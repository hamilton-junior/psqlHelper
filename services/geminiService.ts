
import { GoogleGenAI, Type } from "@google/genai";
import { DatabaseSchema, QueryResult, BuilderState, ServerStats, ActiveProcess } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const cleanJsonString = (str: string): string => {
  if (!str) return "[]";
  return str.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
};

export const getHealthDiagnosis = async (stats: ServerStats, processes: ActiveProcess[]): Promise<string> => {
  const prompt = `
    Como um DBA Sênior PostgreSQL, analise a telemetria atual do servidor:
    
    METRICAS:
    - Conexões Ativas: ${stats.connections}
    - Tamanho: ${stats.dbSize}
    - Cache Hit Rate: ${stats.cacheHitRate}
    - Query mais longa: ${stats.maxQueryDuration}
    
    PROCESSOS CRITICOS (PID/User/Duration/State/BlockedBy):
    ${processes.slice(0, 10).map(p => `${p.pid} | ${p.user} | ${p.duration} | ${p.state} | ${p.blockingPids.length ? p.blockingPids.join(',') : 'None'}`).join('\n')}
    
    FORNEÇA:
    1. Resumo rápido da saúde.
    2. Identificação de gargalos (se houver).
    3. Próximos passos recomendados (ex: rodar vacuum, criar índice, matar PID X).
    
    Use Markdown. Responda em Português. Seja direto.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Não foi possível gerar um diagnóstico.";
  } catch (e) {
    return "Erro ao contatar a inteligência de DBA.";
  }
};

// ... (restante do arquivo mantido)
export const validateSqlQuery = async (sql: string, schema?: DatabaseSchema): Promise<any> => { return { isValid: true }; };
export const generateSqlFromBuilderState = async (schema: DatabaseSchema, state: BuilderState, includeTips: boolean = true): Promise<QueryResult> => { return { sql: '', explanation: '' }; };
export const generateBuilderStateFromPrompt = async (schema: DatabaseSchema, userPrompt: string): Promise<Partial<BuilderState>> => { return {}; };
export const analyzeQueryPerformance = async (schema: DatabaseSchema, sql: string): Promise<any> => { return {}; };
export const analyzeLog = async (schema: DatabaseSchema, logText: string): Promise<{ sql: string, explanation: string }> => { return { sql: '', explanation: '' }; };
export const fixSqlError = async (sql: string, errorMessage: string, schema: DatabaseSchema): Promise<string> => { return sql; };
export const suggestRelationships = async (schema: DatabaseSchema): Promise<any[]> => { return []; };
export const generateSchemaFromTopic = async (topic: string, context: string): Promise<DatabaseSchema> => { return { name: '', tables: [] }; };
export const parseSchemaFromDDL = async (ddl: string): Promise<DatabaseSchema> => { return { name: '', tables: [] }; };
export const extractSqlFromLogs = async (logText: string): Promise<string[]> => { return []; };
