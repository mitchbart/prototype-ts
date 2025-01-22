import dotenv from 'dotenv';
import { ConfigError } from './custom-errors';

dotenv.config();

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new ConfigError(name);
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
            encrypt: false,
            trustServerCertificate: true
        }
    },
    auth: {
        destinationAuthUrl: requireEnv('DESTINATION_AUTH_URL'),
        clientId: requireEnv('CLIENT_ID'),
        clientSecret: requireEnv('CLIENT_SECRET')
    },
    api: {
        destinationApiUrl: requireEnv('DESTINATION_API_URL'),
        version: requireEnv('API_VERSION')
    },
    port: parseInt(process.env.PORT || '3000', 10),
    updateInterval: parseInt(process.env.UPDATE_INTERVAL || '60000', 10)
};