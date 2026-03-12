CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users (full_name, username, password_hash, avatar_url)
VALUES
  ('Люба', 'luba', crypt('May122004!', gen_salt('bf')), 'https://placehold.co/64x64?text=L'),
  ('Петр Петрович', 'peta', crypt('petaOWN', gen_salt('bf')), 'https://placehold.co/64x64?text=P'),
  ('Толя', 'tolya', crypt('Tolik0508', gen_salt('bf')), 'https://placehold.co/64x64?text=T'),
  ('Хомяк', 'dima', crypt('DIMASIK1213', gen_salt('bf')), 'https://placehold.co/64x64?text=H'),
  ('Влад', 'vlad', crypt('vladLadaSedan', gen_salt('bf')), 'https://placehold.co/64x64?text=V'),
  ('Санечка', 'sasha', crypt('sanechkaPASS', gen_salt('bf')), 'https://placehold.co/64x64?text=S');

INSERT INTO messages (sender_id, receiver_id, body)
VALUES
  (1, 2, 'Привет, Петр Петрович!'),
  (2, 1, 'Здравствуйте, Люба. Как дела?'),
  (3, 1, 'Люба, пошли пить чай.'),
  (4, 3, 'Толя, у меня есть семечки.');
