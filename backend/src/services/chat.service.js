import { pool } from '../config/db.js';

export async function getUsers(currentUserId) {
  const query = `
    SELECT id, full_name, username, avatar_url
    FROM users
    WHERE id <> $1
    ORDER BY full_name
  `;

  const { rows } = await pool.query(query, [currentUserId]);
  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    avatarUrl: row.avatar_url
  }));
}

export async function getMessages(userId, peerId) {
  const query = `
    SELECT
      m.id,
      m.sender_id,
      m.receiver_id,
      m.body,
      m.created_at,
      sender.full_name AS sender_name,
      receiver.full_name AS receiver_name
    FROM messages m
    JOIN users sender ON sender.id = m.sender_id
    JOIN users receiver ON receiver.id = m.receiver_id
    WHERE
      (m.sender_id = $1 AND m.receiver_id = $2)
      OR
      (m.sender_id = $2 AND m.receiver_id = $1)
    ORDER BY m.created_at ASC
  `;

  const { rows } = await pool.query(query, [userId, peerId]);
  return rows.map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    body: row.body,
    createdAt: row.created_at,
    senderName: row.sender_name,
    receiverName: row.receiver_name
  }));
}

export async function createMessage(senderId, receiverId, body) {
  const query = `
    INSERT INTO messages (sender_id, receiver_id, body)
    VALUES ($1, $2, $3)
    RETURNING id, sender_id, receiver_id, body, created_at
  `;

  const { rows } = await pool.query(query, [senderId, receiverId, body]);
  const row = rows[0];

  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    body: row.body,
    createdAt: row.created_at
  };
}
