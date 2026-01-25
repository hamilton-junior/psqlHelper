
import { DatabaseSchema, DbCredentials, ExplainNode, IntersectionResult, ServerStats, ActiveProcess, TableInsight } from "../types";

const API_URL = 'http://127.0.0.1:3000/api';

const logger = (context: string, message: string, data?: any) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [DB:${context}] ${message}`, data || '');
};

const ensureIpv4 = (creds: DbCredentials): DbCredentials => {
  if (creds.host.toLowerCase() === 'localhost') {
    return { ...creds, host: '127.0.0.1' };
  }
  return creds;
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

export const executeQueryReal = async (creds: DbCredentials, sql: string): Promise<any[]> => {
  const normalizedCreds = ensureIpv4(creds);
  try {
    const response = await fetch(`${API_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: normalizedCreds, sql })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to execute query');
    }
    return await response.json();
  } catch (error: any) {
    throw error;
  }
};

// Fix line 68 & line 49 errors: Added tableInsights and tps to return object
export const getServerHealth = async (creds: DbCredentials): Promise<{ summary: ServerStats, processes: ActiveProcess[], tableInsights: TableInsight[] }> => {
  const normalizedCreds = ensureIpv4(creds);
  try {
    const response = await fetch(`${API_URL}/server-stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: normalizedCreds })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to fetch server stats');
    }
    const data = await response.json();
    return {
       summary: {
          connections: parseInt(data.summary.connections) || 0,
          dbSize: data.summary.db_size || '0 MB',
          activeQueries: parseInt(data.summary.active_queries) || 0,
          maxQueryDuration: data.summary.max_duration || '0s',
          transactionsCommit: parseInt(data.summary.xact_commit) || 0,
          transactionsRollback: parseInt(data.summary.xact_rollback) || 0,
          cacheHitRate: `${data.summary.cache_hit_rate || 0}%`,
          tps: parseInt(data.summary.xact_commit) || 0 
       },
       processes: (data.processes || []).map((p: any) => ({
          pid: p.pid,
          user: p.user || 'system',
          clientAddr: p.client || 'local',
          duration: p.duration || '0s',
          durationMs: p.duration_ms || 0,
          state: p.state || 'unknown',
          query: p.query || '',
          waitEvent: p.wait_event || 'None',
          blockingPids: p.blocking_pids || [] as number[],
          backendType: p.backend_type || 'unknown'
       })),
       tableInsights: (data.tableInsights || []).map((ti: any) => ({ 
          name: ti.table_name || 'unknown',
          totalSize: ti.total_size || '0 B',
          tableSize: ti.table_size || '0 B',
          indexSize: ti.index_size || '0 B',
          estimatedRows: parseInt(ti.estimated_rows) || 0
       }))
    };
  } catch (error: any) {
    throw error;
  }
};

export const terminateProcess = async (creds: DbCredentials, pid: number): Promise<void> => {
  const normalizedCreds = ensureIpv4(creds);
  try {
    const response = await fetch(`${API_URL}/terminate-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: normalizedCreds, pid })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to terminate process');
    }
  } catch (error: any) {
    throw error;
  }
};

export const fetchIntersectionDetail = async (
  creds: DbCredentials, 
  tableA: string, 
  colA: string, 
  tableB: string, 
  colB: string
): Promise<IntersectionResult> => {
   if (creds.host === 'simulated') {
      await new Promise(r => setTimeout(r, 800));
      return { count: 15, sample: [1, 2, 3, 4, 5], tableA, columnA: colA, tableB, columnB: colB, matchPercentage: 75 };
   }
   const countSql = `SELECT COUNT(DISTINCT A."${colA}") as count FROM ${tableA} A INNER JOIN ${tableB} B ON A."${colA}"::text = B."${colB}"::text`;
   const sampleSql = `SELECT DISTINCT A."${colA}" as val FROM ${tableA} A INNER JOIN ${tableB} B ON A."${colA}"::text = B."${colB}"::text LIMIT 20`;
   try {
     const [countRes, sampleRes] = await Promise.all([ executeQueryReal(creds, countSql), executeQueryReal(creds, sampleSql) ]);
     return { count: parseInt(countRes[0].count), sample: sampleRes.map(r => r.val), tableA, columnA: colA, tableB, columnB: colB };
   } catch (e: any) { throw e; }
};

const mapExplainNode = (pgNode: any): ExplainNode => {
  return {
    type: pgNode['Node Type'] || 'Unknown',
    relation: pgNode['Relation Name'] || pgNode['Alias'],
    rows: pgNode['Plan Rows'] || 0,
    width: pgNode['Plan Width'] || 0,
    cost: { startup: pgNode['Startup Cost'] || 0, total: pgNode['Total Cost'] || 0 },
    children: pgNode['Plans'] ? pgNode['Plans'].map(mapExplainNode) : undefined
  };
};

export const explainQueryReal = async (creds: DbCredentials, sql: string): Promise<ExplainNode> => {
   if (creds.host === 'simulated') {
      await new Promise(r => setTimeout(r, 600));
      return { type: "Result", cost: { startup: 0.00, total: 10.00 }, rows: 100, width: 4, children: [ { type: "Seq Scan", relation: "simulated_table", cost: { startup: 0.00, total: 10.00 }, rows: 100, width: 4 } ] };
   }
   const cleanSql = sql.trim().replace(/;$/, '');
   const explainSql = `EXPLAIN (FORMAT JSON, ANALYZE) ${cleanSql}`;
   try {
      const result = await executeQueryReal(creds, explainSql);
      if (result && result.length > 0) {
         const planRow = result[0];
         const key = Object.keys(planRow).find(k => k.toUpperCase() === 'QUERY PLAN' || k.toUpperCase() === 'JSON' || k.toUpperCase().includes('PLAN'));
         if (!key) throw new Error("Formato do EXPLAIN não reconhecido.");
         let rawPlan = planRow[key];
         if (typeof rawPlan === 'string') rawPlan = JSON.parse(rawPlan);
         if (Array.isArray(rawPlan) && rawPlan[0].Plan) return mapExplainNode(rawPlan[0].Plan);
      }
      throw new Error("Plano de execução inválido.");
   } catch (e: any) { throw new Error("Falha ao gerar plano: " + e.message); }
};
