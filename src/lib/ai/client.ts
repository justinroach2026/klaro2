import { supabase } from '../supabase';

/** POST to a server-side AI function, attaching the Supabase session token the server verifies. */
export async function aiFetch(action: string, body: unknown): Promise<Response> {
    const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    return fetch(`/api/ai/${action}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(data.session && { Authorization: `Bearer ${data.session.access_token}` }),
        },
        body: JSON.stringify(body),
    });
}
