import jwt from 'jsonwebtoken';
import { Client } from '../models/Client.js';

const SECRET = process.env.JWT_SECRET;

export async function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'no token' });
    const payload = jwt.verify(token, SECRET);
    const client = await Client.findById(payload.sub);
    if (!client) return res.status(401).json({ error: 'invalid token' });
    if (!client.active) return res.status(403).json({ error: 'account disabled' });
    req.client = client;
    next();
  } catch (e) {
    res.status(401).json({ error: 'unauthorized' });
  }
}

export function adminOnly(req, res, next) {
  if (req.client?.role !== 'admin') return res.status(403).json({ error: 'admin only' });
  next();
}
