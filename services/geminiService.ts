
import { GoogleGenAI, Type } from "@google/genai";
import { DatabaseSchema, QueryResult, BuilderState, ServerStats, ActiveProcess } from "../types";

const cleanJsonString = (str: string): string => {
  if (!str) return "[]";
  return str.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
};

// Initializing ai instance directly with process.env.API_KEY is preferred by the guidelines.
// However, since several functions are exported, we will initialize within them or at module level if valid.

export const getHealthDiagnosis = async (stats: ServerStats, processes: ActiveProcess[]): Promise<string> => {
  console.log("[GEMINI_SERVICE] Iniciando diagnóstico de saúde do servidor...");
  // ALWAYS use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    console.log("[GEMINI_SERVICE] Diagnóstico gerado com sucesso.");
    return response.text || "Não foi possível gerar um diagnóstico.";
  } catch (e: any) {
    console.error("[GEMINI_SERVICE] Erro ao gerar diagnóstico:", e);
    throw e;
  }
};

export const generateSqlFromBuilderState = async (schema: DatabaseSchema, state: BuilderState, includeTips: boolean = true): Promise<QueryResult> => {
  console.log("[GEMINI_SERVICE] Gerando SQL a partir do estado do builder...");
  // ALWAYS use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Gere uma query SQL PostgreSQL baseada neste estado: ${JSON.stringify(state)}.
    Contexto do Schema: ${JSON.stringify(schema.tables.map(t => ({ name: t.name, cols: t.columns.map(c => c.name) })))}.
    
    Retorne apenas um JSON com os campos:
    - sql: A query final
    - explanation: Explicação curta da lógica
    - tips: Array de strings com dicas de performance se aplicável
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    console.log("[GEMINI_SERVICE] SQL gerado com sucesso.");
    return JSON.parse(response.text || "{}");
  } catch (e: any) {
    console.error("[GEMINI_SERVICE] Erro ao gerar SQL:", e);
    throw e;
  }
};

export const analyzeQueryPerformance = async (schema: DatabaseSchema, sql: string): Promise<any> => {
  console.log("[GEMINI_SERVICE] Analisando performance da query...");
  // ALWAYS use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Analise a performance desta query SQL: "${sql}".
    Schema: ${JSON.stringify(schema.tables.map(t => ({ name: t.name, cols: t.columns.map(c => c.name) })))}.
    Retorne um JSON com:
    - rating: número de 0 a 100
    - summary: resumo curto
    - explanation: explicação detalhada
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    console.log("[GEMINI_SERVICE] Análise de performance concluída.");
    return JSON.parse(response.text || "{}");
  } catch (e: any) {
    console.error("[GEMINI_SERVICE] Erro na análise de performance:", e);
    throw e;
  }
};

export const analyzeLog = async (schema: DatabaseSchema, logText: string): Promise<{ sql: string, explanation: string }> => {
  console.log("[GEMINI_SERVICE] Analisando log de erro...");
  // ALWAYS use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Analise este log de erro de banco de dados: "${logText}".
    Sugira uma query SQL para investigar ou corrigir o problema baseado neste schema: ${JSON.stringify(schema.tables.map(t => ({ name: t.name, cols: t.columns.map(c => c.name) })))}.
    Retorne JSON: { "sql": "...", "explanation": "..." }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    console.log("[GEMINI_SERVICE] Log analisado com sucesso.");
    return JSON.parse(response.text || "{}");
  } catch (e: any) {
    console.error("[GEMINI_SERVICE] Erro na análise de log:", e);
    throw e;
  }
};

export const generateBuilderStateFromPrompt = async (schema: DatabaseSchema, userPrompt: string): Promise<Partial<BuilderState>> => {
  console.log("[GEMINI_SERVICE] Magic Fill: Convertendo prompt em estado de builder...");
  // ALWAYS use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Converta este pedido do usuário em um estado de BuilderState JSON: "${userPrompt}".
    Schema disponível: ${JSON.stringify(schema.tables.map(t => ({ name: t.name, cols: t.columns.map(c => c.name) })))}.
    Use IDs de colunas no formato 'schema.tabela.coluna'.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    console.log("[GEMINI_SERVICE] Magic Fill concluído.");
    return JSON.parse(response.text || "{}");
  } catch (e: any) {
    console.error("[GEMINI_SERVICE] Erro no Magic Fill:", e);
    throw e;
  }
};

