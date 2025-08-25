import React, { useEffect, useState } from 'react';
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function TrendAnalytics(){
  const [data,setData]=useState(null); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  async function load(){
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/fn/trend_overview`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ days:7 })}).then(r=>r.json());
      setData(res);
    } catch(e){ setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ load(); },[]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tren 7 Hari</h2>
        <button onClick={load} className="text-xs btn-ghost" disabled={loading}>↻</button>
      </div>
      {error && <div className="text-[10px] text-red-400">{error}</div>}
      {loading && <div className="text-[10px] opacity-60 animate-pulse">Memuat...</div>}
      {data && (
        <>
          <MiniChart series={data.series} />
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Metric label="Avg" value={data.avg} />
            <Metric label="Last" value={data.last} />
            <Metric label="Δ" value={data.delta} highlight={true} />
          </div>
          {data.reflections && data.reflections.length>0 && (
            <div className="space-y-2 max-h-32 overflow-auto pr-1 text-[10px]">
              {data.reflections.slice(0,3).map(r=> (
                <div key={r.date} className="bg-white/5 border border-white/10 rounded px-2 py-1">
                  <div className="font-medium text-[10px] mb-1">{r.date}</div>
                  {r.improvements?.length>0 && <div className="text-emerald-400">+ {r.improvements.slice(0,2).join('; ')}</div>}
                  {r.issues?.length>0 && <div className="text-amber-400">! {r.issues.slice(0,2).join('; ')}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Metric({ label, value, highlight }){
  return (
    <div className={`flex flex-col gap-1 bg-white/5 rounded-lg px-3 py-2 border ${highlight?'border-emerald-500/50':'border-white/10'}`}>
      <span className="text-[9px] uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-100">{value}</span>
    </div>
  );
}

function MiniChart({ series }){
  if (!series || series.length===0) return <div className="text-[10px] opacity-50">Belum ada data.</div>;
  const max = Math.max(...series.map(s=> s.ratio));
  return (
    <div className="flex items-end gap-1 h-16">
      {series.map(s=>{
        const h = max>0 ? Math.round((s.ratio/max)*100) : 0;
        return <div key={s.date} className="flex-1 flex flex-col items-center">
          <div className="w-full bg-gradient-to-t from-sky-500 to-emerald-500 rounded-sm" style={{ height: (h||2)+'%' }}></div>
          <span className="text-[8px] mt-1 opacity-60">{s.date.slice(5)}</span>
        </div>;
      })}
    </div>
  );
}