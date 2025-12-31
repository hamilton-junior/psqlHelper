
import { GoogleGenAI } from "@google/genai";
import { SAMPLE_SCHEMA, BuilderState, AggregateFunction } from "../types";
import { executeOfflineQuery, initializeSimulation } from "./simulationService";

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

export const runFullHealthCheck = async (): Promise<HealthStatus[]> => {
  const results: HealthStatus[] = [
    { id: 'gemini', name: 'Gemini AI API', status: 'pending' },
    { id: 'backend', name: 'Servidor Backend Local', status: 'pending' },
    { id: 'storage', name: 'Persistência Local (Storage)', status: 'pending' },
    { id: 'simulation', name: 'Motor de Simulação Offline', status: 'pending' }
  ];

  // 1. Storage Check
  try {
    const testKey = 'psql_buddy_health_test';
    localStorage.setItem(testKey, 'ok');
    if (localStorage.getItem(testKey) !== 'ok') throw new Error("Mismatch");
    results[2].status = 'success';
    results[2].message = 'Leitura e escrita em localStorage OK.';
  } catch (e) {
    results[2].status = 'error';
    results[2].message = 'Falha no Storage.';
  }

  // 2. Backend Check
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1500);
    await fetch('http://localhost:3000', { mode: 'no-cors', signal: controller.signal });
    clearTimeout(id);
    results[1].status = 'success';
    results[1].message = 'Servidor local respondendo.';
  } catch (e) {
    results[1].status = 'error';
    results[1].message = 'Backend offline.';
  }

  // 3. AI Check
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Respond with "ping"',
    });
    if (response.text?.toLowerCase().includes('ping')) {
      results[0].status = 'success';
      results[0].message = 'API Gemini operacional.';
    } else {
      throw new Error();
    }
  } catch (e: any) {
    results[0].status = 'error';
    results[0].message = 'Falha na conexão com a IA.';
  }

  // 4. Simulation Check
  try {
    const simData = initializeSimulation(SAMPLE_SCHEMA);
    const mockState: BuilderState = {
      selectedTables: ['public.users'],
      selectedColumns: ['public.users.id'],
      aggregations: {},
      joins: [],
      filters: [],
      groupBy: [],
      orderBy: [],
      limit: 5
    };
    executeOfflineQuery(SAMPLE_SCHEMA, simData, mockState);
    results[3].status = 'success';
    results[3].message = 'Motor de simulação estável.';
  } catch (e) {
    results[3].status = 'error';
    results[3].message = 'Erro no motor offline.';
  }

  return results;
};

/**
 * Executa testes de estresse aleatórios (Fuzzing)
 */
export const runRandomizedStressTest = async (
  onProgress: (log: StressTestLog) => void
): Promise<boolean> => {
  const simData = initializeSimulation(SAMPLE_SCHEMA);
  const tables = SAMPLE_SCHEMA.tables;
  let allPassed = true;

  for (let i = 1; i <= 20; i++) {
    try {
      // 1. Escolhe tabelas e colunas aleatórias
      const randomTable = tables[Math.floor(Math.random() * tables.length)];
      const randomCol = randomTable.columns[Math.floor(Math.random() * randomTable.columns.length)];
      const tableId = `public.${randomTable.name}`;
      const colId = `${tableId}.${randomCol.name}`;

      // 2. Gera um estado aleatório
      const state: BuilderState = {
        selectedTables: [tableId],
        selectedColumns: [colId],
        aggregations: {},
        joins: [],
        filters: [],
        groupBy: [],
        orderBy: [],
        limit: Math.floor(Math.random() * 100) + 1,
        calculatedColumns: []
      };

      // 3. Adiciona um filtro aleatório (Fuzzing)
      if (Math.random() > 0.5) {
        state.filters.push({
          id: 'test-fuzz',
          column: colId,
          operator: ['=', '>', '<', 'LIKE'][Math.floor(Math.random() * 4)] as any,
          value: Math.random() > 0.5 ? String(Math.random() * 1000) : 'random_string'
        });
      }

      // 4. Adiciona uma fórmula matemática aleatória
      if (Math.random() > 0.7) {
        state.calculatedColumns?.push({
          id: 'calc-fuzz',
          alias: 'fuzz_result',
          expression: `(${Math.floor(Math.random() * 100)} * 2) / 1.5`
        });
      }

      // Executa
      const results = executeOfflineQuery(SAMPLE_SCHEMA, simData, state);
      
      onProgress({
        iteration: i,
        type: 'Query Logic',
        status: 'ok',
        detail: `Testada tabela ${randomTable.name} com ${results.length} resultados.`
      });

    } catch (e: any) {
      allPassed = false;
      onProgress({
        iteration: i,
        type: 'Query Logic',
        status: 'fail',
        detail: `Crash na iteração ${i}: ${e.message}`
      });
    }
    
    // Pequeno delay para animação fluida
    await new Promise(r => setTimeout(r, 50));
  }

  return allPassed;
};
