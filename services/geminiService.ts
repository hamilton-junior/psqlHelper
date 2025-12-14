

import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DatabaseSchema, QueryResult, ValidationResult, BuilderState, AggregateFunction, Operator, JoinType, OptimizationAnalysis } from "../types";

// Vite will replace 'process.env.API_KEY' with the actual string from your .env file at build time.
// @ts-ignore: process is defined via Vite config
const apiKey = process.env.API_KEY;

const ai = new GoogleGenAI({ apiKey: apiKey });

// Helper to clean Markdown code blocks from JSON response
const cleanJsonString = (str: string): string => {
  if (!str) return "{}";
  // Remove ```json ... ``` or just ``` ... ```
  return str.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
};

const formatSchemaForPrompt = (schema: DatabaseSchema): string => {
  // Use a more structured JSON-like format for the prompt to reduce ambiguity
  // Include schema explicitly!
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

// ... (Existing Generate Builder State & Validate SQL functions) ...

/**
 * Converts a natural language user request into a structured BuilderState object.
 */
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
    2. Para 'selectedTables', use o formato "schema.tabela" (ex: "public.users").
    3. Para 'selectedColumns', use o formato "schema.tabela.coluna".
    4. Para 'aggregations', retorne uma lista com a coluna e a função: COUNT, SUM, AVG, MIN, MAX ou NONE.
    5. Infira JOINS se múltiplas tabelas forem necessárias. Tente adivinhar as colunas de ligação (fk/pk) pelos nomes.
    6. Infira FILTROS se o usuário pedir (ex: "vendas acima de 100" -> operator: ">", value: "100").
    7. Se o usuário pedir agrupamento (ex: "por país"), adicione ao 'groupBy'.

    Retorne APENAS JSON.
  `;

  const prompt = `Solicitação do usuário: "${userPrompt}"`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
      
      // Post-process to ensure IDs and types match Typescript interfaces
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
          value: String(f.value)
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

/**
 * Validates a generated SQL query against a database schema using AI.
 */
export const validateSqlQuery = async (sql: string, schema?: DatabaseSchema): Promise<ValidationResult> => {
  
  let schemaContext = "";
  if (schema) {
    schemaContext = `
    SCHEMA DE REFERÊNCIA (Formato JSON):
    ${formatSchemaForPrompt(schema)}

    REGRAS DE VALIDAÇÃO:
    1. **VERIFICAÇÃO RIGOROSA DE COLUNAS**: Você deve verificar se TODA coluna usada no SQL (SELECT list, WHERE clause, JOIN ON clause, ORDER BY) existe EXATAMENTE no Schema de Referência acima.
    2. **SEM ADIVINHAÇÃO**: NÃO assuma que uma coluna existe só porque faz sentido.
    3. **VALIDAÇÃO DE JOIN**: Verifique a cláusula ON cuidadosamente.
    4. **INTEGRIDADE DE PALAVRAS-CHAVE**: Verifique se há palavras reservadas.
    5. **REGRAS DE GROUP BY**: Assegure-se de que todas as colunas não agregadas estejam no GROUP BY.
    `;
  }

  const prompt = `
    Atue como um DBA PostgreSQL Sênior e Educador.
    
    ${schemaContext}

    Consulta SQL para Validar: 
    "${sql}"

    Tarefa:
    1. Analise o SQL para identificar todas as tabelas e colunas referenciadas.
    2. Compare-as com o SCHEMA DE REFERÊNCIA.
    3. Verifique erros de sintaxe e lógica (GROUP BY).
    4. Se houver erro, tente identificar em qual linha (aproximada) o erro ocorre.

    Retorne JSON:
    {
      "isValid": boolean,
      "error": string (Resumo técnico conciso),
      "detailedError": string (Explicação em pt-BR),
      "errorLine": number,
      "correctedSql": string (opcional)
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
          },
          required: ["isValid"]
        }
      }
    });

    if (response.text) {
      try {
        const cleanText = cleanJsonString(response.text);
        return JSON.parse(cleanText) as ValidationResult;
      } catch (parseError) {
        console.error("Erro de Parse JSON na Validação:", parseError);
        return { isValid: true };
      }
    }
    return { isValid: true }; 
  } catch (error: any) {
    console.error("Erro na API de Validação:", error);
    if (error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("exhausted")) {
       throw new Error("QUOTA_ERROR");
    }
    return { isValid: true };
  }
};

/**
 * Feature: Performance Analysis & Optimization
 */
