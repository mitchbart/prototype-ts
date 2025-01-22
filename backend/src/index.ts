import express from 'express';
import { getLatestValues } from './db';
import { apiService } from './api-service';
import { config } from './config';
import { closePool } from './db';
import { AppError } from './custom-errors';

const app = express();
const PORT = 3000;

interface CrusherCache {
    [key: string]: number | null;
}

// Init previous values hashmap - previous values are compared to current values to check if update is required
let previousValues: CrusherCache = {}

// Key for caching consists of crusher id + paramter name
function createKey(crusherId: number, parameterName: string): string {
    return `${crusherId}-${parameterName}`;
}

// Function to format epoch time from crusher SQL database
// Epoch time in this database is not localised, setting timezone to GMT gets the correct time
function formatEpochTime(epoch: number): string {
    try {
        const milliseconds = epoch * 1000;
        const date = new Date(milliseconds);
        return date.toLocaleString('en-GB', { timeZone: 'GMT' });
    } catch (error) {
        return 'Invalid Date';
    }
}

// Null values are set to zero
function formatValue(value: number | null): number {
    if (value === null) {
        return 0;
    }
    return value;
}

// Utility function for sleeping - used to limit frequency of requests sent to prevent overwhelming api
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Function to send parameters that have changed to api service for patching
async function updateChangedValue(crusherId: number, parameterName: string, value: number) {
    try {
        await apiService.updateParameter({
            crusherId,
            parameterName,
            value
        });
    } catch (error) {
        if (error instanceof AppError) {
            console.error(error.message);
        } else {
            console.error(`Unexpected error: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }
}

// Print values from SQL database to console, patch any updatedvalues to api
async function updateValues() {
    try {
        // Check API health before proceeding
        const isApiHealthy = await apiService.healthCheck();
        if (!isApiHealthy) {
            console.log('Skipping updates: API is not responding');
            return;
        }

        // Get latest values from source database
        const values = await getLatestValues();
        // Check values retreived before getting timestamp - should never happen as error will be thrown prior
        if (values.length === 0) {
            console.log('No values retrieved from database');
            return;
        }
        // Create timestamp of when values were updated according to db
        const timestamp = formatEpochTime(values[0].ValueLastUpdate); 
        let changesFound = false; // Init changes found as false
        

        // Iterate over each row of values
        for (const row of values) {
            const key = createKey(row.CrusherInterfaceId, row.ParameterName); // Create key
            const previousValue = previousValues[key]; // Get previous value
            const currentValue = formatValue(row.Value); // Get current value, format null to zero
            const hasChanged = previousValue !== row.Value; // Check if value has changed
            
            if (hasChanged) { // If value has changed
                await sleep(50); // Stagger so destination api isnt overwhelmed
                // Output only when first change found
                if (!changesFound) {
                    console.log('\nValue Changes Detected:', timestamp);
                    console.log('----------------------------------------');
                }
                changesFound = true; // Flip changes found switch
                
                // Info output to console
                // console.log(`Crusher Interface ID: ${row.CrusherInterfaceId}`);
                // console.log(`Parameter: ${row.ParameterName}`);
                // console.log(`Value: ${currentValue}`);
                // console.log('----------------------------------------');
                
                // Send update to API
                await updateChangedValue(row.CrusherInterfaceId, row.ParameterName, currentValue);
            }
            
            // Update cache with new value
            previousValues[key] = row.Value;
        }
        // Format line
        console.log('----------------------------------------');
        
        if (!changesFound) {
            console.log(`\n${timestamp}: No value changes detected`);
        }
        
    } catch (error) {
        if (error instanceof AppError) {
            console.error(error.message);
        } else {
            console.error(`Error updating values: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }
    // Add to track next update time
    console.log("Next update at: ");
}

// Print values immediately and then every minute
updateValues();

// Mutex-like pattern to prevent overlap if any updateValues runs longer than interval time
let isRunning = false;
setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
        await updateValues();
    } catch (error) {
        console.error(error);
    } finally {
        isRunning = false;
    }
}, config.updateInterval);

const server = app.listen(PORT, () => {
     console.log(`Server is running on http://localhost:${PORT}`);
});

// Unified cleanup function
async function gracefulShutdown(signal: string) {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    try {
        // Close the HTTP server first to stop accepting new requests
        await new Promise<void>((resolve, reject) => {
            server.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('HTTP server closed');

        // Close the database pool
        await closePool();
        console.log('Database connections closed');

        console.log('Graceful shutdown completed');
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
}

// Register the handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));