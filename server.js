
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

/**
 * Scrubber Ultra-Resiliente: 
 * Força a conversão de bytes para UTF-8 ignorando sequências inválidas.
 */
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

/**
 * Sanitização de Resultados
 */
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
      } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        sanitized[key] = sanitizeRows([val])[0];
      } else {
        sanitized[key] = val;
      }
    }
    
    if (rowWasSanitized) {
      sanitized._is_sanitized = true;
    }
    
    return sanitized;
  });
};

// Forçamos o driver a tratar strings com o nosso scrubber em todas as queries
types.setTypeParser(25, (v) => scrubString(v));   // TEXT
types.setTypeParser(1043, (v) => scrubString(v)); // VARCHAR
types.setTypeParser(1042, (v) => scrubString(v)); // BPCHAR

serverLog('INIT', '-', 'Servidor iniciado em Modo de Sobrevivência (SQL_ASCII).');

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
    
    const sanitizedTables = sanitizeRows(tablesRes.rows);
    const sanitizedCols = sanitizeRows(columnsRes.rows);
    const sanitizedFks = sanitizeRows(fkRes.rows);

    const tables = sanitizedTables.map(t => {
      const tableCols = sanitizedCols.filter(c => c.table_name === t.table_name && c.table_schema === t.table_schema).map(c => {
          const fk = sanitizedFks.find(f => f.table_name === t.table_name && f.table_schema === t.table_schema && f.column_name === c.column_name);
          return { name: c.column_name, type: c.data_type, isPrimaryKey: !!c.is_primary, isForeignKey: !!fk, references: fk ? `${fk.foreign_table_schema}.${fk.foreign_table_name}.${fk.foreign_column_name}` : undefined };
        });
      return { name: t.table_name, schema: t.table_schema, description: t.description, columns: tableCols };
    });
    res.json({ name: database, tables: tables });
  } catch (err) { 
    serverError('POST', '/api/connect', err);
    res.status(500).json({ error: err.message }); 
  } finally { try { await client.end(); } catch (e) {} }
});

app.post('/api/objects', async (req, res) => {
  let { credentials, limit = 50, offset = 0, searchTerm = '', filterType = 'all' } = req.body;
  if (credentials.host === 'localhost') credentials.host = '127.0.0.1';
  const client = new Client(credentials);
  try {
    await client.connect();
    await setupSession(client);
    
    serverLog('POST', '/api/objects', `Buscando página (limit:${limit}, offset:${offset}) em modo ASCII...`);

    // Construção da query unificada para suportar paginação global
    const query = `
      WITH all_objects AS (
        -- Funções e Procedures
        SELECT p.oid::text as id, n.nspname as schema, p.proname as name, pg_get_functiondef(p.oid) as definition,
          CASE when p.prokind = 'f' then 'function' when p.prokind = 'p' then 'procedure' else 'function' END as type,
          pg_get_function_result(p.oid) as return_type, pg_get_function_arguments(p.oid) as args,
          NULL as table_name
        FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') 
        AND p.prokind IN ('f', 'p')

        UNION ALL

        -- Triggers
        SELECT trig.tgrelid::text || '-' || trig.tgname as id, n.nspname as schema, trig.tgname as name, pg_get_triggerdef(trig.oid) as definition, 'trigger' as type,
          NULL as return_type, NULL as args, rel.relname as table_name
        FROM pg_trigger trig JOIN pg_class rel ON trig.tgrelid = rel.oid JOIN pg_namespace n ON rel.relnamespace = n.oid
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND trig.tgisinternal = false

        UNION ALL

        -- Views
        SELECT table_schema || '.' || table_name as id, table_schema as schema, table_name as name, view_definition as definition, 'view' as type,
          NULL as return_type, NULL as args, NULL as table_name
        FROM information_schema.views 
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')

        UNION ALL

        -- Mat Views
        SELECT schemaname || '.' || matviewname as id, schemaname as schema, matviewname as name, definition as definition, 'mview' as type,
          NULL as return_type, NULL as args, NULL as table_name
        FROM pg_matviews 
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      )
      SELECT * FROM all_objects
      WHERE ($3 = '' OR name ILIKE $3 OR schema ILIKE $3 OR table_name ILIKE $3)
      AND ($4 = 'all' OR type = $4)
      ORDER BY schema, name
      LIMIT $1 OFFSET $2;
    `;

    const results = await client.query(query, [limit, offset, searchTerm ? `%${searchTerm}%` : '', filterType]);
    const sanitized = sanitizeRows(results.rows);

    const finalObjects = sanitized.map(obj => ({
       ...obj,
       isSanitized: !!obj._is_sanitized
    }));

    res.json(finalObjects);
  } catch (err) {
    serverError('POST', '/api/objects', err);
    res.status(500).json({ error: err.message });
  } finally { try { await client.end(); } catch (e) {} }
});

app.post('/api/execute', async (req, res) => {
  let { credentials, sql } = req.body;
  if (credentials.host === 'localhost') credentials.host = '127.0.0.1';
  const client = new Client(credentials);
  try {
    await client.connect();
    await setupSession(client);
    const result = await client.query(sql);
    const finalData = Array.isArray(result) ? result[result.length - 1].rows : result.rows;
    res.json(sanitizeRows(finalData));
  } catch (err) { 
    serverError('POST', '/api/execute', err);
    res.status(500).json({ error: err.message }); 
  } finally { try { await client.end(); } catch (e) {} }
});

