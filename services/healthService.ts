
import { GoogleGenAI } from "@google/genai";
import { SAMPLE_SCHEMA, BuilderState, DatabaseSchema, DbCredentials } from "../types";
import { executeOfflineQuery, initializeSimulation, SimulationData } from "./simulationService";
import { executeQueryReal } from "./dbService";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface HealthStatus {
  id: string;
  name: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  cause?: string;
  solution?: string;
}

export interface StressTestLog {
  iteration: number;
  type: string;
  status: 'ok' | 'fail';
  detail: string;
}

/**
 * Executa o check-up geral, priorizando a conexão ativa se disponível.
 */
export const runFullHealthCheck = async (
  credentials?: DbCredentials | null,
  schema?: DatabaseSchema | null
): Promise<HealthStatus[]> => {
  const results: HealthStatus[] = [
    { id: 'gemini', name: 'Gemini AI API', status: 'pending' },
    { id: 'backend', name: 'Servidor Backend Local', status: 'pending' },
    { id: 'db', name: 'Conexão com Banco de Dados', status: 'pending' },
    { id: 'storage', name: 'Persistência Local (Storage)', status: 'pending' },
    { id: 'logic', name: 'Validação de Lógica do Builder', status: 'pending' }
  ];

  // 1. Storage Check
  try {
    localStorage.setItem('health_ping', '1');
    localStorage.removeItem('health_ping');
    results[3].status = 'success';
    results[3].message = 'LocalStorage operando.';
  } catch (e) {
    results[3].status = 'error';
    results[3].message = 'Storage inacessível.';
  }

  // 2. Backend Check (Verifica se server.js está de pé)
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1500);
    await fetch('http://localhost:3000', { mode: 'no-cors', signal: controller.signal });
    clearTimeout(id);
    results[1].status = 'success';
    results[1].message = 'Servidor Node.js respondendo.';
  } catch (e) {
    results[1].status = 'error';
    results[1].message = 'Backend offline.';
  }

  // 3. Database Check (Context Aware)
  if (credentials && credentials.host !== 'simulated') {
    try {
      await executeQueryReal(credentials, 'SELECT 1');
      results[2].status = 'success';
      results[2].message = `Conectado a: ${credentials.database}`;
    } catch (e: any) {
      results[2].status = 'error';
      results[2].message = 'Falha na query de teste.';
      results[2].cause = e.message;
    }
  } else {
    results[2].status = 'success';
    results[2].message = credentials?.host === 'simulated' ? 'Modo Simulação Ativo' : 'Nenhuma conexão ativa';
  }

  // 4. AI Check
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Respond with "pong"',
    });
    if (response.text?.toLowerCase().includes('pong')) {
      results[0].status = 'success';
      results[0].message = 'API Gemini operacional.';
    } else throw new Error();
  } catch (e: any) {
    results[0].status = 'error';
    results[0].message = 'IA indisponível ou sem chave.';
  }

  // 5. Logic Check (Testa o motor de simulação no schema atual)
  try {
    const activeSchema = schema || SAMPLE_SCHEMA;
    const testTable = activeSchema.tables[0];
    const tableId = `${testTable.schema || 'public'}.${testTable.name}`;
    
    const mockState: BuilderState = {
      selectedTables: [tableId],
      selectedColumns: [`${tableId}.${testTable.columns[0].name}`],
      aggregations: {},
      joins: [],
      filters: [],
      groupBy: [],
      orderBy: [],
      limit: 1
    };
    
    // Testa se o motor consegue processar o schema sem crashar
    const tempSimData = initializeSimulation(activeSchema);
    executeOfflineQuery(activeSchema, tempSimData, mockState);
    
    results[4].status = 'success';
    results[4].message = `Lógica validada para schema: ${activeSchema.name}`;
  } catch (e) {
    results[4].status = 'error';
    results[4].message = 'Erro na validação de lógica.';
  }

  return results;
};

/**
 * Executa testes de estresse aleatórios baseados no schema que o usuário está usando.
 */
export const runRandomizedStressTest = async (
  schema: DatabaseSchema | null,
  simulationData: SimulationData,
  onProgress: (log: StressTestLog) => void
): Promise<boolean> => {
  // Fallback para o Sample se não houver schema carregado
  const activeSchema = schema || SAMPLE_SCHEMA;
  const activeSimData = schema ? simulationData : initializeSimulation(SAMPLE_SCHEMA);
  
  const tables = activeSchema.tables;
  let allPassed = true;

  for (let i = 1; i <= 20; i++) {
    try {
      const randomTable = tables[Math.floor(Math.random() * tables.length)];
      const randomCol = randomTable.columns[Math.floor(Math.random() * randomTable.columns.length)];
      const tableId = `${randomTable.schema || 'public'}.${randomTable.name}`;
      const colId = `${tableId}.${randomCol.name}`;

      const state: BuilderState = {
        selectedTables: [tableId],
        selectedColumns: [colId],
        aggregations: {},
        joins: [],
        filters: [],
        groupBy: [],
        orderBy: [],
        limit: Math.floor(Math.random() * 50) + 1,
        calculatedColumns: []
      };

      // Fuzzing de filtro
      if (Math.random() > 0.5) {
        state.filters.push({
          id: 'stress-fuzz',
          column: colId,
          operator: ['=', '>', 'LIKE'][Math.floor(Math.random() * 3)] as any,
          value: Math.random() > 0.5 ? '100' : 'test'
        });
      }

      const results = executeOfflineQuery(activeSchema, activeSimData, state);
      
      onProgress({
        iteration: i,
        type: 'Query Stress',
        status: 'ok',
        detail: `Processado [${randomTable.name}] -> ${results.length} linhas.`
      });

    } catch (e: any) {
      allPassed = false;
      onProgress({
        iteration: i,
        type: 'Query Stress',
        status: 'fail',
        detail: `Erro na iteração ${i}: ${e.message}`
      });
    }
    
    await new Promise(r => setTimeout(r, 60));
  }

  return allPassed;
};
