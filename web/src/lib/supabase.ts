import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazily initialised so the module is safe to import during static build.
// The client is only created when insertWaitlistEmail() is actually called
// (i.e. at runtime in the browser, where the env vars are available).
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error(
        'Missing Supabase env vars. Copy .env.local.example → .env.local and fill in your values.',
      );
    }

    _client = createClient(url, key);
  }
  return _client;
}

export async function insertWaitlistEmail(
  email: string,
): Promise<{ error: { code: string; message: string } | null }> {
  const { error } = await getClient().from('waitlist').insert([{ email }]);
  return { error: error ? { code: error.code ?? '', message: error.message } : null };
}
