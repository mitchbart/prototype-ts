import express from 'express';
import { closePool } from './db';
import { config } from './config';
import { errorLogger } from './error-logger';
import { CrusherService } from './crusher-service';

class Server {
    private app = express();
    private port = config.port;
    private server;
    private crusherService = new CrusherService();

    constructor() {
        this.setupRoutes();
        this.server = this.app.listen(this.port, () => {
            console.log(`Server is running on http://localhost:${this.port}`);
        });
    }

    private setupRoutes(): void {
        this.app.get('/api/errors', (req, res) => {
            res.json(errorLogger.getLogs());
        });

        this.app.delete('/api/errors', (req, res) => {
            errorLogger.clearLogs();
            res.sendStatus(204);
        });
    }

    async start(): Promise<void> {
        await this.crusherService.startUpdateInterval();
    }

    async shutdown(signal: string): Promise<void> {
        console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
        try {
            await new Promise<void>((resolve, reject) => {
                this.server.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            console.log('HTTP server closed');

            await closePool();
            console.log('Database connections closed');

            console.log('Graceful shutdown completed');
            process.exit(0);
        } catch (err) {
            console.error('Error during shutdown:', err);
            process.exit(1);
        }
    }
}

// Application initialization
const server = new Server();
server.start();

// Register shutdown handlers
process.on('SIGTERM', () => server.shutdown('SIGTERM'));
process.on('SIGINT', () => server.shutdown('SIGINT'));