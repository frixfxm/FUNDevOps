import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: process.env.PORT || 4000,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/messenger_db',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-change-me',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000'
};
