import dotenv from 'dotenv';
dotenv.config();

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID'
];

for (const k of required) {
  if (!process.env[k]) {
    console.warn(`[env] Missing ${k}. Some features may not work.`);
  }
}

export const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnon: process.env.SUPABASE_ANON_KEY,
  supabaseService: process.env.SUPABASE_SERVICE_KEY,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  workHoursStart: process.env.WORK_HOURS_START || '08:00',
  workHoursEnd: process.env.WORK_HOURS_END || '17:00',
  timezone: process.env.TZ || 'Asia/Jakarta'
};
