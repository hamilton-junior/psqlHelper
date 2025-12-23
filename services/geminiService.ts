
import { GoogleGenAI, Type } from "@google/genai";
import { DatabaseSchema, QueryResult, ValidationResult, BuilderState, AggregateFunction, Operator, JoinType, OptimizationAnalysis, VirtualRelation } from "../types";

// Initialize the AI client using the API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to clean Markdown code blocks from JSON response
const cleanJsonString = (str: string): string => {
  if (!str) return "{}";
  return str.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
};

const formatSchemaForPrompt = (schema: DatabaseSchema): string => {
  const simplifiedStructure = schema.tables.map(t => ({
    tableName: t.name,
    schema: t.schema || 'public',
    fullName: `${t.schema || 'public'}.${t.name}`,
    columns: t.columns.map(c => ({
       name: c.name,
       type: c.type,
       isPk: c.isPrimaryKey,
       isFk: c.isForeignKey
    })) 
  }));
  return JSON.stringify(simplifiedStructure, null, 2);
};

export const generateBuilderStateFromPrompt = async (
  schema: DatabaseSchema,
  userPrompt: string
): Promise<Partial<BuilderState>> => {
  
  const schemaContext = formatSchemaForPrompt(schema);

  const systemInstruction = `
    Você é um assistente de BI que configura ferramentas de consulta visual.
    
    SEU OBJETIVO:
    Traduzir a pergunta do usuário em uma configuração JSON para um Query Builder visual.
    
    SCHEMA DISPONÍVEL:
    ${schemaContext}

    REGRAS:
    1. Use APENAS nomes de tabelas e colunas que existem no schema.
    2. Para 'selectedTables', use o formato "schema.tabela".
    3. Para 'selectedColumns', use o formato "schema.tabela.coluna".
    4. Para 'aggregations', retorne uma lista com a coluna e a função: COUNT, SUM, AVG, MIN, MAX ou NONE.
    5. Infira JOINS se múltiplas tabelas forem necessárias.
    6. Infira FILTROS se o usuário pedir. IMPORTANTE: No PostgreSQL, operadores LIKE/ILIKE exigem valores entre aspas simples. Não inclua o símbolo % no valor, pois o builder cuidará disso.
    7. Se o usuário pedir agrupamento, adicione ao 'groupBy'.

    Retorne APENAS JSON.
  `;

  const prompt = `Solicitação do usuário: "${userPrompt}"`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            selectedTables: { type: Type.ARRAY, items: { type: Type.STRING } },
            selectedColumns: { type: Type.ARRAY, items: { type: Type.STRING } },
            aggregations: { 
               type: Type.ARRAY,
               items: {
                 type: Type.OBJECT,
                 properties: {
                   column: { type: Type.STRING },
                   function: { type: Type.STRING }
                 }
               }
            }, 
            filters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  column: { type: Type.STRING },
                  operator: { type: Type.STRING },
                  value: { type: Type.STRING }
                }
              }
            },
            joins: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  fromTable: { type: Type.STRING },
                  fromColumn: { type: Type.STRING },
                  toTable: { type: Type.STRING },
                  toColumn: { type: Type.STRING },
                  type: { type: Type.STRING }
                }
              }
            },
            groupBy: { type: Type.ARRAY, items: { type: Type.STRING } },
            limit: { type: Type.INTEGER }
          },
          required: ["selectedTables", "selectedColumns"]
        }
      }
    });

    if (response.text) {
      const rawData = JSON.parse(cleanJsonString(response.text));
      const processedState: Partial<BuilderState> = {
        selectedTables: rawData.selectedTables || [],
        selectedColumns: rawData.selectedColumns || [],
        aggregations: Array.isArray(rawData.aggregations) 
            ? rawData.aggregations.reduce((acc: any, curr: any) => {
                if (curr.column && curr.function) acc[curr.column] = curr.function;
                return acc;
              }, {})
            : {},
        groupBy: rawData.groupBy || [],
        limit: rawData.limit || 100,
        filters: (rawData.filters || []).map((f: any) => ({
          id: crypto.randomUUID(),
          column: f.column,
          operator: (['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'ILIKE', 'IN', 'IS NULL', 'IS NOT NULL'].includes(f.operator) ? f.operator : '=') as Operator,
          value: String(f.value),
          wildcardPosition: 'both' // Default to contains
        })),
        joins: (rawData.joins || []).map((j: any) => ({
          id: crypto.randomUUID(),
          fromTable: j.fromTable,
          fromColumn: j.fromColumn,
          toTable: j.toTable,
          toColumn: j.toColumn,
          type: (['INNER', 'LEFT', 'RIGHT', 'FULL'].includes(j.type) ? j.type : 'INNER') as JoinType
        })),
        orderBy: []
      };
      return processedState;
    }
    throw new Error("No response from AI");
  } catch (error) {
    console.error("Magic Fill Error:", error);
    return {};
  }
};

