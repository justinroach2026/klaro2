/**
 * Dev-only Vite middleware that serves /api/ai/* using the same handlers as the
 * Vercel function in api/ai/[action].ts. Production uses Vercel; this keeps `npm run dev` working.
 */
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { dispatch } from '../api/_lib/handlers.js';

export function aiProxyPlugin(): Plugin {
    return {
        name: 'ai-proxy',
        configResolved(config) {
            // Expose server-only vars (GEMINI_API_KEY etc.) to the handlers via process.env, as on Vercel.
            for (const [key, value] of Object.entries(loadEnv(config.mode, config.root, ''))) {
                process.env[key] ??= value;
            }
        },
        configureServer(server) {
            server.middlewares.use('/api/ai', async (req, res) => {
                const action = (req.url || '').split('?')[0].replace(/^\/+/, '');
                const chunks: Buffer[] = [];
                for await (const chunk of req) chunks.push(chunk as Buffer);
                const raw = Buffer.concat(chunks).toString('utf-8');

                let body: unknown = {};
                try {
                    body = raw ? JSON.parse(raw) : {};
                } catch {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                    return;
                }

                const { status, body: payload } = await dispatch(action, { method: req.method, headers: req.headers, body });
                res.statusCode = status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(payload));
            });
        },
    };
}
