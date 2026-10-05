import type { VercelRequest, VercelResponse } from '@vercel/node';
import { dispatch } from '../_lib/handlers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = String(req.query.action);
    const { status, body } = await dispatch(action, { method: req.method, headers: req.headers, body: req.body });
    res.status(status).json(body);
}