export const analyzeQueryPerformance = async (schema: DatabaseSchema, sql: string): Promise<OptimizationAnalysis> => {
   const schemaContext = formatSchemaForPrompt(schema);
   
   const prompt = `
     Você é um DBA PostgreSQL Especialista em Performance Tuning.
     
     SCHEMA DO BANCO:
     ${schemaContext}
     
     QUERY A ANALISAR:
     "${sql}"
     
     TAREFA:
     1. Analise a query em busca de gargalos de performance comuns (ex: Full Table Scans em tabelas grandes, Joins sem índices, funções em colunas no WHERE, excesso de colunas no SELECT).
     2. Dê uma nota de 0 a 100 para a query (100 = perfeita).
     3. Sugira índices (CREATE INDEX) que beneficiariam esta query específica.
     4. Se possível, reescreva a query para ser mais performática (ex: substituir subquery por JOIN, usar CTEs de forma eficiente, remover DISTINCT desnecessário). Se a query já for ótima, retorne a mesma query.
     
     Retorne JSON:
     {
       "rating": number,
       "summary": string (Título curto do diagnóstico, ex: "Falta de Índice em Foreign Key"),
       "explanation": string (Explicação detalhada em PT-BR sobre os problemas encontrados),
       "suggestedIndexes": string[] (Lista de comandos SQL CREATE INDEX sugeridos),
       "optimizedSql": string (A query reescrita otimizada),
       "improvementDetails": string (O que foi mudado na versão otimizada)
     }
   `;

   try {
     const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash',
       contents: prompt,
       config: {
         responseMimeType: "application/json",
         responseSchema: {
            type: Type.OBJECT,
            properties: {
               rating: { type: Type.INTEGER },
               summary: { type: Type.STRING },
               explanation: { type: Type.STRING },
               suggestedIndexes: { type: Type.ARRAY, items: { type: Type.STRING } },
               optimizedSql: { type: Type.STRING },
               improvementDetails: { type: Type.STRING }
            },
            required: ["rating", "explanation", "optimizedSql"]
         }
       }
     });
     
     if (response.text) {
        return JSON.parse(cleanJsonString(response.text)) as OptimizationAnalysis;
     }
     throw new Error("Sem resposta da análise.");
   } catch (e: any) {
      console.error("Optimization Error:", e);
      if (e.message?.includes("429") || e.message?.includes("quota")) {
         throw new Error("QUOTA_ERROR");
      }
      throw e;
   }
};

