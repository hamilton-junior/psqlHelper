import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Client } = pg;
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Endpoint to test connection and fetch schema
app.post('/api/connect', async (req, res) => {
  const { host, port, user, password, database } = req.body;
  
  const client = new Client({
    host,
    port: parseInt(port),
    user,
    password,
    database,
    ssl: false // For local dev, usually SSL is off. Change if connecting to cloud DBs.
  });

  try {
    await client.connect();

    // Query to extract schema information
    const schemaQuery = `
      SELECT 
        t.table_name,
        c.column_name,
        c.data_type,
        tc.constraint_type,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      LEFT JOIN information_schema.key_column_usage kcu 
        ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.table_constraints tc 
        ON kcu.constraint_name = tc.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name, c.ordinal_position;
    `;

    const result = await client.query(schemaQuery);
    
    // Transform raw rows into the app's DatabaseSchema format
    const tablesMap = {};

    result.rows.forEach(row => {
      if (!tablesMap[row.table_name]) {
        tablesMap[row.table_name] = {
          name: row.table_name,
          columns: [],
          description: "" // Postgres doesn't store descriptions easily accessible here without complex queries
        };
      }

      // check if column already exists (due to multiple constraints causing duplicates)
      const existingCol = tablesMap[row.table_name].columns.find(c => c.name === row.column_name);
      if (existingCol) {
        if (row.constraint_type === 'PRIMARY KEY') existingCol.isPrimaryKey = true;
        if (row.constraint_type === 'FOREIGN KEY') {
          existingCol.isForeignKey = true;
          existingCol.references = `${row.foreign_table_name}.${row.foreign_column_name}`;
        }
        return;
      }

      tablesMap[row.table_name].columns.push({
        name: row.column_name,
        type: row.data_type,
        isPrimaryKey: row.constraint_type === 'PRIMARY KEY',
        isForeignKey: row.constraint_type === 'FOREIGN KEY',
        references: row.constraint_type === 'FOREIGN KEY' ? `${row.foreign_table_name}.${row.foreign_column_name}` : undefined
      });
    });

    const schema = {
      name: database,
      tables: Object.values(tablesMap),
      connectionSource: 'real'
    };

    await client.end();
    res.json(schema);

  } catch (error) {
    console.error("Connection Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to execute SQL
app.post('/api/execute', async (req, res) => {
  const { credentials, sql } = req.body;
  
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
    const result = await client.query(sql);
    await client.end();
    res.json(result.rows);
  } catch (error) {
    console.error("Query Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});