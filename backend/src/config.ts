import dotenv from 'dotenv';
import { ConfigError } from './errors';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  db: {
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    server: requireEnv('DB_SERVER'),
    database: requireEnv('DB_DATABASE'),
    table: requireEnv('DB_TABLE'),
    options: {
      encrypt: true,
      trustServerCertificate: true
    }
  },
  auth: {
    destinationAuthUrl: requireEnv('DESTINATION_AUTH_URL'),
    clientId: requireEnv('CLIENT_ID'),
    clientSecret: requireEnv('CLIENT_SECRET')

  },
  port: parseInt(process.env.PORT || '3000', 10),
  updateInterval: parseInt(process.env.UPDATE_INTERVAL || '60000', 10)
};