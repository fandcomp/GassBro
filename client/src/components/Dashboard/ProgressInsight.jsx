import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function ProgressInsight(){
  const [data, setData] = useState(null);
  const [stale, setStale] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(){
    setLoading(true); setError('');
    try {
  const progResp = await fetch(`${API_BASE}/fn/progress_overview`, { method:'POST', headers:{'Content-Type':'application/json'} }).then(r=>r.json());
  if (progResp.error) throw new Error(progResp.error);
  // Server wraps results as { result: {...} }
  const prog = progResp.result || progResp || {};
  const stResp = await fetch(`${API_BASE}/fn/detect_stagnant_tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ hours:48 }) }).then(r=>r.json());
  if (stResp.error) throw new Error(stResp.error);
  const st = stResp.result || stResp || {};
  // Ensure numeric fallbacks
  setData({ total: prog.total||0, done: prog.done||0, completion_ratio: typeof prog.completion_ratio==='number'? prog.completion_ratio : (prog.total? (prog.done||0)/prog.total : 0) });
  setStale({ count: st.count||0, tasks: Array.isArray(st.tasks)? st.tasks: [] });
    } catch(e){ setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(()=>{ load(); },[]);

  const percent = data && data.total ? Math.round((data.done / data.total)*100) : 0;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">Progres
          {stale && stale.count>0 && (
            <span className="text-[10px] bg-red-500/80 text-white px-2 py-0.5 rounded-full">Stagnant {stale.count}</span>
          )}
        </h2>
        <button onClick={load} className="text-xs btn-ghost" disabled={loading}>↻</button>
      </div>
      {error && <div className="text-[10px] text-red-400">{error}</div>}
      {loading && <div className="text-[10px] opacity-60 animate-pulse">Memuat...</div>}
      {!loading && (
        <>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-400">
              <span>Selesai</span><span>{data? `${data.done}/${data.total}`:'0/0'}</span>
            </div>
            <div className="h-2 rounded bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all" style={{ width: percent+'%' }}></div>
            </div>
            <div className="text-[10px] text-slate-400">{percent}%</div>
          </div>
          {stale && stale.count>0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Task Mandek (contoh)</div>
              <ul className="space-y-1 text-xs">
                {stale.tasks.slice(0,3).map(t=> (
                  <li key={t.id} className="px-2 py-1 rounded bg-white/5 border border-white/10 flex justify-between gap-2">
                    <span className="truncate">{t.title}</span>
                    <span className="text-[9px] text-amber-400">{t.suggestion ? '⚠' : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}