export const validateSqlQuery = async (sql: string, schema?: DatabaseSchema): Promise<any> => { return { isValid: true }; };
export const fixSqlError = async (sql: string, errorMessage: string, schema: DatabaseSchema): Promise<string> => { return sql; };
export const suggestRelationships = async (schema: DatabaseSchema): Promise<any[]> => { return []; };

export const generateSchemaFromTopic = async (topic: string, context: string): Promise<DatabaseSchema> => {
  console.log("[GEMINI_SERVICE] Gerando schema simulado para o tópico:", topic);
  // ALWAYS use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Gere um schema de banco de dados PostgreSQL simulado completo para o tópico: "${topic}". Contexto: "${context}".`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nome do banco de dados" },
            tables: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Nome da tabela (snake_case)" },
                  schema: { type: Type.STRING, description: "Nome do esquema (ex: public)" },
                  description: { type: Type.STRING, description: "Descrição do propósito da tabela" },
                  columns: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING, description: "Nome da coluna" },
                        type: { type: Type.STRING, description: "Tipo de dado PostgreSQL" },
                        isPrimaryKey: { type: Type.BOOLEAN },
                        isForeignKey: { type: Type.BOOLEAN },
                        references: { type: Type.STRING, description: "Referência no formato schema.tabela.coluna" }
                      },
                      required: ["name", "type"]
                    }
                  }
                },
                required: ["name", "columns"]
              }
            }
          },
          required: ["name", "tables"]
        }
      }
    });
    
    const parsed = JSON.parse(response.text || "{}");
    
    const sanitizedSchema: DatabaseSchema = {
      name: String(parsed.name || topic),
      tables: (parsed.tables || [])
        .filter((t: any) => t && typeof t === 'object')
        .map((t: any) => ({
          name: String(t.name || 'unknown_table'),
          schema: String(t.schema || 'public'),
          description: t.description ? String(t.description) : undefined,
          columns: (t.columns || [])
            .filter((c: any) => c && typeof c === 'object')
            .map((c: any) => ({
              name: String(c.name || 'unknown_column'),
              type: String(c.type || 'varchar'),
              isPrimaryKey: !!c.isPrimaryKey,
              isForeignKey: !!c.isForeignKey,
              references: c.references ? String(c.references) : undefined
            }))
        })),
      connectionSource: 'simulated'
    };
    
    console.log("[GEMINI_SERVICE] Schema simulado gerado e sanitizado.");
    return sanitizedSchema;
  } catch (e: any) {
    console.error("[GEMINI_SERVICE] Erro ao gerar schema simulado:", e);
    throw e;
  }
};

export const parseSchemaFromDDL = async (ddl: string): Promise<DatabaseSchema> => { return { name: '', tables: [] }; };
export const extractSqlFromLogs = async (logText: string): Promise<string[]> => {
  console.log("[GEMINI_SERVICE] Extraindo queries de logs...");
  // ALWAYS use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Extraia todas as queries SQL válidas deste texto: "${logText}". Retorne um array JSON de strings.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    console.log("[GEMINI_SERVICE] SQL extraído com sucesso.");
    return JSON.parse(response.text || "[]");
  } catch (e: any) {
    console.error("[GEMINI_SERVICE] Erro ao extrair SQL:", e);
    throw e;
  }
};

export const generateDatabaseWiki = async (schema: DatabaseSchema): Promise<string> => {
  console.log("[GEMINI_SERVICE] Gerando Wiki do Banco de Dados...");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Como um DBA Sênior e Arquiteto de Dados, gere uma documentação técnica completa em formato Markdown para o seguinte schema de banco de dados:
    
    SCHEMA: ${JSON.stringify(schema)}
    
    A documentação deve conter:
    1. Introdução: Visão geral do propósito do banco de dados.
    2. Dicionário de Dados: Para cada tabela, explique seu propósito, descreva as colunas principais e identifique chaves primárias e estrangeiras.
    3. Relacionamentos: Explique como as tabelas se conectam.
    4. Consultas de Exemplo: Forneça 3 a 5 exemplos de consultas SQL úteis baseadas neste schema, com explicações do que elas fazem.
    5. Recomendações: Sugestões de índices ou boas práticas para este modelo específico.
    
    Use Markdown elegante, com tabelas e blocos de código. Responda em Português.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
    });
    console.log("[GEMINI_SERVICE] Wiki gerada com sucesso.");
    return response.text || "Não foi possível gerar a Wiki.";
  } catch (e: any) {
    console.error("[GEMINI_SERVICE] Erro ao gerar Wiki:", e);
    throw e;
  }
};
