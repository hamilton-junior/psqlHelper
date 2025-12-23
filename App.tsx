
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  DatabaseSchema, AppStep, BuilderState, QueryResult, DbCredentials, 
  AppSettings, DEFAULT_SETTINGS, DashboardItem, VirtualRelation,
  DiffRow
} from './types';
import Sidebar from './components/Sidebar';
import ConnectionStep from './components/steps/ConnectionStep';
import BuilderStep from './components/steps/BuilderStep';
import PreviewStep from './components/steps/PreviewStep';
import ResultsStep from './components/steps/ResultsStep';
import DashboardStep from './components/steps/DashboardStep';
import DataDiffStep from './components/steps/DataDiffStep';
import SettingsModal from './components/SettingsModal';
import SchemaDiagramModal from './components/SchemaDiagramModal';
import ShortcutsModal from './components/ShortcutsModal';
import SqlCheatSheetModal from './components/SqlCheatSheetModal';
import VirtualRelationsModal from './components/VirtualRelationsModal';
import TablePreviewModal from './components/TablePreviewModal';
import AiPreferenceModal from './components/AiPreferenceModal';
import LogAnalyzerModal from './components/LogAnalyzerModal'; 
import TemplateModal from './components/TemplateModal'; 
import HistoryModal from './components/HistoryModal'; 
import TourGuide, { TourStep } from './components/TourGuide';
import { generateSqlFromBuilderState } from './services/geminiService';
import { generateLocalSql } from './services/localSqlService';
import { executeQueryReal } from './services/dbService';
import { executeOfflineQuery, initializeSimulation, SimulationData } from './services/simulationService';
import { Toaster, toast } from 'react-hot-toast';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const TOUR_STEPS: TourStep[] = [
  { targetId: 'schema-viewer-panel', title: 'Navegador de Schema', content: 'Aqui você vê todas as tabelas e colunas do seu banco. Selecione tabelas para começar.', position: 'right' },
  { targetId: 'magic-fill-bar', title: 'Magic Fill (IA)', content: 'Digite o que você precisa em linguagem natural e a IA preencherá o construtor para você.', position: 'bottom' },
  { targetId: 'builder-main-panel', title: 'Área de Construção', content: 'Configure colunas, filtros e ordenação manualmente aqui.', position: 'left' },
  { targetId: 'builder-footer-actions', title: 'Gerar SQL', content: 'Quando terminar, clique aqui para gerar o SQL e visualizar os resultados.', position: 'top' },
];

