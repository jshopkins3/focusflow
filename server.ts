import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import session from "express-session";
import { analyzeEmail, triageEmails, getProjectInsights, getTaskSuggestions } from './src/services/ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("focusflow.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    related_goal TEXT,
    owner TEXT,
    scope TEXT,
    team TEXT,
    purpose TEXT,
    due_date TEXT,
    status TEXT DEFAULT 'Active'
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    project_type TEXT,
    priority TEXT,
    task_type TEXT,
    status TEXT DEFAULT 'To Do',
    connected_project_id INTEGER,
    next_step TEXT,
    due_date TEXT,
    FOREIGN KEY (connected_project_id) REFERENCES projects(id)
  );
`);

// Safe migrations - add columns if they don't exist
const migrations = [
  'ALTER TABLE tasks ADD COLUMN user_email TEXT',
  'ALTER TABLE tasks ADD COLUMN source_email_id TEXT',
  'ALTER TABLE projects ADD COLUMN user_email TEXT',
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (e) { /* column already exists */ }
}

const getRedirectUri = (req: express.Request) => {
  // 1. Try origin from query (passed by frontend)
  let origin = req.query.origin as string;
  
  // 2. Try origin from session (saved during auth start)
  if (!origin && (req as any).session?.authOrigin) {
    origin = (req as any).session.authOrigin;
  }
  
  // 3. Try to reconstruct from headers (useful for status checks)
  if (!origin) {
    const host = req.get('x-forwarded-host') || req.get('host');
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    if (host) {
      origin = `${protocol}://${host}`;
    }
  }
  
  // 4. Fallback to env var or localhost
  origin = origin || process.env.APP_URL || 'http://localhost:3000';
  
  const baseUrl = origin.replace(/\/$/, '');
  return `${baseUrl}/auth/google/callback`;
};

