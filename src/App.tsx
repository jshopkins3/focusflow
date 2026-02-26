import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  LayoutDashboard, 
  ListTodo, 
  FolderKanban, 
  Plus, 
  Search,
  ChevronRight,
  Clock,
  AlertCircle,
  MoreVertical,
  Trash2,
  Edit2,
  ArrowRight,
  Tag,
  Calendar as CalendarIcon,
  Mail,
  Settings,
  ExternalLink,
  RefreshCw,
  Copy,
  LogOut,
  User as UserIcon,
  Sparkles,
  Loader2,
  Wand2,
  Zap,
  Brain,
  XCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, Project, View, GoogleEvent, GoogleEmail, User, EmailAnalysis, TriagedEmail, ProjectInsight, TaskSuggestion } from './types';
import TaskForm from './components/TaskForm';
import ProjectForm from './components/ProjectForm';

export default function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [view, setView] = useState<View>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [editingProject, setEditingProject] = useState<Project | undefined>();

  // Google Integration State
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isGoogleConfigured, setIsGoogleConfigured] = useState(true);
  const [redirectUri, setRedirectUri] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessionMismatch, setSessionMismatch] = useState(false);
  const [googleData, setGoogleData] = useState<{ events: GoogleEvent[], emails: GoogleEmail[] }>({ events: [], emails: [] });
  const [isFetchingGoogle, setIsFetchingGoogle] = useState(false);

  // AI State
  const [isAnalyzingEmail, setIsAnalyzingEmail] = useState<string | null>(null); // email ID being analyzed
  const [isTriaging, setIsTriaging] = useState(false);
  const [triagedEmails, setTriagedEmails] = useState<TriagedEmail[]>([]);
  const [projectInsight, setProjectInsight] = useState<ProjectInsight | null>(null);
  const [insightProjectId, setInsightProjectId] = useState<number | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [taskSuggestions, setTaskSuggestions] = useState<TaskSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Reflection State
  const [todayReflection, setTodayReflection] = useState<{ id: number; date: string; mood: number; gratitude: string } | null>(null);
  const [reflectionMood, setReflectionMood] = useState<number>(0);
  const [reflectionGratitude, setReflectionGratitude] = useState('');
  const [isEditingReflection, setIsEditingReflection] = useState(false);
  const [reflectionStreak, setReflectionStreak] = useState(0);
  const [isSavingReflection, setIsSavingReflection] = useState(false);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        return true;
      }
      setUser(null);
      return false;
    } catch {
      setUser(null);
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/projects')
      ]);
      if (tasksRes.status === 401 || projectsRes.status === 401) {
        setUser(null);
        return;
      }
      const [tasksData, projectsData] = await Promise.all([
        tasksRes.json(),
        projectsRes.json()
      ]);
      setTasks(tasksData);
      setProjects(projectsData);
    } catch (e) {
      console.error('Failed to fetch data:', e);
    }
  };

  const fetchReflection = async () => {
    try {
      const [todayRes, historyRes] = await Promise.all([
        fetch('/api/reflections/today'),
        fetch('/api/reflections')
      ]);
      const todayData = await todayRes.json();
      const historyData = await historyRes.json();
      if (todayData) {
        setTodayReflection(todayData);
        setReflectionMood(todayData.mood);
        setReflectionGratitude(todayData.gratitude || '');
      }
      // Calculate streak
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < historyData.length; i++) {
        const expected = new Date(today);
        expected.setDate(expected.getDate() - i);
        const expectedStr = expected.toISOString().split('T')[0];
        if (historyData[i]?.date === expectedStr) {
          streak++;
        } else {
          break;
        }
      }
      setReflectionStreak(streak);
    } catch (e) {
      console.error('Failed to fetch reflection:', e);
    }
  };

  const saveReflection = async () => {
    if (!reflectionMood) return;
    setIsSavingReflection(true);
    try {
      const res = await fetch('/api/reflections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: reflectionMood, gratitude: reflectionGratitude })
      });
      const data = await res.json();
      setTodayReflection(data);
      setIsEditingReflection(false);
      fetchReflection(); // refresh streak
    } catch (e) {
      console.error('Failed to save reflection:', e);
    } finally {
      setIsSavingReflection(false);
    }
  };

  const fetchGoogleStatus = async () => {
    try {
      console.log('FocusFlow: Fetching Google status...');
      const res = await fetch('/api/google/status');
      if (!res.ok) {
        const text = await res.text();
        console.error('Google status fetch failed:', res.status, text);
        return;
      }
      const data = await res.json();
      console.log('FocusFlow: Status received:', data);
      setIsGoogleConnected(data.connected);
      setIsGoogleConfigured(data.configured);
      setRedirectUri(data.redirectUri);
      setSessionId(data.sessionId);
      if (data.connected) {
        console.log('FocusFlow: Connected! Fetching data...');
        fetchGoogleData();
      }
    } catch (e) {
      console.error('Failed to fetch google status', e);
    }
  };

  const fetchGoogleData = async () => {
    setIsFetchingGoogle(true);
    try {
      const res = await fetch('/api/google/data');
      if (res.ok) {
        const data = await res.json();
        setGoogleData(data);
      } else {
        const text = await res.text();
        console.error('Google data fetch failed:', res.status, text);
      }
    } catch (e) {
      console.error('Failed to fetch google data', e);
    } finally {
      setIsFetchingGoogle(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const isAuthed = await checkAuth();
      if (isAuthed) {
        fetchData();
        fetchReflection();
        fetchGoogleStatus();
      }
    };
    init();

    const handleMessage = async (event: MessageEvent) => {
      console.log('FocusFlow: Message received', event.data);
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        console.log('FocusFlow: OAuth Success detected, checking for bridge...');

        const { bridgeId, sessionId: popupSessionId } = event.data;

        // If we have a bridgeId, we need to "claim" the tokens for our current session
        if (bridgeId) {
          console.log('FocusFlow: Attempting session bridge...', { bridgeId });
          try {
            const bridgeRes = await fetch(`/api/auth/bridge?bridgeId=${bridgeId}`);
            if (bridgeRes.ok) {
              console.log('FocusFlow: Bridge successful!');
              setSessionMismatch(false);
              // Re-check auth to pick up user info from the bridge
              const isAuthed = await checkAuth();
              if (isAuthed) {
                fetchData();
              }
            } else {
              console.error('FocusFlow: Bridge failed');
            }
          } catch (e) {
            console.error('FocusFlow: Bridge error', e);
          }
        } else if (popupSessionId && sessionId && popupSessionId !== sessionId) {
          // Fallback mismatch detection if bridge wasn't used
          console.warn('FocusFlow: Session mismatch detected!', { current: sessionId, popup: popupSessionId });
          setSessionMismatch(true);
        }

        // Refresh status to see if we are now connected
        setTimeout(() => {
          fetchGoogleStatus();
        }, 500);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const handleConnectGoogle = async () => {
    try {
      const origin = window.location.origin;
      const res = await fetch(`/api/auth/google/url?origin=${encodeURIComponent(origin)}`);
      const { url } = await res.json();
      if (isMobile) {
        window.location.href = url; // Redirect on mobile (popups are blocked)
      } else {
        window.open(url, 'google_oauth', 'width=600,height=700');
      }
    } catch (e) {
      console.error('Failed to get auth url', e);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await fetch('/api/google/disconnect', { method: 'POST' });
      setIsGoogleConnected(false);
      setGoogleData({ events: [], emails: [] });
    } catch (e) {
      console.error('Failed to disconnect', e);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/google/disconnect', { method: 'POST' });
    } catch (e) {
      // ignore
    }
    setUser(null);
    setIsGoogleConnected(false);
    setGoogleData({ events: [], emails: [] });
    setTasks([]);
    setProjects([]);
  };

  // AI Handlers
  const handleCreateTaskFromEmail = async (email: GoogleEmail) => {
    setIsAnalyzingEmail(email.id);
    try {
      const res = await fetch('/api/ai/analyze-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: email.subject, from: email.from, snippet: email.snippet || '' })
      });
      if (!res.ok) throw new Error('Analysis failed');
      const analysis: EmailAnalysis = await res.json();
      setEditingTask({
        title: analysis.suggestedTitle,
        priority: analysis.suggestedPriority,
        task_type: analysis.suggestedType,
        next_step: analysis.suggestedNextStep,
        status: 'To Do',
        project_type: '',
        connected_project_id: null,
        due_date: new Date().toISOString().split('T')[0],
        source_email_id: email.id
      } as Task);
      setShowTaskForm(true);
    } catch (e) {
      console.error('Failed to analyze email:', e);
      // Fallback: open form with basic info
      setEditingTask({
        title: `Follow up: ${email.subject}`,
        priority: 'Medium',
        task_type: 'Email',
        next_step: '',
        status: 'To Do',
        project_type: '',
        connected_project_id: null,
        due_date: new Date().toISOString().split('T')[0],
        source_email_id: email.id
      } as Task);
      setShowTaskForm(true);
    } finally {
      setIsAnalyzingEmail(null);
    }
  };

  const handleTriageEmails = async () => {
    if (googleData.emails.length === 0) return;
    setIsTriaging(true);
    try {
      const res = await fetch('/api/ai/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: googleData.emails })
      });
      if (!res.ok) throw new Error('Triage failed');
      const triaged: TriagedEmail[] = await res.json();
      setTriagedEmails(triaged);
    } catch (e) {
      console.error('Failed to triage emails:', e);
    } finally {
      setIsTriaging(false);
    }
  };

  const handleGetProjectInsights = async (projectId: number) => {
    setInsightProjectId(projectId);
    setIsLoadingInsight(true);
    try {
      const res = await fetch('/api/ai/project-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      if (!res.ok) throw new Error('Insights failed');
      const insight: ProjectInsight = await res.json();
      setProjectInsight(insight);
    } catch (e) {
      console.error('Failed to get insights:', e);
      setProjectInsight(null);
    } finally {
      setIsLoadingInsight(false);
    }
  };

  const handleGetTaskSuggestions = async () => {
    setIsLoadingSuggestions(true);
    try {
      const res = await fetch('/api/ai/task-suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) throw new Error('Suggestions failed');
      const suggestions: TaskSuggestion[] = await res.json();
      setTaskSuggestions(suggestions);
    } catch (e) {
      console.error('Failed to get suggestions:', e);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const getTriageCategory = (emailId: string) => {
    return triagedEmails.find(t => t.id === emailId);
  };

  const getTriageBadgeColor = (category: string) => {
    switch (category) {
      case 'Action Required': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Follow-up': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'FYI': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Low Priority': return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const toggleTaskStatus = async (task: Task) => {
    const nextStatus = task.status === 'Done' ? 'To Do' : 'Done';
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, status: nextStatus })
    });
    fetchData();
  };

  const deleteTask = async (id: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const deleteProject = async (id: number) => {
    if (!confirm('Deleting a project will also delete all its tasks. Continue?')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.project_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'text-rose-500 bg-rose-50 border-rose-100';
      case 'Medium': return 'text-amber-500 bg-amber-50 border-amber-100';
      case 'Low': return 'text-emerald-500 bg-emerald-50 border-emerald-100';
      default: return 'text-slate-500 bg-slate-50 border-slate-100';
    }
  };

  const NavItem = ({ id, icon: Icon, label }: { id: View, icon: any, label: string }) => (
    <button 
      onClick={() => setView(id)}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
        view === id 
          ? 'bg-primary text-white shadow-lg shadow-emerald-200' 
          : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  // Loading screen while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 mx-auto mb-6">
            <CheckCircle2 size={32} />
          </div>
          <div className="animate-pulse text-slate-400 font-medium">Loading FocusFlow...</div>
        </div>
      </div>
    );
  }

  // Login gate - show sign-in page if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="bg-white rounded-[2rem] shadow-2xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">FocusFlow</h1>
          <p className="text-slate-500 mb-8">Task management powered by AI for Anchor Mortgage</p>
          <button
            onClick={handleConnectGoogle}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-lg"
          >
            <Mail size={20} />
            Sign in with Google
          </button>
          <p className="text-xs text-slate-400 mt-4">
            Connects your Google Calendar and Gmail for a seamless workflow.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 p-6 border-r border-slate-200 bg-white">
        <div className="mb-10 flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <CheckCircle2 size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">FocusFlow</h1>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem id="tasks" icon={ListTodo} label="Tasks" />
          <NavItem id="projects" icon={FolderKanban} label="Projects" />
          <NavItem id="calendar" icon={CalendarIcon} label="Calendar" />
          <NavItem id="integrations" icon={Settings} label="Integrations" />
        </nav>

        <div className="mt-auto space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                <UserIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-700 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-bg overflow-hidden">
        {/* Header */}
        <header className="p-4 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-sm border-b border-slate-200">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 capitalize">
              {view === 'dashboard' ? `Welcome, ${user.name.split(' ')[0]}` : view}
            </h2>
            <p className="text-slate-500">
              {view === 'tasks' ? `${tasks.filter(t => t.status !== 'Done').length} tasks remaining` : 
               view === 'projects' ? `${projects.length} active projects` : 
               view === 'integrations' ? 'Connect your external tools' :
               "Here's what's happening today"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                id="task-search"
                name="task-search"
                type="text" 
                placeholder="Search..." 
                className="input-field pl-10"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            {(view === 'tasks' || view === 'projects' || view === 'calendar') && (
              <button 
                onClick={() => view === 'projects' ? setShowProjectForm(true) : setShowTaskForm(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Add New</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            {view === 'tasks' && (
              <motion.div
                key="tasks"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 max-w-4xl mx-auto"
              >
                {/* AI Suggestions Panel */}
                {tasks.filter(t => t.status !== 'Done').length > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <div />
                    <button
                      onClick={handleGetTaskSuggestions}
                      disabled={isLoadingSuggestions}
                      className="flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      {isLoadingSuggestions ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                      {isLoadingSuggestions ? 'Thinking...' : 'AI Prioritize'}
                    </button>
                  </div>
                )}

                {taskSuggestions.length > 0 && (
                  <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-violet-800 flex items-center gap-2">
                        <Sparkles size={16} /> AI Recommended Order
                      </h4>
                      <button onClick={() => setTaskSuggestions([])} className="p-1 text-violet-400 hover:text-violet-600"><XCircle size={16} /></button>
                    </div>
                    <div className="space-y-2">
                      {taskSuggestions.map((s, i) => (
                        <div key={s.taskId} className="flex items-start gap-3 text-sm">
                          <span className="shrink-0 w-6 h-6 bg-violet-200 text-violet-700 rounded-full flex items-center justify-center text-xs font-black">{i + 1}</span>
                          <div>
                            <p className="font-bold text-violet-900">{s.title}</p>
                            <p className="text-xs text-violet-600">{s.reasoning}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {filteredTasks.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                      <ListTodo size={40} />
                    </div>
                    <h3 className="text-lg font-medium text-slate-600">No tasks found</h3>
                    <p className="text-slate-400">Time to add something to your list!</p>
                  </div>
                ) : (
                  filteredTasks.map(task => (
                    <div 
                      key={task.id}
                      className="group bg-white p-4 md:p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-start gap-4"
                    >
                      <button 
                        onClick={() => toggleTaskStatus(task)}
                        className={`mt-1 transition-colors ${task.status === 'Done' ? 'text-primary' : 'text-slate-300 hover:text-slate-400'}`}
                      >
                        {task.status === 'Done' ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className={`text-lg font-semibold truncate ${task.status === 'Done' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                            {task.title}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                          {task.project_name && (
                            <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              {task.project_name}
                            </span>
                          )}
                        </div>
                        
                        {task.next_step && (
                          <p className="text-slate-500 text-sm mb-3 flex items-center gap-2">
                            <ArrowRight size={14} className="text-primary" />
                            {task.next_step}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Clock size={14} />
                            {task.due_date}
                          </div>
                          {task.task_type && (
                            <div className="flex items-center gap-1.5">
                              <Tag size={14} />
                              {task.task_type}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditingTask(task); setShowTaskForm(true); }}
                          className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => deleteTask(task.id!)}
                          className="p-2 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {view === 'calendar' && (
              <motion.div 
                key="calendar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-6xl mx-auto"
              >
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-800">Upcoming Schedule</h3>
                    {isGoogleConnected && (
                      <button 
                        onClick={fetchGoogleData}
                        disabled={isFetchingGoogle}
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-all disabled:opacity-50"
                      >
                        <RefreshCw size={18} className={isFetchingGoogle ? 'animate-spin' : ''} />
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                    <div className="p-6 space-y-6">
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ListTodo size={16} /> Task Deadlines
                      </h4>
                      <div className="space-y-4">
                        {tasks.filter(t => t.status !== 'Done').sort((a,b) => a.due_date.localeCompare(b.due_date)).map(task => (
                          <div key={task.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                            <div className="w-12 text-center">
                              <p className="text-xs font-bold text-slate-400">{task.due_date.split('-')[1]}/{task.due_date.split('-')[2]}</p>
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-slate-700">{task.title}</p>
                              <p className="text-xs text-slate-400">{task.project_name || 'No Project'}</p>
                            </div>
                            <div className={`w-2 h-2 rounded-full ${
                              task.priority === 'High' ? 'bg-rose-400' : 
                              task.priority === 'Medium' ? 'bg-amber-400' : 'bg-emerald-400'
                            }`} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <CalendarIcon size={16} /> Google Calendar
                      </h4>
                      {!isGoogleConnected ? (
                        <div className="text-center py-10">
                          <p className="text-slate-400 text-sm mb-4">Connect your Google account to see your events.</p>
                          <button onClick={() => setView('integrations')} className="btn-secondary text-xs">Go to Integrations</button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {googleData.events.length === 0 ? (
                            <p className="text-slate-400 text-sm text-center py-10">No upcoming events found.</p>
                          ) : (
                            googleData.events.map(event => (
                              <div key={event.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                                <div className="w-12 text-center">
                                  <p className="text-xs font-bold text-primary">
                                    {new Date(event.start).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                                  </p>
                                </div>
                                <div className="flex-1">
                                  <p className="font-bold text-slate-700">{event.summary}</p>
                                  <p className="text-xs text-slate-400">
                                    {new Date(event.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                    {event.location && ` • ${event.location}`}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'integrations' && (
              <motion.div 
                key="integrations"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                  <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Connection Debugger</p>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${sessionId ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <p className="text-[10px] text-slate-500 font-medium">{sessionId ? 'Session Active' : 'No Session'}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl font-mono text-[10px] text-slate-500 break-all select-all flex justify-between items-center gap-2">
                      <span>{sessionId || 'Waiting for session...'}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchGoogleStatus();
                        }}
                        className="p-1 hover:bg-slate-100 rounded transition-colors"
                        title="Refresh Session"
                      >
                        <RefreshCw size={12} className={isFetchingGoogle ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    {sessionMismatch && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                        <AlertCircle className="text-red-500 shrink-0" size={14} />
                        <p className="text-[10px] text-red-700 leading-tight">
                          <strong>Session Mismatch!</strong> Your browser blocked the connection cookie. 
                          <button 
                            onClick={() => window.open(window.location.href, '_blank')}
                            className="ml-1 text-red-800 hover:underline font-bold"
                          >
                            Click here to open in a new tab
                          </button> to fix this.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-[1.5rem] flex items-center justify-center">
                        <Mail size={32} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">Google Workspace</h3>
                        <p className="text-slate-500">Sync your calendar and emails</p>
                      </div>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-xs font-bold ${isGoogleConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {isGoogleConnected ? 'Connected' : 'Not Connected'}
                    </div>
                  </div>

                  {!isGoogleConfigured && (
                    <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                      <AlertCircle className="text-amber-500 shrink-0" size={20} />
                      <div>
                        <p className="text-sm font-bold text-amber-800">Missing Configuration</p>
                        <p className="text-xs text-amber-700">Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment variables.</p>
                      </div>
                    </div>
                  )}

                  {isGoogleConfigured && !isGoogleConnected && (
                    <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-[1.5rem]">
                      <div className="flex items-center gap-2 mb-2">
                        <Settings className="text-blue-600" size={18} />
                        <p className="text-sm font-bold text-blue-800">Google Cloud Setup</p>
                      </div>
                      <p className="text-xs text-blue-700 mb-4 leading-relaxed">
                        Google requires you to register the exact URL below. If you see a <strong className="text-blue-900">"redirect_uri_mismatch"</strong> error, it means you need to copy this URL into your Google Cloud Console's "Authorized redirect URIs" list.
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-3 bg-white border border-blue-100 rounded-xl text-[10px] font-mono break-all text-blue-600 select-all">
                          {redirectUri || 'Loading URL...'}
                        </code>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(redirectUri);
                            alert('URL copied to clipboard!');
                          }}
                          className="p-3 bg-white border border-blue-100 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Copy URL"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                      <p className="mt-3 text-[10px] text-blue-500 italic">
                        Note: This URL changes whenever the app is updated. You must update it in Google Console each time.
                      </p>
                    </div>
                  )}

                  <div className="space-y-4 mb-8">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="text-primary mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-700">Calendar Sync</p>
                        <p className="text-sm text-slate-500">See your upcoming meetings alongside your tasks.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="text-primary mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-700">Gmail Integration</p>
                        <p className="text-sm text-slate-500">Track unread emails that might need your attention.</p>
                      </div>
                    </div>
                  </div>

                  {!isGoogleConnected ? (
                    <button 
                      onClick={handleConnectGoogle}
                      disabled={!isGoogleConfigured}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ExternalLink size={20} />
                      Connect Google Account
                    </button>
                  ) : (
                    <div className="flex gap-3">
                      <button 
                        onClick={handleDisconnectGoogle}
                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
                      >
                        Disconnect
                      </button>
                      <button 
                        onClick={fetchGoogleData}
                        className="px-6 py-4 bg-primary text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-600 transition-colors"
                      >
                        <RefreshCw size={20} />
                        Sync Now
                      </button>
                    </div>
                  )}
                </div>

                {/* Emails Panel - shown when connected */}
                {isGoogleConnected && googleData.emails.length > 0 && (
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Mail size={20} className="text-blue-500" />
                        Unread Emails ({googleData.emails.length})
                      </h3>
                      <button
                        onClick={handleTriageEmails}
                        disabled={isTriaging}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                      >
                        {isTriaging ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
                        {isTriaging ? 'Analyzing...' : 'AI Triage'}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {googleData.emails.map(email => {
                        const triage = getTriageCategory(email.id);
                        return (
                          <div key={email.id} className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 group/email hover:border-slate-200 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-xs font-bold text-slate-400 truncate">{email.from}</p>
                                {triage && (
                                  <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-lg border ${getTriageBadgeColor(triage.category)}`}>
                                    {triage.category}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-slate-700">{email.subject}</h4>
                              {email.snippet && (
                                <p className="text-xs text-slate-400 mt-1 line-clamp-1">{email.snippet}</p>
                              )}
                              {triage && (
                                <p className="text-[10px] text-slate-400 mt-1 italic">{triage.reason}</p>
                              )}
                            </div>
                            <button
                              onClick={() => handleCreateTaskFromEmail(email)}
                              disabled={isAnalyzingEmail === email.id}
                              className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-500 hover:text-primary hover:border-emerald-200 hover:bg-emerald-50 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                            >
                              {isAnalyzingEmail === email.id ? (
                                <><Loader2 size={14} className="animate-spin" /> Analyzing...</>
                              ) : (
                                <><Wand2 size={14} /> Create Task</>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="bg-slate-900 p-8 rounded-[2rem] text-white">
                  <h3 className="text-xl font-bold mb-2">Privacy First</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    FocusFlow only requests read-only access to your calendar and emails.
                    We do not store your emails or calendar events on our servers.
                  </p>
                </div>
              </motion.div>
            )}

            {view === 'projects' && (
              <motion.div 
                key="projects"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto"
              >
                {filteredProjects.length === 0 ? (
                  <div className="col-span-full text-center py-20">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                      <FolderKanban size={40} />
                    </div>
                    <h3 className="text-lg font-medium text-slate-600">No projects yet</h3>
                    <p className="text-slate-400">Organize your big ideas into projects.</p>
                  </div>
                ) : (
                  filteredProjects.map(project => (
                    <div 
                      key={project.id}
                      className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-lg transition-all flex flex-col"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                          <FolderKanban size={24} />
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleGetProjectInsights(project.id!)}
                            disabled={isLoadingInsight && insightProjectId === project.id}
                            className="p-2 hover:bg-violet-50 rounded-xl text-slate-400 hover:text-violet-600 transition-colors disabled:opacity-50"
                            title="Get AI Insights"
                          >
                            {isLoadingInsight && insightProjectId === project.id ? <Loader2 size={18} className="animate-spin" /> : <Brain size={18} />}
                          </button>
                          <button
                            onClick={() => { setEditingProject(project); setShowProjectForm(true); }}
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => deleteProject(project.id!)}
                            className="p-2 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-slate-800 mb-2">{project.name}</h3>
                      <p className="text-slate-500 text-sm mb-6 line-clamp-2 flex-1">
                        {project.purpose || "No purpose defined for this project."}
                      </p>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Owner</p>
                          <p className="text-sm font-semibold text-slate-700 truncate">{project.owner || 'Unassigned'}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Due Date</p>
                          <p className="text-sm font-semibold text-slate-700">{project.due_date}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          project.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                          project.status === 'On Hold' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {project.status}
                        </span>
                        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                          <ListTodo size={14} />
                          {tasks.filter(t => t.connected_project_id === project.id).length} Tasks
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {view === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8 max-w-6xl mx-auto"
              >
                {/* Daily Reflection */}
                <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 p-6 rounded-[2rem] border border-amber-200/50 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">☀️</span>
                      <h3 className="font-bold text-slate-800 text-lg">Daily Reflection</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {reflectionStreak > 0 && (
                        <span className="text-sm font-bold text-amber-600 bg-amber-100 px-3 py-1 rounded-full">
                          🔥 {reflectionStreak} day{reflectionStreak !== 1 ? 's' : ''}
                        </span>
                      )}
                      {todayReflection && !isEditingReflection && (
                        <button
                          onClick={() => setIsEditingReflection(true)}
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {(!todayReflection || isEditingReflection) ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-600 mb-3">How are you feeling this morning?</p>
                        <div className="flex gap-3">
                          {[
                            { value: 1, emoji: '😫', label: 'Rough' },
                            { value: 2, emoji: '😕', label: 'Meh' },
                            { value: 3, emoji: '😐', label: 'Okay' },
                            { value: 4, emoji: '🙂', label: 'Good' },
                            { value: 5, emoji: '😄', label: 'Great' },
                          ].map(({ value, emoji, label }) => (
                            <motion.button
                              key={value}
                              whileHover={{ scale: 1.15 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setReflectionMood(value)}
                              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                                reflectionMood === value
                                  ? 'bg-white shadow-md ring-2 ring-emerald-400 scale-110'
                                  : 'hover:bg-white/60'
                              }`}
                            >
                              <span className="text-2xl">{emoji}</span>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-600 mb-2">What are you most grateful for from yesterday?</p>
                        <textarea
                          value={reflectionGratitude}
                          onChange={(e) => setReflectionGratitude(e.target.value)}
                          placeholder="I'm grateful for..."
                          className="w-full bg-white/70 border border-amber-200 rounded-xl p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent resize-none"
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={saveReflection}
                          disabled={!reflectionMood || isSavingReflection}
                          className="px-5 py-2 bg-emerald-500 text-white font-bold text-sm rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSavingReflection ? 'Saving...' : todayReflection ? 'Update' : 'Save Reflection'}
                        </button>
                        {isEditingReflection && (
                          <button
                            onClick={() => {
                              setIsEditingReflection(false);
                              if (todayReflection) {
                                setReflectionMood(todayReflection.mood);
                                setReflectionGratitude(todayReflection.gratitude || '');
                              }
                            }}
                            className="px-4 py-2 text-slate-500 font-bold text-sm rounded-xl hover:bg-white/60 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <span className="text-4xl">
                        {['', '😫', '😕', '😐', '🙂', '😄'][todayReflection.mood]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">
                          {['', 'Rough', 'Meh', 'Okay', 'Good', 'Great'][todayReflection.mood]} morning
                        </p>
                        {todayReflection.gratitude && (
                          <p className="text-slate-700 text-sm leading-relaxed">
                            "{todayReflection.gratitude}"
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center">
                        <AlertCircle size={20} />
                      </div>
                      <h3 className="font-bold text-slate-700">High Priority</h3>
                    </div>
                    <p className="text-3xl font-black text-slate-800">
                      {tasks.filter(t => t.priority === 'High' && t.status !== 'Done').length}
                    </p>
                    <p className="text-sm text-slate-400 font-medium">Tasks needing attention</p>
                  </div>

                  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                        <CheckCircle2 size={20} />
                      </div>
                      <h3 className="font-bold text-slate-700">Completed</h3>
                    </div>
                    <p className="text-3xl font-black text-slate-800">
                      {tasks.filter(t => t.status === 'Done').length}
                    </p>
                    <p className="text-sm text-slate-400 font-medium">Tasks finished this week</p>
                  </div>

                  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                        <FolderKanban size={20} />
                      </div>
                      <h3 className="font-bold text-slate-700">Active Projects</h3>
                    </div>
                    <p className="text-3xl font-black text-slate-800">
                      {projects.filter(p => p.status === 'Active').length}
                    </p>
                    <p className="text-sm text-slate-400 font-medium">Currently in progress</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-800 px-2">Upcoming Tasks</h3>
                      <div className="space-y-3">
                        {tasks.filter(t => t.status !== 'Done').slice(0, 5).map(task => (
                          <div key={task.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 shadow-sm">
                            <div className={`w-2 h-10 rounded-full ${
                              task.priority === 'High' ? 'bg-rose-400' : 
                              task.priority === 'Medium' ? 'bg-amber-400' : 'bg-emerald-400'
                            }`} />
                            <div className="flex-1">
                              <h4 className="font-bold text-slate-700 truncate">{task.title}</h4>
                              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{task.due_date}</p>
                            </div>
                            <ChevronRight size={18} className="text-slate-300" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-800 px-2">Project Progress</h3>
                      <div className="space-y-3">
                        {projects.slice(0, 5).map(project => {
                          const projectTasks = tasks.filter(t => t.connected_project_id === project.id);
                          const completed = projectTasks.filter(t => t.status === 'Done').length;
                          const total = projectTasks.length;
                          const progress = total === 0 ? 0 : (completed / total) * 100;

                          return (
                            <div key={project.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="font-bold text-slate-700">{project.name}</h4>
                                <span className="text-xs font-black text-primary">{Math.round(progress)}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  className="h-full bg-primary"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-800 px-2 flex items-center gap-2">
                        <Mail size={18} className="text-blue-500" /> Recent Emails
                      </h3>
                      {!isGoogleConnected ? (
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 text-center">
                          <p className="text-xs text-slate-400 mb-3">Connect Google to see unread emails.</p>
                          <button onClick={() => setView('integrations')} className="text-xs font-bold text-primary">Connect Now</button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {googleData.emails.length === 0 ? (
                            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 text-center">
                              <p className="text-xs text-slate-400">No unread emails!</p>
                            </div>
                          ) : (
                            googleData.emails.map(email => {
                              const triage = getTriageCategory(email.id);
                              return (
                                <div key={email.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm group/email">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-slate-400 truncate mb-1">{email.from}</p>
                                      <h4 className="text-sm font-bold text-slate-700 truncate">{email.subject}</h4>
                                      {triage && (
                                        <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-lg border ${getTriageBadgeColor(triage.category)}`}>
                                          {triage.category}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => handleCreateTaskFromEmail(email)}
                                      disabled={isAnalyzingEmail === email.id}
                                      className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-primary hover:bg-emerald-50 transition-all opacity-0 group-hover/email:opacity-100 disabled:opacity-100"
                                      title="Create task from email"
                                    >
                                      {isAnalyzingEmail === email.id ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-800 px-2 flex items-center gap-2">
                        <CalendarIcon size={18} className="text-primary" /> Today's Events
                      </h3>
                      {!isGoogleConnected ? (
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 text-center">
                          <p className="text-xs text-slate-400 mb-3">Connect Google to see your schedule.</p>
                          <button onClick={() => setView('integrations')} className="text-xs font-bold text-primary">Connect Now</button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {googleData.events.length === 0 ? (
                            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 text-center">
                              <p className="text-xs text-slate-400">No events today.</p>
                            </div>
                          ) : (
                            googleData.events.map(event => (
                              <div key={event.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                                <div className="w-1 h-8 bg-primary rounded-full" />
                                <div className="min-w-0">
                                  <h4 className="text-sm font-bold text-slate-700 truncate">{event.summary}</h4>
                                  <p className="text-[10px] font-bold text-slate-400">
                                    {new Date(event.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden flex justify-around p-4 bg-white border-t border-slate-200 sticky bottom-0 z-40">
        <button onClick={() => setView('dashboard')} className={`p-2 rounded-xl ${view === 'dashboard' ? 'text-primary bg-emerald-50' : 'text-slate-400'}`}>
          <LayoutDashboard size={24} />
        </button>
        <button onClick={() => setView('tasks')} className={`p-2 rounded-xl ${view === 'tasks' ? 'text-primary bg-emerald-50' : 'text-slate-400'}`}>
          <ListTodo size={24} />
        </button>
        <button onClick={() => setView('calendar')} className={`p-2 rounded-xl ${view === 'calendar' ? 'text-primary bg-emerald-50' : 'text-slate-400'}`}>
          <CalendarIcon size={24} />
        </button>
        <button onClick={() => setView('integrations')} className={`p-2 rounded-xl ${view === 'integrations' ? 'text-primary bg-emerald-50' : 'text-slate-400'}`}>
          <Settings size={24} />
        </button>
      </nav>

      {/* AI Insights Modal */}
      <AnimatePresence>
        {projectInsight && insightProjectId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setProjectInsight(null); setInsightProjectId(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-violet-50">
                <h2 className="text-lg font-bold text-violet-900 flex items-center gap-2">
                  <Sparkles size={20} /> AI Project Insights
                </h2>
                <button onClick={() => { setProjectInsight(null); setInsightProjectId(null); }} className="p-2 hover:bg-violet-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <p className="text-sm font-bold text-slate-700 mb-1">Summary</p>
                  <p className="text-sm text-slate-600">{projectInsight.summary}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700 mb-1">Progress Assessment</p>
                  <p className="text-sm text-slate-600">{projectInsight.progressAssessment}</p>
                </div>
                {projectInsight.risks.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-rose-700 mb-1">Risks</p>
                    <ul className="space-y-1">
                      {projectInsight.risks.map((r, i) => (
                        <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                          <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {projectInsight.suggestions.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-emerald-700 mb-1">Suggestions</p>
                    <ul className="space-y-1">
                      {projectInsight.suggestions.map((s, i) => (
                        <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Forms */}
      <AnimatePresence>
        {showTaskForm && (
          <TaskForm 
            projects={projects}
            initialTask={editingTask}
            onClose={() => { setShowTaskForm(false); setEditingTask(undefined); }}
            onSave={() => { setShowTaskForm(false); setEditingTask(undefined); fetchData(); }}
          />
        )}
        {showProjectForm && (
          <ProjectForm 
            initialProject={editingProject}
            onClose={() => { setShowProjectForm(false); setEditingProject(undefined); }}
            onSave={() => { setShowProjectForm(false); setEditingProject(undefined); fetchData(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
