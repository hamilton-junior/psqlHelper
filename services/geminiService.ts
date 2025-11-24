
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
    4. **KEYWORD INTEGRITY**: Check for reserved keywords appearing inside identifiers. Example: "c ON ta_creditar" is a SYNTAX ERROR if the intended column was "conta_creditar". Keywords like ON, FROM, WHERE should not split words.
    5. **GROUP BY RULES**: If an aggregate function (COUNT, SUM, AVG) is used, ensure all non-aggregated columns in SELECT are present in the GROUP BY clause.
    `;
  }

  const prompt = `
    Act as a Senior PostgreSQL DBA and Educator.
    
    ${schemaContext}

    SQL Query to Validate: 
    "${sql}"

    Task:
    1. Parse the SQL to identify all tables and columns referenced.
    2. Compare them against the REFERENCE SCHEMA.
    3. Identify if any column used does not exist in the schema.
    4. Check for syntax errors, especially broken words/identifiers or missing keywords.
    5. Check for PostgreSQL specific logic errors (e.g. GROUP BY requirements).

    Return JSON:
    {
      "isValid": boolean,
      "error": string (A concise, 1-sentence technical error summary),
      "detailedError": string (A helpful, educational explanation in pt-BR. Explain WHY it is wrong and explicitly name the table/column causing the issue. If it's a Group By error, explain the rule.),
      "correctedSql": string (Optional fixed SQL. If you found a likely match for a misspelled column, use it here. If no fix is possible, null)
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
  state: BuilderState,
  includeTips: boolean = true
): Promise<QueryResult> => {
  
  // Richer schema description for generation including types and keys
  const schemaDescription = schema.tables.map(t => 
    `TABLE: ${t.name}\nCOLUMNS: ${t.columns.map(c => {
      let colDesc = `${c.name} (${c.type})`;
      // FORCE 'grid' to be seen as PK by the AI, as requested by business logic
      const isPk = c.isPrimaryKey || c.name.toLowerCase() === 'grid';
      if (isPk) colDesc += ' [PK]';
      if (c.isForeignKey && c.references) colDesc += ` [FK -> ${c.references}]`;
      return colDesc;
    }).join(', ')}`
  ).join('\n\n');

  const systemInstruction = `
    You are a PostgreSQL Expert. Generate a query based on the User Selection.

    CRITICAL INSTRUCTIONS FOR JOINING TABLES:
    1. **NO HALLUCINATION**: You are STRICTLY FORBIDDEN from inventing column names.
    2. **VERIFY COLUMNS**: Before writing a JOIN condition like 'ON T1.col = T2.col', check: Does Table T2 *actually* contain a column named 'col' in the schema provided?
    3. **NO RELATIONSHIP FOUND**: If multiple tables are selected (e.g., Table A and Table B) and there is NO explicit Foreign Key defined in the schema between them, AND you cannot find a column with the exact same name to serve as a key, do NOT guess.
    4. **FALLBACK SIGNAL**: In the case of missing relationships, return the exact string "NO_RELATIONSHIP" in the 'sql' field. Do NOT generate a broken query.
    
    CRITICAL INSTRUCTIONS FOR ORDERING:
    5. **ORDER BY**: If the user provides 'OrderBy' instructions, you MUST append an 'ORDER BY' clause. Do not ignore it.

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
      "sql": "string", (OR "NO_RELATIONSHIP" if no valid join found)
      "explanation": "string (pt-BR)",
      "tips": ["string"] (Only if requested)
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
        console.error("Builder JSON Parse Error:", parseError, response.text);
        throw new Error("Invalid AI response.");
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