const INITIAL_BUILDER_STATE: BuilderState = {
  selectedTables: [],
  selectedColumns: [],
  aggregations: {},
  joins: [],
  filters: [],
  groupBy: [],
  orderBy: [],
  limit: 100
};

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>('connection');
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [credentials, setCredentials] = useState<DbCredentials | null>(null);
  const [simulationData, setSimulationData] = useState<SimulationData>({});
  
  const [builderState, setBuilderState] = useState<BuilderState>(INITIAL_BUILDER_STATE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [executionResult, setExecutionResult] = useState<any[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [executionDuration, setExecutionDuration] = useState(0);

  const [dashboardItems, setDashboardItems] = useState<DashboardItem[]>(() => {
    try {
      const stored = localStorage.getItem('psql-buddy-dashboard');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem('psql-buddy-settings');
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);
  const [showVirtualRelations, setShowVirtualRelations] = useState(false);
  const [showAiPreference, setShowAiPreference] = useState(false);
  const [showLogAnalyzer, setShowLogAnalyzer] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tablePreview, setTablePreview] = useState<{name: string, data: any[], loading: boolean, error: string | null} | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false); 

  const [virtualRelations, setVirtualRelations] = useState<VirtualRelation[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    localStorage.setItem('psql-buddy-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('psql-buddy-dashboard', JSON.stringify(dashboardItems));
  }, [dashboardItems]);

  const handleSchemaLoaded = (loadedSchema: DatabaseSchema, creds: DbCredentials) => {
    setSchema(loadedSchema);
    setCredentials(creds);
    
    if (loadedSchema.connectionSource === 'simulated') {
       const simData = initializeSimulation(loadedSchema);
       setSimulationData(simData);
    }
    
    setCurrentStep('builder');
    
    const hasSeenTour = localStorage.getItem('psql-buddy-tour-seen');
    if (!hasSeenTour) {
       setShowAiPreference(true);
    }
  };

  const handleAiPreferenceSelect = (enableAi: boolean) => {
     setSettings(prev => ({ ...prev, enableAiGeneration: enableAi }));
     setShowAiPreference(false);
     setShowTour(true);
     localStorage.setItem('psql-buddy-tour-seen', 'true');
  };

  const handleGenerateSql = async () => {
    if (!schema) return;
    setIsGenerating(true);
    setProgressMessage("Analisando solicitação...");
    
    try {
      let result: QueryResult;
      
      if (settings.enableAiGeneration) {
         result = await generateSqlFromBuilderState(schema, builderState, settings.enableAiTips, (msg) => setProgressMessage(msg));
      } else {
         await new Promise(r => setTimeout(r, 500));
         result = generateLocalSql(schema, builderState);
         if (settings.enableAiValidation) {
             result.validation = { isValid: true }; 
         }
      }
      
      setQueryResult(result);
      setCurrentStep('preview');
    } catch (error: any) {
      console.error(error);
      handleShowToast(error.message || "Erro ao gerar SQL", 'error');
    } finally {
      setIsGenerating(false);
      setProgressMessage("");
    }
  };

  const handleSkipAi = () => {
     if (!schema) return;
     try {
        const result = generateLocalSql(schema, builderState);
        result.explanation = "Geração fallback (local) utilizada pois a IA estava demorando.";
        setQueryResult(result);
        setCurrentStep('preview');
        setIsGenerating(false);
     } catch (e: any) {
        handleShowToast("Erro ao gerar SQL localmente: " + e.message, 'error');
     }
  };

  const handleExecuteQuery = async (sqlOverride?: string) => {
    if (!credentials || !schema) return;
    
    const sqlToRun = sqlOverride || queryResult?.sql;
    if (!sqlToRun) return;

    setIsExecuting(true);
    setExecutionResult([]);
    const start = performance.now();

    try {
       let data: any[] = [];
       if (credentials.host === 'simulated') {
          if (sqlOverride && sqlOverride !== queryResult?.sql) {
             handleShowToast("Nota: Em modo simulação, edições manuais no SQL podem não refletir nos dados fictícios complexos. Usando lógica do construtor.", 'info');
          }
          data = executeOfflineQuery(schema, simulationData, builderState);
          await new Promise(r => setTimeout(r, 600));
       } else {
          data = await executeQueryReal(credentials, sqlToRun);
       }
       
       setExecutionResult(data);
       setExecutionDuration(performance.now() - start);
       
       if (sqlOverride && queryResult) {
          setQueryResult({ ...queryResult, sql: sqlOverride });
       }
       
       setCurrentStep('results');
    } catch (error: any) {
       console.error(error);
       handleShowToast(error.message || "Erro na execução da query", 'error');
    } finally {
       setIsExecuting(false);
    }
  };

  const handleAddVirtualRelation = (rel: VirtualRelation) => {
     setVirtualRelations(prev => [...prev, rel]);
     if (schema) {
        const newSchema = { ...schema };
        const sourceTbl = newSchema.tables.find(t => `${t.schema || 'public'}.${t.name}` === rel.sourceTable);
        if (sourceTbl) {
           const col = sourceTbl.columns.find(c => c.name === rel.sourceColumn);
           if (col) {
              col.isForeignKey = true;
              col.references = `${rel.targetTable}.${rel.targetColumn}`; 
           }
        }
        setSchema(newSchema);
     }
     handleShowToast("Relacionamento virtual criado com sucesso!", 'success');
  };

  const handleRemoveVirtualRelation = (id: string) => {
     const rel = virtualRelations.find(r => r.id === id);
     setVirtualRelations(prev => prev.filter(r => r.id !== id));
     if (schema && rel) {
        const newSchema = { ...schema };
        const sourceTbl = newSchema.tables.find(t => `${t.schema || 'public'}.${t.name}` === rel.sourceTable);
        if (sourceTbl) {
           const col = sourceTbl.columns.find(c => c.name === rel.sourceColumn);
           if (col) {
              col.isForeignKey = false;
              col.references = undefined;
           }
        }
        setSchema(newSchema);
     }
  };

  const handleCheckOverlap = async (tA: string, cA: string, tB: string, cB: string): Promise<number> => {
     if (!credentials) return 0;
     if (credentials.host === 'simulated') return 10; 
     const sql = `SELECT COUNT(*) as count FROM ${tA} A JOIN ${tB} B ON A.${cA} = B.${cB}`;
     const res = await executeQueryReal(credentials, sql);
     return parseInt(res[0].count);
  };

  const handleAddToDashboard = (item: Omit<DashboardItem, 'id' | 'createdAt'>) => {
     const newItem: DashboardItem = {
        ...item,
        id: crypto.randomUUID(),
        createdAt: Date.now()
     };
     setDashboardItems(prev => [newItem, ...prev]);
  };

  const handlePreviewTable = async (tableName: string) => {
     setTablePreview({ name: tableName, data: [], loading: true, error: null });
     try {
        let data = [];
        if (credentials?.host === 'simulated' && schema) {
           const fakeState: BuilderState = { ...INITIAL_BUILDER_STATE, selectedTables: [`public.${tableName}`], limit: 10 };
           data = executeOfflineQuery(schema, simulationData, fakeState);
        } else if (credentials) {
           data = await executeQueryReal(credentials, `SELECT * FROM ${tableName} LIMIT 10`);
        }
        setTablePreview(prev => prev ? { ...prev, data, loading: false } : null);
     } catch (e: any) {
        setTablePreview(prev => prev ? { ...prev, loading: false, error: e.message } : null);
     }
  };

  const handleShowToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
     if (type === 'success') toast.success(msg);
     else if (type === 'error') toast.error(msg);
     else toast(msg, { icon: <Info className="w-4 h-4 text-blue-500" /> });
  };

  const handleRunExternalSql = (sql: string) => {
     setQueryResult({
        sql: sql,
        explanation: 'Gerada via ferramenta externa.',
        tips: []
     });
     setCurrentStep('preview');
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      <Toaster position="top-right" toastOptions={{ className: 'text-sm font-medium', style: { background: '#1e293b', color: '#fff' } }} />
      
      <Sidebar 
        currentStep={currentStep}
        onNavigate={setCurrentStep}
        schema={schema}
        onOpenSettings={() => setShowSettings(true)}
        onOpenDiagram={() => setShowDiagram(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onRegenerateClick={() => { setSchema(null); setCurrentStep('connection'); }}
        onDescriptionChange={(tableName, newDesc) => {
           if (schema) {
              const updatedTables = schema.tables.map(t => t.name === tableName ? { ...t, description: newDesc } : t);
              setSchema({ ...schema, tables: updatedTables });
           }
        }}
        onOpenShortcuts={() => setShowShortcuts(true)}
        onOpenCheatSheet={() => setShowCheatSheet(true)}
        onOpenVirtualRelations={() => setShowVirtualRelations(true)}
        onOpenLogAnalyzer={() => setShowLogAnalyzer(true)}
        onOpenTemplates={() => setShowTemplates(true)}
      />

      <main className="flex-1 overflow-hidden relative flex flex-col">
        <div className="flex-1 p-6 overflow-hidden h-full">
           {currentStep === 'connection' && (
              <ConnectionStep onSchemaLoaded={handleSchemaLoaded} settings={settings} />
           )}
           
           {currentStep === 'builder' && schema && (
              <BuilderStep 
                 schema={schema} 
                 state={builderState} 
                 onStateChange={setBuilderState}
                 onGenerate={handleGenerateSql}
                 onSkipAi={handleSkipAi}
                 isGenerating={isGenerating}
                 progressMessage={progressMessage}
                 settings={settings}
                 onDescriptionChange={(tableName, newDesc) => {
                    const updatedTables = schema.tables.map(t => t.name === tableName ? { ...t, description: newDesc } : t);
                    setSchema({ ...schema, tables: updatedTables });
                 }}
                 onPreviewTable={handlePreviewTable}
              />
           )}

           {currentStep === 'preview' && queryResult && (
              <PreviewStep 
                 queryResult={queryResult}
                 onExecute={handleExecuteQuery}
                 onBack={() => setCurrentStep('builder')}
                 isExecuting={isExecuting}
                 isValidating={isValidating}
                 validationDisabled={!settings.enableAiValidation}
                 schema={schema || undefined}
              />
           )}

           {currentStep === 'results' && (
              <ResultsStep 
                 data={executionResult}
                 sql={queryResult?.sql || ''}
                 onBackToBuilder={() => setCurrentStep('builder')}
                 onNewConnection={() => { setSchema(null); setCurrentStep('connection'); }}
                 settings={settings}
                 onAddToDashboard={handleAddToDashboard}
                 onShowToast={handleShowToast}
                 credentials={credentials}
                 executionDuration={executionDuration}
                 schema={schema || undefined}
              />
           )}

           {currentStep === 'dashboard' && (
              <DashboardStep 
                 items={dashboardItems} 
                 onRemoveItem={(id) => setDashboardItems(prev => prev.filter(i => i.id !== id))}
                 onClearAll={() => setDashboardItems([])}
              />
           )}

           {currentStep === 'datadiff' && schema && (
              <DataDiffStep 
                 schema={schema} 
                 credentials={credentials}
                 simulationData={simulationData}
              />
           )}
        </div>
      </main>

      {showSettings && (
         <SettingsModal settings={settings} onSave={setSettings} onClose={() => setShowSettings(false)} />
      )}

      {showDiagram && schema && (
         <SchemaDiagramModal 
            schema={schema} 
            onClose={() => setShowDiagram(false)} 
            onAddVirtualRelation={handleAddVirtualRelation}
            credentials={credentials}
         />
      )}

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      
      {showCheatSheet && <SqlCheatSheetModal onClose={() => setShowCheatSheet(false)} />}

      {showVirtualRelations && schema && (
         <VirtualRelationsModal
            schema={schema}
            existingRelations={virtualRelations}
            onAddRelation={handleAddVirtualRelation}
            onRemoveRelation={handleRemoveVirtualRelation}
            onClose={() => setShowVirtualRelations(false)}
            onCheckOverlap={handleCheckOverlap}
            credentials={credentials}
         />
      )}

      {showLogAnalyzer && schema && (
         <LogAnalyzerModal 
            schema={schema}
            onClose={() => setShowLogAnalyzer(false)}
            onRunSql={handleRunExternalSql}
         />
      )}

      {showTemplates && (
         <TemplateModal 
            onClose={() => setShowTemplates(false)}
            onRunTemplate={handleRunExternalSql}
         />
      )}

      {historyOpen && (
         <HistoryModal 
            onClose={() => setHistoryOpen(false)}
            onLoadQuery={handleRunExternalSql}
         />
      )}

      {tablePreview && (
         <TablePreviewModal 
            tableName={tablePreview.name}
            data={tablePreview.data}
            isLoading={tablePreview.loading}
            error={tablePreview.error}
            onClose={() => setTablePreview(null)}
         />
      )}

      {showAiPreference && (
         <AiPreferenceModal onSelect={handleAiPreferenceSelect} />
      )}

      <TourGuide 
         steps={TOUR_STEPS}
         isOpen={showTour}
         onClose={() => setShowTour(false)}
         onComplete={() => setShowTour(false)}
      />

    </div>
  );
};

export default App;
