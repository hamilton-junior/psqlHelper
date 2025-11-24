
import React, { useState, useEffect } from 'react';
import { DatabaseSchema, AppStep, BuilderState, QueryResult, DbCredentials, AppSettings, DEFAULT_SETTINGS } from './types';
import Sidebar from './components/Sidebar';
import ConnectionStep from './components/steps/ConnectionStep';
import BuilderStep from './components/steps/BuilderStep';
import PreviewStep from './components/steps/PreviewStep';
import ResultsStep from './components/steps/ResultsStep';
import SettingsModal from './components/SettingsModal';
import { generateSqlFromBuilderState, validateSqlQuery } from './services/geminiService';
import { executeQueryReal } from './services/dbService';
import { AlertTriangle, X } from 'lucide-react';

function App() {
  // Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('psql-buddy-settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });
  const [showSettings, setShowSettings] = useState(false);

  // Apply Theme
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('psql-buddy-settings', JSON.stringify(settings));
  }, [settings]);

  // Navigation State
  const [currentStep, setCurrentStep] = useState<AppStep>('connection');
  
  // App Data State
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [credentials, setCredentials] = useState<DbCredentials | null>(null);

  const [builderState, setBuilderState] = useState<BuilderState>({
    selectedTables: [],
    selectedColumns: [],
    joins: [],
    filters: [],
    groupBy: [],
    orderBy: [],
    limit: settings.defaultLimit
  });
  
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [dbResults, setDbResults] = useState<any[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false); // For SQL Gen & Execution
  const [isValidating, setIsValidating] = useState(false); // For Background Validation
  const [error, setError] = useState<string | null>(null);

  // --- Handlers ---

  const handleSchemaLoaded = (newSchema: DatabaseSchema, creds: DbCredentials) => {
    setError(null);
    setSchema(newSchema);
    setCredentials(creds);
    // Reset downstream state
    setBuilderState({ 
      selectedTables: [], 
      selectedColumns: [], 
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

  const handleBuilderChange = (newState: BuilderState) => {
    setBuilderState(newState);
  };

  const handleGeneratePreview = async () => {
    if (!schema) return;
    setError(null);
    setIsProcessing(true);
    
    try {
      // 1. Generate SQL from visual state
      const result = await generateSqlFromBuilderState(schema, builderState, settings.enableAiTips);

      // Check for NO_RELATIONSHIP signal
      if (result.sql === 'NO_RELATIONSHIP') {
        setError("AI could not find a relationship between these tables. Please go to the 'Joins' tab and define the connection manually.");
        setIsProcessing(false);
        return;
      }
      
      // 2. Update UI Immediately (Don't wait for validation)
      setQueryResult(result);
      setCurrentStep('preview');
      setIsProcessing(false);

      // 3. Run Validation in Background (if enabled)
      if (settings.enableAiValidation) {
        setIsValidating(true);
        // PASS THE SCHEMA HERE so validation can check column existence
        validateSqlQuery(result.sql, schema)
          .then(validation => {
            setQueryResult(prev => prev ? { ...prev, validation } : null);
          })
          .catch(err => {
            console.error("Background validation failed:", err);
          })
          .finally(() => {
            setIsValidating(false);
          });
      }

    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to generate SQL from your selection.");
      setIsProcessing(false);
    }
  };

  const handleExecuteQuery = async () => {
    if (!schema || !queryResult || !credentials) return;
    setError(null);
    setIsProcessing(true);
    try {
      // Execute on real DB via backend
      const data = await executeQueryReal(credentials, queryResult.sql);
      setDbResults(data);
      setCurrentStep('results');
    } catch (e: any) {
      console.error(e);
      setError("Execution failed: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setError(null);
    setCurrentStep('connection');
    setSchema(null);
    setCredentials(null);
    setQueryResult(null);
    setDbResults([]);
  };

  const handleNavigate = (step: AppStep) => {
    setError(null);
    setCurrentStep(step);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Left Navigation Sidebar */}
      <Sidebar 
        currentStep={currentStep} 
        onNavigate={handleNavigate} 
        hasSchema={!!schema}
        onOpenSettings={() => setShowSettings(true)}
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
              <span className="text-sm font-medium text-red-800 dark:text-red-200">{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"
            >
              <X className="w-4 h-4" />
            </button>
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
              isGenerating={isProcessing}
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
            />
          )}

          {currentStep === 'results' && (
            <ResultsStep 
              data={dbResults}
              sql={queryResult?.sql || ''}
              onBackToBuilder={() => handleNavigate('builder')}
              onNewConnection={handleReset}
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
        />
      )}
    </div>
  );
}

export default App;
