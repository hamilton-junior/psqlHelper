import React, { useState, useEffect, useRef } from 'react';
import { DatabaseSchema, AppStep, BuilderState, QueryResult, DbCredentials, AppSettings, DEFAULT_SETTINGS } from './types';
import Sidebar from './components/Sidebar';
import ConnectionStep from './components/steps/ConnectionStep';
import BuilderStep from './components/steps/BuilderStep';
import PreviewStep from './components/steps/PreviewStep';
import ResultsStep from './components/steps/ResultsStep';
import SettingsModal from './components/SettingsModal';
import AiPreferenceModal from './components/AiPreferenceModal';
import { generateSqlFromBuilderState, validateSqlQuery, generateMockData } from './services/geminiService';
import { generateLocalSql } from './services/localSqlService';
import { initializeSimulation, executeOfflineQuery, SimulationData } from './services/simulationService';
import { executeQueryReal } from './services/dbService';
import { AlertTriangle, X, ZapOff } from 'lucide-react';

function App() {
  // Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('psql-buddy-settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });
  const [showSettings, setShowSettings] = useState(false);
  
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
    // Apply class to HTML element for full page theming
    const root = document.documentElement;
    const body = document.body;
    
    root.classList.remove('dark');
    body.classList.remove('dark');
    
    if (settings.theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
      // Ensure body background is consistent with theme to prevent white flashes
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

  // Navigation State
  const [currentStep, setCurrentStep] = useState<AppStep>('connection');
  
  // App Data State
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [credentials, setCredentials] = useState<DbCredentials | null>(null);
  const [simulationData, setSimulationData] = useState<SimulationData | null>(null);

  const [builderState, setBuilderState] = useState<BuilderState>({
    selectedTables: [],
    selectedColumns: [],
    aggregations: {},
    joins: [],
    filters: [],
    groupBy: [],
    orderBy: [],
    limit: settings.defaultLimit
  });
  
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [dbResults, setDbResults] = useState<any[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false); // For SQL Gen & Execution
  const [progressMessage, setProgressMessage] = useState<string>(''); // Detailed progress
  const [isValidating, setIsValidating] = useState(false); // For Background Validation
  const [error, setError] = useState<{message: string, action?: {label: string, handler: () => void}} | null>(null);
  const [warningToast, setWarningToast] = useState<string | null>(null);

  // Reference to track the active request ID to handle race conditions (skip/cancel)
  const generationRequestId = useRef(0);

  // --- Handlers ---

  const handleSchemaLoaded = (newSchema: DatabaseSchema, creds: DbCredentials) => {
    setError(null);
    setSchema(newSchema);
    setCredentials(creds);
    
    // If we are connecting to a simulated DB, initialize its data immediately
    if (creds.host === 'simulated') {
       const simData = initializeSimulation(newSchema);
       setSimulationData(simData);
    } else {
       setSimulationData(null);
    }

    // Reset downstream state
    setBuilderState({ 
      selectedTables: [], 
      selectedColumns: [], 
      aggregations: {},
      joins: [],
      filters: [],
      groupBy: [],
      orderBy: [],
      limit: settings.defaultLimit
    });
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
    // Increment ID to invalidate any pending AI promise result
    generationRequestId.current += 1;
    setProgressMessage("Cancelando IA e alternando para modo local...");
    
    // Artificial delay to let user see the status change
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

  const retryWithoutExtras = () => {
     setError(null);
     setSettings(prev => ({...prev, enableAiTips: false, enableAiValidation: false}));
     handleGeneratePreview();
  };

  const handleGeneratePreview = async () => {
    if (!schema) return;
    setError(null);
    setIsProcessing(true);
    setWarningToast(null);
    
    // Assign a new ID for this specific generation request
    const currentRequestId = generationRequestId.current + 1;
    generationRequestId.current = currentRequestId;

    setProgressMessage("Iniciando...");

    // Warning Logic for High Quota Usage
    const usingExtras = settings.enableAiGeneration && (settings.enableAiValidation || settings.enableAiTips);
    if (usingExtras && !hasShownQuotaWarning && !quotaExhausted) {
       setWarningToast("Dicas e Validação consomem mais cota da API. Desative nas configurações se desejar economizar.");
       setHasShownQuotaWarning(true);
    }
    
    let result: QueryResult | null = null;
    let usedLocalFallback = false;

    try {
      // 1. Attempt AI Generation if enabled
      // Even if quotaExhausted is true, we try (maybe it reset?), but we FORCE disable extras to save cost/errors
      if (settings.enableAiGeneration) {
         try {
           // Pass granular progress callback
           // Disable tips if quota is exhausted to try a lighter request
           const includeTips = settings.enableAiTips && !quotaExhausted;

           result = await generateSqlFromBuilderState(
             schema, 
             builderState, 
             includeTips, 
             (msg) => {
               // Only update if this request is still active/latest
               if (generationRequestId.current === currentRequestId) {
                 setProgressMessage(msg);
               }
             }
           );
           
           // If we have moved on (e.g. user clicked Skip), discard this result
           if (generationRequestId.current !== currentRequestId) {
             console.log("Ignorando resultado obsoleto da IA (Skipped)");
             return; 
           }

           if (result.sql === 'NO_RELATIONSHIP') {
              throw new Error("NO_RELATIONSHIP");
           }
         } catch (aiError: any) {
           console.warn("AI Generation failed, attempting fallback...", aiError);
           
           // If request ID changed, we probably skipped already, so don't error out
           if (generationRequestId.current !== currentRequestId) return;

           if (aiError.message === "QUOTA_ERROR") {
              setQuotaExhausted(true);
              
              // NON-BLOCKING Quota Logic: Warn and Fallback
              if (!hasShownQuotaWarning) {
                 setWarningToast("Cota da API IA excedida. Alternando para modo offline (sem validação/dicas).");
                 setHasShownQuotaWarning(true);
              }
              // Proceed to local fallback...
           } else if (aiError.message === "NO_RELATIONSHIP") {
              throw new Error("A IA não encontrou relacionamento entre estas tabelas. Defina Joins manualmente.");
           } else if (aiError.message === "TIMEOUT") {
              // Timeout handled naturally by fallback
              console.warn("AI Timeout - switching to local");
           }
           
           // Trigger fallback
           usedLocalFallback = true;
         }
      } else {
         usedLocalFallback = true;
      }

      // Check ID again before fallback
      if (generationRequestId.current !== currentRequestId) return;

      // 2. Fallback to Local Engine if AI failed or was disabled
      if (usedLocalFallback) {
         // If we are here because of Quota Error and we didn't return above, we are falling back to local
         setProgressMessage("Gerando SQL com motor local...");
         // Artificial small delay for UX so user sees the switch
         await new Promise(r => setTimeout(r, 500));
         
         if (generationRequestId.current !== currentRequestId) return;
         result = generateLocalSql(schema, builderState);
      }
      
      if (!result) throw new Error("Falha ao gerar SQL.");

      // 3. Update UI Immediately
      setQueryResult(result);
      setCurrentStep('preview');
      setIsProcessing(false);
      setProgressMessage("");

      // 4. Run Validation in Background (ONLY if enabled, allowed, and NOT using local fallback)
      // If quotaExhausted is true, skip validation to save remaining quota for generations
      if (settings.enableAiGeneration && settings.enableAiValidation && !quotaExhausted && !usedLocalFallback) {
        setIsValidating(true);
        validateSqlQuery(result.sql, schema)
          .then(validation => {
            setQueryResult(prev => prev ? { ...prev, validation } : null);
          })
          .catch(err => {
             console.error("Validação em segundo plano falhou:", err);
             if (err.message === "QUOTA_ERROR") {
                setQuotaExhausted(true);
                // Fail silently/gracefully on validation error
             }
          })
          .finally(() => {
            setIsValidating(false);
          });
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
             // Try to use AI to gen data, but handle quota
            try {
               data = await generateMockData(schema, queryResult.sql);
            } catch (mockErr: any) {
               if (mockErr.message === "QUOTA_ERROR") {
                  setQuotaExhausted(true);
                  // Soft fail to offline data or empty
                  setWarningToast("Cota excedida. Usando dados offline.");
                  // If simulation data exists we used it, but here we likely dont have it initialized?
                  // App flow initializes simulationData on Connect if 'simulated'.
                  // So we should have landed in 'executeOfflineQuery' above unless simData is null.
                  // If simData is null (e.g. maybe pure AI mode without init), we just return empty with warning
                  data = [];
               } else {
                  throw mockErr;
               }
            }
         } else {
            // Fallback if no simulation data and no AI
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
         // Don't block, just show error
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
  };

  const handleNavigate = (step: AppStep) => {
    setError(null);
    setCurrentStep(step);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      
      {showOnboarding && <AiPreferenceModal onSelect={handleAiPreferenceSelect} />}

      {/* Left Navigation Sidebar */}
      <Sidebar 
        currentStep={currentStep} 
        onNavigate={handleNavigate} 
        schema={schema}
        onOpenSettings={() => setShowSettings(true)}
        onRegenerateClick={handleReset}
        onDescriptionChange={handleUpdateSchemaDescription}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden rounded-tl-3xl shadow-2xl my-2 mr-2 relative">
        
        {/* Progress Bar (Visual Top) */}
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

        {/* Global Error Banner */}
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

        {/* Warning Toast (Dismissible) */}
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

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal 
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(newSettings) => setSettings(newSettings)}
          quotaExhausted={quotaExhausted}
        />
      )}
    </div>
  );
}

export default App;