import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const userId = Number(payload.sub);

    req.user = {
      id: userId,
      username: payload.username,
      fullName: payload.fullName
    };

    pool
      .query('UPDATE users SET last_seen = NOW() WHERE id = $1', [userId])
      .catch(() => {});

    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}