export const fixSqlError = async (sql: string, errorMessage: string, schema: DatabaseSchema): Promise<string> => {
   const schemaContext = formatSchemaForPrompt(schema);
   
   const prompt = `
     Você é um especialista em corrigir erros de SQL PostgreSQL.
     
     SCHEMA:
     ${schemaContext}
     
     QUERY QUE FALHOU:
     "${sql}"
     
     MENSAGEM DE ERRO DO BANCO:
     "${errorMessage}"
     
     TAREFA:
     Analise o erro e o schema. Corrija o SQL para funcionar corretamente.
     Retorne APENAS a string do SQL corrigido, sem markdown.
   `;

   try {
     const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash',
       contents: prompt
     });
     
     if (response.text) {
        let fixed = response.text.trim();
        fixed = fixed.replace(/^```sql\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
        return fixed;
     }
     throw new Error("Não foi possível gerar correção.");
   } catch (e) {
      console.error("Fix SQL Error:", e);
      throw e;
   }
};

export const generateSqlFromBuilderState = async (
  schema: DatabaseSchema,
  state: BuilderState,
  includeTips: boolean = true,
  onProgress?: (msg: string) => void
): Promise<QueryResult> => {
  
  if (onProgress) onProgress("Preparando contexto do schema...");

  const schemaDescription = schema.tables.map(t => 
    `TABELA: ${t.schema}.${t.name}\nCOLUNAS: ${t.columns.map(c => {
      let colDesc = `${c.name} (${c.type})`;
      const isPk = c.isPrimaryKey || c.name.toLowerCase() === 'grid';
      if (isPk) colDesc += ' [PK]';
      if (c.isForeignKey && c.references) colDesc += ` [FK -> ${c.references}]`;
      return colDesc;
    }).join(', ')}`
  ).join('\n\n');

  const systemInstruction = `
    Você é um Professor Especialista em PostgreSQL. Gere uma consulta baseada na Seleção do Usuário e explique-a didaticamente. Responda em Português do Brasil (pt-BR).

    INSTRUÇÕES CRÍTICAS DE SQL:
    1. **NOMES QUALIFICADOS**: SEMPRE use o formato "schema.tabela" no FROM e JOIN.
    2. **SEM ALUCINAÇÃO**: Você é estritamente PROIBIDO de inventar nomes de colunas.
    3. **VERIFICAR COLUNAS**: Antes de escrever uma condição de JOIN, verifique se a coluna existe.
    4. **SINAL DE FALLBACK**: Se não houver relacionamentos válidos, retorne "NO_RELATIONSHIP".
    
    INSTRUÇÕES PARA COLUNAS E AGREGAÇÃO:
    5. **AGREGAÇÃO**: Se houver função de agregação, adicione GROUP BY para colunas não agregadas.
    6. **COLUNAS CALCULADAS**: Inclua fórmulas no SELECT.

    INSTRUÇÕES DIDÁTICAS:
    - Explique A SINTAXE para um iniciante no campo 'explanation'.
  `;

  const formattedColumns = state.selectedColumns.map(col => {
     const agg = state.aggregations?.[col];
     if (agg && agg !== 'NONE') {
        const parts = col.split('.');
        const colName = parts[parts.length - 1];
        return `${agg}(${col}) AS ${agg.toLowerCase()}_${colName}`;
     }
     return col;
  });
  
  const calculatedContext = state.calculatedColumns?.map(c => `Calculated Column: "${c.alias}" = ${c.expression}`).join('\n') || 'Nenhuma coluna calculada';

  const prompt = `
    SCHEMA DO BANCO DE DADOS:
    ${schemaDescription}

    SOLICITAÇÃO DO USUÁRIO:
    - Tabelas: ${state.selectedTables.join(', ')}
    - Colunas Solicitadas: ${formattedColumns.join(', ')}
    - Colunas Calculadas: ${calculatedContext}
    - Joins Explícitos: ${JSON.stringify(state.joins)}
    - Filtros: ${JSON.stringify(state.filters)}
    - GroupBy: ${state.groupBy.join(', ')}
    - OrderBy: ${JSON.stringify(state.orderBy)}
    - Limite: ${state.limit}

    Gere um JSON válido:
    {
      "sql": "string",
      "explanation": "string",
      "tips": ["string"]
    }
  `;
  
  const requiredFields = ["sql", "explanation"];
  if (includeTips) requiredFields.push("tips");

  try {
    if (onProgress) onProgress("Aguardando resposta da IA...");
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("TIMEOUT")), 25000)
    );

    const apiPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sql: { type: Type.STRING },
            explanation: { type: Type.STRING },
            tips: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: requiredFields
        }
      }
    });

    const response: any = await Promise.race([apiPromise, timeoutPromise]);

    if (onProgress) onProgress("Processando resposta JSON...");

    if (response.text) {
      let result: QueryResult;
      try {
        const cleanText = cleanJsonString(response.text);
        result = JSON.parse(cleanText) as QueryResult;
      } catch (parseError) {
        console.error("Erro de Parse JSON no Builder:", parseError, response.text);
        throw new Error("Resposta inválida da IA.");
      }
      
      if (result.sql === "NO_RELATIONSHIP") {
        return result;
      }

      let fixedSql = result.sql;
      fixedSql = fixedSql.replace(/^SELECT(?=[^\s])/i, 'SELECT ');
      result.sql = fixedSql;
      
      if (!includeTips) result.tips = [];

      return result;
    }
    throw new Error("Sem resposta da IA");
  } catch (error: any) {
    console.error("Erro na Geração do Builder:", error);
    if (error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("exhausted")) {
       throw new Error("QUOTA_ERROR");
    }
    throw new Error(error.message || "Falha ao construir SQL.");
  }
};

export const generateSchemaFromTopic = async (topic: string, context: string): Promise<DatabaseSchema> => {
  const prompt = `
    Gere um Schema de Banco de Dados PostgreSQL realista para um sistema sobre: "${topic}".
    Contexto adicional: ${context}
    
    Retorne JSON:
    {
      "name": "string",
      "tables": [ { "name": "string", "description": "string", "columns": [ { "name": "string", "type": "string", "isPrimaryKey": boolean, "isForeignKey": boolean, "references": "string" } ] } ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            tables: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  columns: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        type: { type: Type.STRING },
                        isPrimaryKey: { type: Type.BOOLEAN },
                        isForeignKey: { type: Type.BOOLEAN },
                        references: { type: Type.STRING }
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

    if (response.text) {
      const parsed = JSON.parse(cleanJsonString(response.text)) as DatabaseSchema;
      parsed.connectionSource = 'simulated';
      parsed.tables = parsed.tables.map(t => ({...t, schema: 'public'}));
      return parsed;
    }
    throw new Error("Resposta da IA vazia na simulação.");
  } catch (error: any) {
    if (error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("exhausted")) {
       throw new Error("QUOTA_ERROR");
    }
    throw new Error("Falha ao gerar simulação.");
  }
};

export const parseSchemaFromDDL = async (ddl: string): Promise<DatabaseSchema> => {
  const prompt = `Faça o parse deste SQL DDL para JSON: ${ddl}`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    if (response.text) {
      const parsed = JSON.parse(cleanJsonString(response.text)) as DatabaseSchema;
      parsed.connectionSource = 'ddl';
      parsed.tables = parsed.tables.map(t => ({...t, schema: 'public'}));
      return parsed;
    }
    throw new Error("Resposta da IA vazia");
  } catch (error: any) {
    if (error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("exhausted")) {
       throw new Error("QUOTA_ERROR");
    }
    throw new Error("Falha ao analisar DDL.");
  }
};

export const generateMockData = async (schema: DatabaseSchema, sql: string): Promise<any[]> => {
  const prompt = `
    Gere dados fictícios (Mock Data).
    SCHEMA: ${JSON.stringify(schema.tables.map(t => ({ table: `${t.schema || 'public'}.${t.name}`, columns: t.columns.map(c => c.name) })))}
    QUERY SQL: ${sql}
    INSTRUÇÃO: Retorne Array JSON com 5-10 linhas de resultados realistas.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    if (response.text) return JSON.parse(cleanJsonString(response.text));
    return [];
  } catch (error: any) {
    if (error.message?.includes("429") || error.message?.includes("quota")) {
       throw new Error("QUOTA_ERROR");
    }
    return [];
  }
};
