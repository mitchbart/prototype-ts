import express from 'express';
import { getLatestValues } from './db';
import { apiService } from './api-service';

const app = express();
const PORT = 3000;

interface CrusherCache {
    [key: string]: number | null;
}

let previousValues: CrusherCache = {}

function createKey(crusherId: number, parameterName: string): string {
    return `${crusherId}-${parameterName}`;
}

function formatEpochTime(epoch: number): string {
    try {
        const milliseconds = epoch * 1000;
        const date = new Date(milliseconds);
        return date.toLocaleString('en-GB', { timeZone: 'GMT' });
    } catch (error) {
        return 'Invalid Date';
    }
}

function formatValue(value: number | null): number {
    if (value === null) {
        return 0;
    }
    return value;
}

// Utility function for sleeping - used to limit frequency of requests sent
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

async function printLatestValues() {
    try {
        const values = await getLatestValues();
        const timestamp = formatEpochTime(values[0].ValueLastUpdate);
        let changesFound = false;
        
        for (const row of values) {
            await sleep(200);
            const key = createKey(row.CrusherInterfaceId, row.ParameterName);
            const previousValue = previousValues[key];
            const currentValue = formatValue(row.Value);
            const hasChanged = previousValue !== row.Value;
            
            if (hasChanged) {
                if (!changesFound) {
                    console.log('\nValue Changes Detected:', timestamp);
                    console.log('----------------------------------------');
                }
                changesFound = true;
                
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
setInterval(printLatestValues, 60000);

app.listen(PORT, () => {
     console.log(`Server is running on http://localhost:${PORT}`);
});