
import React, { useState } from 'react';
import { DatabaseSchema, AppStep, BuilderState, QueryResult } from './types';
import Sidebar from './components/Sidebar';
import ConnectionStep from './components/steps/ConnectionStep';
import BuilderStep from './components/steps/BuilderStep';
import PreviewStep from './components/steps/PreviewStep';
import ResultsStep from './components/steps/ResultsStep';
import { generateSqlFromBuilderState, validateSqlQuery, generateMockData } from './services/geminiService';

function App() {
  // Navigation State
  const [currentStep, setCurrentStep] = useState<AppStep>('connection');
  
  // App Data State
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [builderState, setBuilderState] = useState<BuilderState>({
    selectedTables: [],
    selectedColumns: [],
    limit: 100
  });
  
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [mockResults, setMockResults] = useState<any[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Handlers ---

  const handleSchemaLoaded = (newSchema: DatabaseSchema) => {
    setSchema(newSchema);
    // Reset downstream state
    setBuilderState({ selectedTables: [], selectedColumns: [], limit: 100 });
    setQueryResult(null);
    setMockResults([]);
    setCurrentStep('builder');
  };

  const handleBuilderChange = (newState: BuilderState) => {
    setBuilderState(newState);
  };

  const handleGeneratePreview = async () => {
    if (!schema) return;
    setIsProcessing(true);
    try {
      // 1. Generate SQL from visual state
      const result = await generateSqlFromBuilderState(schema, builderState);
      // 2. Validate immediately
      const validation = await validateSqlQuery(result.sql);
      result.validation = validation;
      
      setQueryResult(result);
      setCurrentStep('preview');
    } catch (e) {
      console.error(e);
      alert("Failed to generate SQL from your selection.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteQuery = async () => {
    if (!schema || !queryResult) return;
    setIsProcessing(true);
    try {
      const data = await generateMockData(schema, queryResult.sql);
      setMockResults(data);
      setCurrentStep('results');
    } catch (e) {
      console.error(e);
      alert("Execution failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCurrentStep('connection');
    setSchema(null);
    setQueryResult(null);
    setMockResults([]);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Left Navigation Sidebar */}
      <Sidebar currentStep={currentStep} onNavigate={setCurrentStep} hasSchema={!!schema} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 text-slate-900 overflow-hidden rounded-tl-3xl shadow-2xl my-2 mr-2 relative">
        
        {/* Progress Bar (Visual Top) */}
        <div className="h-1.5 bg-slate-200 w-full">
          <div 
            className="h-full bg-indigo-600 transition-all duration-500 ease-out"
            style={{ 
              width: currentStep === 'connection' ? '25%' : 
                     currentStep === 'builder' ? '50%' : 
                     currentStep === 'preview' ? '75%' : '100%' 
            }}
          />
        </div>

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
              onBack={() => setCurrentStep('builder')}
              isExecuting={isProcessing}
            />
          )}

          {currentStep === 'results' && (
            <ResultsStep 
              data={mockResults}
              sql={queryResult?.sql || ''}
              onBackToBuilder={() => setCurrentStep('builder')}
              onNewConnection={handleReset}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
