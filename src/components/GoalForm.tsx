import React, { useState } from 'react';
import { X, Target, Calendar, Activity, FileText, Clock } from 'lucide-react';
import { Goal } from '../types';
import { motion } from 'motion/react';

interface GoalFormProps {
  onClose: () => void;
  onSave: () => void;
  initialGoal?: Goal;
}

export default function GoalForm({ onClose, onSave, initialGoal }: GoalFormProps) {
  const [goal, setGoal] = useState<Partial<Goal>>(initialGoal || {
    name: '',
    description: '',
    timeframe: '',
    target_date: new Date().toISOString().split('T')[0],
    status: 'Active'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = goal.id ? 'PUT' : 'POST';
    const url = goal.id ? `/api/goals/${goal.id}` : '/api/goals';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goal)
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
            {goal.id ? 'Edit Goal' : 'New Goal'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 uppercase tracking-wider">Goal Name</label>
            <input 
              required
              autoFocus
              className="text-2xl font-bold w-full border-none focus:ring-0 p-0 placeholder:text-slate-300"
              placeholder="What's the big goal?"
              value={goal.name}
              onChange={e => setGoal({...goal, name: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Clock size={14} /> Timeframe
              </label>
              <select 
                className="input-field"
                value={goal.timeframe}
                onChange={e => setGoal({...goal, timeframe: e.target.value})}
              >
                <option value="">Select timeframe</option>
                <option value="1 Year">1 Year</option>
                <option value="2 Years">2 Years</option>
                <option value="3 Years">3 Years</option>
                <option value="5 Years">5 Years</option>
                <option value="Ongoing">Ongoing</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Calendar size={14} /> Target Date
              </label>
              <input 
                type="date"
                className="input-field"
                value={goal.target_date}
                onChange={e => setGoal({...goal, target_date: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Activity size={14} /> Status
              </label>
              <select 
                className="input-field"
                value={goal.status}
                onChange={e => setGoal({...goal, status: e.target.value})}
              >
                <option value="Active">Active</option>
                <option value="On Track">On Track</option>
                <option value="At Risk">At Risk</option>
                <option value="Completed">Completed</option>
                <option value="Paused">Paused</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <FileText size={14} /> Description
              </label>
              <textarea 
                className="input-field min-h-[100px]"
                placeholder="Describe this goal and what success looks like..."
                value={goal.description}
                onChange={e => setGoal({...goal, description: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="submit" className="btn-primary flex-1">
              {goal.id ? 'Update Goal' : 'Create Goal'}
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
