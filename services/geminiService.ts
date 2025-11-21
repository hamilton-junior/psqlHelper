
import { GoogleGenAI, Type } from "@google/genai";
import { DatabaseSchema, QueryResult, ValidationResult, BuilderState } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SCHEMA_RESPONSE_SCHEMA = {
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
    `Table ${t.name} (${t.description}):\n  Columns: ${t.columns.map(c => `${c.name} (${c.type})`).join(', ')}`
  ).join('\n\n');

  const systemInstruction = `
    You are an expert PostgreSQL Query Builder.
    Construct a valid SQL query based on the user's visual selection of tables and columns.
    
    Rules:
    1. Select ONLY the columns specified in "Target Columns".
    2. Automatically determine the correct JOIN syntax (INNER/LEFT) based on the foreign keys in the schema to connect the "Selected Tables".
    3. Apply the LIMIT clause as requested.
    4. CRITICAL: Ensure strict whitespace rules. ALWAYS put a space after keywords (SELECT, FROM, WHERE, LIMIT, JOIN, ON).
    5. NEVER concatenate keywords with identifiers (e.g. "SELECTid" is forbidden, must be "SELECT id").
    6. Format the SQL nicely (newlines and indentation) within the JSON string to be readable.
  `;

  const prompt = `
    Database Schema:
    ${schemaDescription}

    Visual Builder State:
    - Selected Tables: ${state.selectedTables.join(', ')}
    - Target Columns: ${state.selectedColumns.join(', ')}
    - Limit: ${state.limit}

    Generate the SQL query and an explanation of the automatically generated JOINs.
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
      // This fixes issues where the AI might output "SELECTid" or "tableFROM"
      let fixedSql = result.sql;
      
      // Ensure space after SELECT if missing (and it's at start of string)
      fixedSql = fixedSql.replace(/^SELECT(?=[^\s])/i, 'SELECT ');
      
      // Ensure space before FROM if missing (e.g. "columnFROM")
      fixedSql = fixedSql.replace(/([^\s])FROM/gi, '$1 FROM');
      // Ensure space after FROM if missing (e.g. "FROMtable")
      fixedSql = fixedSql.replace(/FROM(?=[^\s])/gi, 'FROM ');
      
      // Ensure space before LIMIT
      fixedSql = fixedSql.replace(/([^\s])LIMIT/gi, '$1 LIMIT');
      // Ensure space after LIMIT
      fixedSql = fixedSql.replace(/LIMIT(?=[^\s])/gi, 'LIMIT ');

      result.sql = fixedSql;

      return result;
    }
    throw new Error("No response from AI");
  } catch (error) {
    console.error("Builder Gen Error:", error);
    throw new Error("Failed to build SQL.");
  }
};

export const generateMockData = async (
  schema: DatabaseSchema,
  sql: string
): Promise<any[]> => {
  const prompt = `
    Given the following SQL query and the implied schema context, generate 5 rows of realistic mock data that would result from running this query.
    Return ONLY the raw JSON array of objects.
    
    SQL: ${sql}
    
    Context (Tables): ${schema.tables.map(t => t.name).join(', ')}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
        // Note: responseSchema removed to allow dynamic object keys in the array
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return [];
  } catch (error) {
    console.error("GenAI Mock Data Error:", error);
    return [];
  }
};

export const parseSchemaFromDDL = async (ddlString: string): Promise<DatabaseSchema> => {
  const prompt = `
    Parse the following PostgreSQL DDL (CREATE TABLE statements) and extract the schema structure into a JSON format.
    Extract table names, column names, types, and foreign key relationships.
    Guess a short description for each table based on its name and columns.
    
    DDL:
    ${ddlString}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA_RESPONSE_SCHEMA
      }
    });

    if (response.text) {
      const schema = JSON.parse(response.text) as DatabaseSchema;
      schema.connectionSource = 'ddl';
      return schema;
    }
    throw new Error("Failed to parse DDL");
  } catch (error) {
    console.error("DDL Parse Error:", error);
    throw new Error("Could not parse the provided SQL schema.");
  }
};

export const generateSchemaFromTopic = async (topic: string, dbContext?: string): Promise<DatabaseSchema> => {
   let prompt = `Create a realistic PostgreSQL database schema for a "${topic}" application. Include 3-5 related tables with appropriate data types.`;
   
   if (dbContext) {
     prompt = `Create a realistic PostgreSQL database schema for a database named "${topic}". 
     Context provided by user: "${dbContext}".
     Include appropriate tables that would exist in such a database.`;
   }

   try {
     const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash',
       contents: prompt,
       config: {
         responseMimeType: "application/json",
         responseSchema: SCHEMA_RESPONSE_SCHEMA
       }
     });

     if (response.text) {
       const schema = JSON.parse(response.text) as DatabaseSchema;
       schema.connectionSource = 'ai';
       return schema;
     }
     throw new Error("Failed to generate schema");
   } catch (error) {
     throw error;
   }
};
