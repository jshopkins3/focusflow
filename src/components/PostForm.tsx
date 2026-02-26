import React, { useState } from 'react';
import { X, Calendar, FileText, Hash, MessageSquare, Target, FolderKanban, Activity } from 'lucide-react';
import { Post, Goal, Project } from '../types';
import { motion } from 'motion/react';

interface PostFormProps {
  onClose: () => void;
  onSave: () => void;
  initialPost?: Post;
  goals: Goal[];
  projects: Project[];
}

const PLATFORMS = ['LinkedIn', 'Instagram', 'Facebook', 'X / Twitter', 'TikTok', 'YouTube', 'Blog', 'Email Newsletter', 'Other'];

export default function PostForm({ onClose, onSave, initialPost, goals, projects }: PostFormProps) {
  const [post, setPost] = useState<Partial<Post>>(initialPost || {
    title: '',
    content: '',
    platform: '',
    status: 'Draft',
    scheduled_date: new Date().toISOString().split('T')[0],
    hashtags: '',
    notes: '',
    connected_goal_id: null,
    connected_project_id: null
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = post.id ? 'PUT' : 'POST';
    const url = post.id ? `/api/posts/${post.id}` : '/api/posts';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post)
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
            {post.id ? 'Edit Post' : 'New Post'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 uppercase tracking-wider">Post Title</label>
            <input
              required
              autoFocus
              className="text-2xl font-bold w-full border-none focus:ring-0 p-0 placeholder:text-slate-300"
              placeholder="What's the post about?"
              value={post.title}
              onChange={e => setPost({...post, title: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <MessageSquare size={14} /> Platform
              </label>
              <select
                className="input-field"
                value={post.platform}
                onChange={e => setPost({...post, platform: e.target.value})}
              >
                <option value="">Select platform</option>
                {PLATFORMS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Activity size={14} /> Status
              </label>
              <select
                className="input-field"
                value={post.status}
                onChange={e => setPost({...post, status: e.target.value as Post['status']})}
              >
                <option value="Draft">Draft</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Published">Published</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Calendar size={14} /> Scheduled Date
              </label>
              <input
                type="date"
                className="input-field"
                value={post.scheduled_date}
                onChange={e => setPost({...post, scheduled_date: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Hash size={14} /> Hashtags
              </label>
              <input
                className="input-field"
                placeholder="#marketing #mortgage #tips"
                value={post.hashtags}
                onChange={e => setPost({...post, hashtags: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Target size={14} /> Connected Goal
              </label>
              <select
                className="input-field"
                value={post.connected_goal_id || ''}
                onChange={e => setPost({...post, connected_goal_id: e.target.value ? Number(e.target.value) : null})}
              >
                <option value="">No goal connected</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <FolderKanban size={14} /> Connected Project
              </label>
              <select
                className="input-field"
                value={post.connected_project_id || ''}
                onChange={e => setPost({...post, connected_project_id: e.target.value ? Number(e.target.value) : null})}
              >
                <option value="">No project connected</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <FileText size={14} /> Content
              </label>
              <textarea
                className="input-field min-h-[120px]"
                placeholder="Write your post content here..."
                value={post.content}
                onChange={e => setPost({...post, content: e.target.value})}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-500">Notes</label>
              <textarea
                className="input-field min-h-[60px]"
                placeholder="Internal notes (not part of the post)..."
                value={post.notes}
                onChange={e => setPost({...post, notes: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="submit" className="btn-primary flex-1">
              {post.id ? 'Update Post' : 'Create Post'}
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
