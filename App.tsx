import React, { useState, useEffect, useRef } from 'react';
import { DatabaseSchema, AppStep, BuilderState, QueryResult, DbCredentials, AppSettings, DEFAULT_SETTINGS } from './types';
import Sidebar from './components/Sidebar';
import ConnectionStep from './components/steps/ConnectionStep';
import BuilderStep from './components/steps/BuilderStep';
import PreviewStep from './components/steps/PreviewStep';
import ResultsStep from './components/steps/ResultsStep';
import SettingsModal from './components/SettingsModal';
import AiPreferenceModal from './components/AiPreferenceModal';
import SchemaDiagramModal from './components/SchemaDiagramModal';
import { generateSqlFromBuilderState, validateSqlQuery, generateMockData } from './services/geminiService';
import { generateLocalSql } from './services/localSqlService';
import { initializeSimulation, executeOfflineQuery, SimulationData } from './services/simulationService';
import { executeQueryReal } from './services/dbService';
import { AlertTriangle, X, ZapOff, History as HistoryIcon, Clock, CheckCircle2, AlertCircle as AlertCircleIcon } from 'lucide-react';
import { getHistory, clearHistory } from './services/historyService';

// Helper for safe storage loading
function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function App() {
  // Settings State
  const [settings, setSettings] = useState<AppSettings>(() => loadFromStorage('psql-buddy-settings', DEFAULT_SETTINGS));
  const [showSettings, setShowSettings] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if it's first run to show onboarding
  useEffect(() => {
    const saved = localStorage.getItem('psql-buddy-settings');
    if (!saved) {
       setShowOnboarding(true);
    }
  }, []);

  // Global State for Quota Limits
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [hasShownQuotaWarning, setHasShownQuotaWarning] = useState(false);

  // Apply Theme - STRICT MODE for Tailwind
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    
    root.classList.remove('dark');
    body.classList.remove('dark');
    
    if (settings.theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
      body.style.backgroundColor = '#0f172a'; // slate-900
    } else {
      body.style.backgroundColor = '#f8fafc'; // slate-50
    }
    
    localStorage.setItem('psql-buddy-settings', JSON.stringify(settings));
  }, [settings, settings.theme]); 

  const handleAiPreferenceSelect = (enableAi: boolean) => {
    const newSettings = { ...settings, enableAiGeneration: enableAi };
    setSettings(newSettings);
    localStorage.setItem('psql-buddy-settings', JSON.stringify(newSettings));
    setShowOnboarding(false);
  };

  // --- Session State (Persisted) ---
  const [currentStep, setCurrentStep] = useState<AppStep>(() => loadFromStorage('psql-buddy-step', 'connection'));
  const [schema, setSchema] = useState<DatabaseSchema | null>(() => loadFromStorage('psql-buddy-schema', null));
  const [credentials, setCredentials] = useState<DbCredentials | null>(() => loadFromStorage('psql-buddy-creds', null));
  const [simulationData, setSimulationData] = useState<SimulationData | null>(() => loadFromStorage('psql-buddy-simdata', null));

  const [builderState, setBuilderState] = useState<BuilderState>(() => loadFromStorage('psql-buddy-builder', {
    selectedTables: [],
    selectedColumns: [],
    aggregations: {},
    joins: [],
    filters: [],
    groupBy: [],
    orderBy: [],
    limit: settings.defaultLimit
  }));
  
  // Persisted Results State (Added to survive reload)
  const [queryResult, setQueryResult] = useState<QueryResult | null>(() => loadFromStorage('psql-buddy-query-result', null));
  const [dbResults, setDbResults] = useState<any[]>(() => loadFromStorage('psql-buddy-db-results', []));
  
  // Transient State (Not persisted heavily)
  const [isProcessing, setIsProcessing] = useState(false); 
  const [progressMessage, setProgressMessage] = useState<string>(''); 
  const [isValidating, setIsValidating] = useState(false); 
  const [error, setError] = useState<{message: string, action?: {label: string, handler: () => void}} | null>(null);
  const [warningToast, setWarningToast] = useState<string | null>(null);

  const generationRequestId = useRef(0);

  // --- Persistence Effect ---
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
       localStorage.setItem('psql-buddy-step', JSON.stringify(currentStep));
       if (schema) localStorage.setItem('psql-buddy-schema', JSON.stringify(schema));
       else localStorage.removeItem('psql-buddy-schema');

       if (credentials) localStorage.setItem('psql-buddy-creds', JSON.stringify(credentials));
       else localStorage.removeItem('psql-buddy-creds');

       if (simulationData) localStorage.setItem('psql-buddy-simdata', JSON.stringify(simulationData));
       else localStorage.removeItem('psql-buddy-simdata');

       localStorage.setItem('psql-buddy-builder', JSON.stringify(builderState));
       
       if (queryResult) localStorage.setItem('psql-buddy-query-result', JSON.stringify(queryResult));
       else localStorage.removeItem('psql-buddy-query-result');

       if (dbResults && dbResults.length > 0) localStorage.setItem('psql-buddy-db-results', JSON.stringify(dbResults));
       else localStorage.removeItem('psql-buddy-db-results');

    }, 500); // Debounce saves

    return () => clearTimeout(saveTimeout);
  }, [currentStep, schema, credentials, simulationData, builderState, queryResult, dbResults]);


  // --- Handlers ---

  const handleSchemaLoaded = (newSchema: DatabaseSchema, creds: DbCredentials) => {
    setError(null);
    setSchema(newSchema);
    setCredentials(creds);
    
    if (creds.host === 'simulated') {
       const simData = initializeSimulation(newSchema);
       setSimulationData(simData);
    } else {
       setSimulationData(null);
    }

    // Reset downstream state (New Connection usually implies reset)
    const cleanBuilderState = { 
      selectedTables: [], 
      selectedColumns: [], 
      aggregations: {},
      joins: [],
      filters: [],
      groupBy: [],
      orderBy: [],
      limit: settings.defaultLimit
    };
    
    setBuilderState(cleanBuilderState);
    setQueryResult(null);
    setDbResults([]);
    setCurrentStep('builder');
  };

  const handleUpdateSchemaDescription = (tableName: string, newDesc: string) => {
    if (!schema) return;
    const newTables = schema.tables.map(t => 
      t.name === tableName ? { ...t, description: newDesc } : t
    );
    setSchema({ ...schema, tables: newTables });
  };

  const handleBuilderChange = (newState: BuilderState) => {
    setBuilderState(newState);
  };

  const handleSkipAiGeneration = async () => {
    generationRequestId.current += 1;
    setProgressMessage("Cancelando IA e alternando para modo local...");
    await new Promise(r => setTimeout(r, 400));
    
    if (!schema) return;
    try {
      const result = generateLocalSql(schema, builderState);
      setQueryResult(result);
      setCurrentStep('preview');
    } catch (e: any) {
      setError({ message: "Falha na geração local: " + e.message });
    } finally {
      setIsProcessing(false);
      setProgressMessage("");
    }
  };

  const handleGeneratePreview = async () => {
    if (!schema) return;
    setError(null);
    setIsProcessing(true);
    setWarningToast(null);
    
    const currentRequestId = generationRequestId.current + 1;
    generationRequestId.current = currentRequestId;

    setProgressMessage("Iniciando...");

    const usingExtras = settings.enableAiGeneration && (settings.enableAiValidation || settings.enableAiTips);
    if (usingExtras && !hasShownQuotaWarning && !quotaExhausted) {
       setWarningToast("Dicas e Validação consomem mais cota da API. Desative nas configurações se desejar economizar.");
       setHasShownQuotaWarning(true);
    }
    
    let result: QueryResult | null = null;
    let usedLocalFallback = false;

    try {
      if (settings.enableAiGeneration) {
         try {
           const includeTips = settings.enableAiTips && !quotaExhausted;

           result = await generateSqlFromBuilderState(
             schema, 
             builderState, 
             includeTips, 
             (msg) => {
               if (generationRequestId.current === currentRequestId) {
                 setProgressMessage(msg);
               }
             }
           );
           
           if (generationRequestId.current !== currentRequestId) return; 

           if (result.sql === 'NO_RELATIONSHIP') {
              throw new Error("NO_RELATIONSHIP");
           }
         } catch (aiError: any) {
           console.warn("AI Generation failed, attempting fallback...", aiError);
           if (generationRequestId.current !== currentRequestId) return;
           if (aiError.message === "QUOTA_ERROR") {
              setQuotaExhausted(true);
              if (!hasShownQuotaWarning) {
                 setWarningToast("Cota da API IA excedida. Alternando para modo offline (sem validação/dicas).");
                 setHasShownQuotaWarning(true);
              }
           } else if (aiError.message === "NO_RELATIONSHIP") {
              throw new Error("A IA não encontrou relacionamento entre estas tabelas. Defina Joins manualmente.");
           }
           usedLocalFallback = true;
         }
      } else {
         usedLocalFallback = true;
      }

      if (generationRequestId.current !== currentRequestId) return;

      if (usedLocalFallback) {
         setProgressMessage("Gerando SQL com motor local...");
         await new Promise(r => setTimeout(r, 500));
         if (generationRequestId.current !== currentRequestId) return;
         result = generateLocalSql(schema, builderState);
      }
      
      if (!result) throw new Error("Falha ao gerar SQL.");

      setQueryResult(result);
      setCurrentStep('preview');
      setIsProcessing(false);
      setProgressMessage("");

      if (settings.enableAiGeneration && settings.enableAiValidation && !quotaExhausted && !usedLocalFallback) {
        setIsValidating(true);
        validateSqlQuery(result.sql, schema)
          .then(validation => {
            setQueryResult(prev => prev ? { ...prev, validation } : null);
          })
          .catch(err => {
             console.error("Validação em segundo plano falhou:", err);
             if (err.message === "QUOTA_ERROR") setQuotaExhausted(true);
          })
          .finally(() => setIsValidating(false));
      }

    } catch (e: any) {
      if (generationRequestId.current !== currentRequestId) return;
      console.error(e);
      setError({ message: e.message || "Falha ao gerar SQL a partir da seleção." });
      setIsProcessing(false);
      setProgressMessage("");
    }
  };

  const handleExecuteQuery = async () => {
    if (!schema || !queryResult || !credentials) return;
    setError(null);
    setIsProcessing(true);
    setProgressMessage(credentials.host === 'simulated' ? "Consultando dados simulados..." : "Executando no banco...");

    try {
      let data: any[] = [];
      
      if (credentials.host === 'simulated') {
         if (simulationData) {
            data = executeOfflineQuery(schema, simulationData, builderState);
         } else if (settings.enableAiGeneration && !quotaExhausted) {
            try {
               data = await generateMockData(schema, queryResult.sql);
            } catch (mockErr: any) {
               if (mockErr.message === "QUOTA_ERROR") {
                  setQuotaExhausted(true);
                  setWarningToast("Cota excedida. Usando dados offline.");
                  data = [];
               } else {
                  throw mockErr;
               }
            }
         } else {
            data = [];
            setWarningToast("Sem dados de simulação disponíveis.");
         }
      } else {
         data = await executeQueryReal(credentials, queryResult.sql);
      }

      setDbResults(data);
      setCurrentStep('results');
    } catch (e: any) {
      console.error(e);
      if (e.message === "QUOTA_ERROR") {
         setQuotaExhausted(true);
         setError({ message: "Cota excedida durante execução." });
      } else {
         setError({ message: "Falha na execução: " + e.message });
      }
    } finally {
      setIsProcessing(false);
      setProgressMessage("");
    }
  };

  const handleReset = () => {
    setError(null);
    setCurrentStep('connection');
    setSchema(null);
    setCredentials(null);
    setSimulationData(null);
    setQueryResult(null);
    setDbResults([]);
    // Explicitly clear session storage
    localStorage.removeItem('psql-buddy-schema');
    localStorage.removeItem('psql-buddy-creds');
    localStorage.removeItem('psql-buddy-simdata');
    localStorage.removeItem('psql-buddy-builder');
    localStorage.removeItem('psql-buddy-step');
    localStorage.removeItem('psql-buddy-query-result');
    localStorage.removeItem('psql-buddy-db-results');
  };

  const handleNavigate = (step: AppStep) => {
    setError(null);
    setCurrentStep(step);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {showOnboarding && <AiPreferenceModal onSelect={handleAiPreferenceSelect} />}

      <Sidebar 
        currentStep={currentStep} 
        onNavigate={handleNavigate} 
        schema={schema}
        onOpenSettings={() => setShowSettings(true)}
        onOpenDiagram={() => setShowDiagram(true)}
        onOpenHistory={() => setShowHistory(true)}
        onRegenerateClick={handleReset}
        onDescriptionChange={handleUpdateSchemaDescription}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden rounded-tl-3xl shadow-2xl my-2 mr-2 relative">
        <div className="h-1.5 bg-slate-200 dark:bg-slate-800 w-full shrink-0">
          <div 
            className="h-full bg-indigo-600 transition-all duration-500 ease-out"
            style={{ 
              width: currentStep === 'connection' ? '25%' : 
                     currentStep === 'builder' ? '50%' : 
                     currentStep === 'preview' ? '75%' : '100%' 
            }}
          />
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 p-4 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                 <span className="text-sm font-medium text-red-800 dark:text-red-200">{error.message}</span>
                 {error.action && (
                    <button 
                       onClick={error.action.handler}
                       className="text-xs bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-800 dark:text-red-100 px-2 py-1 rounded font-bold transition-colors"
                    >
                       {error.action.label}
                    </button>
                 )}
              </div>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {warningToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4 animate-in fade-in slide-in-from-top-4">
             <div className="bg-amber-50 dark:bg-amber-900/90 backdrop-blur border border-amber-200 dark:border-amber-700 p-3 rounded-xl shadow-lg flex items-start gap-3">
               <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
               <div className="flex-1 text-sm text-amber-800 dark:text-amber-100">
                  {warningToast}
               </div>
               <button onClick={() => setWarningToast(null)} className="text-amber-400 hover:text-amber-600 dark:text-amber-300">
                  <X className="w-4 h-4" />
               </button>
             </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {currentStep === 'connection' && (
            <ConnectionStep 
              onSchemaLoaded={handleSchemaLoaded}
              settings={settings}
            />
          )}

          {currentStep === 'builder' && schema && (
            <BuilderStep 
              schema={schema}
              state={builderState}
              onStateChange={handleBuilderChange}
              onGenerate={handleGeneratePreview}
              onSkipAi={handleSkipAiGeneration}
              isGenerating={isProcessing}
              progressMessage={progressMessage}
              settings={settings}
              onDescriptionChange={handleUpdateSchemaDescription}
            />
          )}

          {currentStep === 'preview' && queryResult && (
            <PreviewStep 
              queryResult={queryResult}
              onExecute={handleExecuteQuery}
              onBack={() => handleNavigate('builder')}
              isExecuting={isProcessing}
              isValidating={isValidating}
              validationDisabled={!settings.enableAiGeneration || !settings.enableAiValidation || quotaExhausted}
            />
          )}

          {currentStep === 'results' && (
            <ResultsStep 
              data={dbResults}
              sql={queryResult?.sql || ''}
              onBackToBuilder={() => handleNavigate('builder')}
              onNewConnection={handleReset}
              settings={settings}
            />
          )}
        </div>
      </main>

      {showSettings && (
        <SettingsModal 
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(newSettings) => setSettings(newSettings)}
          quotaExhausted={quotaExhausted}
        />
      )}

      {showDiagram && schema && (
         <SchemaDiagramModal schema={schema} onClose={() => setShowDiagram(false)} />
      )}

      {showHistory && (
         <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
               <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                     <HistoryIcon className="w-5 h-5 text-indigo-500" />
                     <h3 className="font-bold text-slate-700 dark:text-slate-200">Histórico de Execuções</h3>
                  </div>
                  <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900">
                  {getHistory().length === 0 ? (
                     <p className="text-center text-slate-400 py-10">Nenhuma execução registrada.</p>
                  ) : (
                     getHistory().map(item => (
                        <div key={item.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                           <div className="flex justify-between items-start mb-2">
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${item.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                 {item.status}
                              </span>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                 <Clock className="w-3 h-3" />
                                 {new Date(item.timestamp).toLocaleString()}
                              </div>
                           </div>
                           <code className="block text-xs font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 p-2 rounded mb-2 overflow-x-auto">
                              {item.sql}
                           </code>
                           <div className="flex justify-between items-center text-xs text-slate-500">
                              <span>{item.rowCount} linhas retornadas</span>
                              <button onClick={() => { navigator.clipboard.writeText(item.sql); setShowHistory(false); }} className="text-indigo-500 hover:underline">Copiar SQL</button>
                           </div>
                        </div>
                     ))
                  )}
               </div>
               <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right">
                  <button onClick={() => { clearHistory(); setShowHistory(false); }} className="text-xs text-red-500 hover:text-red-700">Limpar Histórico</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}

export default App;