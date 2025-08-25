// Simple in-memory agent state tracking for current plan/intents
export const agentState = {
  current: null, // { id, created_at, text, intents:[{action, params, status, result?, error?}] }
  history: [] // keep last N summaries
};

export function startPlan(text, intents){
  const plan = {
    id: Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    created_at: Date.now(),
    text,
    intents: intents.map(i=> ({ ...i, status:'planned' }))
  };
  agentState.current = plan;
  return plan;
}
export function updateIntentStatus(actionName, updater){
  if (!agentState.current) return;
  const it = agentState.current.intents.find(i=> i.action===actionName && i.status==='planned');
  if (!it) return;
  updater(it);
}
export function finalizePlan(){
  if (!agentState.current) return;
  const summary = {
    id: agentState.current.id,
    created_at: agentState.current.created_at,
    text: agentState.current.text,
    intents: agentState.current.intents.map(i=>({ action:i.action, status:i.status }))
  };
  agentState.history.unshift(summary);
  agentState.history = agentState.history.slice(0,20);
}
export function getAgentSnapshot(){
  return {
    current: agentState.current,
    history: agentState.history
  };
}
