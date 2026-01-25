
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
  if (host === 'localhost') host = '127.0.0.1';
  serverLog('POST', '/api/connect', `Tentativa: ${user}@${host}:${port}/${database}`);
  if (!host || !port || !user || !database) return res.status(400).json({ error: 'Faltam detalhes de conexão' });
  const client = new Client({ host, port, user, password, database, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await setupSession(client);
    const tablesRes = await client.query(`SELECT table_schema, table_name, obj_description((table_schema || '.' || table_name)::regclass) as description FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog') AND table_type = 'BASE TABLE' ORDER BY table_schema, table_name;`);
    const columnsRes = await client.query(`SELECT c.table_schema, c.table_name, c.column_name, c.data_type, (SELECT COUNT(*) > 0 FROM information_schema.key_column_usage kcu JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema WHERE kcu.table_name = c.table_name AND kcu.column_name = c.column_name AND tc.constraint_type = 'PRIMARY KEY') as is_primary FROM information_schema.columns c WHERE c.table_schema NOT IN ('information_schema', 'pg_catalog') ORDER BY c.ordinal_position;`);
    const fkRes = await client.query(`SELECT tc.table_schema, tc.table_name, kcu.column_name, ccu.table_schema AS foreign_table_schema, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema WHERE tc.constraint_type = 'FOREIGN KEY';`);
    const tables = tablesRes.rows.map(t => {
      const tableCols = columnsRes.rows.filter(c => c.table_name === t.table_name && c.table_schema === t.table_schema).map(c => {
          const fk = fkRes.rows.find(f => f.table_name === t.table_name && f.table_schema === t.table_schema && f.column_name === c.column_name);
          return { name: c.column_name, type: c.data_type, isPrimaryKey: !!c.is_primary, isForeignKey: !!fk, references: fk ? `${fk.foreign_table_schema}.${fk.foreign_table_name}.${fk.foreign_column_name}` : undefined };
        });
      return { name: t.table_name, schema: t.table_schema, description: t.description, columns: tableCols };
    });
    res.json({ name: database, tables: tables });
  } catch (err) { res.status(500).json({ error: err.message }); } finally { try { await client.end(); } catch (e) {} }
});

app.post('/api/execute', async (req, res) => {
  let { credentials, sql } = req.body;
  if (!credentials || !sql) return res.status(400).json({ error: 'Missing credentials or SQL' });
  if (credentials.host === 'localhost') credentials.host = '127.0.0.1';
  const client = new Client(credentials);
  try {
    await client.connect();
    await setupSession(client);
    const result = await client.query(sql);
    if (Array.isArray(result)) res.json(result[result.length - 1].rows);
    else res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); } finally { try { await client.end(); } catch (e) {} }
});

app.post('/api/server-stats', async (req, res) => {
  const { credentials } = req.body;
  if (!credentials) return res.status(400).json({ error: 'Missing credentials' });
  if (credentials.host === 'localhost') credentials.host = '127.0.0.1';
  const client = new Client(credentials);
  try {
    await client.connect();
    
    // 1. Sumário estendido e Wraparound
    const statsQuery = `
      SELECT 
        (SELECT numbackends FROM pg_stat_database WHERE datname = $1) as connections,
        (SELECT current_setting('max_connections')::int) as max_connections,
        pg_size_pretty(pg_database_size($1)) as db_size,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND datname = $1) as active_queries,
        (SELECT COALESCE(max(now() - query_start), '0s'::interval)::text FROM pg_stat_activity WHERE state = 'active' AND datname = $1) as max_duration,
        COALESCE(xact_commit, 0) as xact_commit, 
        COALESCE(xact_rollback, 0) as xact_rollback,
        round(100.0 * blks_hit / NULLIF(blks_read + blks_hit, 0), 2) as cache_hit_rate,
        age(datfrozenxid) as wraparound_age,
        round(100.0 * age(datfrozenxid) / 2000000000.0, 2) as wraparound_percent
      FROM pg_stat_database WHERE datname = $1;`;
    const statsRes = await client.query(statsQuery, [credentials.database]);

    // 2. Processos com Bloqueios e Wait Events
    const processesQuery = `
      SELECT 
        pid, 
        COALESCE(usename, 'system') as user, 
        COALESCE(client_addr::text, 'local') as client,
        COALESCE((now() - query_start)::text, '0s') as duration,
        extract(epoch from COALESCE((now() - query_start), '0s'::interval)) * 1000 as duration_ms,
        state, 
        COALESCE(query, '') as query, 
        COALESCE(wait_event_type, 'None') as wait_event_type,
        COALESCE(wait_event, 'None') as wait_event,
        pg_blocking_pids(pid) as blocking_pids,
        backend_type
      FROM pg_stat_activity 
      WHERE (datname = $1 OR datname IS NULL) AND pid <> pg_backend_pid()
      ORDER BY duration_ms DESC;`;
    const procRes = await client.query(processesQuery, [credentials.database]);

    // 3. Table Insights com Bloat e Autovacuum
    const bloatQuery = `
      SELECT 
        relname as table_name,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size,
        pg_size_pretty(pg_relation_size(relid)) as table_size,
        pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) as index_size,
        COALESCE(n_live_tup, 0) as estimated_rows,
        COALESCE(n_dead_tup, 0) as dead_tuples,
        COALESCE(last_autovacuum::text, 'Nunca') as last_vacuum
      FROM pg_stat_user_tables 
      ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;`;
    const bloatRes = await client.query(bloatQuery);

    // 4. Índices Não Utilizados
    const unusedIndexesQuery = `
      SELECT 
        relname as table_name, 
        indexrelname as index_name, 
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
      FROM pg_stat_user_indexes 
      JOIN pg_index USING (indexrelid)
      WHERE idx_scan = 0 AND indisunique IS FALSE
      ORDER BY pg_relation_size(indexrelid) DESC LIMIT 5;`;
    const unusedRes = await client.query(unusedIndexesQuery);

    res.json({
      summary: statsRes.rows[0],
      processes: procRes.rows,
      tableInsights: bloatRes.rows,
      unusedIndexes: unusedRes.rows
    });
  } catch (err) { res.status(500).json({ error: err.message }); } finally { try { await client.end(); } catch (e) {} }
});

app.post('/api/terminate-process', async (req, res) => {
  const { credentials, pid } = req.body;
  if (!credentials || !pid) return res.status(400).json({ error: 'Missing credentials or PID' });
  const client = new Client(credentials);
  try {
    await client.connect();
    await client.query('SELECT pg_terminate_backend($1)', [pid]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); } finally { try { await client.end(); } catch (e) {} }
});

app.listen(PORT, HOST, () => {
  serverLog('STARTUP', '-', `Backend ativado em http://${HOST}:${PORT}`);
});