const createOAuthClient = (req: express.Request) => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri(req)
  );
};

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly'
];

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  app.use(express.json());
  app.use(session({
    secret: process.env.SESSION_SECRET || 'focusflow-secret',
    resave: true,
    saveUninitialized: true,
    proxy: true,
    name: 'focusflow.sid',
    cookie: {
      secure: false,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Session Bridge for iframe/popup cookie mismatches
  const oauthBridge = new Map<string, any>();

  // Google Auth Routes
  app.get("/api/auth/google/url", (req, res) => {
    const origin = req.query.origin as string || process.env.APP_URL || 'http://localhost:3000';
    const bridgeId = Math.random().toString(36).substring(2, 15);
    
    const client = createOAuthClient(req);
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: JSON.stringify({ origin, bridgeId }) // Pass both origin and bridgeId
    });
    res.json({ url });
  });

  app.get("/auth/google/callback", async (req, res) => {
    const { code, state } = req.query;
    let origin = process.env.APP_URL || '';
    let bridgeId = '';

    try {
      const stateData = JSON.parse(state as string);
      origin = stateData.origin;
      bridgeId = stateData.bridgeId;
    } catch (e) {
      origin = state as string;
    }
    
    console.log(`[Session: ${req.sessionID}] OAuth callback received. State: ${state}`);
    
    try {
      const stateData = JSON.parse(state as string);
      origin = stateData.origin;
      bridgeId = stateData.bridgeId;
      console.log(`[Session: ${req.sessionID}] Parsed State - Origin: ${origin}, Bridge: ${bridgeId}`);
    } catch (e) {
      origin = state as string;
      console.log(`[Session: ${req.sessionID}] State was not JSON, using as origin: ${origin}`);
    }
    
    const redirectUri = `${origin.replace(/\/$/, '')}/auth/google/callback`;
    console.log(`[Session: ${req.sessionID}] Using Redirect URI: ${redirectUri}`);
    
    try {
      const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      const { tokens } = await client.getToken(code as string);
      console.log(`[Session: ${req.sessionID}] Tokens received`);

      // Extract user info from Google
      client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const userInfo = await oauth2.userinfo.get();
      const userEmail = userInfo.data.email || '';
      const userName = userInfo.data.name || '';
      console.log(`[Session: ${req.sessionID}] User: ${userEmail} (${userName})`);

      // Store tokens + user info in the bridge map for the main window to pick up
      if (bridgeId) {
        oauthBridge.set(bridgeId, { tokens, userEmail, userName });
        // Clean up old bridge entries after 5 mins
        setTimeout(() => oauthBridge.delete(bridgeId), 5 * 60 * 1000);
      }

      (req as any).session.tokens = tokens;
      (req as any).session.userEmail = userEmail;
      (req as any).session.userName = userName;
      (req as any).session.authOrigin = origin;
      
      req.session.save((err) => {
        if (err) {
          console.error(`[Session: ${req.sessionID}] Save error:`, err);
          return res.status(500).send('Session save failed');
        }
        console.log(`[Session: ${req.sessionID}] Session saved`);
        res.send(`
          <html>
            <head>
              <title>Authentication Successful</title>
              <style>
                body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; text-align: center; }
                .card { background: white; padding: 2rem; border-radius: 1rem; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 400px; }
                button { background: #10b981; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: bold; cursor: pointer; margin-top: 1rem; }
              </style>
            </head>
            <body>
              <div class="card">
                <h2>Connection Successful!</h2>
                <p>You can now close this window and return to FocusFlow.</p>
                <div style="margin-top: 1rem; padding: 0.5rem; background: #f1f5f9; border-radius: 0.5rem; font-family: monospace; font-size: 10px; color: #64748b;">
                  Session: ${req.sessionID}
                </div>
                <button onclick="window.close()">Close Window</button>
              </div>
              <script>
                function notifyOpener() {
                  if (window.opener) {
                    console.log('Notifying opener...');
                    window.opener.postMessage({ 
                      type: 'OAUTH_AUTH_SUCCESS',
                      sessionId: '${req.sessionID}',
                      bridgeId: '${bridgeId}'
                    }, '*');
                    // Delay closing to ensure message is sent
                    setTimeout(() => window.close(), 1500);
                  }
                }
                // Try immediately
                notifyOpener();
                // Also try on click just in case
                document.querySelector('button').addEventListener('click', notifyOpener);
              </script>
            </body>
          </html>
        `);
      });
    } catch (error) {
      console.error('Error getting tokens:', error);
      res.status(500).send('Authentication failed');
    }
  });

  app.get("/api/auth/bridge", (req, res) => {
    const { bridgeId } = req.query;
    if (!bridgeId || !oauthBridge.has(bridgeId as string)) {
      console.error(`[Session: ${req.sessionID}] Bridge failed. ID: ${bridgeId}`);
      return res.status(400).json({ error: "Invalid or expired bridge ID" });
    }

    const bridgeData = oauthBridge.get(bridgeId as string);
    (req as any).session.tokens = bridgeData.tokens;
    (req as any).session.userEmail = bridgeData.userEmail;
    (req as any).session.userName = bridgeData.userName;
    oauthBridge.delete(bridgeId as string); // One-time use

    req.session.save((err) => {
      if (err) return res.status(500).json({ error: "Failed to save session" });
      console.log(`[Session: ${req.sessionID}] Bridge success! Tokens claimed.`);
      res.json({ success: true });
    });
  });

  app.get("/api/google/status", (req, res) => {
    try {
      const hasConfig = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
      const connected = !!(req as any).session?.tokens;
      console.log(`[Session: ${req.sessionID}] Status check - Connected: ${connected}`);
      const redirectUri = getRedirectUri(req);
      res.json({ 
        connected, 
        configured: hasConfig, 
        redirectUri,
        sessionId: req.sessionID 
      });
    } catch (error) {
      console.error('Error in /api/google/status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/google/disconnect", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({ error: 'Failed to disconnect' });
      }
      res.json({ success: true });
    });
  });

  // Auth middleware - checks for authenticated user
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!(req as any).session?.userEmail) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  };

  // Current user info
  app.get("/api/auth/me", (req, res) => {
    if (!(req as any).session?.userEmail) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({
      email: (req as any).session.userEmail,
      name: (req as any).session.userName,
      connected: !!(req as any).session.tokens
    });
  });

  app.get("/api/google/data", async (req, res) => {
    const tokens = (req as any).session?.tokens;
    if (!tokens) {
      return res.status(401).json({ error: 'Not connected to Google' });
    }

    const client = createOAuthClient(req);
    client.setCredentials(tokens);
    
    try {
      const calendar = google.calendar({ version: 'v3', auth: client });
      const gmail = google.gmail({ version: 'v1', auth: client });

      const [calendarRes, gmailRes] = await Promise.all([
        calendar.events.list({
          calendarId: 'primary',
          timeMin: new Date().toISOString(),
          maxResults: 5,
          singleEvents: true,
          orderBy: 'startTime',
        }),
        gmail.users.messages.list({
          userId: 'me',
          maxResults: 5,
          q: 'is:unread'
        })
      ]);

      const events = calendarRes.data.items || [];
      const messages = gmailRes.data.messages || [];

      // Fetch message details
      const messageDetails = await Promise.all(
        messages.map(async (msg) => {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!
          });
          const subject = detail.data.payload?.headers?.find(h => h.name === 'Subject')?.value || 'No Subject';
          const from = detail.data.payload?.headers?.find(h => h.name === 'From')?.value || 'Unknown';
          const snippet = detail.data.snippet || '';
          return { id: msg.id, subject, from, snippet };
        })
      );

      res.json({
        events: events.map(e => ({
          id: e.id,
          summary: e.summary,
          start: e.start?.dateTime || e.start?.date,
          location: e.location
        })),
        emails: messageDetails
      });
    } catch (error) {
      console.error('Error fetching Google data:', error);
      res.status(500).json({ error: 'Failed to fetch data' });
    }
  });

  // API Routes
  app.get("/api/projects", requireAuth, (req, res) => {
    const userEmail = (req as any).session.userEmail;
    const projects = db.prepare("SELECT * FROM projects WHERE user_email = ? ORDER BY due_date ASC").all(userEmail);
    res.json(projects);
  });

  app.post("/api/projects", requireAuth, (req, res) => {
    const userEmail = (req as any).session.userEmail;
    const { name, related_goal, owner, scope, team, purpose, due_date, status } = req.body;
    const info = db.prepare(`
      INSERT INTO projects (name, related_goal, owner, scope, team, purpose, due_date, status, user_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, related_goal, owner, scope, team, purpose, due_date, status || 'Active', userEmail);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/projects/:id", requireAuth, (req, res) => {
    const userEmail = (req as any).session.userEmail;
    const { name, related_goal, owner, scope, team, purpose, due_date, status } = req.body;
    db.prepare(`
      UPDATE projects
      SET name = ?, related_goal = ?, owner = ?, scope = ?, team = ?, purpose = ?, due_date = ?, status = ?
      WHERE id = ? AND user_email = ?
    `).run(name, related_goal, owner, scope, team, purpose, due_date, status, req.params.id, userEmail);
    res.json({ success: true });
  });

  app.delete("/api/projects/:id", requireAuth, (req, res) => {
    const userEmail = (req as any).session.userEmail;
    db.prepare("DELETE FROM tasks WHERE connected_project_id = ? AND user_email = ?").run(req.params.id, userEmail);
    db.prepare("DELETE FROM projects WHERE id = ? AND user_email = ?").run(req.params.id, userEmail);
    res.json({ success: true });
  });

  app.get("/api/tasks", requireAuth, (req, res) => {
    const userEmail = (req as any).session.userEmail;
    const tasks = db.prepare(`
      SELECT tasks.*, projects.name as project_name
      FROM tasks
      LEFT JOIN projects ON tasks.connected_project_id = projects.id
      WHERE tasks.user_email = ?
      ORDER BY
        CASE priority
          WHEN 'High' THEN 1
          WHEN 'Medium' THEN 2
          WHEN 'Low' THEN 3
          ELSE 4
        END,
        due_date ASC
    `).all(userEmail);
    res.json(tasks);
  });

  app.post("/api/tasks", requireAuth, (req, res) => {
    const userEmail = (req as any).session.userEmail;
    const { title, project_type, priority, task_type, status, connected_project_id, next_step, due_date, source_email_id } = req.body;
    const info = db.prepare(`
      INSERT INTO tasks (title, project_type, priority, task_type, status, connected_project_id, next_step, due_date, user_email, source_email_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, project_type, priority, task_type, status || 'To Do', connected_project_id, next_step, due_date, userEmail, source_email_id || null);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/tasks/:id", requireAuth, (req, res) => {
    const userEmail = (req as any).session.userEmail;
    const { title, project_type, priority, task_type, status, connected_project_id, next_step, due_date } = req.body;
    db.prepare(`
      UPDATE tasks
      SET title = ?, project_type = ?, priority = ?, task_type = ?, status = ?, connected_project_id = ?, next_step = ?, due_date = ?
      WHERE id = ? AND user_email = ?
    `).run(title, project_type, priority, task_type, status, connected_project_id, next_step, due_date, req.params.id, userEmail);
    res.json({ success: true });
  });

  app.delete("/api/tasks/:id", requireAuth, (req, res) => {
    const userEmail = (req as any).session.userEmail;
    db.prepare("DELETE FROM tasks WHERE id = ? AND user_email = ?").run(req.params.id, userEmail);
    res.json({ success: true });
  });

  // ========== AI Routes ==========

  app.post("/api/ai/analyze-email", requireAuth, async (req, res) => {
    try {
      const { subject, from, snippet } = req.body;
      if (!subject) return res.status(400).json({ error: 'Subject is required' });
      const analysis = await analyzeEmail(subject, from || '', snippet || '');
      res.json(analysis);
    } catch (e) {
      console.error('AI analyze-email error:', e);
      res.status(500).json({ error: 'AI analysis failed' });
    }
  });

  app.post("/api/ai/triage", requireAuth, async (req, res) => {
    try {
      const { emails } = req.body;
      if (!emails || !Array.isArray(emails)) return res.status(400).json({ error: 'Emails array is required' });
      const triaged = await triageEmails(emails);
      res.json(triaged);
    } catch (e) {
      console.error('AI triage error:', e);
      res.status(500).json({ error: 'AI triage failed' });
    }
  });

  app.post("/api/ai/project-insights", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.body;
      const userEmail = (req as any).session.userEmail;
      const project = db.prepare("SELECT * FROM projects WHERE id = ? AND user_email = ?").get(projectId, userEmail) as any;
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const tasks = db.prepare("SELECT * FROM tasks WHERE connected_project_id = ? AND user_email = ?").all(projectId, userEmail) as any[];
      const insights = await getProjectInsights(project, tasks);
      res.json(insights);
    } catch (e) {
      console.error('AI project-insights error:', e);
      res.status(500).json({ error: 'AI insights failed' });
    }
  });

  app.post("/api/ai/task-suggestions", requireAuth, async (req, res) => {
    try {
      const userEmail = (req as any).session.userEmail;
      const tasks = db.prepare(`
        SELECT tasks.*, projects.name as project_name
        FROM tasks
        LEFT JOIN projects ON tasks.connected_project_id = projects.id
        WHERE tasks.user_email = ?
      `).all(userEmail) as any[];
      const suggestions = await getTaskSuggestions(tasks);
      res.json(suggestions);
    } catch (e) {
      console.error('AI task-suggestions error:', e);
      res.status(500).json({ error: 'AI suggestions failed' });
    }
  });

  // 404 for API routes
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
