/**
 * Vite server middleware plugin for proxying OpenAI API calls
 * and fetching web content for the AI interviewer.
 * 
 * This keeps the OPENAI_API_KEY on the server side only (no VITE_ prefix),
 * preventing it from being bundled into client-side JavaScript.
 * 
 * For production, replace this with Supabase Edge Functions or a backend API.
 */
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';

export function aiProxyPlugin(): Plugin {
    let apiKey: string | undefined;

    return {
        name: 'ai-proxy',
        configResolved(config) {
            // Load ALL env vars (including non-VITE_ prefixed ones) using empty prefix
            const env = loadEnv(config.mode, config.root, '');
            apiKey = env.OPENAI_API_KEY;
        },
        configureServer(server) {
            // ─── OpenAI Chat Proxy ───────────────────────────────
            server.middlewares.use('/api/ai/chat', async (req, res) => {
                if (req.method !== 'POST') {
                    res.statusCode = 405;
                    res.end(JSON.stringify({ error: 'Method not allowed' }));
                    return;
                }

                if (!apiKey) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'OPENAI_API_KEY not configured on server' }));
                    return;
                }

                try {
                    const body = await readBody(req);
                    const { messages, temperature = 0.7, max_tokens, model = 'gpt-4o', response_format } = JSON.parse(body);

                    const openaiBody: any = {
                        model,
                        messages,
                        temperature,
                    };
                    if (max_tokens) openaiBody.max_tokens = max_tokens;
                    if (response_format) openaiBody.response_format = response_format;

                    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify(openaiBody),
                    });

                    const data = await openaiRes.json();

                    res.statusCode = openaiRes.status;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                } catch (error: any) {
                    console.error('[ai-proxy] Chat error:', error);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: error.message || 'Internal server error' }));
                }
            });

            // ─── URL Content Fetcher ─────────────────────────────
            // Fetches a webpage and extracts its text content server-side
            server.middlewares.use('/api/ai/fetch-url', async (req, res) => {
                if (req.method !== 'POST') {
                    res.statusCode = 405;
                    res.end(JSON.stringify({ error: 'Method not allowed' }));
                    return;
                }

                try {
                    const body = await readBody(req);
                    const { url } = JSON.parse(body);

                    if (!url || typeof url !== 'string') {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'URL is required' }));
                        return;
                    }

                    // Validate URL format
                    let parsedUrl: URL;
                    try {
                        parsedUrl = new URL(url);
                        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                            throw new Error('Only HTTP/HTTPS URLs are supported');
                        }
                    } catch {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Invalid URL format' }));
                        return;
                    }

                    console.log(`[ai-proxy] Fetching URL: ${url}`);

                    const response = await fetch(url, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; KlaroBot/1.0; +https://klaro.app)',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        },
                        signal: AbortSignal.timeout(15000), // 15 second timeout
                    });

                    if (!response.ok) {
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({
                            success: false,
                            error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
                        }));
                        return;
                    }

                    const html = await response.text();

                    // Extract text content from HTML (basic but effective)
                    const textContent = extractTextFromHTML(html);

                    // Truncate to avoid overwhelming the LLM context
                    const maxChars = 8000;
                    const truncated = textContent.length > maxChars
                        ? textContent.substring(0, maxChars) + '\n\n[Content truncated — showing first 8,000 characters]'
                        : textContent;

                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        success: true,
                        url: url,
                        title: extractTitle(html),
                        content: truncated,
                        contentLength: textContent.length,
                    }));

                } catch (error: any) {
                    console.error('[ai-proxy] URL fetch error:', error);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        success: false,
                        error: error.message || 'Failed to fetch URL',
                    }));
                }
            });

            // ─── Web Search ──────────────────────────────────────
            // Uses OpenAI's web search capability via the responses API
            server.middlewares.use('/api/ai/search', async (req, res) => {
                if (req.method !== 'POST') {
                    res.statusCode = 405;
                    res.end(JSON.stringify({ error: 'Method not allowed' }));
                    return;
                }

                if (!apiKey) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'OPENAI_API_KEY not configured on server' }));
                    return;
                }

                try {
                    const body = await readBody(req);
                    const { query, context } = JSON.parse(body);

                    // Use GPT-4o with a web-search-oriented prompt to synthesize information
                    const searchMessages = [
                        {
                            role: 'system',
                            content: `You are a research assistant. The user is creating a Standard Operating Procedure and needs additional information. Based on the search query, provide relevant, accurate, and up-to-date information that would help improve their SOP. Focus on:
- Industry best practices
- Regulatory requirements
- Step-by-step procedures
- Safety and compliance considerations
Format your response as clear, concise bullet points.`
                        },
                        ...(context ? [{ role: 'user', content: `Context about the SOP being created:\n${context}` }] : []),
                        { role: 'user', content: `Research the following for my SOP: ${query}` }
                    ];

                    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify({
                            model: 'gpt-4o',
                            messages: searchMessages,
                            temperature: 0.4,
                            max_tokens: 1000,
                        }),
                    });

                    const data = await openaiRes.json();

                    res.statusCode = openaiRes.status;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                } catch (error: any) {
                    console.error('[ai-proxy] Search error:', error);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: error.message || 'Search failed' }));
                }
            });
        },
    };
}

// ─── Helpers ─────────────────────────────────────────────

function readBody(req: any): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => { 
            chunks.push(chunk); 
        });
        req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve(buffer.toString('utf-8'));
        });
        req.on('error', reject);
    });
}

/** Extract readable text from HTML, stripping tags and scripts */
function extractTextFromHTML(html: string): string {
    // Remove script and style blocks entirely
    let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '');

    // Convert common block elements to newlines
    text = text
        .replace(/<\/?(h[1-6]|p|div|br|li|tr|td|th|blockquote|pre)[^>]*>/gi, '\n')
        .replace(/<\/?(ul|ol|table|tbody|thead)[^>]*>/gi, '\n');

    // Remove remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode common HTML entities
    text = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#\d+;/g, '');

    // Clean up whitespace
    text = text
        .replace(/[ \t]+/g, ' ')         // collapse horizontal whitespace
        .replace(/\n\s*\n/g, '\n\n')     // collapse multiple blank lines
        .trim();

    return text;
}

/** Extract the page title from HTML */
function extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return match
        ? match[1].replace(/\s+/g, ' ').trim()
        : 'Untitled Page';
}
