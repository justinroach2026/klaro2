import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_CHARS = 8000;
const MAX_REDIRECTS = 3;

function isPrivateAddress(ip: string): boolean {
    if (isIP(ip) === 6) {
        const v = ip.toLowerCase();
        if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
        return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
    }
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Rejects non-http(s) URLs and hosts that resolve to private/loopback/link-local addresses. */
async function assertPublicUrl(raw: string): Promise<URL> {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new Error('Invalid URL format');
    }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP/HTTPS URLs are supported');

    const host = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (addresses.some(a => isPrivateAddress(a.address))) throw new Error('URL points to a private network address');
    return url;
}

export async function fetchUrlContent(rawUrl: string) {
    let url = await assertPublicUrl(rawUrl);
    let response: Response | undefined;

    // Follow redirects manually so every hop is re-validated.
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        response = await fetch(url, {
            redirect: 'manual',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; KlaroBot/1.0; +https://klaro.app)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(15000),
        });
        const location = response.headers.get('location');
        if (response.status >= 300 && response.status < 400 && location) {
            url = await assertPublicUrl(new URL(location, url).toString());
            continue;
        }
        break;
    }

    if (!response || !response.ok) {
        return { success: false, error: `Failed to fetch URL: ${response?.status} ${response?.statusText}` };
    }

    const html = await response.text();
    const text = extractTextFromHTML(html);
    return {
        success: true,
        url: rawUrl,
        title: extractTitle(html),
        content: text.length > MAX_CHARS
            ? text.substring(0, MAX_CHARS) + `\n\n[Content truncated — showing first ${MAX_CHARS.toLocaleString()} characters]`
            : text,
        contentLength: text.length,
    };
}

/** Extract readable text from HTML, stripping tags and scripts */
function extractTextFromHTML(html: string): string {
    let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '');

    text = text
        .replace(/<\/?(h[1-6]|p|div|br|li|tr|td|th|blockquote|pre)[^>]*>/gi, '\n')
        .replace(/<\/?(ul|ol|table|tbody|thead)[^>]*>/gi, '\n');

    text = text.replace(/<[^>]+>/g, ' ');

    text = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#\d+;/g, '');

    return text
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
}

function extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return match ? match[1].replace(/\s+/g, ' ').trim() : 'Untitled Page';
}
