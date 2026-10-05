/**
 * Thin Gemini REST wrapper (generateContent). Accepts the chat-completions-style messages the
 * frontend already sends and returns a matching response, so client parsing is unchanged.
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export type ChatPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string | ChatPart[];
}

interface GeminiPart {
    text?: string;
    thought?: boolean;
    inlineData?: { mimeType: string; data: string };
    fileData?: { fileUri: string; mimeType: string };
}

interface GeminiResponse {
    candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    error?: { message?: string };
}

const chatModel = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const ttsModel = () => process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';

async function generate(model: string, body: Record<string, unknown>): Promise<GeminiResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new GeminiError(500, 'GEMINI_API_KEY not configured on server');

    // 503 "high demand" is transient on Gemini; retry briefly before surfacing it.
    for (let attempt = 0; ; attempt++) {
        const res = await fetch(`${BASE_URL}/models/${model}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as GeminiResponse;
        if (res.ok) return data;
        if (res.status === 503 && attempt < 3) {
            await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
            continue;
        }
        throw new GeminiError(res.status, data.error?.message || `Gemini error (${res.status})`);
    }
}

function textOf(data: GeminiResponse): string {
    if (data.promptFeedback?.blockReason) {
        throw new GeminiError(422, `Request blocked: ${data.promptFeedback.blockReason}`);
    }
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    return parts.filter(p => p.text && !p.thought).map(p => p.text).join('');
}

function toParts(content: string | ChatPart[]): GeminiPart[] {
    if (typeof content === 'string') return [{ text: content }];
    return content.flatMap((part): GeminiPart[] => {
        if (part.type === 'text') return [{ text: part.text }];
        const match = /^data:([^;]+);base64,(.+)$/s.exec(part.image_url.url);
        return match ? [{ inlineData: { mimeType: match[1], data: match[2] } }] : [];
    });
}

/** System messages become systemInstruction; assistant becomes the "model" role. */
function toGeminiRequest(messages: ChatMessage[]) {
    const system = messages
        .filter(m => m.role === 'system')
        .map(m => (typeof m.content === 'string' ? m.content : m.content.map(p => (p.type === 'text' ? p.text : '')).join('')))
        .join('\n\n');

    const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: toParts(m.content) }));

    // Gemini rejects an empty conversation; some callers send only a system prompt.
    if (contents.length === 0) contents.push({ role: 'user', parts: [{ text: 'Proceed.' }] });

    return { contents, ...(system && { systemInstruction: { parts: [{ text: system }] } }) };
}

const asChatResponse = (content: string) => ({ choices: [{ message: { role: 'assistant', content } }] });

export async function chat(opts: {
    messages: ChatMessage[];
    temperature?: number;
    response_format?: { type: string };
}) {
    const data = await generate(chatModel(), {
        ...toGeminiRequest(opts.messages),
        generationConfig: {
            temperature: opts.temperature ?? 0.7,
            ...(opts.response_format?.type === 'json_object' && { responseMimeType: 'application/json' }),
        },
    });
    return asChatResponse(textOf(data));
}

/** Web research using Gemini's built-in Google Search grounding. */
export async function search(query: string, context?: string) {
    const prompt = `You are a research assistant. The user is creating a Standard Operating Procedure and needs additional information. Provide relevant, accurate, up-to-date information that would help improve their SOP. Focus on:
- Industry best practices
- Regulatory requirements
- Step-by-step procedures
- Safety and compliance considerations
Format your response as clear, concise bullet points.
${context ? `\nContext about the SOP being created:\n${context}\n` : ''}
Research the following for my SOP: ${query}`;

    const data = await generate(chatModel(), {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.4 },
    });
    return asChatResponse(textOf(data));
}

export async function transcribe(audioBase64: string, mimeType: string, languageName?: string) {
    const hint = languageName ? ` The speaker is most likely speaking ${languageName}.` : '';
    const data = await generate(chatModel(), {
        contents: [{
            role: 'user',
            parts: [
                { text: `Transcribe this audio verbatim in its original language.${hint} Output only the transcript text, nothing else. If there is no speech, output nothing.` },
                { inlineData: { mimeType, data: audioBase64 } },
            ],
        }],
        generationConfig: { temperature: 0 },
    });
    return textOf(data).trim();
}

/** Returns base64 WAV audio. */
export async function speak(text: string, voice = 'Kore') {
    const data = await generate(ttsModel(), {
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
    });
    const audio = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
    if (!audio) throw new GeminiError(502, 'No audio returned by TTS model');

    // generateContent returns headerless PCM (audio/L16;rate=24000); browsers need a container.
    if (/wav/i.test(audio.mimeType)) return audio.data;
    const rate = Number(/rate=(\d+)/.exec(audio.mimeType)?.[1]) || 24000;
    return wrapPcmAsWav(Buffer.from(audio.data, 'base64'), rate).toString('base64');
}

function wrapPcmAsWav(pcm: Buffer, sampleRate: number): Buffer {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // mono
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]);
}

// ─── Video (Files API) ──────────────────────────────────────────────────────

export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export interface VideoFile {
    name: string;
    uri: string;
    mimeType: string;
    state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
    sizeBytes: number;
}

function apiKeyOrThrow(): string {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new GeminiError(500, 'GEMINI_API_KEY not configured on server');
    return apiKey;
}

/**
 * Starts a resumable upload and returns the pre-authorised upload URL. The browser PUTs the
 * video straight to Google (a Vercel function can't take a >4.5 MB body) and never sees the API key.
 */
