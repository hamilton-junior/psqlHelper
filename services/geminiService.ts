import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DatabaseSchema, QueryResult, ValidationResult, BuilderState } from "../types";

// Vite will replace 'process.env.API_KEY' with the actual string from your .env file at build time.
// @ts-ignore: process is defined via Vite config
const apiKey = process.env.API_KEY;

const ai = new GoogleGenAI({ apiKey: apiKey });

export const validateSqlQuery = async (sql: string): Promise<ValidationResult> => {
  const prompt = `
    Act as a strict PostgreSQL Syntax Validator. 
    Analyze the following SQL query for syntax errors, deprecated keywords, or logical inconsistencies.
    
    SQL Query: "${sql}"

    Return a JSON object indicating validity. If invalid, provide a short error message and a corrected version of the SQL if possible.
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
      return JSON.parse(response.text) as ValidationResult;
    }
    return { isValid: true }; // Default to valid if parsing fails to prevent blocking
  } catch (error) {
    console.error("Validation Error:", error);
    return { isValid: true };
  }
};

export const generateSqlFromBuilderState = async (
  schema: DatabaseSchema,
  state: BuilderState
): Promise<QueryResult> => {
  const schemaDescription = schema.tables.map(t => 
    `Table ${t.name} (${t.description || ''}):\n  Columns: ${t.columns.map(c => `${c.name} (${c.type})`).join(', ')}`
  ).join('\n\n');

  const systemInstruction = `
    You are an expert PostgreSQL Query Builder.
    Construct a valid SQL query based on the user's visual selection of tables, columns, and explicit logic.
    
    Rules:
    1. Select ONLY the columns specified in "Target Columns". If "Target Columns" is empty but tables are selected, select all columns from those tables.
    2. JOINS: Use the "Explicit Joins" if provided. If no explicit joins are provided but multiple tables are selected, automatically determine the correct JOIN syntax (INNER/LEFT) based on foreign keys.
    3. FILTERS: Apply all provided "Filters" in the WHERE clause.
    4. GROUP BY: Apply the GROUP BY clause if "Group By Columns" are provided.
    5. ORDER BY: Apply the ORDER BY clause if "Order By Rules" are provided.
    6. LIMIT: Apply the LIMIT clause.
    7. CRITICAL: Ensure strict whitespace rules. ALWAYS put a space after keywords (SELECT, FROM, WHERE, LIMIT, JOIN, ON, GROUP BY, ORDER BY).
    8. NEVER concatenate keywords with identifiers (e.g. "SELECTid" is forbidden, must be "SELECT id").
    9. Format the SQL nicely (newlines and indentation) within the JSON string to be readable.
  `;

  const prompt = `
    Database Schema:
    ${schemaDescription}

    Visual Builder State:
    - Selected Tables: ${state.selectedTables.join(', ')}
    - Target Columns: ${state.selectedColumns.join(', ')}
    - Explicit Joins: ${JSON.stringify(state.joins)}
    - Filters (WHERE): ${JSON.stringify(state.filters)}
    - Group By Columns: ${state.groupBy.join(', ')}
    - Order By Rules: ${JSON.stringify(state.orderBy)}
    - Limit: ${state.limit}

    Generate the SQL query and an explanation of the logic.
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
            sql: { type: Type.STRING, description: "The valid PostgreSQL query" },
            explanation: { type: Type.STRING, description: "Explanation of the query logic" },
            tips: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Tips for optimization" 
            }
          },
          required: ["sql", "explanation"]
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text) as QueryResult;
      
      // Safety net: regex post-processing to ensure whitespace around key keywords
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

      result.sql = fixedSql;

      return result;
    }
    throw new Error("No response from AI");
  } catch (error) {
    console.error("Builder Gen Error:", error);
    throw new Error("Failed to build SQL.");
  }
};

export const generateSchemaFromTopic = async (topic: string, context: string): Promise<DatabaseSchema> => {
  const prompt = `
    Generate a comprehensive PostgreSQL database schema for a "${topic}".
    Context/Description: ${context}
    
    Include 3-5 relevant tables with realistic columns, primary keys, and foreign key relationships.
    Ensure data types are valid PostgreSQL types (e.g., SERIAL, VARCHAR, INTEGER, TIMESTAMP, BOOLEAN).
  `;

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
                  references: { type: Type.STRING, description: "Format: table.column" }
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
      config: {
        responseMimeType: "application/json",
        responseSchema: schemaStructure
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text) as DatabaseSchema;
      result.connectionSource = 'simulated';
      return result;
    }
    throw new Error("Empty response from AI");
  } catch (error) {
    console.error("Schema Generation Error:", error);
    throw new Error("Failed to generate schema.");
  }
};

export const parseSchemaFromDDL = async (ddl: string): Promise<DatabaseSchema> => {
  const prompt = `
    Parse the following SQL DDL (CREATE TABLE statements) into a structured JSON schema.
    
    DDL:
    ${ddl}
  `;

  const schemaStructure: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Inferred database name or 'Imported Schema'" },
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
                  references: { type: Type.STRING, description: "Format: table.column" }
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
      config: {
        responseMimeType: "application/json",
        responseSchema: schemaStructure
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text) as DatabaseSchema;
      parsed.connectionSource = 'ddl';
      return parsed;
    }
    throw new Error("Empty response from AI");
  } catch (error) {
    console.error("DDL Parsing Error:", error);
    throw new Error("Failed to parse DDL.");
  }
};