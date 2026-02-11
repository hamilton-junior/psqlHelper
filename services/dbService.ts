
import { DatabaseSchema, DbCredentials, ExplainNode, IntersectionResult, ServerStats, ActiveProcess, TableInsight, UnusedIndex, QueryProfilingSnapshot, StorageStats, DatabaseObject } from "../types";

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

export const fetchDatabaseObjects = async (
  creds: DbCredentials, 
  limit: number = 50, 
  offset: number = 0,
  searchTerm: string = '',
  filterType: string = 'all'
): Promise<DatabaseObject[]> => {
  const normalizedCreds = ensureIpv4(creds);
  logger('FETCH_OBJECTS', `Buscando lote de objetos (offset: ${offset}, termo: "${searchTerm}")...`);
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
    logger('FETCH_OBJECTS_ERROR', error.message);
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

export const executeDryRun = async (creds: DbCredentials, sql: string): Promise<{ affectedRows: number }> => {
  const normalizedCreds = ensureIpv4(creds);
  try {
    const response = await fetch(`${API_URL}/dry-run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: normalizedCreds, sql })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Falha na simulação de impacto DML');
    }
    return await response.json();
  } catch (error: any) {
    throw error;
  }
};

export const getServerHealth = async (creds: DbCredentials): Promise<{ 
  summary: ServerStats, 
  processes: ActiveProcess[], 
  tableInsights: TableInsight[],
  unusedIndexes: UnusedIndex[]
}> => {
  const normalizedCreds = ensureIpv4(creds);
  try {
    const response = await fetch(`${API_URL}/server-stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: normalizedCreds })
    });
    
    if (!response.ok) {
      let msg = 'Failed to fetch server stats';
      try {
        const errData = await response.json();
        msg = errData.error || msg;
      } catch (e) {}
      throw new Error(msg);
    }

    const data = await response.json();
    
    const summary = data.summary || {};
    
    return {
       summary: {
          connections: parseInt(summary.connections) || 0,
          maxConnections: parseInt(summary.max_connections) || 100,
          dbSize: summary.db_size || '0 MB',
          activeQueries: parseInt(summary.active_queries) || 0,
          maxQueryDuration: summary.max_duration || '0s',
          transactionsCommit: parseInt(summary.xact_commit) || 0,
          transactionsRollback: parseInt(summary.xact_rollback) || 0,
          cacheHitRate: `${summary.cache_hit_rate || 0}%`,
          tps: parseInt(summary.xact_commit) || 0,
          wraparoundAge: parseInt(summary.wraparound_age) || 0,
          wraparoundPercent: parseFloat(summary.wraparound_percent) || 0,
          statsReset: summary.stats_reset ? new Date(summary.stats_reset).toLocaleString() : 'Desconhecido'
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
          waitEventType: p.wait_event_type || 'None',
          blockingPids: p.blocking_pids || [] as number[],
          backendType: p.backend_type || 'unknown'
       })),
       tableInsights: (data.tableInsights || []).map((ti: any) => ({ 
          schema: ti.schema_name || 'public',
          name: ti.table_name || 'unknown',
          totalSize: ti.total_size || '0 B',
          tableSize: ti.table_size || '0 B',
          indexSize: ti.index_size || '0 B',
          estimatedRows: parseInt(ti.estimated_rows) || 0,
          deadTuples: parseInt(ti.dead_tuples) || 0,
          lastVacuum: ti.last_vacuum
       })),
       unusedIndexes: (data.unusedIndexes || []).map((ui: any) => ({
          schema: ui.schema_name || 'public',
          table: ui.table_name,
          index: ui.index_name,
          size: ui.index_size
       }))
    };
  } catch (error: any) {
    console.error("[DB:getServerHealth] Request failed", error);
    throw error;
  }
};

