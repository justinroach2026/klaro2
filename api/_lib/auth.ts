import { createClient } from '@supabase/supabase-js';

/** Verifies the Supabase access token so only signed-in users can spend the Gemini key. Returns the user id, or null. */
export async function getUserId(authHeader: string | string[] | undefined): Promise<string | null> {
    const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const token = header?.replace(/^Bearer\s+/i, '');
    if (!token) return null;

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
        console.error('[ai] Supabase URL/anon key missing on server; rejecting request');
        return null;
    }

    const { data, error } = await createClient(url, anonKey).auth.getUser(token);
    return !error && data.user ? data.user.id : null;
}
