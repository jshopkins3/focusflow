import React, { useState, useEffect } from 'react';
import { Plus, X, Calendar, Flag, Tag, Link2, ArrowRight, Repeat, Target } from 'lucide-react';
import { Task, Project, Goal } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface TaskFormProps {
  onClose: () => void;
  onSave: () => void;
  projects: Project[];
  goals: Goal[];
  initialTask?: Task;
}

export default function TaskForm({ onClose, onSave, projects, goals, initialTask }: TaskFormProps) {
  const [task, setTask] = useState<Partial<Task>>(initialTask || {
    title: '',
    project_type: '',
    priority: 'Medium',
    task_type: '',
    status: 'To Do',
    connected_project_id: null,
    next_step: '',
    due_date: new Date().toISOString().split('T')[0],
    recurrence: 'none',
    connected_goal_id: null
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = task.id ? 'PUT' : 'POST';
    const url = task.id ? `/api/tasks/${task.id}` : '/api/tasks';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
    onSave();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-semibold text-slate-800">
            {task.id ? 'Edit Task' : 'New Task'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 uppercase tracking-wider">Task Title</label>
            <input 
              required
              autoFocus
              className="text-2xl font-bold w-full border-none focus:ring-0 p-0 placeholder:text-slate-300"
              placeholder="What needs to be done?"
              value={task.title}
              onChange={e => setTask({...task, title: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Flag size={14} /> Priority
              </label>
              <select 
                className="input-field"
                value={task.priority}
                onChange={e => setTask({...task, priority: e.target.value as any})}
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
                <option value="None">None</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Calendar size={14} /> Due Date
              </label>
              <input 
                type="date"
                className="input-field"
                value={task.due_date}
                onChange={e => setTask({...task, due_date: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Repeat size={14} /> Recurrence
              </label>
              <select 
                className="input-field"
                value={task.recurrence || 'none'}
                onChange={e => setTask({...task, recurrence: e.target.value as any})}
              >
                <option value="none">No Recurrence</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Tag size={14} /> Project Type
              </label>
              <input 
                className="input-field"
                placeholder="e.g. Work, Personal, Hobby"
                value={task.project_type}
                onChange={e => setTask({...task, project_type: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Tag size={14} /> Task Type
              </label>
              <input 
                className="input-field"
                placeholder="e.g. Email, Code, Call"
                value={task.task_type}
                onChange={e => setTask({...task, task_type: e.target.value})}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Link2 size={14} /> Connected Project
              </label>
              <select 
                className="input-field"
                value={task.connected_project_id || ''}
                onChange={e => setTask({...task, connected_project_id: e.target.value ? Number(e.target.value) : null})}
              >
                <option value="">No Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Target size={14} /> Connected Goal
              </label>
              <select 
                className="input-field"
                value={task.connected_goal_id || ''}
                onChange={e => setTask({...task, connected_goal_id: e.target.value ? Number(e.target.value) : null})}
              >
                <option value="">No Goal</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <ArrowRight size={14} /> Next Step
              </label>
              <textarea 
                className="input-field min-h-[80px]"
                placeholder="What's the very next action?"
                value={task.next_step}
                onChange={e => setTask({...task, next_step: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="submit" className="btn-primary flex-1">
              {task.id ? 'Update Task' : 'Create Task'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
