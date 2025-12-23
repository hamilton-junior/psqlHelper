
import { DatabaseSchema, DbCredentials, ExplainNode, IntersectionResult } from "../types";

const API_URL = 'http://localhost:3000/api';

/**
 * Log auxiliar para rastreamento de requisições
 */
const logger = (context: string, message: string, data?: any) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [DB:${context}] ${message}`, data || '');
};

export const connectToDatabase = async (creds: DbCredentials): Promise<DatabaseSchema> => {
  logger('Connect', `Iniciando conexão para ${creds.host}:${creds.port}/${creds.database}`);
  try {
    const response = await fetch(`${API_URL}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds)
    });

    if (!response.ok) {
      const err = await response.json();
      logger('Connect', 'Falha na resposta do servidor', err);
      throw new Error(err.error || 'Failed to connect');
    }

    const schema = await response.json();
    logger('Connect', `Conectado com sucesso. ${schema.tables.length} tabelas carregadas.`);
    return schema;
  } catch (error: any) {
    logger('Connect', 'Erro crítico de conexão', error.message);
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error("Cannot reach backend server (localhost:3000). Run 'npm run server' in a separate terminal.");
    }
    throw error;
  }
};

export const executeQueryReal = async (creds: DbCredentials, sql: string): Promise<any[]> => {
  const sqlPreview = sql.substring(0, 50) + (sql.length > 50 ? '...' : '');
  logger('Execute', `Rodando SQL: ${sqlPreview}`);
  
  try {
    const response = await fetch(`${API_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: creds, sql })
    });

    if (!response.ok) {
      const err = await response.json();
      logger('Execute', 'Erro na execução da query', err);
      throw new Error(err.error || 'Failed to execute query');
    }

    const data = await response.json();
    logger('Execute', `Query concluída. ${data.length} linhas retornadas.`);
    return data;
  } catch (error: any) {
    logger('Execute', 'Erro de rede ou servidor', error.message);
    if (error.message.includes('Failed to fetch')) {
      throw new Error("Backend server is unreachable.");
    }
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
   logger('Intersection', `Validando vínculo: ${tableA}.${colA} -> ${tableB}.${colB}`);
   
   if (creds.host === 'simulated') {
      await new Promise(r => setTimeout(r, 800));
      return {
         count: 15,
         sample: [1, 2, 3, 4, 5],
         tableA, columnA: colA,
         tableB, columnB: colB,
         matchPercentage: 75
      };
   }

   const countSql = `SELECT COUNT(DISTINCT A."${colA}") as count 
                     FROM ${tableA} A 
                     INNER JOIN ${tableB} B ON A."${colA}"::text = B."${colB}"::text`;
   
   const sampleSql = `SELECT DISTINCT A."${colA}" as val 
                      FROM ${tableA} A 
                      INNER JOIN ${tableB} B ON A."${colA}"::text = B."${colB}"::text 
                      LIMIT 20`;

   try {
     const [countRes, sampleRes] = await Promise.all([
        executeQueryReal(creds, countSql),
        executeQueryReal(creds, sampleSql)
     ]);

     return {
        count: parseInt(countRes[0].count),
        sample: sampleRes.map(r => r.val),
        tableA, columnA: colA,
        tableB, columnB: colB
     };
   } catch (e: any) {
     logger('Intersection', 'Erro ao verificar interseção', e.message);
     throw e;
   }
};

/**
 * Função recursiva para converter o JSON do Postgres Explain para nossa interface simplificada
 */
const mapExplainNode = (pgNode: any): ExplainNode => {
  return {
    type: pgNode['Node Type'] || 'Unknown',
    relation: pgNode['Relation Name'] || pgNode['Alias'],
    rows: pgNode['Plan Rows'] || 0,
    width: pgNode['Plan Width'] || 0,
    cost: {
      startup: pgNode['Startup Cost'] || 0,
      total: pgNode['Total Cost'] || 0
    },
    children: pgNode['Plans'] ? pgNode['Plans'].map(mapExplainNode) : undefined
  };
};

export const explainQueryReal = async (creds: DbCredentials, sql: string): Promise<ExplainNode> => {
   logger('Explain', 'Iniciando análise de plano de execução');
   
   if (creds.host === 'simulated') {
      await new Promise(r => setTimeout(r, 600));
      return {
         type: "Result",
         cost: { startup: 0.00, total: 10.00 },
         rows: 100,
         width: 4,
         children: [
            {
               type: "Seq Scan",
               relation: "simulated_table",
               cost: { startup: 0.00, total: 10.00 },
               rows: 100,
               width: 4
            }
         ]
      };
   }

   // Remove terminador ; se houver para evitar erro no explain
   const cleanSql = sql.trim().replace(/;$/, '');
   const explainSql = `EXPLAIN (FORMAT JSON, ANALYZE) ${cleanSql}`;
   
   try {
      const result = await executeQueryReal(creds, explainSql);
      
      if (result && result.length > 0) {
         logger('Explain', 'Resultado bruto recebido', result[0]);
         
         const planRow = result[0];
         // O pg pode retornar o resultado em uma coluna com nome variável
         const key = Object.keys(planRow).find(k => 
            k.toUpperCase() === 'QUERY PLAN' || 
            k.toUpperCase() === 'JSON' || 
            k.toUpperCase().includes('PLAN')
         );

         if (!key) {
            logger('Explain', 'Coluna de resultado não identificada', Object.keys(planRow));
            throw new Error("Formato de retorno do EXPLAIN não reconhecido.");
         }

         let rawPlan = planRow[key];
         if (typeof rawPlan === 'string') rawPlan = JSON.parse(rawPlan);

         // Postgres retorna um array com um objeto que tem a chave 'Plan'
         if (Array.isArray(rawPlan) && rawPlan[0].Plan) {
            return mapExplainNode(rawPlan[0].Plan);
         }
      }
      throw new Error("O banco de dados não retornou um plano de execução válido.");
   } catch (e: any) {
      logger('Explain', 'Falha ao processar explain', e.message);
      throw new Error("Falha ao gerar plano de execução: " + e.message);
   }
};
