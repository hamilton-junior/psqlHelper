
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client, types } = pg;
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1'; // IPV4 Estrito

// ESM helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

const serverLog = (method, path, message, extra = '') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [SERVER] ${method} ${path} - ${message}`, extra);
};

// Configurações de tipos do Postgres
types.setTypeParser(25, (v) => v); 
types.setTypeParser(1043, (v) => v);
types.setTypeParser(1042, (v) => v);

serverLog('INIT', '-', 'Servidor inicializando em IPv4 estrito.');

// Rota de Health Check
app.get('/api/ping', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString(), ipv4: true });
});

async function setupSession(client) {
  try {
    await client.query("SET client_encoding TO 'LATIN1'");
  } catch (e) {
    serverLog('SESSION', '-', 'Falha ao definir encoding.', e.message);
  }
}

app.post('/api/connect', async (req, res) => {
  let { host, port, user, password, database } = req.body;
  const start = Date.now();
  
  // Normalização de Host para IPv4
  if (host === 'localhost') host = '127.0.0.1';

  serverLog('POST', '/api/connect', `Tentativa: ${user}@${host}:${port}/${database}`);

  if (!host || !port || !user || !database) {
    return res.status(400).json({ error: 'Faltam detalhes de conexão' });
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
    
    // Busca tabelas e metadados
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

    serverLog('POST', '/api/connect', `Schema carregado em ${Date.now() - start}ms.`);
    res.json({ name: database, tables: tables });

  } catch (err) {
    serverLog('POST', '/api/connect', 'ERRO Postgres', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    try { await client.end(); } catch (e) {}
  }
});

app.post('/api/execute', async (req, res) => {
  let { credentials, sql } = req.body;
  const start = Date.now();
  
  if (!credentials || !sql) {
    return res.status(400).json({ error: 'Missing credentials or SQL' });
  }

  if (credentials.host === 'localhost') credentials.host = '127.0.0.1';

  serverLog('POST', '/api/execute', `Executando no banco ${credentials.database}`);
  const client = new Client(credentials);

  try {
    await client.connect();
    await setupSession(client);
    
    const result = await client.query(sql);
    const duration = Date.now() - start;
    
    if (Array.isArray(result)) {
        serverLog('POST', '/api/execute', `Sucesso (Multi) em ${duration}ms.`);
        res.json(result[result.length - 1].rows);
    } else {
        serverLog('POST', '/api/execute', `Sucesso em ${duration}ms. ${result.rowCount} linhas.`);
        res.json(result.rows);
    }
  } catch (err) {
    serverLog('POST', '/api/execute', 'ERRO de execução', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    try { await client.end(); } catch (e) {}
  }
});

app.listen(PORT, HOST, () => {
  serverLog('STARTUP', '-', `Backend ativado em http://${HOST}:${PORT}`);
});
