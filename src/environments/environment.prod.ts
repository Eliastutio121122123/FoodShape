export const environment = {
  production: true,
  supabaseUrl: (globalThis as typeof globalThis & { FOODSHARE_CONFIG?: { supabaseUrl?: string } }).FOODSHARE_CONFIG?.supabaseUrl ?? 'https://YOUR_PROJECT_REF.supabase.co',
  supabasePublishableKey: (globalThis as typeof globalThis & { FOODSHARE_CONFIG?: { supabasePublishableKey?: string } }).FOODSHARE_CONFIG?.supabasePublishableKey ?? 'YOUR_SUPABASE_PUBLISHABLE_KEY',
};
