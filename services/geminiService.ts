
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DatabaseSchema, QueryResult, ValidationResult, BuilderState } from "../types";

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
  const simplifiedStructure = schema.tables.map(t => ({
    tableName: t.name,
    columns: t.columns.map(c => c.name) // Only names needed for validation existence check
  }));
  return JSON.stringify(simplifiedStructure, null, 2);
};

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

    Retorne JSON:
    {
      "isValid": boolean,
      "error": string (Um resumo técnico conciso de 1 frase do erro),
      "detailedError": string (Uma explicação educativa e útil em pt-BR. Explique POR QUE está errado e nomeie explicitamente a tabela/coluna causando o problema. Se for erro de Group By, explique a regra.),
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

export const generateSqlFromBuilderState = async (
  schema: DatabaseSchema,
  state: BuilderState,
  includeTips: boolean = true
): Promise<QueryResult> => {
  
  // Richer schema description for generation including types and keys
  const schemaDescription = schema.tables.map(t => 
    `TABELA: ${t.name}\nCOLUNAS: ${t.columns.map(c => {
      let colDesc = `${c.name} (${c.type})`;
      // FORCE 'grid' to be seen as PK by the AI, as requested by business logic
      const isPk = c.isPrimaryKey || c.name.toLowerCase() === 'grid';
      if (isPk) colDesc += ' [PK]';
      if (c.isForeignKey && c.references) colDesc += ` [FK -> ${c.references}]`;
      return colDesc;
    }).join(', ')}`
  ).join('\n\n');

  const systemInstruction = `
    Você é um Especialista em PostgreSQL. Gere uma consulta baseada na Seleção do Usuário. Responda em Português do Brasil (pt-BR).

    INSTRUÇÕES CRÍTICAS PARA JUNÇÃO DE TABELAS (JOINS):
    1. **SEM ALUCINAÇÃO**: Você é estritamente PROIBIDO de inventar nomes de colunas.
    2. **VERIFICAR COLUNAS**: Antes de escrever uma condição de JOIN como 'ON T1.col = T2.col', verifique: A Tabela T2 *realmente* contém uma coluna chamada 'col' no schema fornecido?
    3. **NENHUM RELACIONAMENTO ENCONTRADO**: Se múltiplas tabelas forem selecionadas (ex: Tabela A e Tabela B) e NÃO houver chave estrangeira explícita definida no schema entre elas, E você não conseguir encontrar uma coluna com exatamente o mesmo nome para servir de chave, NÃO adivinhe.
    4. **SINAL DE FALLBACK**: No caso de relacionamentos ausentes, retorne a string exata "NO_RELATIONSHIP" no campo 'sql'. NÃO gere uma consulta quebrada.
    
    INSTRUÇÕES CRÍTICAS PARA ORDENAÇÃO:
    5. **ORDER BY**: Se o usuário fornecer instruções de 'OrderBy', você DEVE anexar uma cláusula 'ORDER BY'. Não ignore.

    Formatação:
    - Use espaçamento estrito (ex: 'SELECT * FROM' não 'SELECT*FROM').
    - Use alias para tabelas como t1, t2, etc., para brevidade, mas mapeie corretamente.
  `;

  const prompt = `
    SCHEMA DO BANCO DE DADOS (Use APENAS estas colunas):
    ${schemaDescription}

    SOLICITAÇÃO DO USUÁRIO:
    - Tabelas: ${state.selectedTables.join(', ')}
    - Colunas: ${state.selectedColumns.join(', ')}
    - Joins Explícitos: ${JSON.stringify(state.joins)}
    - Filtros: ${JSON.stringify(state.filters)}
    - Agrupamento (GroupBy): ${state.groupBy.join(', ')}
    - Ordenação (OrderBy): ${JSON.stringify(state.orderBy)}
    - Limite: ${state.limit}

    Gere um JSON válido:
    {
      "sql": "string", (OU "NO_RELATIONSHIP" se nenhum join válido for encontrado)
      "explanation": "string (pt-BR - Explique a lógica da query de forma didática)",
      "tips": ["string"] (Apenas se solicitado, dicas de otimização em pt-BR)
    }
  `;
  
  // Conditionally remove tips from the schema request if disabled
  const requiredFields = ["sql", "explanation"];
  if (includeTips) requiredFields.push("tips");

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

    if (response.text) {
      let result: QueryResult;
      try {
        const cleanText = cleanJsonString(response.text);
        result = JSON.parse(cleanText) as QueryResult;
      } catch (parseError) {
        console.error("Erro de Parse JSON no Builder:", parseError, response.text);
        throw new Error("Resposta inválida da IA.");
      }
      
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