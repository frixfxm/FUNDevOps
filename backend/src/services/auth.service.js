import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';

export async function loginUser(login, password) {
  const query = `
    SELECT id, full_name, username, password_hash, avatar_url
    FROM users
    WHERE username = $1
    LIMIT 1
  `;

  const { rows } = await pool.query(query, [login]);
  const user = rows[0];

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return null;
  }

  const token = jwt.sign(
    {
      sub: user.id,
      username: user.username,
      fullName: user.full_name
    },
    env.jwtSecret,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      fullName: user.full_name,
      username: user.username,
      avatarUrl: user.avatar_url
    }
  };
}
