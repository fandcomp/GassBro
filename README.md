# GassBro – Agentic AI Productivity Dashboard

GassBro adalah AI Productivity Agent yang membantu mengatur, memantau, dan meningkatkan produktivitas harian secara proaktif.

## ✨ Fitur Utama (Target)
- Daily Summary otomatis (pagi) + rekomendasi fokus
- Reminder sebelum deadline (T-30 menit)
- Evaluasi harian (malam)
- Manajemen Tasks, Events, Goals, Notes (Supabase)
- Penjadwalan otomatis & deteksi konflik + saran reschedule
- Pemecahan tugas besar menjadi subtasks
- Notifikasi Telegram (summary, reminder, evaluasi)
- Dashboard UI modern (React + Tailwind) + Dark Mode
- Chat Assistant Panel (perintah cepat)

## 🗂 Struktur Proyek
```
GassBro/
  README.md
  server/
    package.json
    src/
      index.js               # HTTP API (Express)
      env.js                 # Load & validate env vars
      services/
        supabase.js          # Koneksi Supabase
        telegram.js          # Kirim pesan Telegram
        agentFunctions.js    # add_task, schedule_event, dll
      utils/
        scheduling.js        # Algoritma penjadwalan & konflik
      agent/
        planner.js           # Logika generate_daily_summary
        scheduler.js         # CRON rutin (pagi/siang/malam/reminder)
  client/
    package.json
    index.html
    tailwind.config.js
    postcss.config.js
    src/
      main.jsx
      App.jsx
      index.css
      theme.js
      context/AppContext.jsx
      services/api.js
      components/
        Dashboard/
          DailySummaryCard.jsx
          TaskList.jsx
          GoalList.jsx
          CalendarView.jsx
        Assistant/AssistantPanel.jsx
        ui/ProgressBar.jsx
        ui/Badge.jsx
```

## 🧪 Database (Supabase) – Skema Awal (Rancang)
SQL contoh (jalankan di Supabase):
```sql
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  priority text check (priority in ('urgent','important','optional')) default 'important',
  status text check (status in ('pending','in_progress','done','blocked')) default 'pending',
  deadline timestamptz,
  estimated_minutes int,
  parent_task_id uuid references tasks(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  created_at timestamptz default now()
);
create table goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  target_date date,
  progress int default 0,
  created_at timestamptz default now()
);
create table daily_summaries (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  content jsonb not null,
  created_at timestamptz default now()
);
create table daily_evaluations (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  content jsonb not null,
  created_at timestamptz default now()
);
```

## 🔐 Environment Variables
Buat file `.env` di folder `server`:
```
SUPABASE_URL=... 
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
WORK_HOURS_START=08:00
WORK_HOURS_END=17:00
TZ=Asia/Jakarta
```

## ▶️ Menjalankan (Dev)
Install dep:
```powershell
cd server; npm install
cd ..\client; npm install
```
Jalankan server API + scheduler:
```powershell
cd server; npm run dev
# Tab baru
cd server; npm run agent
```
Jalankan client:
```powershell
cd client; npm run dev
```

## 🧠 Fungsi Agent (Server)
- add_task(title, deadline, priority)
- update_task_status(task_id, status)
- schedule_event(title, datetime_start, datetime_end)
- send_telegram(message, time?)
- generate_daily_summary(date)
- evaluate_day(date)

## ⏰ Rutinitas Otomatis (scheduler.js)
- 07:00 → generate_daily_summary + kirim Telegram
- Tiap 5 menit → cek deadline < 30m → kirim reminder
- 21:00 → evaluate_day + kirim Telegram

## 🗺 Penjadwalan & Konflik
Algoritma awal: sort tasks by (priority, deadline, estimated_minutes) lalu tempatkan di slot kerja bebas, hindari bentrok events. Bila konflik → usulan slot alternatif paling dekat yang muat.

## 🚀 Tahap Berikut
1. (DONE) Struktur dasar & skeleton kode
2. Implementasi API & services Supabase/Telegram
3. UI komponen utama dashboard
4. Penjadwalan otomatis & reminder
5. Chat assistant & integrasi fungsi
6. Refinement (animasi, dark mode, optimasi jadwal)

## 📌 Catatan
Kode awal masih skeleton – lanjutkan iterasi untuk logika AI lebih cerdas (prioritization heuristics, historical focus windows, dsb.).

## (Opsional) RLS Policies (Perbaikan Error 42601)
Jika Anda mengaktifkan Row Level Security (RLS) dan sebelumnya muncul error seperti:
```
ERROR:  42601: syntax error at or near "\"
```
Itu karena penulisan policy memakai escape backslash. Gunakan versi tanpa backslash.

Aktifkan RLS:
```sql
alter table tasks enable row level security;
alter table events enable row level security;
alter table goals enable row level security;
alter table daily_summaries enable row level security;
alter table daily_evaluations enable row level security;
```

Policies DEV permisif (sementara – jangan gunakan di produksi):
```sql
create policy public_select_tasks on tasks for select using (true);
create policy public_insert_tasks on tasks for insert with check (true);
create policy public_update_tasks on tasks for update using (true);

create policy public_select_events on events for select using (true);
create policy public_insert_events on events for insert with check (true);
create policy public_update_events on events for update using (true);

create policy public_select_goals on goals for select using (true);
create policy public_insert_goals on goals for insert with check (true);
create policy public_update_goals on goals for update using (true);

create policy public_select_daily_summaries on daily_summaries for select using (true);
create policy public_upsert_daily_summaries on daily_summaries for insert with check (true);
create policy public_update_daily_summaries on daily_summaries for update using (true);

create policy public_select_daily_evaluations on daily_evaluations for select using (true);
create policy public_upsert_daily_evaluations on daily_evaluations for insert with check (true);
create policy public_update_daily_evaluations on daily_evaluations for update using (true);
```

Reset (jika perlu ulang):
```sql
drop policy if exists public_select_tasks on tasks;
drop policy if exists public_insert_tasks on tasks;
drop policy if exists public_update_tasks on tasks;
-- ulangi untuk tabel lain
```

Catatan: Jika backend memakai service_role key, RLS bisa ditunda sampai implement multi-user.