export const fetchStorageStats = async (creds: DbCredentials): Promise<StorageStats> => {
  const normalizedCreds = ensureIpv4(creds);
  try {
    const response = await fetch(`${API_URL}/storage-stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: normalizedCreds })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to fetch storage stats');
    }
    return await response.json();
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

export const vacuumTable = async (creds: DbCredentials, schema: string, table: string): Promise<void> => {
  const normalizedCreds = ensureIpv4(creds);
  try {
    const response = await fetch(`${API_URL}/vacuum-table`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: normalizedCreds, schema, table })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to vacuum table');
    }
  } catch (error: any) {
    throw error;
  }
};

export const dropIndex = async (creds: DbCredentials, schema: string, index: string): Promise<void> => {
  const normalizedCreds = ensureIpv4(creds);
  try {
    const response = await fetch(`${API_URL}/drop-index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: normalizedCreds, schema, index })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to drop index');
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

const mapExplainNode = (pgNode: any, totalExecutionTime?: number): ExplainNode => {
  const children = pgNode['Plans'] ? pgNode['Plans'].map((p: any) => mapExplainNode(p, totalExecutionTime)) : [];
  
  const actualTotalTime = pgNode['Actual Total Time'] || 0;
  const childrenTotalTime = children.reduce((acc: number, child: ExplainNode) => acc + (child.actualTime?.total || 0), 0);
  
  const exclusiveTime = Math.max(0, actualTotalTime - childrenTotalTime);
  const exclusivePercent = totalExecutionTime ? (exclusiveTime / totalExecutionTime) * 100 : 0;

  return {
    type: pgNode['Node Type'] || 'Unknown',
    relation: pgNode['Relation Name'],
    alias: pgNode['Alias'],
    rows: pgNode['Plan Rows'] || 0,
    actualRows: pgNode['Actual Rows'] || 0,
    loops: pgNode['Actual Loops'] || 1,
    width: pgNode['Plan Width'] || 0,
    cost: { startup: pgNode['Startup Cost'] || 0, total: pgNode['Total Cost'] || 0 },
    actualTime: { 
      startup: pgNode['Actual Startup Time'] || 0, 
      total: actualTotalTime 
    },
    exclusiveTime,
    exclusivePercent,
    children: children.length > 0 ? children : undefined
  };
};

export const explainQueryReal = async (creds: DbCredentials, sql: string): Promise<ExplainNode> => {
   if (creds.host === 'simulated') {
      await new Promise(r => setTimeout(r, 600));
      return { type: "Result", cost: { startup: 0.00, total: 10.00 }, rows: 100, width: 4, actualTime: { startup: 0.1, total: 5.0 }, exclusiveTime: 5.0, exclusivePercent: 100, children: [ { type: "Seq Scan", relation: "simulated_table", cost: { startup: 0.00, total: 10.00 }, rows: 100, width: 4, actualTime: { startup: 0.1, total: 4.0 }, exclusiveTime: 4.0, exclusivePercent: 80 } ] };
   }
   const cleanSql = sql.trim().replace(/;$/, '');
   const explainSql = `EXPLAIN (ANALYZE, BUFFERS, COSTS, VERBOSE, FORMAT JSON) ${cleanSql}`;
   try {
      const result = await executeQueryReal(creds, explainSql);
      if (result && result.length > 0) {
         const planRow = result[0];
         const key = Object.keys(planRow).find(k => k.toUpperCase() === 'QUERY PLAN' || k.toUpperCase() === 'JSON' || k.toUpperCase().includes('PLAN'));
         if (!key) throw new Error("Formato do EXPLAIN não reconhecido.");
         let rawPlan = planRow[key];
         if (typeof rawPlan === 'string') rawPlan = JSON.parse(rawPlan);
         
         const planObj = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan;
         const totalTime = planObj['Execution Time'] || planObj.Plan['Actual Total Time'];
         
         if (planObj && planObj.Plan) return mapExplainNode(planObj.Plan, totalTime);
      }
      throw new Error("Plano de execução inválido.");
   } catch (e: any) { throw new Error("Falha ao gerar plano: " + e.message); }
};

export const fetchDetailedProfiling = async (creds: DbCredentials, sql: string): Promise<QueryProfilingSnapshot> => {
  const normalizedCreds = ensureIpv4(creds);
  const cleanSql = sql.trim().replace(/;$/, '');
  const profilingSql = `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, FORMAT JSON) ${cleanSql}`;
  
  logger('PROFILING', `Capturando snapshot detalhado para: ${cleanSql.substring(0, 50)}...`);
  
  try {
    const result = await executeQueryReal(normalizedCreds, profilingSql);
    if (result && result.length > 0) {
      const planRow = result[0];
      const key = Object.keys(planRow).find(k => k.toUpperCase().includes('PLAN'));
      let rawPlan = planRow[key || 'QUERY PLAN'];
      if (typeof rawPlan === 'string') rawPlan = JSON.parse(rawPlan);
      
      const planObj = rawPlan[0];
      const topNode = planObj.Plan;

      return {
        id: crypto.randomUUID(),
        name: `Snapshot ${new Date().toLocaleTimeString()}`,
        timestamp: Date.now(),
        sql,
        plan: topNode,
        metrics: {
          totalRuntime: planObj['Actual Total Time'] || topNode['Actual Total Time'] || 0,
          planningTime: planObj['Planning Time'] || 0,
          sharedReadBuffers: topNode['Shared Read Blocks'] || 0,
          sharedHitBuffers: topNode['Shared Hit Blocks'] || 0,
          sharedWrittenBuffers: topNode['Shared Written Blocks'] || 0,
          tempReadBuffers: topNode['Temp Read Blocks'] || 0,
          tempWrittenBuffers: topNode['Temp Written Blocks'] || 0,
        }
      };
    }
    throw new Error("Falha ao capturar dados de profiling.");
  } catch (e: any) {
    logger('PROFILING_ERROR', e.message);
    throw e;
  }
};