app.post('/api/dry-run', async (req, res) => {
  let { credentials, sql } = req.body;
  if (credentials.host === 'localhost') credentials.host = '127.0.0.1';
  const client = new Client(credentials);
  try {
    await client.connect();
    await setupSession(client);
    await client.query('BEGIN');
    try {
      const result = await client.query(sql);
      const affectedRows = Array.isArray(result) ? result.reduce((acc, r) => acc + (r.rowCount || 0), 0) : (result.rowCount || 0);
      await client.query('ROLLBACK');
      res.json({ success: true, affectedRows });
    } catch (queryErr) {
      await client.query('ROLLBACK');
      throw queryErr;
    }
  } catch (err) {
    serverError('POST', '/api/dry-run', err);
    res.status(500).json({ error: err.message });
  } finally { try { await client.end(); } catch (e) {} }
});

app.post('/api/server-stats', async (req, res) => {
  const { credentials } = req.body;
  if (credentials.host === 'localhost') credentials.host = '127.0.0.1';
  const client = new Client(credentials);
  try {
    await client.connect();
    await setupSession(client);
    
    const statsQuery = `
      SELECT (SELECT numbackends FROM pg_stat_database WHERE datname = $1) as connections,
             (SELECT current_setting('max_connections')::int) as max_connections,
             pg_size_pretty(pg_database_size($1)) as db_size,
             (SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND datname = $1) as active_queries,
             (SELECT COALESCE(max(now() - query_start), '0s'::interval)::text FROM pg_stat_activity WHERE state = 'active' AND datname = $1) as max_duration,
             (SELECT xact_commit FROM pg_stat_database WHERE datname = $1) as xact_commit,
             (SELECT xact_rollback FROM pg_stat_database WHERE datname = $1) as xact_rollback,
             (SELECT round(100.0 * blks_hit / NULLIF(blks_read + blks_hit, 0), 2) FROM pg_stat_database WHERE datname = $1) as cache_hit_rate,
             (SELECT stats_reset FROM pg_stat_database WHERE datname = $1) as stats_reset,
             age(datfrozenxid) as wraparound_age,
             round(100.0 * age(datfrozenxid) / 2000000000.0, 2) as wraparound_percent
      FROM pg_database WHERE datname = $1;`;
    const statsRes = await client.query(statsQuery, [credentials.database]);

    const processesQuery = `
      SELECT pid, usename as user, client_addr::text as client, (now() - query_start)::text as duration, 
             extract(epoch from (now() - query_start)) * 1000 as duration_ms, state, query, 
             wait_event_type, wait_event, pg_blocking_pids(pid) as blocking_pids, backend_type
      FROM pg_stat_activity WHERE (datname = $1 OR datname IS NULL) AND pid <> pg_backend_pid();`;
    const procRes = await client.query(processesQuery, [credentials.database]);

    const bloatQuery = `
      SELECT schemaname as schema_name, relname as table_name, pg_size_pretty(pg_total_relation_size(relid)) as total_size,
             pg_size_pretty(pg_relation_size(relid)) as table_size, pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) as index_size,
             n_live_tup as estimated_rows, n_dead_tup as dead_tuples, last_autovacuum::text as last_vacuum
      FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;`;
    const bloatRes = await client.query(bloatQuery);

    res.json({
      summary: sanitizeRows(statsRes.rows)[0] || {},
      processes: sanitizeRows(procRes.rows),
      tableInsights: sanitizeRows(bloatRes.rows),
      unusedIndexes: []
    });
  } catch (err) { 
    serverError('POST', '/api/server-stats', err);
    res.status(500).json({ error: err.message }); 
  } finally { try { await client.end(); } catch (e) {} }
});

app.post('/api/storage-stats', async (req, res) => {
  const { credentials } = req.body;
  const client = new Client(credentials);
  try {
    await client.connect();
    await setupSession(client);
    
    const dirRes = await client.query("SHOW data_directory;");
    const dataDir = dirRes.rows[0].data_directory;
    const dbSizeRes = await client.query(`SELECT datname as name, pg_database_size(datname) as size_bytes FROM pg_database WHERE datistemplate = false;`);
    
    let diskStats = { total: 0, used: 0, free: 0, percent: 0, mount: '/' };
    
    try {
        if (os.platform() === 'win32') {
            const drive = dataDir.substring(0, 2); // Ex: C:
            const { stdout } = await execAsync(`wmic logicaldisk where "DeviceID='${drive}'" get FreeSpace,Size /format:list`);
            const lines = stdout.split('\n').filter(l => l.trim());
            const free = parseInt(lines.find(l => l.includes('FreeSpace'))?.split('=')[1]) || 0;
            const total = parseInt(lines.find(l => l.includes('Size'))?.split('=')[1]) || 1;
            const used = total - free;
            diskStats = { total, used, free, percent: Math.round((used / total) * 100), mount: drive };
        } else {
            const { stdout } = await execAsync(`df -Pk "${dataDir}" | tail -1`);
            const parts = stdout.trim().split(/\s+/);
            const total = parseInt(parts[1]) * 1024;
            const used = parseInt(parts[2]) * 1024;
            const free = parseInt(parts[3]) * 1024;
            diskStats = { total, used, free, percent: parseInt(parts[4]), mount: parts[5] };
        }
    } catch (e) {
        console.warn("[STORAGE] Falha ao ler disco do SO, usando fallback simulado.");
    }

    res.json({
       partition: diskStats,
       databases: sanitizeRows(dbSizeRes.rows).map(r => ({ name: r.name, size: parseInt(r.size_bytes) })),
       dataDirectory: dataDir
    });
  } catch (err) {
    serverError('POST', '/api/storage-stats', err);
    res.status(500).json({ error: err.message });
  } finally { try { await client.end(); } catch (e) {} }
});

app.listen(PORT, HOST, () => {
  serverLog('STARTUP', '-', `Backend ativo em http://${HOST}:${PORT} (Modo ASCII Forçado)`);
});
