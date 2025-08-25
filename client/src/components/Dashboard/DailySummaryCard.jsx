import React from 'react';
import { useApp } from '../../context/AppContext.jsx';
import dayjs from 'dayjs';

export default function DailySummaryCard() {
  const { summary, refreshSummary, loading } = useApp();
  if (loading) return (
    <div className="flex flex-col gap-4 animate-fadeScaleIn">
      <div className="flex items-start justify-between">
        <div className="space-y-2 w-full">
          <div className="skeleton-block h-5 w-40"></div>
          <div className="skeleton-block h-3 w-24"></div>
        </div>
        <div className="skeleton-block h-7 w-10 rounded-lg"></div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="skeleton-block h-14"></div>
        <div className="skeleton-block h-14"></div>
        <div className="skeleton-block h-14"></div>
        <div className="skeleton-block h-14"></div>
      </div>
      <div className="space-y-2">
        <div className="skeleton-block h-4 w-16"></div>
        <div className="space-y-2">
          <div className="skeleton-block h-8 w-full"></div>
          <div className="skeleton-block h-8 w-5/6"></div>
          <div className="skeleton-block h-8 w-4/5"></div>
        </div>
      </div>
    </div>
  );
  if (!summary) return <div className="text-sm text-slate-400">Belum ada summary</div>;
  return (
    <div className="flex flex-col gap-4 animate-fadeScaleIn">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Daily Summary</h2>
          <div className="text-[11px] uppercase tracking-wider text-slate-400 mt-1">{summary.date}</div>
        </div>
        <button onClick={refreshSummary} className="btn-ghost text-xs">↻</button>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Stat label="Tugas" value={summary.tasks_count} />
        <Stat label="Events" value={summary.events_count} />
        {summary.first_deadline && <Stat label="Deadline 1" value={dayjs(summary.first_deadline).format('HH:mm')} />}
        <Stat label="Fokus" value={summary.focus_recommendation} />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-300">Plan</h3>
        <div className="space-y-1 max-h-44 overflow-auto pr-1">
          {summary.plan.map(p=> (
            <div key={p.id} className="flex items-center gap-3 text-[11px] bg-white/5 border border-white/10 rounded-lg px-2 py-1.5">
              <span className="text-brand-300 font-mono">{dayjs(p.start).format('HH:mm')}</span>
              <span className="opacity-50">→</span>
              <span className="text-brand-300 font-mono">{dayjs(p.end).format('HH:mm')}</span>
              <span className="flex-1 truncate font-medium">{p.title}</span>
            </div>
          ))}
        </div>
        {summary.unscheduled.length>0 && (
          <div className="mt-2 text-[11px] text-amber-400">Unscheduled: {summary.unscheduled.map(u=>u.title).join(', ')}</div>
        )}
        {summary.reschedule_suggestions?.length>0 && (
          <div className="mt-2 space-y-1">
            <h4 className="text-xs font-medium text-slate-300">Saran Reschedule</h4>
            {summary.reschedule_suggestions.slice(0,3).map((s,i)=>(
              <div key={i} className="text-[11px] text-slate-400 bg-white/5 rounded px-2 py-1 border border-white/10">{s.suggestion}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col gap-1 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
      <span className="text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-100">{value ?? '-'}</span>
    </div>
  );
}
