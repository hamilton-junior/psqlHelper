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
    REFERENCE SCHEMA (JSON Format):
    ${formatSchemaForPrompt(schema)}

    VALIDATION RULES:
    1. **STRICT COLUMN CHECK**: You must verify that EVERY column name used in the SQL (SELECT list, WHERE clause, JOIN ON clause, ORDER BY) exists EXACTLY in the Reference Schema above for the corresponding table.
    2. **NO GUESSING**: Do NOT assume a column exists just because it makes sense. If table 'lancto' only has ['id', 'date'], and the query uses 'lancto.movto', it is INVALID.
    3. **JOIN VALIDATION**: Check the ON clause carefully. Does the column on the right side of the equals sign actually belong to that table?
    `;
  }

  const prompt = `
    Act as a PostgreSQL Compiler and Syntax Validator.
    
    ${schemaContext}

    SQL Query to Validate: 
    "${sql}"

    Task:
    1. Parse the SQL to identify all tables and columns referenced.
    2. Compare them against the REFERENCE SCHEMA.
    3. Identify if any column used does not exist in the schema.
    4. Check for syntax errors.

    Return JSON:
    {
      "isValid": boolean,
      "error": string (Description of the missing column or syntax error in pt-BR),
      "correctedSql": string (Optional fixed SQL if easy to fix, else null)
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
        console.error("Validation JSON Parse Error:", parseError, response.text);
        return { isValid: true };
      }
    }
    return { isValid: true }; 
  } catch (error) {
    console.error("Validation API Error:", error);
    return { isValid: true };
  }
};

export const generateSqlFromBuilderState = async (
  schema: DatabaseSchema,
  state: BuilderState
): Promise<QueryResult> => {
  
  // Richer schema description for generation including types and keys
  const schemaDescription = schema.tables.map(t => 
    `TABLE: ${t.name}\nCOLUMNS: ${t.columns.map(c => `${c.name} (${c.type})`).join(', ')}`
  ).join('\n\n');

  const systemInstruction = `
    You are a PostgreSQL Expert. Generate a query based on the User Selection.

    CRITICAL INSTRUCTIONS FOR JOINING TABLES:
    1. **NO HALLUCINATION**: You are STRICTLY FORBIDDEN from inventing column names.
    2. **VERIFY COLUMNS**: Before writing a JOIN condition like 'ON T1.col = T2.col', check: Does Table T2 *actually* contain a column named 'col'?
    3. **COMMON ERROR TRAP**: Do NOT assume that a table named 'lancto' has a column named 'movto'. Only use columns listed in the schema below.
    4. **FALLBACK**: If you cannot find a common column to JOIN tables, explain that no relationship was found in the 'explanation' field, and do NOT generate a fake JOIN condition.

    Formatting:
    - Use strict spacing (e.g., 'SELECT * FROM' not 'SELECT*FROM').
    - Alias tables as t1, t2, etc., for brevity, but map them correctly.
  `;

  const prompt = `
    DATABASE SCHEMA (Use ONLY these columns):
    ${schemaDescription}

    USER REQUEST:
    - Tables: ${state.selectedTables.join(', ')}
    - Columns: ${state.selectedColumns.join(', ')}
    - Explicit Joins: ${JSON.stringify(state.joins)}
    - Filters: ${JSON.stringify(state.filters)}
    - GroupBy: ${state.groupBy.join(', ')}
    - OrderBy: ${JSON.stringify(state.orderBy)}
    - Limit: ${state.limit}

    Generate valid JSON:
    {
      "sql": "string",
      "explanation": "string (pt-BR)",
      "tips": ["string"]
    }
  `;

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
          required: ["sql", "explanation"]
        }
      }
    });

    if (response.text) {
      let result: QueryResult;
      try {
        const cleanText = cleanJsonString(response.text);
        result = JSON.parse(cleanText) as QueryResult;
      } catch (parseError) {
        console.error("Builder JSON Parse Error:", parseError, response.text);
        throw new Error("Invalid AI response.");
      }
      
      // Safety net: regex post-processing
      let fixedSql = result.sql;
      fixedSql = fixedSql.replace(/^SELECT(?=[^\s])/i, 'SELECT ');
      fixedSql = fixedSql.replace(/([^\s])FROM/gi, '$1 FROM');
      fixedSql = fixedSql.replace(/FROM(?=[^\s])/gi, 'FROM ');
      fixedSql = fixedSql.replace(/([^\s])LIMIT/gi, '$1 LIMIT');
      fixedSql = fixedSql.replace(/LIMIT(?=[^\s])/gi, 'LIMIT ');
      fixedSql = fixedSql.replace(/([^\s])WHERE/gi, '$1 WHERE');
      fixedSql = fixedSql.replace(/WHERE(?=[^\s])/gi, 'WHERE ');
      fixedSql = fixedSql.replace(/([^\s])ORDER/gi, '$1 ORDER');
      fixedSql = fixedSql.replace(/([^\s])GROUP/gi, '$1 GROUP');
      fixedSql = fixedSql.replace(/([^\s])JOIN/gi, '$1 JOIN');
      fixedSql = fixedSql.replace(/JOIN(?=[^\s])/gi, 'JOIN ');
      fixedSql = fixedSql.replace(/([^\s])ON/gi, '$1 ON');
      fixedSql = fixedSql.replace(/ON(?=[^\s])/gi, 'ON ');

      result.sql = fixedSql;

      return result;
    }
    throw new Error("No response from AI");
  } catch (error: any) {
    console.error("Builder Gen Error:", error);
    throw new Error(error.message || "Failed to build SQL.");
  }
};

export const generateSchemaFromTopic = async (topic: string, context: string): Promise<DatabaseSchema> => {
  throw new Error("Simulation mode deprecated. Please connect to a real DB.");
};

export const parseSchemaFromDDL = async (ddl: string): Promise<DatabaseSchema> => {
  const prompt = `Parse SQL DDL to JSON: ${ddl}`;
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
    throw new Error("Empty AI response");
  } catch (error) {
    throw new Error("Failed to parse DDL.");
  }
};