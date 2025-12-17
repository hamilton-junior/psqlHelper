import express from 'express';
import cors from 'cors';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const app = express();
const PORT = process.env.PORT || 3000;

// ESM helpers for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

console.log(`Starting server...`);

// Helper to handle encoding errors automatically
async function queryWithFallback(client, sql, params = []) {
  try {
    return await client.query(sql, params);
  } catch (error) {
    const errorMsg = error.message ? error.message.toLowerCase() : '';
    // Error 22021 is character_not_in_repertoire, often due to encoding mismatch
    const isEncodingError = 
      error.code === '22021' || 
      errorMsg.includes('invalid byte sequence') ||
      errorMsg.includes('encoding');

    if (isEncodingError) {
      console.warn('Encoding error detected. Attempting fallback to LATIN1...');
      try {
        await client.query("SET CLIENT_ENCODING TO 'LATIN1'");
        return await client.query(sql, params);
      } catch (retryError) {
        throw retryError; // If fallback fails, throw original
      }
    }
    throw error;
  }
}

app.post('/api/connect', async (req, res) => {
  const { host, port, user, password, database } = req.body;
  
  if (!host || !port || !user || !database) {
    return res.status(400).json({ error: 'Missing connection details' });
  }

  const client = new Client({
    host,
    port,
    user,
    password,
    database,
    connectionTimeoutMillis: 5000, // 5s timeout
  });

  try {
    await client.connect();
    
    // 1. Fetch Tables
    const tablesQuery = `
      SELECT 
        table_schema, 
        table_name, 
        obj_description((table_schema || '.' || table_name)::regclass) as description
      FROM information_schema.tables
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name;
    `;
    const tablesRes = await queryWithFallback(client, tablesQuery);

    // 2. Fetch Columns
    const columnsQuery = `
      SELECT 
        c.table_schema, 
        c.table_name, 
        c.column_name, 
        c.data_type,
        (
          SELECT COUNT(*) > 0 
          FROM information_schema.key_column_usage kcu
          JOIN information_schema.table_constraints tc 
            ON kcu.constraint_name = tc.constraint_name 
            AND kcu.table_schema = tc.table_schema
          WHERE kcu.table_name = c.table_name 
            AND kcu.column_name = c.column_name
            AND tc.constraint_type = 'PRIMARY KEY'
        ) as is_primary
      FROM information_schema.columns c
      WHERE c.table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY c.ordinal_position;
    `;
    const columnsRes = await queryWithFallback(client, columnsQuery);

    // 3. Fetch Foreign Keys
    const fkQuery = `
      SELECT
          tc.table_schema, 
          tc.table_name, 
          kcu.column_name, 
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY';
    `;
    const fkRes = await queryWithFallback(client, fkQuery);

    // Assemble Schema Object
    const tables = tablesRes.rows.map(t => {
      const tableCols = columnsRes.rows
        .filter(c => c.table_name === t.table_name && c.table_schema === t.table_schema)
        .map(c => {
          // Check for FK
          const fk = fkRes.rows.find(f => 
            f.table_name === t.table_name && 
            f.table_schema === t.table_schema && 
            f.column_name === c.column_name
          );

          return {
            name: c.column_name,
            type: c.data_type,
            isPrimaryKey: !!c.is_primary,
            isForeignKey: !!fk,
            references: fk ? `${fk.foreign_table_schema}.${fk.foreign_table_name}.${fk.foreign_column_name}` : undefined
          };
        });

      return {
        name: t.table_name,
        schema: t.table_schema,
        description: t.description,
        columns: tableCols
      };
    });

    res.json({
      name: database,
      tables: tables
    });

  } catch (err) {
    console.error('Connection error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    try { await client.end(); } catch (e) {}
  }
});

app.post('/api/execute', async (req, res) => {
  const { credentials, sql } = req.body;
  
  if (!credentials || !sql) {
    return res.status(400).json({ error: 'Missing credentials or SQL' });
  }

  const client = new Client(credentials);

  try {
    await client.connect();
    
    // Check if it is multiple statements or single
    // pg driver executes multiple statements if passed as one string, but returns array of results
    // We want to handle single statement mostly for this app
    const result = await queryWithFallback(client, sql);
    
    // Handle case where result might be an array (if multiple statements)
    if (Array.isArray(result)) {
        res.json(result[result.length - 1].rows); // Return last result
    } else {
        res.json(result.rows);
    }
  } catch (err) {
    console.error('Execution error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    try { await client.end(); } catch (e) {}
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});