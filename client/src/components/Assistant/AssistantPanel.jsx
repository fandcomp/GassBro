import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function AssistantPanel() {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState('');
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [modelInfo, setModelInfo] = useState(null);
  const [aux, setAux] = useState(null); // auxiliary result display
  const quicks = [
    { label:'Fokus Hari Ini', text:'fokus hari ini' },
    { label:'Prioritas', text:'prioritas' },
    { label:'Ringkas Memory', text:'ringkas memory' },
    { label:'Suggest Next', text:'task berikut' }
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;
    setLog(l => [...l, { role:'user', text: cmd }]);
    setInput('');
    try {
      setRunning(true);
      const resp = await fetch(`${API_BASE}/agent/chat`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text: cmd })}).then(r=>r.json());
      if (resp.error) throw new Error(resp.error);
      setLog(l=> [...l, { role:'assistant', type:'answer', text: resp.answer }]);
    } catch(e){
      setLog(l=> [...l, { role:'assistant', type:'error', text: e.message }]);
    } finally { setRunning(false); }
  }

  // Fetch model info once
  useEffect(()=>{
    fetch(`${API_BASE}/`).then(r=>r.json()).then(d=> setModelInfo(d.llm)).catch(()=>{});
  },[]);

  async function callExplainPriorities(){
    setRunning(true); setAux(null);
    try {
      const r = await fetch(`${API_BASE}/ai/explain-priorities`).then(r=>r.json());
      if (r.error) throw new Error(r.error);
      setAux({ type:'explain', data:r });
    } catch(e){ setAux({ type:'error', error:e.message }); }
    finally { setRunning(false); }
  }
  async function callPlanDay(){
    setRunning(true); setAux(null);
    try {
      const r = await fetch(`${API_BASE}/ai/plan-day`).then(r=>r.json());
      if (r.error) throw new Error(r.error);
      setAux({ type:'plan', data:r });
    } catch(e){ setAux({ type:'error', error:e.message }); }
    finally { setRunning(false); }
  }
  async function refineTitleExample(){
    if (!input.trim()) return;
    setRunning(true); setAux(null);
    try {
      const r = await fetch(`${API_BASE}/ai/refine-title`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ raw_title: input, style:'singkat' })}).then(r=>r.json());
      if (r.error) throw new Error(r.error);
      setAux({ type:'refine', data:r });
    } catch(e){ setAux({ type:'error', error:e.message }); }
    finally { setRunning(false); }
  }
  async function makeBrief(){
    if (!input.trim()) return;
    setRunning(true); setAux(null);
    try {
      const r = await fetch(`${API_BASE}/ai/task-brief`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title: input })}).then(r=>r.json());
      if (r.error) throw new Error(r.error);
      setAux({ type:'brief', data:r });
    } catch(e){ setAux({ type:'error', error:e.message }); }
    finally { setRunning(false); }
  }

  return (
    <div className={`fixed bottom-4 right-4 w-80 ${open?'':'h-10'} transition-all`}>
      <div className="bg-white dark:bg-slate-800 shadow-lg rounded-lg flex flex-col h-full max-h-96 overflow-hidden">
        <div className="p-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <span className="text-sm font-medium">GassBro Assistant</span>
          <button onClick={()=>setOpen(o=>!o)} className="text-xs text-brand-600">{open?'Min':'Open'}</button>
        </div>
        {open && (
          <>
          <div className="flex-1 overflow-auto p-2 space-y-3 text-xs">
            <div className="flex flex-wrap gap-1 sticky top-0 bg-white dark:bg-slate-800 pb-1 z-10">
              {quicks.map(q=> <button key={q.label} disabled={running} onClick={()=> setInput(q.text)} className="px-2 py-1 rounded border border-brand-500/40 text-[10px] hover:bg-brand-500 hover:text-white transition disabled:opacity-40">{q.label}</button>)}
            </div>
            {modelInfo && (
              <div className="text-[10px] opacity-60">Model: {modelInfo.model}</div>
            )}
            {log.map((m,i)=>{
              if (m.type==='answer') {
                return (
                  <div key={i} className="text-left">
                    <div className="inline-block px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 whitespace-pre-wrap text-[12px] leading-relaxed">
                      {m.text}
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} className={m.role==='user'? 'text-right':'text-left'}>
                  <div className={`inline-block px-2 py-1 rounded max-w-[90%] break-words whitespace-pre-wrap ${m.role==='user'?'bg-brand-500 text-white':'bg-slate-100 dark:bg-slate-700'}`}>{m.text}</div>
                </div>
              );
            })}
          </div>
          <form onSubmit={handleSubmit} className="p-2 border-t border-slate-200 dark:border-slate-700 flex gap-2">
            <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Perintah..." className="flex-1 bg-slate-100 dark:bg-slate-700 rounded px-2 py-1 text-xs disabled:opacity-50" disabled={running} />
            <button disabled={running} className="text-xs bg-brand-600 text-white px-2 py-1 rounded disabled:opacity-40">{running?'...':'Go'}</button>
          </form>
          <div className="p-2 pt-0 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-1">
            <button onClick={refineTitleExample} disabled={running||!input.trim()} className="text-[10px] px-2 py-1 rounded bg-white/20 hover:bg-white/30 disabled:opacity-40">Refine Judul</button>
            <button onClick={makeBrief} disabled={running||!input.trim()} className="text-[10px] px-2 py-1 rounded bg-white/20 hover:bg-white/30 disabled:opacity-40">Brief</button>
            <button onClick={callExplainPriorities} disabled={running} className="text-[10px] px-2 py-1 rounded bg-white/20 hover:bg-white/30 disabled:opacity-40">Explain Prioritas</button>
            <button onClick={callPlanDay} disabled={running} className="text-[10px] px-2 py-1 rounded bg-white/20 hover:bg-white/30 disabled:opacity-40">Plan Day</button>
          </div>
          {aux && (
            <div className="px-3 pb-2 text-[10px] space-y-1 max-h-40 overflow-auto">
              {aux.type==='error' && <div className="text-red-400">{aux.error}</div>}
              {aux.type==='refine' && <div><div className="font-semibold">Refined:</div><div>{aux.data.refined}</div></div>}
              {aux.type==='brief' && (
                <div>
                  <div className="font-semibold">Brief:</div>
                  <div className="opacity-80">Why: {aux.data.brief?.why}</div>
                  <div className="opacity-80">Outcome: {aux.data.brief?.outcome}</div>
                  <ul className="list-disc ml-4 mt-1 space-y-0.5">
                    {aux.data.brief?.steps?.map((s,i)=><li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {aux.type==='explain' && (
                <div>
                  <div className="font-semibold">Prioritas:</div>
                  <ol className="ml-4 list-decimal space-y-0.5">{aux.data.tasks.map(t=> <li key={t.id}>{t.title} <span className="opacity-50">({t.score})</span></li>)}</ol>
                  <div className="mt-1 whitespace-pre-wrap">{aux.data.explanation}</div>
                </div>
              )}
              {aux.type==='plan' && (
                <div className="space-y-1">
                  <div className="font-semibold">Rencana Hari (Natural):</div>
                  <pre className="whitespace-pre-wrap bg-slate-900/30 p-2 rounded max-h-32 overflow-auto text-[9px]">{aux.data.summary}</pre>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[9px] opacity-70 hover:opacity-100">Lihat JSON</summary>
                    <pre className="whitespace-pre-wrap bg-slate-900/40 p-2 rounded max-h-40 overflow-auto text-[9px] mt-1">{JSON.stringify(aux.data.plan, null, 2)}</pre>
                  </details>
                </div>
              )}
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
