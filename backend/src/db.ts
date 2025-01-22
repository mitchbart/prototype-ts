import * as sql from 'mssql';
import { config } from './config';

// Interface matches exact column names from the database
interface CrusherParameter {
    CrusherInterfaceId: number;
    ParameterName: string;
    Value: number | null;
    ValueLastUpdate: number;
}

let pool: sql.ConnectionPool | null = null;

// Init connection pool
// export async function initDb(): Promise<void> {
//     if (!pool) {
//         pool = await sql.connect(config.db);
//     }
// }

// Get connection pool
export async function getPool(): Promise<sql.ConnectionPool> {
    if (!pool) {
        // throw new Error('Pool not initialized. Call initDb() first!');
        console.log("Connection pool not initialised - initialising pool");
        pool = await sql.connect(config.db);
    }
    return pool;
}

export async function closePool(): Promise<void> {
    if (pool) {
        await pool.close();
        pool = null;
    }
}

export async function getLatestValues(): Promise<CrusherParameter[]> {
    try {
        //const pool = await sql.connect(config.db);
        const pool = await getPool();
        
        // Let's first log the raw result to debug
        const result = await pool.request().query(`
            SELECT
                CrusherInterfaceId,
                ParameterName,
                Value,
                ValueLastUpdate
            FROM ${config.db.table}
            ORDER BY ValueLastUpdate DESC
            OFFSET 0 ROWS FETCH FIRST 20 ROWS ONLY
        `);
        
        // Debug log - only for testing
        // console.log('Raw database result:', result.recordset[0]);
        
        // await pool.close();
        return result.recordset;
    } catch (error) {
        console.error('Database error:', error);
        return [];
    }
}