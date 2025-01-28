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
            // console.log(`Successfully updated crusher ${crusherId} parameter ${parameterName}`);
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
            // Perform health checks - error thrown if either doesn't pass
            await Promise.all([apiService.apiHealthCheck(), dbHealthCheck()]);
            
            // Get latest values from source
            const values = await getLatestValues();
            if (values.length === 0) { // This scenario should technically never happen
                console.log('No values retrieved from database');
                return;
            }
            // console.log(`Values returned: ${values.length}`); // Testing log

            // Timestamp when update performed
            const currTimestamp = new Date().toLocaleString("en-GB", {timeZone: "Australia/Brisbane"});
            // Timestamp when source DB updated
            const sourceTimestamp = this.formatEpochTime(values[0].ValueLastUpdate);
            let changesFound = false;

            

            for (const row of values) {
                const key = this.createKey(row.CrusherInterfaceId, row.ParameterName);
                const previousValue = this.previousValues[key];
                const currentValue = this.formatValue(row.Value);
                
                if (previousValue !== row.Value) {
                    await this.sleep(50); // Small pause to avoid rate limiting
                    if (!changesFound) {
                        console.log(`\nSource DB Time Updated: ${sourceTimestamp}`);
                        console.log(`Value Changes Detected: ${currTimestamp}`);
                        console.log('--------------------------------------------');
                    }
                    changesFound = true;
                    await this.updateChangedValue(row.CrusherInterfaceId, row.ParameterName, currentValue);
                }
                // Previous value should only be updated if there are no errors
                this.previousValues[key] = row.Value;
            }
            console.log('--------------------------------------------');
            if (!changesFound) {
                console.log(`No Value Changes Found: ${currTimestamp}`);
                console.log('--------------------------------------------');
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