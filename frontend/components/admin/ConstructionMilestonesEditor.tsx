'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, RefreshCw, CheckCircle2, Clock, Calendar, Eye, Activity, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { adminAuthHeaders } from '@/lib/authedFetch';
import { API_BASE } from '@/lib/env';
import CustomSelect from './CustomSelect';

export interface MilestoneItem {
  id?: string;
  name: string;
  status: 'completed' | 'in_progress' | 'upcoming';
  date_label: string;
  sort_order: number;
}

interface ConstructionMilestonesEditorProps {
  projectId: string;
}

const DEFAULT_PHASES: MilestoneItem[] = [
  { name: 'RERA & Land Excavation', status: 'completed', date_label: 'Q1 2024', sort_order: 1 },
  { name: 'Tower Raft & Basement Foundation', status: 'completed', date_label: 'Q3 2024', sort_order: 2 },
  { name: 'Superstructure Slabs & RCC Frame', status: 'in_progress', date_label: 'Q1 2025', sort_order: 3 },
  { name: 'Brickwork & Internal Plastering', status: 'in_progress', date_label: 'Q3 2025', sort_order: 4 },
  { name: 'Exterior Elevation & Tile Flooring', status: 'upcoming', date_label: 'Q1 2026', sort_order: 5 },
  { name: 'OC Inspection & Resident Handover', status: 'upcoming', date_label: 'Q4 2026', sort_order: 6 },
];

export default function ConstructionMilestonesEditor({ projectId }: ConstructionMilestonesEditorProps) {
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchMilestones = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/projects/${projectId}/milestones`, {
        headers: adminAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.milestones) && data.milestones.length > 0) {
          setMilestones(data.milestones);
        } else {
          setMilestones(DEFAULT_PHASES);
        }
      } else {
        setMilestones(DEFAULT_PHASES);
      }
    } catch {
      setMilestones(DEFAULT_PHASES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchMilestones();
  }, [projectId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/projects/${projectId}/milestones`, {
        method: 'PUT',
        headers: adminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ milestones }),
      });

      if (!res.ok) throw new Error('Failed to save construction milestones');
      toast.success('Construction milestones updated successfully!');
      await fetchMilestones();
    } catch (err: any) {
      toast.error(err?.message || 'Error saving milestones');
    } finally {
      setSaving(false);
    }
  };

  const addMilestone = () => {
    setMilestones((prev) => [
      ...prev,
      {
        name: 'New Milestone Phase',
        status: 'upcoming',
        date_label: 'Q1 2027',
        sort_order: prev.length + 1,
      },
    ]);
  };

  const removeMilestone = (index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMilestone = (index: number, key: keyof MilestoneItem, value: any) => {
    setMilestones((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: value } : item))
    );
  };

  if (loading) {
    return <div className="h-48 bg-slate-100 dark:bg-zinc-800 rounded-2xl animate-pulse" />;
  }

  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const inProgressCount = milestones.filter(m => m.status === 'in_progress').length;
  const overallPct = milestones.length > 0
    ? Math.round(((completedCount + inProgressCount * 0.5) / milestones.length) * 100)
    : 0;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 p-6 space-y-6 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0066cc] dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/40">
            <Activity size={17} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              Construction & Development Spine ({overallPct}% Complete)
            </h3>
            <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              {completedCount} Completed · {inProgressCount} Active · {milestones.length - completedCount - inProgressCount} Upcoming
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={addMilestone}
            className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-[12.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus size={13} /> Add Phase Stage
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[#0066cc] hover:bg-[#0055b3] text-white rounded-xl text-[13px] font-medium flex items-center gap-2 transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            <span>{saving ? 'Saving...' : 'Save Milestones'}</span>
          </button>
        </div>
      </div>

      {/* Grid of Milestones */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {milestones.map((m, idx) => {
          const isCompleted = m.status === 'completed';
          const isInProgress = m.status === 'in_progress';

          return (
            <div
              key={idx}
              className={`p-4 rounded-xl border transition-all space-y-3 shadow-2xs ${
                isCompleted
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/50'
                  : isInProgress
                  ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/50'
                  : 'bg-zinc-50/70 dark:bg-zinc-800/40 border-zinc-200/80 dark:border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10.5px] font-semibold uppercase tracking-wider font-mono px-2 py-0.5 rounded-md border ${
                  isCompleted ? 'bg-emerald-100/70 text-emerald-800 border-emerald-200/80 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/60' :
                  isInProgress ? 'bg-amber-100/70 text-amber-800 border-amber-200/80 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/60' :
                  'bg-zinc-100 text-zinc-600 border-zinc-200/80 dark:bg-zinc-700/60 dark:text-zinc-300 dark:border-zinc-600'
                }`}>
                  Phase {idx + 1}
                </span>

                <button
                  onClick={() => removeMilestone(idx)}
                  className="text-zinc-400 hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                  title="Remove Phase"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  Stage Description
                </label>
                <input
                  type="text"
                  value={m.name}
                  onChange={(e) => updateMilestone(idx, 'name', e.target.value)}
                  className="w-full text-[12.5px] font-medium bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3 py-1.5 text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                    Status
                  </label>
                  <CustomSelect
                    value={m.status}
                    onChange={(val) => updateMilestone(idx, 'status', val as any)}
                    options={[
                      { value: 'completed', label: 'Completed', dotColor: 'bg-emerald-500' },
                      { value: 'in_progress', label: 'In Progress', dotColor: 'bg-amber-500' },
                      { value: 'upcoming', label: 'Upcoming', dotColor: 'bg-zinc-400' },
                    ]}
                    size="sm"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                    Quarter / Date
                  </label>
                  <input
                    type="text"
                    value={m.date_label || ''}
                    placeholder="Q4 2025"
                    onChange={(e) => updateMilestone(idx, 'date_label', e.target.value)}
                    className="w-full text-[12.5px] font-medium font-mono bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl px-3 py-1.5 text-zinc-900 dark:text-zinc-100 focus:border-[#0066cc] outline-none shadow-2xs"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
