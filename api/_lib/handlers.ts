import { isAuthenticated } from './auth.js';
import { fetchUrlContent } from './fetch-url.js';
import { GeminiError, chat, search, speak, transcribe, type ChatMessage } from './gemini.js';

export interface AiRequest {
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
}

export interface AiResponse {
    status: number;
    body: unknown;
}

const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English', es: 'Spanish', nl: 'Dutch', fr: 'French',
    de: 'German', it: 'Italian', pt: 'Portuguese', pl: 'Polish',
};

type Handler = (body: Record<string, unknown>) => Promise<unknown>;

const actions: Record<string, Handler> = {
    chat: body => chat({
        messages: body.messages as ChatMessage[],
        temperature: body.temperature as number | undefined,
        response_format: body.response_format as { type: string } | undefined,
    }),
    search: body => search(String(body.query ?? ''), body.context as string | undefined),
    'fetch-url': body => {
        if (typeof body.url !== 'string' || !body.url) throw new GeminiError(400, 'URL is required');
        return fetchUrlContent(body.url);
    },
    transcribe: async body => {
        if (typeof body.audio !== 'string') throw new GeminiError(400, 'audio (base64) is required');
        const language = body.language as string | undefined;
        const text = await transcribe(body.audio, String(body.mimeType || 'audio/webm'), language && LANGUAGE_NAMES[language]);
        return { text };
    },
    speak: async body => {
        if (typeof body.text !== 'string' || !body.text) throw new GeminiError(400, 'text is required');
        return { audio: await speak(body.text), mimeType: 'audio/wav' };
    },
};

/** Single entry point shared by the Vercel function and the Vite dev middleware. */
export async function dispatch(action: string, req: AiRequest): Promise<AiResponse> {
    const handler = actions[action];
    if (!handler) return { status: 404, body: { error: 'Not found' } };
    if (req.method !== 'POST') return { status: 405, body: { error: 'Method not allowed' } };
    if (!(await isAuthenticated(req.headers.authorization))) return { status: 401, body: { error: 'Unauthorized' } };

    try {
        const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Record<string, unknown>;
        return { status: 200, body: await handler(body ?? {}) };
    } catch (error) {
        const status = error instanceof GeminiError ? error.status : 500;
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error(`[ai] ${action} failed:`, message);
        // fetch-url failures are reported in-band so a bad link never breaks the interview turn.
        if (action === 'fetch-url') return { status: 200, body: { success: false, error: message } };
        return { status, body: { error: message } };
    }
}
