import dotenv from 'dotenv';

dotenv.config();

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '8709806156:AAFQnPA2T9RWVnEEKSYwOzgMHOQxlFNi3t4',
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://eofbdmhjirbtidtucqkp.supabase.co',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZmJkbWhqaXJidGlkdHVjcWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNTk0MzAsImV4cCI6MjA5NzczNTQzMH0.sGuRVekxwUGYPDjaY85DceTBYDpsVX-uaf9qkXoXJDY',
  webAppUrl: process.env.TELEGRAM_WEBAPP_URL || 'https://remaprofitmachine.com',
};

if (!config.telegramBotToken) {
  console.warn('⚠️ WARNING: TELEGRAM_BOT_TOKEN is not set in environment variables.');
}
