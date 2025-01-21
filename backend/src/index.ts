import express from 'express';
import { getLatestValues } from './db';
import { apiService } from './api-service';
import { config } from './config';

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
        console.error(`Failed to update value for crusher ${crusherId}, parameter ${parameterName}:`, error);
    }
}

// Print values from SQL database to console
async function printLatestValues() {
    try {
        const values = await getLatestValues(); // Get latest values from source database
        // Check values retreived before getting timestamp
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
                console.log(`Crusher Interface ID: ${row.CrusherInterfaceId}`);
                console.log(`Parameter: ${row.ParameterName}`);
                console.log(`Value: ${currentValue}`);
                console.log('----------------------------------------');
                
                // Send update to API
                await updateChangedValue(row.CrusherInterfaceId, row.ParameterName, currentValue);
            }
            
            // Update cache with new value
            previousValues[key] = row.Value;
        }
        
        if (!changesFound) {
            console.log(`\n${timestamp}: No value changes detected`);
        }
        
    } catch (error) {
        console.error('Error fetching values:', error);
    }
}

// Print values immediately and then every minute
printLatestValues();
//setInterval(printLatestValues, 60000);

// Mutex-like pattern to prevent overlap if any printLatestValues runs longer than interval time
let isRunning = false;
setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
        await printLatestValues();
    } catch (error) {
        console.error(error);
    } finally {
        isRunning = false;
    }
}, config.updateInterval);

app.listen(PORT, () => {
     console.log(`Server is running on http://localhost:${PORT}`);
});