export async function startVideoUpload(opts: { displayName: string; mimeType: string; sizeBytes: number }): Promise<string> {
    const res = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKeyOrThrow(),
            'X-Goog-Upload-Protocol': 'resumable',
            'X-Goog-Upload-Command': 'start',
            'X-Goog-Upload-Header-Content-Length': String(opts.sizeBytes),
            'X-Goog-Upload-Header-Content-Type': opts.mimeType,
        },
        body: JSON.stringify({ file: { display_name: opts.displayName } }),
    });
    const uploadUrl = res.headers.get('x-goog-upload-url');
    if (!res.ok || !uploadUrl) throw new GeminiError(res.status || 502, 'Could not start video upload');
    return uploadUrl;
}

/**
 * Looks a file up by display name. Google's upload endpoint sends no CORS header on the final
 * response, so the browser can't read the file id back; the unique display name stands in for it.
 */
export async function findVideoFile(displayName: string): Promise<VideoFile | null> {
    let pageToken = '';
    for (let page = 0; page < 5; page++) {
        const res = await fetch(
            `${BASE_URL}/files?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
            { headers: { 'x-goog-api-key': apiKeyOrThrow() } },
        );
        const data = (await res.json().catch(() => ({}))) as {
            files?: { name: string; displayName?: string; uri: string; mimeType: string; state: VideoFile['state']; sizeBytes?: string }[];
            nextPageToken?: string;
            error?: { message?: string };
        };
        if (!res.ok) throw new GeminiError(res.status, data.error?.message || 'Could not list uploaded files');
        const match = data.files?.find(f => f.displayName === displayName);
        if (match) return { ...match, sizeBytes: Number(match.sizeBytes) || 0 };
        if (!data.nextPageToken) return null;
        pageToken = data.nextPageToken;
    }
    return null;
}

export async function deleteFile(name: string): Promise<void> {
    await fetch(`${BASE_URL}/${name}`, { method: 'DELETE', headers: { 'x-goog-api-key': apiKeyOrThrow() } }).catch(() => undefined);
}

export interface VideoSOP {
    title: string;
    purpose: string;
    roles: string[];
    prerequisites: string[];
    steps: { timestampSeconds: number; title: string; instruction: string; notes?: string }[];
    qualityStandards: string[];
    tips: string[];
    troubleshooting: string[];
}

const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim() !== '') : [];

/** Gemini's JSON is model output, so coerce it into the shape the client relies on. */
function normaliseVideoSOP(raw: Record<string, unknown>): VideoSOP {
    const steps = (Array.isArray(raw.steps) ? raw.steps : [])
        .map(s => s as Record<string, unknown>)
        .filter(s => typeof s.title === 'string' && typeof s.instruction === 'string')
        .map(s => ({
            timestampSeconds: Math.max(0, Number(s.timestampSeconds) || 0),
            title: s.title as string,
            instruction: s.instruction as string,
            ...(typeof s.notes === 'string' && s.notes.trim() && { notes: s.notes }),
        }));
    if (steps.length === 0) throw new GeminiError(422, 'No process steps could be identified in this video');

    return {
        title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Untitled process',
        purpose: typeof raw.purpose === 'string' ? raw.purpose : '',
        roles: strings(raw.roles),
        prerequisites: strings(raw.prerequisites),
        steps,
        qualityStandards: strings(raw.qualityStandards),
        tips: strings(raw.tips),
        troubleshooting: strings(raw.troubleshooting),
    };
}

export async function videoToSop(opts: {
    fileUri: string;
    mimeType: string;
    languageName: string;
    industryName: string;
    countryName: string;
}): Promise<VideoSOP> {
    const prompt = `You are an expert ${opts.industryName} consultant and SOP writer. This video is a screen recording of someone performing a business process while narrating it. Watch what happens on screen and listen to the narration, then document the process as a Standard Operating Procedure.

Rules:
- Write everything in ${opts.languageName}, even if the narration is in another language.
- Document only what is actually shown or said. Do not invent steps, tools, or screens.
- List steps in the order they are performed. Each step is one clear action or decision.
- "timestampSeconds" is the time in the video (in seconds) where the screen best shows that step completed or in progress, so a screenshot taken there illustrates it.
- Use the narrator's exact names for buttons, fields, systems and documents.
- Where the narrator mentions rules, exceptions, or mistakes to avoid, put them in "notes", "qualityStandards" or "troubleshooting" as appropriate.
- "qualityStandards", "tips" and "troubleshooting" must come only from things the narrator says or the screen shows. If there are none, return an empty array.
- The procedure takes place in ${opts.countryName}; mention applicable regulation only if the video makes it relevant.
- Never include passwords, API keys, or personal data you can see on screen.

Respond with JSON only, matching exactly this shape:
{
  "title": string,
  "purpose": string,
  "roles": string[],
  "prerequisites": string[],
  "steps": [{ "timestampSeconds": number, "title": string, "instruction": string, "notes": string (optional) }],
  "qualityStandards": string[],
  "tips": string[],
  "troubleshooting": string[]
}`;

    const data = await generate(chatModel(), {
        contents: [{
            role: 'user',
            parts: [
                { fileData: { fileUri: opts.fileUri, mimeType: opts.mimeType } },
                { text: prompt },
            ],
        }],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
    });

    try {
        return normaliseVideoSOP(JSON.parse(textOf(data)) as Record<string, unknown>);
    } catch (error) {
        if (error instanceof GeminiError) throw error;
        throw new GeminiError(502, 'The model returned an unreadable response. Please try again.');
    }
}
