import React, { useState } from 'react';
import { X, Target, User, Layers, Users, Info, Calendar, Activity } from 'lucide-react';
import { Project, Goal } from '../types';
import { motion } from 'motion/react';

interface ProjectFormProps {
  onClose: () => void;
  onSave: () => void;
  initialProject?: Project;
  goals: Goal[];
}

export default function ProjectForm({ onClose, onSave, initialProject, goals }: ProjectFormProps) {
  const [project, setProject] = useState<Partial<Project>>(initialProject || {
    name: '',
    related_goal: '',
    connected_goal_id: null,
    owner: '',
    scope: '',
    team: '',
    purpose: '',
    due_date: new Date().toISOString().split('T')[0],
    status: 'Active'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = project.id ? 'PUT' : 'POST';
    const url = project.id ? `/api/projects/${project.id}` : '/api/projects';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
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
            {project.id ? 'Edit Project' : 'New Project'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 uppercase tracking-wider">Project Name</label>
            <input 
              required
              autoFocus
              className="text-2xl font-bold w-full border-none focus:ring-0 p-0 placeholder:text-slate-300"
              placeholder="What's the big project?"
              value={project.name}
              onChange={e => setProject({...project, name: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Target size={14} /> Connected Goal
              </label>
              <select
                className="input-field"
                value={project.connected_goal_id || ''}
                onChange={e => {
                  const goalId = e.target.value ? Number(e.target.value) : null;
                  const goal = goals.find(g => g.id === goalId);
                  setProject({...project, connected_goal_id: goalId, related_goal: goal?.name || ''});
                }}
              >
                <option value="">No goal connected</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <User size={14} /> Owner
              </label>
              <input 
                className="input-field"
                placeholder="Who's leading this?"
                value={project.owner}
                onChange={e => setProject({...project, owner: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Layers size={14} /> Scope
              </label>
              <input 
                className="input-field"
                placeholder="What's included?"
                value={project.scope}
                onChange={e => setProject({...project, scope: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Users size={14} /> Team
              </label>
              <input 
                className="input-field"
                placeholder="Who else is involved?"
                value={project.team}
                onChange={e => setProject({...project, team: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Calendar size={14} /> Due Date
              </label>
              <input 
                type="date"
                className="input-field"
                value={project.due_date}
                onChange={e => setProject({...project, due_date: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Activity size={14} /> Status
              </label>
              <select 
                className="input-field"
                value={project.status}
                onChange={e => setProject({...project, status: e.target.value})}
              >
                <option value="Active">Active</option>
                <option value="In Progress">In Progress</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Info size={14} /> Purpose
              </label>
              <textarea 
                className="input-field min-h-[100px]"
                placeholder="Why are we doing this project?"
                value={project.purpose}
                onChange={e => setProject({...project, purpose: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="submit" className="btn-primary flex-1">
              {project.id ? 'Update Project' : 'Create Project'}
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
