import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Client } = pg;
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

console.log(`Starting server...`);

// Helper to handle encoding errors automatically with multiple fallbacks
async function queryWithFallback(client, sql, params = []) {
  try {
    return await client.query(sql, params);
  } catch (error) {
    // Code 22021: character_not_in_repertoire / invalid_byte_sequence
    const errorMsg = error.message ? error.message.toLowerCase() : '';
    const isEncodingError = 
      error.code === '22021' || 
      errorMsg.includes('invalid byte sequence') ||
      errorMsg.includes('encoding') ||
      errorMsg.includes('utf8');

    if (isEncodingError) {
      console.warn(`[Encoding Fix] Error detected: ${error.message}`);
      
      // Attempt 1: WIN1252 (Common in legacy BR systems)
      try {
        console.warn(`[Encoding Fix] Switching client_encoding to 'WIN1252' and retrying...`);
        await client.query("SET client_encoding TO 'WIN1252'");
        return await client.query(sql, params);
      } catch (retryError) {
        // Attempt 2: LATIN1 (ISO-8859-1)
        console.warn(`[Encoding Fix] WIN1252 failed. Switching to 'LATIN1' and retrying...`);
        try {
           await client.query("SET client_encoding TO 'LATIN1'");
           return await client.query(sql, params);
        } catch (finalError) {
           console.error(`[Encoding Fix] All encoding fallbacks failed.`);
           throw finalError;
        }
      }
    }
    throw error;
  }
}

// Endpoint to test connection and fetch schema
app.post('/api/connect', async (req, res) => {
  console.log('--- Received connection request ---');
  const { host, port, user, database } = req.body;
  console.log(`Target: ${user}@${host}:${port}/${database}`);
  
  const client = new Client({
    host,
    port: parseInt(port),
    user,
    password: req.body.password,
    database,
    ssl: false,
    connectionTimeoutMillis: 5000 
  });

  try {
    console.log("Attempting to connect to Postgres...");
    await client.connect();
    console.log("Connected successfully. Fetching schema components...");

    // Execute metadata queries in parallel for better performance
    // Instead of one giant join which can be slow on information_schema views,
    // we fetch components separately and stitch them in JS.
    const [tablesRes, columnsRes, pkRes, fkRes] = await Promise.all([
      // 1. Fetch Tables (Exclude system schemas)
      queryWithFallback(client, `
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_type = 'BASE TABLE'
          AND table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY table_schema, table_name
      `),
      
      // 2. Fetch Columns
      queryWithFallback(client, `
        SELECT table_schema, table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY table_schema, table_name, ordinal_position
      `),

      // 3. Fetch Primary Keys
      queryWithFallback(client, `
        SELECT tc.table_schema, tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      `),

      // 4. Fetch Foreign Keys
      queryWithFallback(client, `
        SELECT 
          tc.table_schema,
          tc.table_name, 
          kcu.column_name, 
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      `)
    ]);

    // Process & Stitch Logic
    // Use a unique key for map because table names can repeat across schemas
    const tablesMap = {};
    const getMapKey = (schema, table) => `${schema}.${table}`;

    // Init Tables
    tablesRes.rows.forEach(row => {
      const key = getMapKey(row.table_schema, row.table_name);
      tablesMap[key] = {
        name: row.table_name,
        schema: row.table_schema,
        columns: [],
        description: "" 
      };
    });

    // Populate Columns
    columnsRes.rows.forEach(row => {
      const key = getMapKey(row.table_schema, row.table_name);
      if (tablesMap[key]) {
        tablesMap[key].columns.push({
          name: row.column_name,
          type: row.data_type,
          isPrimaryKey: false,
          isForeignKey: false
        });
      }
    });

    // Mark PKs
    pkRes.rows.forEach(row => {
      const key = getMapKey(row.table_schema, row.table_name);
      if (tablesMap[key]) {
        const col = tablesMap[key].columns.find(c => c.name === row.column_name);
        if (col) col.isPrimaryKey = true;
      }
    });

    // Mark FKs
    fkRes.rows.forEach(row => {
      const key = getMapKey(row.table_schema, row.table_name);
      if (tablesMap[key]) {
        const col = tablesMap[key].columns.find(c => c.name === row.column_name);
        if (col) {
          col.isForeignKey = true;
          // IMPORTANT: Store Fully Qualified Reference: schema.table.column
          // This allows the frontend to disambiguate tables with same name in diff schemas
          col.references = `${row.foreign_table_schema}.${row.foreign_table_name}.${row.foreign_column_name}`;
        }
      }
    });

    const schema = {
      name: database,
      tables: Object.values(tablesMap),
      connectionSource: "real",
    };

    console.log(`Schema parsed successfully. Found ${schema.tables.length} tables.`);
    res.json(schema);

  } catch (error) {
    console.error("CONNECTION ERROR:", error.message);
    res.status(500).json({ error: `Database Error: ${error.message}` });
  } finally {
    try {
      await client.end();
      console.log('Connection closed.');
    } catch (e) {
      // ignore close errors
    }
  }
});

// Endpoint to execute SQL
app.post('/api/execute', async (req, res) => {
  console.log('--- Received execution request ---');
  const { credentials, sql } = req.body;
  console.log(`Executing on ${credentials.database}: ${sql.substring(0, 50)}...`);
  
  const client = new Client({
    host: credentials.host,
    port: parseInt(credentials.port),
    user: credentials.user,
    password: credentials.password,
    database: credentials.database,
    ssl: false
  });

  try {
    await client.connect();
    
    // Use the fallback wrapper which now handles WIN1252 and LATIN1 automatically
    const result = await queryWithFallback(client, sql);
    
    console.log(`Query successful. Returned ${result.rows.length} rows.`);
    res.json(result.rows);
  } catch (error) {
    console.error("QUERY ERROR:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Ready to accept connections.`);
});