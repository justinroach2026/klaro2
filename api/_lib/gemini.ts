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
}

interface GeminiResponse {
    candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    error?: { message?: string };
}

const chatModel = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// The lite voice is ~1 s faster per spoken reply, which matters more than studio fidelity in hands-free mode.
const ttsModel = () => process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts';

// Gemini defaults to medium thinking, which roughly doubles latency on conversational turns.
const interactiveThinking = () => ({ thinkingConfig: { thinkingLevel: process.env.GEMINI_THINKING_LEVEL || 'low' } });

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
            ...interactiveThinking(),
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
        generationConfig: { temperature: 0.4, ...interactiveThinking() },
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
        generationConfig: { temperature: 0, ...interactiveThinking() },
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
