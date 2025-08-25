import React, { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';

// Simple circular focus timer (Pomodoro style) with start/pause/reset.
// Default 25 min focus, 5 min break toggle.
export default function FocusTimer() {
  const FOCUS_MIN = 25;
  const BREAK_MIN = 5;
  const [mode, setMode] = useState('focus'); // focus | break
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_MIN * 60);
  const [running, setRunning] = useState(false);
  const rafRef = useRef(null);
  const lastTickRef = useRef(null);

  useEffect(()=>{ // Reset when mode changes
    setSecondsLeft((mode==='focus'?FOCUS_MIN:BREAK_MIN)*60);
  },[mode]);

  useEffect(()=>{
    if(!running) { if(rafRef.current) cancelAnimationFrame(rafRef.current); return; }
    function step(ts){
      if(!lastTickRef.current) lastTickRef.current = ts;
      const diff = ts - lastTickRef.current;
      if(diff >= 1000){
        setSecondsLeft(prev => {
          if(prev <= 1){
            // Auto switch
            const nextMode = mode==='focus' ? 'break' : 'focus';
            setMode(nextMode);
            setRunning(false); // require manual start for next phase
            return (nextMode==='focus'?FOCUS_MIN:BREAK_MIN)*60;
          }
          return prev - 1;
        });
        lastTickRef.current = ts;
      }
      rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return ()=>{ if(rafRef.current) cancelAnimationFrame(rafRef.current); lastTickRef.current = null; };
  },[running, mode]);

  const total = (mode==='focus'?FOCUS_MIN:BREAK_MIN)*60;
  const pct = (1 - secondsLeft/total) * 100;
  const mm = String(Math.floor(secondsLeft/60)).padStart(2,'0');
  const ss = String(secondsLeft%60).padStart(2,'0');
  const display = `${mm}:${ss}`;

  function toggle(){ setRunning(r=>!r); }
  function reset(){ setRunning(false); setSecondsLeft((mode==='focus'?FOCUS_MIN:BREAK_MIN)*60); }

  return (
    <div className="focus-timer glass gradient-border p-5 flex flex-col gap-4 animate-fadeScaleIn">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Focus Timer</h2>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${mode==='focus'?'bg-emerald-500/20 text-emerald-500':'bg-sky-500/20 text-sky-500'}`}>{mode}</span>
      </div>
      <div className="relative w-40 h-40 self-center">
        <svg viewBox="0 0 120 120" className="w-40 h-40">
          <circle cx="60" cy="60" r="54" className="timer-bg" />
          <circle cx="60" cy="60" r="54" className="timer-progress" style={{ strokeDashoffset: 339.292 - (339.292 * pct / 100) }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="font-mono text-2xl font-semibold">{display}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">{mode==='focus'?'Fokus':'Break'}</span>
        </div>
      </div>
      <div className="flex gap-3 justify-center">
        <button onClick={toggle} className="btn !px-5 !py-2 text-sm">{running?'Pause':'Start'}</button>
        <button onClick={reset} className="btn-ghost text-xs">Reset</button>
        <button onClick={()=>{ setMode(m=> m==='focus'?'break':'focus'); setRunning(false); }} className="btn-ghost text-xs">Switch</button>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Mode ini membantu menjaga ritme kerja: 25 menit fokus, 5 menit break. Selesai satu sesi, lanjutkan sesuai kebutuhan.
      </p>
    </div>
  );
}
