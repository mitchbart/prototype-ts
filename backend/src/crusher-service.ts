import { getLatestValues, dbHealthCheck } from './db';
import { apiService } from './api-service';
import { config } from './config';
import { AppError, HealthCheckError } from './custom-errors';
import { errorLogger } from './error-logger';

interface CrusherCache {
    [key: string]: number | null;
}

export class CrusherService {
    private previousValues: CrusherCache = {};
    private isRunning: boolean = false;

    private createKey(crusherId: number, parameterName: string): string {
        return `${crusherId}-${parameterName}`;
    }

    private formatEpochTime(epoch: number): string {
        try {
            const milliseconds = epoch * 1000;
            const date = new Date(milliseconds);
            return date.toLocaleString('en-GB', { timeZone: 'GMT' });
        } catch (error) {
            return 'Invalid Date';
        }
    }

    private formatValue(value: number | null): number {
        return value === null ? 0 : value;
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async updateChangedValue(crusherId: number, parameterName: string, value: number): Promise<void> {
        try {
            await apiService.updateParameter({ crusherId, parameterName, value });
            console.log(`Successfully updated crusher ${crusherId} parameter ${parameterName}`);
        } catch (error) {
            if (error instanceof AppError) {
                console.error(error.message);
            } else {
                console.error(`Unexpected error: ${error instanceof Error ? error.message : 'unknown error'}`);
            }
        }
    }

    async updateValues(): Promise<void> {
        try {
            await Promise.all([apiService.apiHealthCheck(), dbHealthCheck()]);
            
            const values = await getLatestValues();
            if (values.length === 0) {
                console.log('No values retrieved from database');
                return;
            }
            console.log(`Values returned: ${values.length}`); // Testing log

            const timestamp = this.formatEpochTime(values[0].ValueLastUpdate);
            let changesFound = false;

            console.log(`Values from: ${timestamp}`); // Testing timestamp

            for (const row of values) {
                const key = this.createKey(row.CrusherInterfaceId, row.ParameterName);
                const previousValue = this.previousValues[key];
                const currentValue = this.formatValue(row.Value);
                
                if (previousValue !== row.Value) {
                    await this.sleep(50);
                    if (!changesFound) {
                        console.log(`\nValue Changes Detected: ${timestamp}`);
                        console.log('----------------------------------------');
                    }
                    changesFound = true;
                    
                    await this.updateChangedValue(row.CrusherInterfaceId, row.ParameterName, currentValue);
                }
                
                this.previousValues[key] = row.Value;
            }

            console.log('----------------------------------------');
            if (!changesFound) {
                console.log(`\n${timestamp}: No value changes detected`);
            }

        } catch (error) {
            if (error instanceof HealthCheckError) {
                console.log(`Skipping updates: ${error.message}`);
                console.log(`Will retry in ${config.updateInterval/1000} seconds.`);
            }
            errorLogger.logError(error instanceof Error ? error : new Error('Unknown error occurred'));
        }
    }

    async startUpdateInterval(): Promise<void> {
        await this.updateValues();
        
        setInterval(async () => {
            if (this.isRunning) return;
            this.isRunning = true;
            try {
                await this.updateValues();
            } catch (error) {
                console.error(error);
            } finally {
                this.isRunning = false;
            }
        }, config.updateInterval);
    }
}