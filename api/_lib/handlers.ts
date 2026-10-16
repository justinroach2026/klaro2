import { randomUUID } from 'node:crypto';
import { getUserId } from './auth.js';
import { fetchUrlContent } from './fetch-url.js';
import {
    GeminiError, MAX_VIDEO_BYTES, VIDEO_MIME_TYPES,
    chat, deleteFile, findVideoFile, search, speak, startVideoUpload, transcribe, videoToSop,
    type ChatMessage,
} from './gemini.js';

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

const INDUSTRY_NAMES: Record<string, string> = {
    tech: 'Technology & Software', healthcare: 'Healthcare & Medical', hospitality: 'Hospitality & Tourism',
    manufacturing: 'Manufacturing & Logistics', professional: 'Professional Services', education: 'Education & Training',
    retail: 'Retail & E-commerce', construction: 'Construction & Development', real_estate: 'Real Estate', other: 'General business',
};

interface Context {
    userId: string;
}

type Handler = (body: Record<string, unknown>, ctx: Context) => Promise<unknown>;

/** Uploaded files are named `<userId>:<uuid>` so a user can only touch their own. */
function ownedDisplayName(body: Record<string, unknown>, ctx: Context): string {
    const name = body.displayName;
    if (typeof name !== 'string' || !name.startsWith(`${ctx.userId}:`)) throw new GeminiError(403, 'Not your file');
    return name;
}

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
    'video-upload-session': async (body, ctx) => {
        const sizeBytes = Number(body.sizeBytes);
        const mimeType = String(body.mimeType ?? '').split(';')[0];
        if (!VIDEO_MIME_TYPES.includes(mimeType)) throw new GeminiError(400, 'Unsupported video type. Use MP4, WebM or MOV.');
        if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) throw new GeminiError(400, 'sizeBytes is required');
        if (sizeBytes > MAX_VIDEO_BYTES) throw new GeminiError(413, 'Video is larger than 500 MB');

        const displayName = `${ctx.userId}:${randomUUID()}`;
        const uploadUrl = await startVideoUpload({ displayName, mimeType, sizeBytes });
        return { uploadUrl, displayName };
    },
    'video-status': async (body, ctx) => {
        const file = await findVideoFile(ownedDisplayName(body, ctx));
        const expected = Number(body.sizeBytes);
        // sizeBytes is only set once the upload has been finalised; a mismatch means a truncated upload.
        if (!file || (expected && file.sizeBytes !== expected)) return { state: 'MISSING' };
        return { state: file.state };
    },
    'video-to-sop': async (body, ctx) => {
        const file = await findVideoFile(ownedDisplayName(body, ctx));
        if (!file) throw new GeminiError(404, 'Uploaded video not found');
        if (file.state !== 'ACTIVE') throw new GeminiError(409, `Video is not ready (${file.state})`);

        const language = body.language as string | undefined;
        try {
            const sop = await videoToSop({
                fileUri: file.uri,
                mimeType: file.mimeType,
                languageName: (language && LANGUAGE_NAMES[language]) || 'English',
                industryName: INDUSTRY_NAMES[String(body.industry)] ?? INDUSTRY_NAMES.other,
                countryName: String(body.country ?? '').slice(0, 60) || 'the user\'s country',
            });
            return { sop };
        } finally {
            // Recordings can show sensitive screens; don't leave them on Google's side for the 48 h default.
            await deleteFile(file.name);
        }
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
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return { status: 401, body: { error: 'Unauthorized' } };

    try {
        const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Record<string, unknown>;
        return { status: 200, body: await handler(body ?? {}, { userId }) };
    } catch (error) {
        const status = error instanceof GeminiError ? error.status : 500;
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error(`[ai] ${action} failed:`, message);
        // fetch-url failures are reported in-band so a bad link never breaks the interview turn.
        if (action === 'fetch-url') return { status: 200, body: { success: false, error: message } };
        return { status, body: { error: message } };
    }
}
