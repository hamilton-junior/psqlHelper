import React, { useState } from 'react';
import { DatabaseSchema, AppStep, BuilderState, QueryResult, DbCredentials } from './types';
import Sidebar from './components/Sidebar';
import ConnectionStep from './components/steps/ConnectionStep';
import BuilderStep from './components/steps/BuilderStep';
import PreviewStep from './components/steps/PreviewStep';
import ResultsStep from './components/steps/ResultsStep';
import { generateSqlFromBuilderState, validateSqlQuery } from './services/geminiService';
import { executeQueryReal } from './services/dbService';
import { AlertTriangle, X } from 'lucide-react';

function App() {
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
    limit: 100
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
      limit: 100 
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
      const result = await generateSqlFromBuilderState(schema, builderState);
      
      // 2. Update UI Immediately (Don't wait for validation)
      setQueryResult(result);
      setCurrentStep('preview');
      setIsProcessing(false);

      // 3. Run Validation in Background
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
      <Sidebar currentStep={currentStep} onNavigate={handleNavigate} hasSchema={!!schema} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 text-slate-900 overflow-hidden rounded-tl-3xl shadow-2xl my-2 mr-2 relative">
        
        {/* Progress Bar (Visual Top) */}
        <div className="h-1.5 bg-slate-200 w-full shrink-0">
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
          <div className="bg-red-50 border-b border-red-200 p-4 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-red-800">{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {currentStep === 'connection' && (
            <ConnectionStep 
              onSchemaLoaded={handleSchemaLoaded} 
            />
          )}

          {currentStep === 'builder' && schema && (
            <BuilderStep 
              schema={schema}
              state={builderState}
              onStateChange={handleBuilderChange}
              onGenerate={handleGeneratePreview}
              isGenerating={isProcessing}
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
    </div>
  );
}

export default App;