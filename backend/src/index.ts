import express from 'express';
import { getLatestValues } from './db';
import { authService } from './auth-service';

const app = express();
const PORT = 3000;

// CrusherCache used to store previous values to detect any changes
interface CrusherCache {
    [key: string]: number | null;
}

let previousValues: CrusherCache = {}

// Key used for cache - crusher id + parameter name
function createKey(crusherId: number, parameterName: string): string {
    return `${crusherId}-${parameterName}`;
}

// Used to convert epoch time from source DB - not currently used but may be useful for determining update times
function formatEpochTime(epoch: number): string {
    try {
        // Convert epoch to milliseconds if it's in seconds
        const milliseconds = epoch * 1000;
        const date = new Date(milliseconds);
        return date.toLocaleString('en-GB', { timeZone: 'GMT' });
    } catch (error) {
        return 'Invalid Date';
    }
}

// Null values converted to 0
function formatValue(value: number | null): number {
    if (value === null) {
        return 0;
    }
    return value;
}

async function printLatestValues() {
    try {
        const values = await getLatestValues();
        //const timestamp = new Date().toLocaleString();
        const timestamp = formatEpochTime(values[0].ValueLastUpdate);
        let changesFound = false;
        
        values.forEach((row) => {
            const key = createKey(row.CrusherInterfaceId, row.ParameterName);
            const previousValue = previousValues[key];
            const hasChanged = previousValue !== row.Value;
            
            if (hasChanged) {
                if (!changesFound) {
                    console.log('\nValue Changes Detected:', timestamp);
                    console.log('----------------------------------------');
                }
                changesFound = true;
                
                console.log(`Crusher Interface ID: ${row.CrusherInterfaceId}`);
                console.log(`Parameter: ${row.ParameterName}`);
                console.log(`Value: ${formatValue(row.Value)}`);
                console.log('----------------------------------------');
            }
            
            // Update cache with new value
            previousValues[key] = row.Value;
        });
        
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