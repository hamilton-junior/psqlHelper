
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client, types } = pg;
const app = express();
const PORT = process.env.PORT || 3000;

// ESM helpers for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// CONFIGURAÇÃO DE ENCODING GLOBAL:
// Intercepta tipos de texto do Postgres e garante que sejam lidos como 'latin1' 
// caso o banco envie bytes não-UTF8, convertendo-os para as strings UTF-8 do JS.
const parseText = (val) => {
  if (val === null) return null;
  // O driver pg já nos dá o valor como string. 
  // Se houver caracteres corrompidos (como o erro 0xc7), 
  // tratamos a string como um buffer latin1 e convertemos para utf8.
  return Buffer.from(val, 'binary').toString('utf8');
};

// Sobrescreve os parsers para TEXT (25), VARCHAR (1043) e BPCHAR (1042)
types.setTypeParser(25, (v) => v); // Deixa o driver ler, vamos converter na sessão
types.setTypeParser(1043, (v) => v);
types.setTypeParser(1042, (v) => v);

console.log(`Starting server...`);

// Helper para configurar a sessão com encoding resiliente
async function setupSession(client) {
  try {
    // Definimos LATIN1 na sessão. Isso faz com que o Postgres nos envie os bytes puros
    // sem tentar validar se eles são UTF-8 válidos no disco, evitando o erro 0xc7.
    await client.query("SET client_encoding TO 'LATIN1'");
  } catch (e) {
    console.warn("Could not set client_encoding to LATIN1, falling back to default.");
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
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await setupSession(client);
    
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
    const tablesRes = await client.query(tablesQuery);

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
    const columnsRes = await client.query(columnsQuery);

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
    const fkRes = await client.query(fkQuery);

    // Assemble Schema Object
    const tables = tablesRes.rows.map(t => {
      const tableCols = columnsRes.rows
        .filter(c => c.table_name === t.table_name && c.table_schema === t.table_schema)
        .map(c => {
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
    await setupSession(client);
    
    const result = await client.query(sql);
    
    if (Array.isArray(result)) {
        res.json(result[result.length - 1].rows);
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
