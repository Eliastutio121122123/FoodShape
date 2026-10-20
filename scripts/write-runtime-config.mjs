import { mkdir, writeFile } from 'node:fs/promises';

const config = {
  supabaseUrl: process.env.SUPABASE_URL || 'https://YOUR_PROJECT_REF.supabase.co',
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || 'YOUR_SUPABASE_PUBLISHABLE_KEY',
};
await mkdir('src/assets', { recursive: true });
await writeFile('src/assets/runtime-config.js', `window.FOODSHARE_CONFIG = ${JSON.stringify(config)};\n`, 'utf8');
