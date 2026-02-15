
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);
const { Client, types } = pg;
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1'; // IPV4 Estrito

// Mapa global para sessões de transação ativa
const activeSessions = new Map();

// ESM helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

const serverLog = (method, path, message, extra = '') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [SERVER] ${method} ${path} - ${message}`, extra);
};

const serverError = (method, path, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [ERROR] ${method} ${path} - ${error.message}`, error.stack);
};

const scrubString = (val) => {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'string') return val;
  try {
    let clean = val.replace(/\0/g, '');
    const buffer = Buffer.from(clean, 'binary');
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(buffer).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');
  } catch (e) {
    return val.replace(/[^\x20-\x7E]/g, '?');
  }
};

const sanitizeRows = (rows) => {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => {
    const sanitized = {};
    let rowWasSanitized = false;
    for (const key in row) {
      const val = row[key];
      if (typeof val === 'string') {
        const scrubbed = scrubString(val);
        sanitized[key] = scrubbed;
        if (scrubbed.includes('\uFFFD')) rowWasSanitized = true;
      } else if (val instanceof Date) {
        sanitized[key] = val;
      } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        sanitized[key] = sanitizeRows([val])[0];
      } else {
        sanitized[key] = val;
      }
    }
    if (rowWasSanitized) sanitized._is_sanitized = true;
    return sanitized;
  });
};

types.setTypeParser(25, (v) => scrubString(v));   
types.setTypeParser(1043, (v) => scrubString(v)); 
types.setTypeParser(1042, (v) => scrubString(v)); 

app.get('/api/ping', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString(), ipv4: true });
});

async function setupSession(client) {
  try {
    await client.query("SET client_encoding TO 'SQL_ASCII'");
    await client.query("SET datestyle TO 'ISO, MDY'");
  } catch (e) {
    serverError('SESSION', 'FATAL', e);
  }
}

app.post('/api/connect', async (req, res) => {
  let { host, port, user, password, database } = req.body;
  if (host === 'localhost') host = '127.0.0.1';
  serverLog('POST', '/api/connect', `Conectando em ${database}...`);
  const client = new Client({ host, port, user, password, database, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await setupSession(client);
    const tablesRes = await client.query(`SELECT table_schema, table_name, obj_description((table_schema || '.' || table_name)::regclass) as description FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog') AND table_type = 'BASE TABLE' ORDER BY table_schema, table_name;`);
    const columnsRes = await client.query(`SELECT c.table_schema, c.table_name, c.column_name, c.data_type, (SELECT COUNT(*) > 0 FROM information_schema.key_column_usage kcu JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema WHERE kcu.table_name = c.table_name AND kcu.column_name = c.column_name AND tc.constraint_type = 'PRIMARY KEY') as is_primary FROM information_schema.columns c WHERE c.table_schema NOT IN ('information_schema', 'pg_catalog') ORDER BY c.ordinal_position;`);
    const fkRes = await client.query(`SELECT tc.table_schema, tc.table_name, kcu.column_name, ccu.table_schema AS foreign_table_schema, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema WHERE tc.constraint_type = 'FOREIGN KEY';`);
    res.json({ name: database, tables: sanitizeRows(tablesRes.rows).map(t => ({
      name: t.table_name, schema: t.table_schema, description: t.description, columns: sanitizeRows(columnsRes.rows).filter(c => c.table_name === t.table_name && c.table_schema === t.table_schema).map(c => {
          const fk = fkRes.rows.find(f => f.table_name === t.table_name && f.table_schema === t.table_schema && f.column_name === c.column_name);
          return { name: c.column_name, type: c.data_type, isPrimaryKey: !!c.is_primary, isForeignKey: !!fk, references: fk ? `${fk.foreign_table_schema}.${fk.foreign_table_name}.${fk.foreign_column_name}` : undefined };
        })
    })) });
  } catch (err) { 
    serverError('POST', '/api/connect', err);
    res.status(500).json({ error: err.message }); 
  } finally { try { await client.end(); } catch (e) {} }
});

// TRANSACTION ENDPOINTS
app.post('/api/transaction/begin', async (req, res) => {
  const { credentials } = req.body;
  const sessionId = crypto.randomUUID();
  const client = new Client(credentials);
  try {
    await client.connect();
    await setupSession(client);
    await client.query('BEGIN');
    activeSessions.set(sessionId, { client, startTime: Date.now() });
    serverLog('TX', 'BEGIN', `Sessão iniciada: ${sessionId}`);
    res.json({ sessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transaction/commit', async (req, res) => {
  const { sessionId } = req.body;
  const session = activeSessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });
  try {
    await session.client.query('COMMIT');
    await session.client.end();
    activeSessions.delete(sessionId);
    serverLog('TX', 'COMMIT', `Sessão finalizada: ${sessionId}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transaction/rollback', async (req, res) => {
  const { sessionId } = req.body;
  const session = activeSessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });
  try {
    await session.client.query('ROLLBACK');
    await session.client.end();
    activeSessions.delete(sessionId);
    serverLog('TX', 'ROLLBACK', `Sessão revertida: ${sessionId}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/execute', async (req, res) => {
  let { credentials, sql, sessionId } = req.body;
  const startTime = Date.now();
  
  let client;
  let isFromSession = false;

  if (sessionId && activeSessions.has(sessionId)) {
    client = activeSessions.get(sessionId).client;
    isFromSession = true;
  } else {
    client = new Client(credentials);
  }

  try {
    if (!isFromSession) {
      await client.connect();
      await setupSession(client);
    }
    
    const result = await client.query(sql);
    const serverTime = Date.now() - startTime;
    const finalData = Array.isArray(result) ? result[result.length - 1].rows : result.rows;

    res.json({
      rows: sanitizeRows(finalData),
      audit: {
        client: { ip: req.ip, os: os.platform(), userAgent: req.get('User-Agent') },
        performance: { serverProcessMs: serverTime },
        server: { dbUser: credentials.user, sessionId: sessionId || 'isolated' }
      }
    });
  } catch (err) { 
    serverError('POST', '/api/execute', err);
    res.status(500).json({ 
      error: err.message,
      audit: {
        server: { rawErrorStack: err.stack, dbUser: credentials.user }
      }
    }); 
  } finally { 
    if (!isFromSession) {
      try { await client.end(); } catch (e) {} 
    }
  }
});

// ... (restante dos endpoints mantidos)

app.listen(PORT, HOST, () => {
  serverLog('STARTUP', '-', `Backend ativo em http://${HOST}:${PORT}`);
});
