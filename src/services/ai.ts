import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface EmailAnalysis {
  suggestedTitle: string;
  suggestedPriority: 'High' | 'Medium' | 'Low' | 'None';
  suggestedType: string;
  suggestedNextStep: string;
  category: 'Action Required' | 'Follow-up' | 'FYI' | 'Low Priority';
}

export interface TriagedEmail {
  id: string;
  subject: string;
  from: string;
  category: 'Action Required' | 'Follow-up' | 'FYI' | 'Low Priority';
  reason: string;
  urgency: number; // 1-5
}

export interface ProjectInsight {
  summary: string;
  progressAssessment: string;
  risks: string[];
  suggestions: string[];
}

export interface TaskSuggestion {
  taskId: number;
  title: string;
  suggestedOrder: number;
  reasoning: string;
}

export async function analyzeEmail(
  subject: string,
  from: string,
  snippet: string
): Promise<EmailAnalysis> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Analyze this email and suggest how to convert it into an actionable task.

Email Subject: ${subject}
From: ${from}
Preview: ${snippet}

Respond in JSON format only, no markdown:
{
  "suggestedTitle": "concise task title",
  "suggestedPriority": "High|Medium|Low|None",
  "suggestedType": "Email|Call|Review|Meeting|Document|Other",
  "suggestedNextStep": "specific next action to take",
  "category": "Action Required|Follow-up|FYI|Low Priority"
}`
      }
    ]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    return JSON.parse(text);
  } catch {
    return {
      suggestedTitle: `Follow up: ${subject}`,
      suggestedPriority: 'Medium',
      suggestedType: 'Email',
      suggestedNextStep: 'Review and respond to this email',
      category: 'Follow-up'
    };
  }
}

export async function triageEmails(
  emails: Array<{ id: string; subject: string; from: string; snippet: string }>
): Promise<TriagedEmail[]> {
  if (emails.length === 0) return [];

  const emailList = emails
    .map((e, i) => `${i + 1}. Subject: ${e.subject}\n   From: ${e.from}\n   Preview: ${e.snippet}`)
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Categorize and prioritize these emails for a mortgage company employee.

${emailList}

Respond in JSON format only, no markdown. Return an array:
[
  {
    "index": 1,
    "category": "Action Required|Follow-up|FYI|Low Priority",
    "reason": "brief reason",
    "urgency": 1-5
  }
]`
      }
    ]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    const results = JSON.parse(text);
    return results.map((r: any) => {
      const email = emails[r.index - 1];
      return {
        id: email.id,
        subject: email.subject,
        from: email.from,
        category: r.category,
        reason: r.reason,
        urgency: r.urgency
      };
    });
  } catch {
    return emails.map(e => ({
      id: e.id,
      subject: e.subject,
      from: e.from,
      category: 'FYI' as const,
      reason: 'Unable to categorize',
      urgency: 3
    }));
  }
}

export async function getProjectInsights(
  project: { name: string; purpose: string; status: string; due_date: string; owner: string },
  tasks: Array<{ title: string; status: string; priority: string; due_date: string }>
): Promise<ProjectInsight> {
  const taskSummary = tasks.map(t => `- ${t.title} [${t.status}] (${t.priority}, due ${t.due_date})`).join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 768,
    messages: [
      {
        role: 'user',
        content: `Analyze this project and its tasks for a mortgage company team.

Project: ${project.name}
Purpose: ${project.purpose || 'Not specified'}
Status: ${project.status}
Due: ${project.due_date}
Owner: ${project.owner || 'Unassigned'}

Tasks:
${taskSummary || 'No tasks yet'}

Respond in JSON format only, no markdown:
{
  "summary": "1-2 sentence project health summary",
  "progressAssessment": "detailed progress analysis",
  "risks": ["risk 1", "risk 2"],
  "suggestions": ["suggestion 1", "suggestion 2"]
}`
      }
    ]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    return JSON.parse(text);
  } catch {
    return {
      summary: 'Unable to generate insights at this time.',
      progressAssessment: 'Analysis unavailable.',
      risks: [],
      suggestions: ['Try again later.']
    };
  }
}

export async function getTaskSuggestions(
  tasks: Array<{ id: number; title: string; status: string; priority: string; due_date: string; next_step: string; project_name?: string }>
): Promise<TaskSuggestion[]> {
  const openTasks = tasks.filter(t => t.status !== 'Done');
  if (openTasks.length === 0) return [];

  const taskList = openTasks
    .map(t => `- ID:${t.id} "${t.title}" [${t.priority}] due ${t.due_date}${t.project_name ? ` (${t.project_name})` : ''}${t.next_step ? ` → ${t.next_step}` : ''}`)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 768,
    messages: [
      {
        role: 'user',
        content: `Prioritize these open tasks for a mortgage company employee. Consider urgency, deadlines, and dependencies.

${taskList}

Respond in JSON format only, no markdown. Return an array ordered by suggested priority:
[
  {
    "taskId": <id>,
    "title": "task title",
    "suggestedOrder": 1,
    "reasoning": "why this should be done first/next"
  }
]`
      }
    ]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    return JSON.parse(text);
  } catch {
    return openTasks.map((t, i) => ({
      taskId: t.id,
      title: t.title,
      suggestedOrder: i + 1,
      reasoning: 'Default ordering'
    }));
  }
}
