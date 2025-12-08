
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DatabaseSchema, QueryResult, ValidationResult, BuilderState, AggregateFunction, Operator, JoinType } from "../types";

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
    columns: t.columns.map(c => c.name) // Only names needed for validation existence check
  }));
  return JSON.stringify(simplifiedStructure, null, 2);
};

// ... (Existing Generate Builder State & Validate SQL functions) ...

/**
 * Converts a natural language user request into a structured BuilderState object.
 * This allows the UI to be auto-filled based on a sentence like "Show sales by country".
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
        orderBy: [] // Usually AI struggles to get this perfectly right in same pass, leave empty for now
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
 * ...
 */
export const validateSqlQuery = async (sql: string, schema?: DatabaseSchema): Promise<ValidationResult> => {
  
  let schemaContext = "";
  if (schema) {
    schemaContext = `
    SCHEMA DE REFERÊNCIA (Formato JSON):
    ${formatSchemaForPrompt(schema)}

    REGRAS DE VALIDAÇÃO:
    1. **VERIFICAÇÃO RIGOROSA DE COLUNAS**: Você deve verificar se TODA coluna usada no SQL (SELECT list, WHERE clause, JOIN ON clause, ORDER BY) existe EXATAMENTE no Schema de Referência acima para a tabela correspondente.
    2. **SEM ADIVINHAÇÃO**: NÃO assuma que uma coluna existe só porque faz sentido. Se a tabela 'lancto' tem apenas ['id', 'data'], e a query usa 'lancto.movto', é INVÁLIDO.
    3. **VALIDAÇÃO DE JOIN**: Verifique a cláusula ON cuidadosamente. A coluna do lado direito do igual pertence realmente àquela tabela?
    4. **INTEGRIDADE DE PALAVRAS-CHAVE**: Verifique se há palavras reservadas aparecendo dentro de identificadores. Exemplo: "c ON ta_creditar" é um ERRO DE SINTAXE se a coluna pretendida era "conta_creditar". Palavras como ON, FROM, WHERE não devem dividir palavras.
    5. **REGRAS DE GROUP BY**: Se uma função de agregação (COUNT, SUM, AVG) for usada, assegure-se de que todas as colunas não agregadas no SELECT estejam presentes na cláusula GROUP BY.
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
    3. Identifique se alguma coluna usada não existe no schema.
    4. Verifique erros de sintaxe, especialmente palavras/identificadores quebrados ou palavras-chave ausentes.
    5. Verifique erros de lógica específicos do PostgreSQL (ex: requisitos de GROUP BY).
    6. Se houver erro, tente identificar em qual linha (aproximada) do SQL fornecido o erro ocorre (considere a primeira linha como 1).

    Retorne JSON:
    {
      "isValid": boolean,
      "error": string (Um resumo técnico conciso de 1 frase do erro),
      "detailedError": string (Uma explicação educativa e útil em pt-BR. Explique POR QUE está errado e nomeie explicitamente a tabela/coluna causando o problema. Se for erro de Group By, explique a regra.),
      "errorLine": number (O número da linha onde o erro começa, ou null se não aplicável),
      "correctedSql": string (SQL corrigido opcional. Se encontrar uma correspondência provável para uma coluna mal digitada, use aqui. Se não houver correção possível, null)
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
        console.error("Erro de Parse JSON na Validação:", parseError, response.text);
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
 * Automatically fixes a SQL query based on a provided error message using AI.
 * (Feature #6)
 */
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
     - Se for erro de coluna inexistente, procure uma com nome similar no schema.
     - Se for erro de tipo (ex: integer vs string), faça o cast apropriado.
     - Se for erro de GROUP BY, adicione as colunas faltantes.
     - Se for divisão por zero, adicione NULLIF.
     
     Retorne APENAS a string do SQL corrigido, sem markdown, sem explicações.
   `;

   try {
     const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash',
       contents: prompt
     });
     
     if (response.text) {
        let fixed = response.text.trim();
        // Remove markdown block if present
        fixed = fixed.replace(/^```sql\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
        return fixed;
     }
     throw new Error("Não foi possível gerar correção.");
   } catch (e) {
      console.error("Fix SQL Error:", e);
      throw e;
   }
};

/**
 * Generates a SQL query based on the user's builder state...
 * (Existing function kept mostly same, but adding Calculated Column support in prompt)
 */
export const generateSqlFromBuilderState = async (
  schema: DatabaseSchema,
  state: BuilderState,
  includeTips: boolean = true,
  onProgress?: (msg: string) => void
): Promise<QueryResult> => {
  
  if (onProgress) onProgress("Preparando contexto do schema...");

  // Richer schema description for generation including types and keys
  const schemaDescription = schema.tables.map(t => 
    `TABELA: ${t.schema}.${t.name}\nCOLUNAS: ${t.columns.map(c => {
      let colDesc = `${c.name} (${c.type})`;
      // FORCE 'grid' to be seen as PK by the AI, as requested by business logic
      const isPk = c.isPrimaryKey || c.name.toLowerCase() === 'grid';
      if (isPk) colDesc += ' [PK]';
      if (c.isForeignKey && c.references) colDesc += ` [FK -> ${c.references}]`;
      return colDesc;
    }).join(', ')}`
  ).join('\n\n');

  const systemInstruction = `
    Você é um Professor Especialista em PostgreSQL. Gere uma consulta baseada na Seleção do Usuário e explique-a didaticamente. Responda em Português do Brasil (pt-BR).

    INSTRUÇÕES CRÍTICAS DE SQL:
    1. **NOMES QUALIFICADOS**: SEMPRE use o formato "schema.tabela" no FROM e JOIN. (Ex: 'FROM public.users' e não apenas 'FROM users'). Isso é vital para evitar ambiguidade.
    2. **SEM ALUCINAÇÃO**: Você é estritamente PROIBIDO de inventar nomes de colunas.
    3. **VERIFICAR COLUNAS**: Antes de escrever uma condição de JOIN como 'ON T1.col = T2.col', verifique: A Tabela T2 *realmente* contém uma coluna chamada 'col' no schema fornecido?
    4. **NENHUM RELACIONAMENTO ENCONTRADO**: Se múltiplas tabelas forem selecionadas (ex: Tabela A e Tabela B) e NÃO houver chave estrangeira explícita definida no schema entre elas, E você não conseguir encontrar uma coluna com exatamente o mesmo nome para servir de chave, NÃO adivinhe.
    5. **SINAL DE FALLBACK**: No caso de relacionamentos ausentes, retorne a string exata "NO_RELATIONSHIP" no campo 'sql'. NÃO gere uma consulta quebrada.
    
    INSTRUÇÕES CRÍTICAS PARA ORDENAÇÃO E GROUP BY:
    6. **ORDER BY**: Se o usuário fornecer instruções de 'OrderBy', você DEVE anexar uma cláusula 'ORDER BY'. Não ignore.
    7. **AGREGAÇÃO**: Se o usuário solicitou uma função de agregação (COUNT, SUM, etc.) em uma coluna, você DEVE incluí-la no SELECT e adicionar o GROUP BY apropriado para as outras colunas.

    INSTRUÇÕES DIDÁTICAS (Explanation):
    - No campo 'explanation', não descreva apenas o que a query faz. EXPLIQUE A SINTAXE para um iniciante.
    - Exemplo ruim: "Esta query seleciona vendas."
    - Exemplo bom: "Estamos usando 'SELECT' para escolher as colunas e 'JOIN' para conectar a tabela de vendas com clientes através do ID. O 'GROUP BY' é necessário aqui porque usamos a função SUM() para somar totais."

    Formatação:
    - Use espaçamento estrito (ex: 'SELECT * FROM' não 'SELECT*FROM').
    - Use alias para tabelas como t1, t2, etc., para brevidade, mas mapeie corretamente.
  `;

  // Format columns to include aggregation requests
  const formattedColumns = state.selectedColumns.map(col => {
     // Format input: "schema.table.column"
     const agg = state.aggregations?.[col];
     if (agg && agg !== 'NONE') {
        // extract column name (last part)
        const parts = col.split('.');
        const colName = parts[parts.length - 1];
        return `${agg}(${col}) AS ${agg.toLowerCase()}_${colName}`;
     }
     return col;
  });
  
  // Inject calculated columns into context
  const calculatedContext = state.calculatedColumns?.map(c => `Calculated Column: "${c.alias}" = ${c.expression}`).join('\n') || '';

  const prompt = `
    SCHEMA DO BANCO DE DADOS (Use APENAS estas colunas):
    ${schemaDescription}

    SOLICITAÇÃO DO USUÁRIO:
    - Tabelas: ${state.selectedTables.join(', ')}
    - Colunas Solicitadas (com agregações): ${formattedColumns.join(', ')}
    - Colunas Calculadas (fórmulas): ${calculatedContext}
    - Joins Explícitos: ${JSON.stringify(state.joins)}
    - Filtros: ${JSON.stringify(state.filters)}
    - Agrupamento (GroupBy): ${state.groupBy.join(', ')}
    - Ordenação (OrderBy): ${JSON.stringify(state.orderBy)}
    - Limite: ${state.limit}

    Gere um JSON válido:
    {
      "sql": "string", (OU "NO_RELATIONSHIP" se nenhum join válido for encontrado)
      "explanation": "string (pt-BR - Explique a lógica da query de forma didática e educacional)",
      "tips": ["string"] (Apenas se solicitado, dicas de otimização em pt-BR)
    }
  `;
  
  // Conditionally remove tips from the schema request if disabled
  const requiredFields = ["sql", "explanation"];
  if (includeTips) requiredFields.push("tips");

  try {
    if (onProgress) onProgress("Aguardando resposta da IA...");
    
    // Add a timeout race
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
            tips: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            }
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
      
      if (onProgress) onProgress("Finalizando query...");

      // Check for the specific no-relationship signal
      if (result.sql === "NO_RELATIONSHIP") {
        return result;
      }

      // Safety net: ensure very first SELECT has a space if missing.
      let fixedSql = result.sql;
      fixedSql = fixedSql.replace(/^SELECT(?=[^\s])/i, 'SELECT ');
      
      result.sql = fixedSql;
      
      // Clean up tips if they weren't requested
      if (!includeTips) {
        result.tips = [];
      }

      return result;
    }
    throw new Error("Sem resposta da IA");
  } catch (error: any) {
    console.error("Erro na Geração do Builder:", error);
    // Add logic to check for quota exhaustion
    if (error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("exhausted")) {
       throw new Error("QUOTA_ERROR");
    }
    throw new Error(error.message || "Falha ao construir SQL.");
  }
};

// ... (Other exports: generateSchemaFromTopic, parseSchemaFromDDL, generateMockData kept as is) ...
export const generateSchemaFromTopic = async (topic: string, context: string): Promise<DatabaseSchema> => {
  const prompt = `
    Gere um Schema de Banco de Dados PostgreSQL realista para um sistema sobre: "${topic}".
    Contexto adicional: ${context}
    
    O schema deve ser complexo o suficiente para ser interessante (mínimo 3 tabelas, máximo 6).
    Inclua chaves primárias (PK) e estrangeiras (FK) adequadas.
    
    Retorne JSON estritamente com esta estrutura:
    {
      "name": "string",
      "tables": [
        {
          "name": "string",
          "description": "string",
          "columns": [
             { "name": "string", "type": "string (ex: SERIAL, VARCHAR(50), INTEGER)", "isPrimaryKey": boolean, "isForeignKey": boolean, "references": "string (opcional, ex: users.id)" }
          ]
        }
      ]
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
      // Default missing schemas to 'public' for simulation
      parsed.tables = parsed.tables.map(t => ({...t, schema: 'public'}));
      return parsed;
    }
    throw new Error("Resposta da IA vazia na simulação.");
  } catch (error: any) {
    console.error(error);
    if (error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("exhausted")) {
       throw new Error("QUOTA_ERROR");
    }
    throw new Error("Falha ao gerar simulação.");
  }
};

export const parseSchemaFromDDL = async (ddl: string): Promise<DatabaseSchema> => {
  const prompt = `Faça o parse deste SQL DDL para JSON: ${ddl}`;
  const schemaStructure: Schema = {
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
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schemaStructure }
    });

    if (response.text) {
      const parsed = JSON.parse(cleanJsonString(response.text)) as DatabaseSchema;
      parsed.connectionSource = 'ddl';
      // Default to public
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
    Gere dados fictícios (Mock Data) para o seguinte cenário.
    
    SCHEMA DO BANCO:
    ${JSON.stringify(schema.tables.map(t => ({ table: `${t.schema || 'public'}.${t.name}`, columns: t.columns.map(c => c.name) })))}

    QUERY SQL:
    ${sql}

    INSTRUÇÃO:
    Retorne um Array JSON contendo 5 a 10 linhas de resultados realistas para esta query.
    As chaves dos objetos JSON devem ser os nomes das colunas/aliases retornados pela query.
    Seja consistente com os tipos de dados (números, datas, strings).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    if (response.text) {
      return JSON.parse(cleanJsonString(response.text));
    }
    return [];
  } catch (error: any) {
    console.error("Mock Data Generation Error:", error);
    if (error.message?.includes("429") || error.message?.includes("quota")) {
       throw new Error("QUOTA_ERROR");
    }
    return [];
  }
};