export const validateSqlQuery = async (sql: string, schema?: DatabaseSchema): Promise<ValidationResult> => {
  let schemaContext = "";
  if (schema) {
    schemaContext = `
    SCHEMA DE REFERÊNCIA (Formato JSON):
    ${formatSchemaForPrompt(schema)}
    `;
  }

  const prompt = `
    Atue como um DBA PostgreSQL.
    ${schemaContext}
    Consulta SQL: "${sql}"
    Retorne JSON com validação de colunas e sintaxe. IMPORTANTE: Operadores LIKE/ILIKE em colunas BIGINT/INT exigem cast da coluna para ::text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN },
            error: { type: Type.STRING },
            detailedError: { type: Type.STRING },
            errorLine: { type: Type.INTEGER },
            correctedSql: { type: Type.STRING }
          }
        }
      }
    });
    return response.text ? JSON.parse(cleanJsonString(response.text)) : { isValid: true };
  } catch (error) {
    return { isValid: true };
  }
};

export const analyzeQueryPerformance = async (schema: DatabaseSchema, sql: string): Promise<OptimizationAnalysis> => {
   const schemaContext = formatSchemaForPrompt(schema);
   const prompt = `
     Analise a performance desta query PostgreSQL: "${sql}"
     Schema: ${schemaContext}
     Retorne JSON com rating (0-100), explicação, sugestões de índices e SQL otimizado.
   `;
   const response = await ai.models.generateContent({
     model: 'gemini-3-pro-preview',
     contents: prompt,
     config: { responseMimeType: "application/json" }
   });
   return JSON.parse(cleanJsonString(response.text || '{}')) as OptimizationAnalysis;
};

export const analyzeLog = async (schema: DatabaseSchema, logText: string): Promise<{ sql: string, explanation: string }> => {
   const schemaContext = formatSchemaForPrompt(schema);
   const prompt = `
     Você é um Especialista em Suporte Técnico N3.
     Analise este LOG DE ERRO e gere uma QUERY SQL INVESTIGATIVA.
     SCHEMA: ${schemaContext}
     LOG: "${logText}"
     Retorne JSON: { "sql": "SELECT ...", "explanation": "..." }
   `;
   const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
         responseMimeType: "application/json",
         responseSchema: {
            type: Type.OBJECT,
            properties: {
               sql: { type: Type.STRING },
               explanation: { type: Type.STRING }
            }
         }
      }
   });
   return JSON.parse(cleanJsonString(response.text || '{}'));
};

export const fixSqlError = async (sql: string, errorMessage: string, schema: DatabaseSchema): Promise<string> => {
   const schemaContext = formatSchemaForPrompt(schema);
   const prompt = `Corrija este SQL Postgres: "${sql}"\nErro: "${errorMessage}"\nSchema: ${schemaContext}. Lembre-se que LIKE/ILIKE em tipos numéricos exige cast para ::text.`;
   const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
   return response.text?.replace(/```sql|```/g, '').trim() || sql;
};

export const generateSqlFromBuilderState = async (
  schema: DatabaseSchema,
  state: BuilderState,
  includeTips: boolean = true,
  onProgress?: (msg: string) => void
): Promise<QueryResult> => {
  if (onProgress) onProgress("Gerando SQL...");
  const schemaDesc = formatSchemaForPrompt(schema);
  const prompt = `Gere SQL Postgres para: ${JSON.stringify(state)}. Schema: ${schemaDesc}. Retorne JSON {sql, explanation, tips}. Regra: LIKE/ILIKE em campos BIGINT exige cast ::text e valores entre aspas.`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(cleanJsonString(response.text || '{}')) as QueryResult;
};

export const suggestRelationships = async (schema: DatabaseSchema): Promise<VirtualRelation[]> => {
   const schemaContext = formatSchemaForPrompt(schema);
   const prompt = `Sugira relacionamentos (FKs) implícitos para este schema: ${schemaContext}. Retorne JSON {suggestions: [{sourceTable, sourceColumn, targetTable, targetColumn, confidence}]}`;
   const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
   });
   const data = JSON.parse(cleanJsonString(response.text || '{}'));
   return (data.suggestions || []).map((s: any) => ({...s, id: crypto.randomUUID()}));
};

export const generateSchemaFromTopic = async (topic: string, context: string): Promise<DatabaseSchema> => {
  const prompt = `Crie um schema Postgres JSON para "${topic}". Contexto: ${context}.`;
  const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt, config: { responseMimeType: "application/json" } });
  const parsed = JSON.parse(cleanJsonString(response.text || '{}')) as DatabaseSchema;
  parsed.connectionSource = 'simulated';
  parsed.tables = parsed.tables.map(t => ({...t, schema: 'public'}));
  return parsed;
};

export const parseSchemaFromDDL = async (ddl: string): Promise<DatabaseSchema> => {
  const prompt = `Parse DDL para JSON Schema: ${ddl}`;
  const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt, config: { responseMimeType: "application/json" } });
  const parsed = JSON.parse(cleanJsonString(response.text || '{}')) as DatabaseSchema;
  parsed.connectionSource = 'ddl';
  parsed.tables = parsed.tables.map(t => ({...t, schema: 'public'}));
  return parsed;
};

export const generateMockData = async (schema: DatabaseSchema, sql: string): Promise<any[]> => {
  return [];
};
