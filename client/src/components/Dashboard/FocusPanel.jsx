import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function FocusPanel(){
  const [focus, setFocus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function call(action, body={}){
    setLoading(true); setMsg('');
    try {
      const res = await fetch(`${API_BASE}/fn/${action}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r=>r.json());
      if (action==='focus_today') setFocus(res);
      if (action==='auto_schedule_top_tasks') setMsg(`Auto schedule: ${res.scheduled?.length||0} blok`);
      if (action==='prioritize_tasks') setMsg(`Prioritization dihitung (${res.length||0})`);
      if (action==='schedule_recurring_event') setMsg(`Recurring dibuat: ${res.count}`);
    } catch(e){ setMsg(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fokus & Otomasi</h2>
        <button onClick={()=>call('focus_today')} disabled={loading} className="text-xs btn-ghost">Refresh</button>
      </div>
      <div className="flex flex-wrap gap-2 text-[10px]">
        <button onClick={()=>call('auto_schedule_top_tasks',{count:2})} disabled={loading} className="px-2 py-1 rounded bg-brand-600 text-white">Auto Blok</button>
        <button onClick={()=>call('prioritize_tasks')} disabled={loading} className="px-2 py-1 rounded bg-white/20">Skor Ulang</button>
        <button onClick={()=>call('shift_next_event',{ minutes:15 })} disabled={loading} className="px-2 py-1 rounded bg-white/20">Geser +15m</button>
        <button onClick={()=>call('shift_next_event',{ minutes:-15 })} disabled={loading} className="px-2 py-1 rounded bg-white/20">Geser -15m</button>
        <button onClick={()=>call('schedule_recurring_event',{ day_of_week:1, start_time_hhmm:'09:00', end_time_hhmm:'10:00', weeks:4, title:'Weekly Sync'})} disabled={loading} className="px-2 py-1 rounded bg-white/20">Weekly Sync</button>
      </div>
      {focus && (
        <div className="space-y-2 text-xs">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Top 3</div>
          <ul className="space-y-1">
            {focus.top.map(t=> <li key={t.id} className="bg-white/5 border border-white/10 rounded px-2 py-1 flex justify-between"><span className="truncate">{t.title}</span><span className="opacity-50">{t.priority}</span></li>)}
          </ul>
        </div>
      )}
      {msg && <div className="text-[10px] text-amber-400">{msg}</div>}
      {loading && <div className="text-[10px] opacity-60 animate-pulse">Processing...</div>}
    </div>
  );
}