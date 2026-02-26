export interface Goal {
  id?: number;
  name: string;
  description: string;
  timeframe: string;
  target_date: string;
  status: string;
}

export interface Project {
  id?: number;
  name: string;
  related_goal: string;
  owner: string;
  scope: string;
  team: string;
  purpose: string;
  due_date: string;
  status: string;
  connected_goal_id: number | null;
  goal_name?: string;
}

export interface Task {
  id?: number;
  title: string;
  project_type: string;
  priority: 'High' | 'Medium' | 'Low' | 'None';
  task_type: string;
  status: 'To Do' | 'In Progress' | 'Done' | 'Blocked';
  connected_project_id: number | null;
  project_name?: string;
  next_step: string;
  due_date: string;
  source_email_id?: string | null;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | null;
  recurrence_source_id?: number | null;
  connected_goal_id: number | null;
  goal_name?: string;
}

export interface User {
  email: string;
  name: string;
  connected: boolean;
}

export type View = 'tasks' | 'projects' | 'goals' | 'dashboard' | 'calendar' | 'integrations';

export interface GoogleEvent {
  id: string;
  summary: string;
  start: string;
  location?: string;
}

export interface GoogleEmail {
  id: string;
  subject: string;
  from: string;
  snippet?: string;
}

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
  urgency: number;
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
