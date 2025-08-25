import React, { useEffect, useState } from 'react';
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function AgentExecutionPanel(){
  const [data,setData] = useState(null);
  const [open,setOpen] = useState(true);
  useEffect(()=>{
    let active = true;
    async function tick(){
      try {
        const r = await fetch(`${API_BASE}/agent/state`).then(r=>r.json());
        if (!active) return;
        setData(r);
      } catch{/* ignore */}
      setTimeout(tick, 1500);
    }
    tick();
    return ()=>{ active=false; };
  },[]);
  const current = data?.current;
  return (
    <div className="fixed bottom-4 left-4 w-72 text-[11px] z-40">
      <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-white/30 dark:border-slate-700 rounded shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-2 py-1 border-b border-white/30 dark:border-slate-700">
          <span className="font-semibold tracking-wide text-[10px]">INTENT EXECUTION</span>
          <button onClick={()=>setOpen(o=>!o)} className="text-[10px] opacity-60 hover:opacity-100">{open?'−':'+'}</button>
        </div>
        {open && (
          <div className="max-h-60 overflow-auto p-2 space-y-3">
            {current ? (
              <div>
                <div className="mb-1"><span className="font-medium">Perintah:</span> <span className="opacity-70">{current.text}</span></div>
                <ul className="space-y-1">
                  {current.intents.map(it=> <IntentRow key={it.action+it.status+Math.random()} intent={it} />)}
                </ul>
              </div>
            ) : <div className="opacity-50 italic">Idle</div>}
            {data?.history?.length>0 && (
              <div className="pt-2 border-t border-white/20 dark:border-slate-700">
                <div className="uppercase text-[9px] tracking-wider opacity-60 mb-1">Riwayat</div>
                <ul className="space-y-0.5 max-h-24 overflow-auto pr-1">
                  {data.history.slice(0,5).map(h=> <li key={h.id} className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> <span className="truncate">{h.text.slice(0,40)}</span></li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function IntentRow({ intent }){
  const color = intent.status==='done' ? 'bg-emerald-500' : intent.status==='error' ? 'bg-red-500' : intent.status==='running' ? 'bg-amber-500 animate-pulse' : 'bg-slate-400';
  return (
    <li className="flex items-center gap-2 p-1 rounded bg-white/40 dark:bg-white/5 border border-white/30 dark:border-slate-700">
      <span className={`w-2 h-2 rounded-full ${color}`}></span>
      <span className="font-mono text-[10px]">{intent.action}</span>
      <span className="ml-auto text-[9px] uppercase tracking-wider opacity-60">{intent.status}</span>
    </li>
  );
}
