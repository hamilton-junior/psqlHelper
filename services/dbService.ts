
import { DatabaseSchema, DbCredentials, ExplainNode, IntersectionResult, ServerStats, ActiveProcess, TableInsight, UnusedIndex, QueryProfilingSnapshot, StorageStats, DatabaseObject, AuditMetadata } from "../types";

const API_URL = 'http://127.0.0.1:3000/api';

const ensureIpv4 = (creds: DbCredentials): DbCredentials => {
  if (creds.host.toLowerCase() === 'localhost') {
    return { ...creds, host: '127.0.0.1' };
  }
  return creds;
};

export const beginTransaction = async (creds: DbCredentials): Promise<string> => {
  const normalized = ensureIpv4(creds);
  const res = await fetch(`${API_URL}/transaction/begin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentials: normalized })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data.sessionId;
};

export const commitTransaction = async (sessionId: string): Promise<void> => {
  const res = await fetch(`${API_URL}/transaction/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  });
  if (!res.ok) throw new Error((await res.json()).error);
};

export const rollbackTransaction = async (sessionId: string): Promise<void> => {
  const res = await fetch(`${API_URL}/transaction/rollback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  });
  if (!res.ok) throw new Error((await res.json()).error);
};

export const connectToDatabase = async (creds: DbCredentials): Promise<DatabaseSchema> => {
  const normalizedCreds = ensureIpv4(creds);
  try {
    const response = await fetch(`${API_URL}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizedCreds)
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to connect');
    }
    return await response.json();
  } catch (error: any) {
    throw error;
  }
};

export const fetchDatabaseObjects = async (
  creds: DbCredentials, 
  limit: number = 50, 
  offset: number = 0,
  searchTerm: string = '',
  filterType: string = 'all'
): Promise<DatabaseObject[]> => {
  const normalizedCreds = ensureIpv4(creds);
  try {
    const response = await fetch(`${API_URL}/objects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        credentials: normalizedCreds,
        limit,
        offset,
        searchTerm,
        filterType
      })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Falha ao carregar objetos do banco.');
    }
    return await response.json();
  } catch (error: any) {
    throw error;
  }
};

export const executeQueryReal = async (creds: DbCredentials, sql: string, sessionId?: string): Promise<{ rows: any[], audit: AuditMetadata }> => {
  const normalizedCreds = ensureIpv4(creds);
  try {
    const response = await fetch(`${API_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: normalizedCreds, sql, sessionId })
    });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.error || 'Failed to execute query');
      (err as any).audit = data.audit;
      throw err;
    }
    return data;
  } catch (error: any) {
    throw error;
  }
};

// ... (restante mantido com normalization do IP)
export const executeDryRun = async (creds: DbCredentials, sql: string): Promise<{ affectedRows: number }> => {
  const normalizedCreds = ensureIpv4(creds);
  const response = await fetch(`${API_URL}/dry-run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentials: normalizedCreds, sql })
  });
  if (!response.ok) throw new Error((await response.json()).error);
  return await response.json();
};

export const getServerHealth = async (creds: DbCredentials): Promise<{ summary: ServerStats, processes: ActiveProcess[], tableInsights: TableInsight[], unusedIndexes: UnusedIndex[] }> => {
  const normalized = ensureIpv4(creds);
  const res = await fetch(`${API_URL}/server-stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentials: normalized })
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return await res.json();
};

export const fetchStorageStats = async (creds: DbCredentials): Promise<StorageStats> => {
  const normalized = ensureIpv4(creds);
  const res = await fetch(`${API_URL}/storage-stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentials: normalized })
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return await res.json();
};

export const terminateProcess = async (creds: DbCredentials, pid: number): Promise<void> => {
  const normalized = ensureIpv4(creds);
  await fetch(`${API_URL}/terminate-process`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentials: normalized, pid }) });
};

export const vacuumTable = async (creds: DbCredentials, schema: string, table: string): Promise<void> => {
  const normalized = ensureIpv4(creds);
  await fetch(`${API_URL}/vacuum-table`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentials: normalized, schema, table }) });
};

export const dropIndex = async (creds: DbCredentials, schema: string, index: string): Promise<void> => {
  const normalized = ensureIpv4(creds);
  await fetch(`${API_URL}/drop-index`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentials: normalized, schema, index }) });
};

export const fetchIntersectionDetail = async (creds: DbCredentials, tableA: string, colA: string, tableB: string, colB: string): Promise<IntersectionResult> => {
   if (creds.host === 'simulated') return { count: 15, sample: [1, 2, 3, 4, 5], tableA, columnA: colA, tableB, columnB: colB, matchPercentage: 75 };
   const countSql = `SELECT COUNT(DISTINCT A."${colA}") as count FROM ${tableA} A INNER JOIN ${tableB} B ON A."${colA}"::text = B."${colB}"::text`;
   const sampleSql = `SELECT DISTINCT A."${colA}" as val FROM ${tableA} A INNER JOIN ${tableB} B ON A."${colA}"::text = B."${colB}"::text LIMIT 20`;
   const [countRes, sampleRes] = await Promise.all([ executeQueryReal(creds, countSql), executeQueryReal(creds, sampleSql) ]);
   return { count: parseInt(countRes.rows[0].count), sample: sampleRes.rows.map((r:any) => r.val), tableA, columnA: colA, tableB, columnB: colB };
};

export const explainQueryReal = async (creds: DbCredentials, sql: string): Promise<ExplainNode> => {
   if (creds.host === 'simulated') return { type: "Result", cost: { startup: 0.00, total: 10.00 }, rows: 100, width: 4, actualTime: { startup: 0.1, total: 5.0 }, exclusiveTime: 5.0, exclusivePercent: 100 };
   const cleanSql = sql.trim().replace(/;$/, '');
   const explainSql = `EXPLAIN (ANALYZE, BUFFERS, COSTS, VERBOSE, FORMAT JSON) ${cleanSql}`;
   const res = await executeQueryReal(creds, explainSql);
   const planRow = res.rows[0];
   const key = Object.keys(planRow).find(k => k.toUpperCase().includes('PLAN'));
   let rawPlan = planRow[key || 'QUERY PLAN'];
   if (typeof rawPlan === 'string') rawPlan = JSON.parse(rawPlan);
   return rawPlan[0].Plan;
};

export const fetchDetailedProfiling = async (creds: DbCredentials, sql: string): Promise<QueryProfilingSnapshot> => {
  const normalized = ensureIpv4(creds);
  const cleanSql = sql.trim().replace(/;$/, '');
  const profilingSql = `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, FORMAT JSON) ${cleanSql}`;
  const res = await executeQueryReal(normalized, profilingSql);
  const planRow = res.rows[0];
  const key = Object.keys(planRow).find(k => k.toUpperCase().includes('PLAN'));
  let rawPlan = planRow[key || 'QUERY PLAN'];
  if (typeof rawPlan === 'string') rawPlan = JSON.parse(rawPlan);
  const planObj = rawPlan[0];
  return { id: crypto.randomUUID(), name: `Snapshot ${new Date().toLocaleTimeString()}`, timestamp: Date.now(), sql, plan: planObj.Plan, metrics: { totalRuntime: planObj['Execution Time'] || 0, planningTime: planObj['Planning Time'] || 0, sharedReadBuffers: planObj.Plan['Shared Read Blocks'] || 0, sharedHitBuffers: planObj.Plan['Shared Hit Blocks'] || 0 } };
};
