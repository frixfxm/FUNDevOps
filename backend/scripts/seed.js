/**
 * Добавляет или обновляет пользователя МАКСОН в БД.
 * Запускать при уже существующей БД (после git pull), когда init.sql не перезапускался.
 * Использует bcrypt, как в auth — логин и пароль будут работать.
 *
 * Запуск: из корня backend — node scripts/seed.js
 * Или: npm run seed
 */
import '../src/config/env.js';
import { pool } from '../src/config/db.js';
import bcrypt from 'bcryptjs';

const USER = {
  full_name: 'МАКСОН',
  username: 'max',
  password: 'MaxonChinazes',
  avatar_url: 'https://placehold.co/64x64?text=M'
};

async function seed() {
  const passwordHash = await bcrypt.hash(USER.password, 10);
  const query = `
    INSERT INTO users (full_name, username, password_hash, avatar_url)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (username) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      password_hash = EXCLUDED.password_hash,
      avatar_url = EXCLUDED.avatar_url
  `;
  await pool.query(query, [
    USER.full_name,
    USER.username,
    passwordHash,
    USER.avatar_url
  ]);
  console.log('Пользователь max (МАКСОН) добавлен или обновлён.');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
