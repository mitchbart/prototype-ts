import * as sql from 'mssql';
import { config } from './config';
import { DatabaseError, ConnectionError, HealthCheckError } from './custom-errors';

// Interface matches exact column names from the database
interface CrusherParameter {
    CrusherInterfaceId: number;
    ParameterName: string;
    Value: number | null;
    ValueLastUpdate: number;
}

let pool: sql.ConnectionPool | null = null;

// Get connection pool
export async function getPool(): Promise<sql.ConnectionPool> {
    if (!pool) {
        try {
            console.log("Initialising source database connection pool");
            pool = await sql.connect(config.db);
        } catch (error) {
            throw new ConnectionError('source database', error instanceof Error ? error.message : 'unknown error');
        }
        
    }
    return pool;
}

// Close connection pool
export async function closePool(): Promise<void> {
    if (pool) {
        console.log("Connection pool closing.");
        await pool.close();
        pool = null;
    }
}

// Helper function to check database health
export async function dbHealthCheck(): Promise<void> {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT 1');
        if (result.recordset.length !== 1) {
            throw new HealthCheckError('database', 'Invalid response from health check query');
        }
    } catch (error) {
        throw new HealthCheckError('database', error instanceof Error ? error.message : 'unknown error');
    }
}

// Get latest update from database
export async function getLatestValues(): Promise<CrusherParameter[]> {
    try {
        //const pool = await sql.connect(config.db);
        const pool = await getPool();
        
        // Update later so users can enter custom query
        const result = await pool.request().query(`
            SELECT
                CrusherInterfaceId,
                ParameterName,
                Value,
                ValueLastUpdate
            FROM ${config.db.table}
            ORDER BY ValueLastUpdate DESC
            OFFSET 0 ROWS FETCH FIRST ${config.db.rows} ROWS ONLY
        `);
        
        // Debug log - only for testing
        // console.log('Raw database result:', result.recordset[0]);
        
        // await pool.close();
        return result.recordset;
    } catch (error) {
        //await closePool(); is it worth closing the database here?
        throw new DatabaseError('query', error instanceof Error ? error.message : 'unknown error');
        // Previously returned empty array - is this still required?
        // return [];
    }
}