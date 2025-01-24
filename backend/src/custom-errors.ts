export class AppError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ConfigError extends AppError {
    constructor(envVar: string) {
        super(`Missing required environment variable: ${envVar}`);
    }
}

export class DatabaseError extends AppError {
    constructor(operation: string, details?: string) {
        super(`Database ${operation} failed${details ? `: ${details}` : ''}`);
    }
}

export class AuthenticationError extends AppError {
    constructor(details?: string) {
        super(`Authentication failed${details ? `: ${details}` : ''}`);
    }
}

export class ApiError extends AppError {
    constructor(operation: string, crusherId: number, parameterName: string, details?: string) {
        super(`API ${operation} failed for crusher ${crusherId}, parameter ${parameterName}${details ? `: ${details}` : ''}`);
    }
}

export class ConnectionError extends AppError {
    constructor(service: string, details?: string) {
        super(`Failed to connect to ${service}${details ? `: ${details}` : ''}`);
    }
}

export class HealthCheckError extends AppError {
    constructor(service: string, details?: string) {
        super(`Health check failed for ${service}${details ? `: ${details}` : ''}`);
    }
}