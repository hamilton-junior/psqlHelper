
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  DatabaseSchema, AppStep, BuilderState, QueryResult, DbCredentials, 
  AppSettings, DEFAULT_SETTINGS, VirtualRelation, DashboardItem, QueryTab,
  TabResultsState, ConnectionGroup
} from './types';
import { Loader2, Database, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import TabBar from '@/components/TabBar';
import ConnectionStep from '@/components/steps/ConnectionStep';
import BuilderStep from '@/components/steps/BuilderStep';
import PreviewStep from '@/components/steps/PreviewStep';
import ResultsStep from '@/components/steps/ResultsStep';
import DataDiffStep from '@/components/steps/DataDiffStep';
import DashboardStep from '@/components/steps/DashboardStep';
import RoadmapStep from '@/components/steps/RoadmapStep';
import ServerHealthStep from '@/components/steps/ServerHealthStep';
import VisualQueryFlowStep from '@/components/steps/VisualQueryFlowStep';
import ObjectExplorer from '@/components/ObjectExplorer';
import SettingsModal from '@/components/SettingsModal';
import SchemaDiagramModal from '@/components/SchemaDiagramModal';
import HistoryModal from '@/components/HistoryModal';
import ShortcutsModal from '@/components/ShortcutsModal';
import SqlCheatSheetModal from '@/components/SqlCheatSheetModal';
import VirtualRelationsModal from '@/components/VirtualRelationsModal';
import LogAnalyzerModal from '@/components/LogAnalyzerModal';
import TemplateModal from '@/components/TemplateModal';
import SqlExtractorModal from '@/components/SqlExtractorModal';
import SchemaWikiModal from '@/components/SchemaWikiModal';
import UpdateModal from '@/components/UpdateModal';
import { generateSqlFromBuilderState } from '@/services/geminiService';
import { generateLocalSql } from '@/services/localSqlService';
import { executeQueryReal } from '@/services/dbService';
import { executeOfflineQuery, initializeSimulation, SimulationData } from '@/services/simulationService';
import { Toaster, toast } from 'react-hot-toast';

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

const INITIAL_RESULTS_STATE: TabResultsState = {
  activeTab: 'table',
  search: '',
  filters: [],
  chatMessages: [
    { id: '1', role: 'assistant', text: 'Olá! Analisei os dados retornados pela sua consulta. O que você gostaria de saber sobre eles?' }
  ],
  chatInput: '',
  chartConfig: { type: 'bar', xAxis: '', yKeys: [] }
};

function createNewQueryTab(index: number): QueryTab {
  return {
    id: crypto.randomUUID(),
    name: `Consulta ${index + 1}`,
    currentStep: 'builder',
    builderState: { ...INITIAL_BUILDER_STATE },
    queryResult: null,
    executionResult: [],
    isGenerating: false,
    isExecuting: false,
    resultsState: { ...INITIAL_RESULTS_STATE },
  };
}

function createNewConnectionGroup(): ConnectionGroup {
  const firstTab = createNewQueryTab(0);
  return {
    id: crypto.randomUUID(),
    name: 'Nova Conexão',
    schema: null,
    credentials: null,
    simulationData: {},
    tabs: [firstTab],
    activeTabId: firstTab.id,
    contextColor: ''
  };
}

const App: React.FC = () => {
  // Connection Groups Management
  const [connections, setConnections] = useState<ConnectionGroup[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string>('');
  const [globalStep, setGlobalStep] = useState<AppStep | 'query'>('connection');
  
  // Hydration & Global State
  const [isHydrated, setIsHydrated] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [dashboardItems, setDashboardItems] = useState<DashboardItem[]>([]);
  const [virtualRelations, setVirtualRelations] = useState<VirtualRelation[]>([]);
  
  // Modals visibility
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'interface' | 'ai' | 'database' | 'diagnostics'>('interface');
  const [showDiagram, setShowDiagram] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [showVirtualRelations, setShowVirtualRelations] = useState(false);
  const [showLogAnalyzer, setShowLogAnalyzer] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSqlExtractor, setShowSqlExtractor] = useState(false);
  const [showWiki, setShowWiki] = useState(false);
  
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [remoteVersions, setRemoteVersions] = useState<any>(null);
  const [currentAppVersion, setCurrentAppVersion] = useState<string>('...');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  const generationIdRef = useRef(0);

  // Computations
  const activeConnection = useMemo(() => 
    connections.find(c => c.id === activeConnectionId) || null
  , [connections, activeConnectionId]);

  const activeQuery = useMemo(() => 
    activeConnection?.tabs.find(t => t.id === activeConnection?.activeTabId) || null
  , [activeConnection]);

  // Actions
  const updateActiveConnection = useCallback((updater: (conn: ConnectionGroup) => Partial<ConnectionGroup>) => {
    setConnections(prev => prev.map(c => c.id === activeConnectionId ? { ...c, ...updater(c) } : c));
  }, [activeConnectionId]);

  const updateActiveQuery = useCallback((updater: (tab: QueryTab) => Partial<QueryTab>) => {
    if (!activeConnection) return;
    setConnections(prev => prev.map(c => {
      if (c.id !== activeConnectionId) return c;
      const updatedTabs = c.tabs.map(t => t.id === c.activeTabId ? { ...t, ...updater(t) } : t);
      return { ...c, tabs: updatedTabs };
    }));
  }, [activeConnectionId, activeConnection]);

  const handleAddConnection = () => {
    console.log("[WORKSPACE] Adicionando novo grupo de conexão.");
    const newConn = createNewConnectionGroup();
    setConnections(prev => [...prev, newConn]);
    setActiveConnectionId(newConn.id);
    setGlobalStep('connection');
  };

  const handleCloseConnection = (id: string) => {
    if (connections.length === 1) {
        toast.error("Mantenha pelo menos um banco de dados ativo.");
        return;
    }
    const newConns = connections.filter(c => c.id !== id);
    setConnections(newConns);
    if (activeConnectionId === id) setActiveConnectionId(newConns[newConns.length - 1].id);
    console.log(`[WORKSPACE] Conexão ${id} encerrada.`);
  };

  const handleAddQueryTab = () => {
    if (!activeConnection) return;
    const newTab = createNewQueryTab(activeConnection.tabs.length);
    updateActiveConnection(conn => ({
        tabs: [...conn.tabs, newTab],
        activeTabId: newTab.id
    }));
    setGlobalStep('query');
    console.log(`[WORKSPACE] Nova query adicionada ao banco ${activeConnection.name}.`);
  };

  const handleCloseQueryTab = (id: string) => {
    if (!activeConnection) return;
    if (activeConnection.tabs.length === 1) return;
    const newTabs = activeConnection.tabs.filter(t => t.id !== id);
    updateActiveConnection(conn => ({
        tabs: newTabs,
        activeTabId: activeConnection.activeTabId === id ? newTabs[newTabs.length - 1].id : activeConnection.activeTabId
    }));
  };

  // Init & Persistence
  useEffect(() => {
    const hydrate = async () => {
        const electron = (window as any).electron;
        if (electron?.invoke) {
            const diskData = await electron.invoke('get-persistent-store');
            if (diskData) {
                Object.entries(diskData).forEach(([k, v]) => localStorage.setItem(k, v as string));
                const s = localStorage.getItem('psqlBuddy-settings');
                if (s) setSettings(JSON.parse(s));
            }
        }
        const initial = createNewConnectionGroup();
        setConnections([initial]);
        setActiveConnectionId(initial.id);
        setIsHydrated(true);
    };
    hydrate();
  }, []);

  // Theme Sync
  useEffect(() => {
    if (settings.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('psqlBuddy-settings', JSON.stringify(settings));
  }, [settings.theme, settings]);

  // Monitora a troca de banco de dados para garantir que bancos não conectados mostrem a tela de conexão
  useEffect(() => {
    if (isHydrated && activeConnection && !activeConnection.schema) {
      console.log(`[WORKSPACE] Banco "${activeConnection.name}" não conectado. Redirecionando para tela de conexão.`);
      setGlobalStep('connection');
    } else if (isHydrated && activeConnection && activeConnection.schema && globalStep === 'connection') {
      // Se voltarmos para um banco já conectado via aba, mas estávamos no passo 'connection', restauramos o fluxo de query
      console.log(`[WORKSPACE] Banco "${activeConnection.name}" já possui schema. Restaurando fluxo.`);
      setGlobalStep('query');
    }
  }, [activeConnectionId, activeConnection?.schema, isHydrated]);

  const handleSchemaLoaded = (loadedSchema: DatabaseSchema, creds: DbCredentials) => {
    console.log(`[CONNECTION] Schema carregado para: ${creds.database}. Iniciando workspace.`);
    updateActiveConnection(() => ({
       schema: loadedSchema,
       credentials: creds,
       simulationData: loadedSchema.connectionSource === 'simulated' ? initializeSimulation(loadedSchema) : {},
       name: creds.database || loadedSchema.name,
       contextColor: creds.color
    }));
    setGlobalStep('query');
  };

  const handleGenerateSql = async () => {
    if (!activeConnection?.schema || !activeQuery) return;
    const currentGenId = ++generationIdRef.current;
    updateActiveQuery(() => ({ isGenerating: true }));
    
    try {
      let result = settings.enableAiGeneration 
        ? await generateSqlFromBuilderState(activeConnection.schema, activeQuery.builderState, settings.enableAiTips)
        : generateLocalSql(activeConnection.schema, activeQuery.builderState);
      
      if (currentGenId !== generationIdRef.current) return;
      updateActiveQuery(() => ({ queryResult: result, currentStep: 'preview', isGenerating: false }));
    } catch (e: any) { 
      updateActiveQuery(() => ({ isGenerating: false }));
      toast.error(e.message || "Erro na geração");
    }
  };

  const handleExecuteQuery = async (sqlOverride?: string) => {
    if (!activeConnection?.credentials || !activeConnection.schema || !activeQuery) return;
    const sqlToRun = sqlOverride || activeQuery.queryResult?.sql;
    if (!sqlToRun) return;

    updateActiveQuery(() => ({ isExecuting: true }));
    try {
       let data = activeConnection.credentials.host === 'simulated'
          ? executeOfflineQuery(activeConnection.schema, activeConnection.simulationData, activeQuery.builderState)
          : await executeQueryReal(activeConnection.credentials, sqlToRun);
       
       updateActiveQuery(() => ({ 
         executionResult: data, 
         currentStep: 'results', 
         isExecuting: false,
         resultsState: { ...INITIAL_RESULTS_STATE }
       }));
    } catch (e: any) { 
      updateActiveQuery(() => ({ isExecuting: false }));
      toast.error(e.message || "Falha na execução");
    }
  };

  const handleNavigate = (step: AppStep) => {
    console.log(`[NAVIGATION] Solicitado passo: ${step}`);
    if (step === 'connection') {
      setGlobalStep('connection');
      return;
    }

    if (['builder', 'preview', 'results', 'queryflow'].includes(step)) {
      setGlobalStep('query');
      updateActiveQuery(() => ({ currentStep: step as AppStep }));
    } else {
      setGlobalStep(step);
    }
  };

  if (!isHydrated) {
    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-indigo-400 transition-colors duration-500">
            <Loader2 className="w-12 h-12 animate-spin mb-4" />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Restaurando Ambiente...</span>
        </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-500">
      <Toaster position="top-right" />
      
      <Sidebar 
        currentStep={globalStep === 'query' ? (activeQuery?.currentStep || 'builder') : globalStep} 
        onNavigate={handleNavigate} schema={activeConnection?.schema || null} hasResults={(activeQuery?.executionResult?.length || 0) > 0}
        onOpenSettings={() => setShowSettings(true)} onOpenDiagram={() => setShowDiagram(true)}
        onOpenHistory={() => setShowHistory(true)} onOpenShortcuts={() => setShowShortcuts(true)}
        onOpenCheatSheet={() => setShowCheatSheet(true)} onOpenVirtualRelations={() => setShowVirtualRelations(true)}
        onOpenLogAnalyzer={() => setShowLogAnalyzer(true)} onOpenTemplates={() => setShowTemplates(true)}
        onOpenSqlExtractor={() => setShowSqlExtractor(true)} 
        onOpenWiki={() => setShowWiki(true)}
        onCheckUpdate={() => (window as any).electron?.send('check-update', settings.updateBranch)}
      />
      
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {/* Camada 1: Barra de Conexões (Bancos de Dados) */}
        <div className="flex items-center bg-slate-200/50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 h-10 gap-1 overflow-x-auto no-scrollbar shrink-0 transition-colors duration-300">
            {connections.map(conn => (
                <div 
                    key={conn.id}
                    onClick={() => setActiveConnectionId(conn.id)}
                    className={`group relative flex items-center h-7 px-3 rounded-t-lg text-[10px] font-black uppercase tracking-tighter cursor-pointer transition-all min-w-[100px] border-x border-t
                        ${activeConnectionId === conn.id 
                            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-slate-200 dark:border-slate-800 z-10' 
                            : 'bg-transparent text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 border-transparent'}
                    `}
                >
                    {conn.contextColor && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-lg" style={{ backgroundColor: conn.contextColor }} />}
                    <Database className="w-3 h-3 mr-2 opacity-50" />
                    <span className="truncate flex-1">{conn.name}</span>
                    {connections.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); handleCloseConnection(conn.id); }} className="ml-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"><X size={10} /></button>
                    )}
                </div>
            ))}
            <button onClick={handleAddConnection} className="p-1.5 ml-2 text-slate-400 hover:text-indigo-500 transition-all shrink-0" title="Nova Conexão"><Plus size={14} /></button>
        </div>

        {/* Camada 2: Barra de Queries do Banco Ativo (Só aparece se o banco estiver conectado) */}
        {globalStep === 'query' && activeConnection?.schema && (
            <TabBar 
                tabs={activeConnection.tabs} 
                activeTabId={activeConnection.activeTabId} 
                contextColor={activeConnection.contextColor}
                onSwitch={(id) => updateActiveConnection(() => ({ activeTabId: id }))} 
                onClose={handleCloseQueryTab} 
                onAdd={handleAddQueryTab} 
            />
        )}
        
        <div className="flex-1 overflow-hidden h-full relative">
           <AnimatePresence mode="popLayout">
             <motion.div
               key={`${activeConnectionId}-${activeConnection?.activeTabId}-${globalStep}`}
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               transition={{ duration: 0.1 }}
               className="h-full w-full absolute top-0 left-0 p-6"
             >
               {/* SEMPRE mostra conexão se o banco não possuir schema OU se solicitado explicitamente */}
               {(globalStep === 'connection' || (activeConnection && !activeConnection.schema)) && (
                  <ConnectionStep onSchemaLoaded={handleSchemaLoaded} settings={settings} />
               )}
               
               {activeConnection && activeConnection.schema && (
                   <>
                       {globalStep === 'objects' && <ObjectExplorer credentials={activeConnection.credentials} />}
                       {globalStep === 'query' && activeQuery?.currentStep === 'builder' && (
                          <BuilderStep 
                            schema={activeConnection.schema} state={activeQuery.builderState} 
                            onStateChange={(s) => updateActiveQuery(() => ({ builderState: s }))} 
                            onGenerate={handleGenerateSql} isGenerating={activeQuery.isGenerating} 
                            settings={settings} 
                          />
                       )}
                       {globalStep === 'query' && activeQuery?.currentStep === 'queryflow' && (
                          <VisualQueryFlowStep schema={activeConnection.schema} state={activeQuery.builderState} />
                       )}
                       {globalStep === 'query' && activeQuery?.currentStep === 'preview' && activeQuery.queryResult && (
                          <PreviewStep 
                            queryResult={activeQuery.queryResult} onExecute={handleExecuteQuery} 
                            onBack={() => updateActiveQuery(() => ({ currentStep: 'builder' }))} 
                            isExecuting={activeQuery.isExecuting} isValidating={false} 
                            schema={activeConnection.schema || undefined} settings={settings} credentials={activeConnection.credentials} />
                       )}
                       {globalStep === 'query' && activeQuery?.currentStep === 'results' && activeQuery.executionResult && (
                          <ResultsStep 
                            data={activeQuery.executionResult} sql={activeQuery.queryResult?.sql || ''} 
                            onBackToBuilder={() => updateActiveQuery(() => ({ currentStep: 'builder' }))} 
                            onNewConnection={() => setGlobalStep('connection')} settings={settings} 
                            onShowToast={(m) => toast(m)} credentials={activeConnection.credentials} 
                            schema={activeConnection.schema || undefined} 
                            resultsState={activeQuery.resultsState} 
                            onResultsStateChange={(p) => updateActiveQuery(q => ({ resultsState: { ...q.resultsState, ...p } }))}
                          />
                       )}
                       {globalStep === 'datadiff' && (
                            <DataDiffStep schema={activeConnection.schema} credentials={activeConnection.credentials} simulationData={activeConnection.simulationData} settings={settings} />
                       )}
                       {globalStep === 'serverhealth' && <ServerHealthStep credentials={activeConnection.credentials} />}
                   </>
               )}

               {globalStep === 'dashboard' && <DashboardStep items={dashboardItems} onRemoveItem={(id) => setDashboardItems(prev => prev.filter(i => i.id !== id))} onClearAll={() => setDashboardItems([])} />}
               {globalStep === 'roadmap' && <RoadmapStep onNavigate={handleNavigate} />}
             </motion.div>
           </AnimatePresence>
        </div>
      </main>

      {/* Modais de contexto global (usam o activeConnection quando necessário) */}
      {showSettings && <SettingsModal settings={settings} onSave={setSettings} onClose={() => setShowSettings(false)} simulationData={activeConnection?.simulationData} schema={activeConnection?.schema} credentials={activeConnection?.credentials} remoteVersions={remoteVersions} initialTab={settingsTab} />}
      {showDiagram && activeConnection?.schema && <SchemaDiagramModal schema={activeConnection.schema} onClose={() => setShowDiagram(false)} credentials={activeConnection.credentials} />}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} onLoadQuery={sql => { updateActiveQuery(() => ({ queryResult: { sql, explanation: '', tips: [] }, currentStep: 'preview' })); setGlobalStep('query'); }} />}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showCheatSheet && <SqlCheatSheetModal onClose={() => setShowCheatSheet(false)} />}
      {showVirtualRelations && activeConnection?.schema && <VirtualRelationsModal schema={activeConnection.schema} existingRelations={virtualRelations} onAddRelation={r => setVirtualRelations(p => [...p, r])} onRemoveRelation={id => setVirtualRelations(p => p.filter(r => r.id !== id))} onClose={() => setShowVirtualRelations(false)} credentials={activeConnection.credentials} />}
      {showLogAnalyzer && activeConnection?.schema && <LogAnalyzerModal schema={activeConnection.schema} onClose={() => setShowLogAnalyzer(false)} onRunSql={sql => { updateActiveQuery(() => ({ queryResult: { sql, explanation: '', tips: [] }, currentStep: 'preview' })); setGlobalStep('query'); }} />}
      {showTemplates && <TemplateModal onClose={() => setShowTemplates(false)} onRunTemplate={sql => { updateActiveQuery(() => ({ queryResult: { sql, explanation: '', tips: [] }, currentStep: 'preview' })); setGlobalStep('query'); }} />}
      {showSqlExtractor && <SqlExtractorModal onClose={() => setShowSqlExtractor(false)} onRunSql={sql => { updateActiveQuery(() => ({ queryResult: { sql, explanation: '', tips: [] }, currentStep: 'preview' })); setGlobalStep('query'); }} settings={settings} />}
      {showWiki && activeConnection?.schema && <SchemaWikiModal schema={activeConnection.schema} onClose={() => setShowWiki(false)} />}
      {updateInfo && <UpdateModal updateInfo={updateInfo} downloadProgress={downloadProgress} isReady={updateReady} onClose={() => setUpdateInfo(null)} onStartDownload={() => (window as any).electron.send('start-download')} onInstall={() => (window as any).electron.send('install-update')} onIgnore={() => setUpdateInfo(null)} />}
    </div>
  );
};

export default App;
