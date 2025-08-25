import { CONFIG } from '../env.js';

// Simple Ollama client (non-stream) fallback to echo
export async function callLLM(prompt, { model, temperature=0.3 } = {}) {
  const mdl = model || process.env.OLLAMA_MODEL || 'llama3';
  const url = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
  const body = { model: mdl, prompt, stream: false, options:{ temperature } };
  try {
    const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('LLM status '+res.status);
    const json = await res.json();
    return json.response?.trim() || '';
  } catch (e) {
  console.warn('[llm] fallback (error:', e.message, ')');
  // Return explicit marker so caller can decide custom fallback
  return ''; // empty string indicates failure
  }
}

export function buildPlanningPrompt(userText, functionRegistry, memoryContext=''){
  return `Anda adalah asisten agent produktivitas.
User input: "${userText}"

Daftar fungsi (name: deskripsi):\n${functionRegistry.map(f=>`${f.name}: ${f.description}`).join('\n')}\n
Konteks ringkas terakhir:\n${memoryContext || '(kosong)'}\n
Instruksi:
- Pilih hanya fungsi yang relevan.
- Hindari duplikasi (misal add_task sama judul, generate_daily_summary lebih dari 1).
- Maks 5 item.
- Jika tidak perlu tindakan, kembalikan [] saja.
Output: JSON array murni tanpa teks tambahan.
Contoh: [{"action":"add_task","params":{"title":"Contoh"}}]
JSON:`;
}

export function buildAnswerPrompt(userText, intents, results){
  return `User: ${userText}
Intents dieksekusi: ${JSON.stringify(intents)}
Hasil: ${JSON.stringify(results)}
Buat jawaban ringkas, natural (Bahasa Indonesia), ramah, tanpa menampilkan JSON atau struktur teknis. Jika ada konflik event, jelaskan saran perbaikan. Jika menambah task, sebutkan judulnya. Fokus pada nilai bagi user.`;
}

// --- Guardrail helpers for planning JSON ---
export function tryParseJSON(raw){
  try { return JSON.parse(raw); } catch { return null; }
}

export function extractFirstJSONArray(raw){
  if (!raw) return null;
  const start = raw.indexOf('['); const end = raw.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end>start){
    const slice = raw.slice(start, end+1);
    return tryParseJSON(slice);
  }
  return null;
}

export async function repairPlanningOutput(raw, { model } = {}) {
  let candidate = extractFirstJSONArray(raw);
  if (candidate) return candidate;
  const cleaned = raw.replace(/```[a-zA-Z]*|```/g,'').trim();
  candidate = extractFirstJSONArray(cleaned);
  if (candidate) return candidate;
  candidate = extractFirstJSONArray(cleaned.replace(/\n+/g,' '));
  if (candidate) return candidate;
  const prompt = `Perbaiki JSON array berikut agar valid. Hanya keluarkan JSON array tanpa teks tambahan.\nTeks:\n${raw}\nJSON:`;
  const fixed = await callLLM(prompt, { model, temperature:0 });
  return tryParseJSON(fixed) || extractFirstJSONArray(fixed) || [];
}

export async function planWithRetries(prompt, { model, maxRetries=2 } = {}) {
  let attempt = 0; let raw=''; let parsed=null;
  while (attempt <= maxRetries){
    raw = await callLLM(prompt, { model, temperature: attempt===0?0.2:0 });
    if (!raw){ attempt++; continue; }
    parsed = tryParseJSON(raw) || await repairPlanningOutput(raw, { model });
    if (Array.isArray(parsed)) break; attempt++;
  }
  if (!Array.isArray(parsed)) parsed = [];
  return { raw, intents: parsed, retries: attempt };
}

export function buildReflectionPrompt(recentLines){
  return `Anda adalah agen produktivitas yang melakukan refleksi.
Riwayat tindakan terbaru:
${recentLines.join('\n')}
Tujuan refleksi:
- Identifikasi 1–3 perbaikan strategi (singkat)
- Deteksi hambatan (misal banyak task tanpa deadline, terlalu banyak blok kosong)
- Sarankan langkah konkrit berikutnya (maks 2)
Format keluaran JSON:
{"improvements":["..."],"issues":["..."],"next_actions":["..."]}
JSON:`;
}
