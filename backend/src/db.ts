import * as sql from 'mssql';
import { config } from './config';

// Interface matches exact column names from the database
interface CrusherParameter {
    CrusherInterfaceId: number;
    ParameterName: string;
    Value: number | null;
    ValueLastUpdate: number;
}

export async function getLatestValues(): Promise<CrusherParameter[]> {
    try {
        const pool = await sql.connect(config.db);
        
        // Let's first log the raw result to debug
        const result = await pool.request()
            .query(`
                SELECT
                    CrusherInterfaceId,
                    ParameterName,
                    Value,
                    ValueLastUpdate
                FROM ${config.db.table}
                ORDER BY Id DESC
                OFFSET 0 ROWS FETCH FIRST 20 ROWS ONLY
            `);
        
        // Debug log - only for testing
        // console.log('Raw database result:', result.recordset[0]);
        
        await pool.close();
        return result.recordset;
    } catch (error) {
        console.error('Database error:', error);
        return [];
    }
}