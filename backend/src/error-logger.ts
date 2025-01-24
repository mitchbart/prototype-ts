// Interface for error logs
interface ErrorLog {
    timestamp: string;
    name: string;
    message: string;
    stack?: string;
}

class ErrorLogger {
    private logs: ErrorLog[] = [];
    private readonly maxLogs: number = 100;

    logError(error: Error): void {
        const errorLog: ErrorLog = {
            timestamp: new Date().toISOString(),
            name: error.name,
            message: error.message,
            stack: error.stack
        };

        this.logs.unshift(errorLog);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }
        console.error(errorLog);
    }

    getLogs(): ErrorLog[] {
        return this.logs;
    }

    clearLogs(): void {
        this.logs = [];
    }
}

export const errorLogger = new ErrorLogger();