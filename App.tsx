
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  DatabaseSchema, AppStep, BuilderState, QueryResult, DbCredentials, 
  AppSettings, DEFAULT_SETTINGS, VirtualRelation, DashboardItem, QueryTab,
  TabResultsState
} from './types';
import { Loader2, AlertCircle } from 'lucide-react';
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
import SettingsModal from '@/components/SettingsModal';
import SchemaDiagramModal from '@/components/SchemaDiagramModal';
import HistoryModal from '@/components/HistoryModal';
import ShortcutsModal from '@/components/ShortcutsModal';
import SqlCheatSheetModal from '@/components/SqlCheatSheetModal';
import VirtualRelationsModal from '@/components/VirtualRelationsModal';
import LogAnalyzerModal from '@/components/LogAnalyzerModal';
import TemplateModal from '@/components/TemplateModal';
import SqlExtractorModal from '@/components/SqlExtractorModal';
import UpdateModal from '@/components/UpdateModal';
import Dialog from '@/components/common/Dialog';
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
    { id: '1', role: 'assistant', text: 'Olá! Analisei os dados retornados pela sua consulta. O que você gostaria de saber sobre eles? Posso encontrar tendências, anomalias ou resumir os resultados.' }
  ],
  chatInput: '',
  chartConfig: {
    type: 'bar',
    xAxis: '',
    yKeys: []
  }
};

function createNewTab(index: number): QueryTab {
  return {
    id: crypto.randomUUID(),
    name: index === 0 ? 'Consulta Principal' : `Consulta ${index + 1}`,
    currentStep: 'builder',
    builderState: { ...INITIAL_BUILDER_STATE },
    queryResult: null,
    executionResult: [],
    isGenerating: false,
    isExecuting: false,
    resultsState: { ...INITIAL_RESULTS_STATE }
  };
}

const App: React.FC = () => {
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [credentials, setCredentials] = useState<DbCredentials | null>(null);
  const [simulationData, setSimulationData] = useState<SimulationData>({});
  
  // Tab Management
  const [tabs, setTabs] = useState<QueryTab[]>([createNewTab(0)]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
  const [globalStep, setGlobalStep] = useState<AppStep | 'query'>('connection');

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);

  const updateActiveTab = useCallback((updater: (tab: QueryTab) => Partial<QueryTab>) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updater(t) } : t));
  }, [activeTabId]);

  const updateActiveResultsState = useCallback((partial: Partial<TabResultsState>) => {
    updateActiveTab(tab => ({
      resultsState: { ...tab.resultsState, ...partial }
    }));
  }, [updateActiveTab]);

  const handleAddTab = () => {
    const newTab = createNewTab(tabs.length);
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setGlobalStep('query');
  };

  const handleCloseTab = (id: string) => {
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const [isHydrated, setIsHydrated] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const savedSettings = localStorage.getItem('psqlBuddy-settings');
      return savedSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  const [dashboardItems, setDashboardItems] = useState<DashboardItem[]>(() => {
    try {
      const stored = localStorage.getItem('psqlBuddy-dashboard');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

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
  const [virtualRelations, setVirtualRelations] = useState<VirtualRelation[]>([]);
  
  const [updateInfo, setUpdateInfo] = useState<{version: string, notes: string, branch?: string, updateType?: 'upgrade' | 'downgrade', currentVersion?: string, isManual?: boolean} | null>(null);
  const [remoteVersions, setRemoteVersions] = useState<{ stable: string; wip: string; bleedingEdge: string; totalCommits?: number } | null>(null);
  const [currentAppVersion, setCurrentAppVersion] = useState<string>('...');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const manualCheckRef = useRef(false);

  const generationIdRef = useRef(0);

  useEffect(() => {
    const hydrateFromDisk = async () => {
        const electron = (window as any).electron;
        if (electron && electron.invoke) {
            try {
                const diskData = await electron.invoke('get-persistent-store');
                if (diskData && Object.keys(diskData).length > 0) {
                    Object.entries(diskData).forEach(([key, val]) => {
                        localStorage.setItem(key, val as string);
                    });
                    const savedSettings = localStorage.getItem('psqlBuddy-settings');
                    if (savedSettings) setSettings(JSON.parse(savedSettings));
                    const savedDash = localStorage.getItem('psqlBuddy-dashboard');
                    if (savedDash) setDashboardItems(JSON.parse(savedDash));
                }
            } catch (e) {
                console.error("[PERSISTENCE] Falha ao sincronizar disco -> localStorage:", e);
            }
        }
        setIsHydrated(true);
    };
    hydrateFromDisk();
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const syncToDisk = () => {
        const electron = (window as any).electron;
        if (electron) {
            const allKeys: Record<string, string> = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('psqlBuddy-') || key.startsWith('psql-buddy-'))) {
                    allKeys[key] = localStorage.getItem(key) || '';
                }
            }
            electron.send('save-persistent-store', allKeys);
        }
    };
    const timer = setTimeout(syncToDisk, 2000); 
    return () => clearTimeout(timer);
  }, [settings, dashboardItems, virtualRelations, isHydrated]);

  useEffect(() => {
    if (settings.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('psqlBuddy-settings', JSON.stringify(settings));
  }, [settings.theme, settings]);

  const handleUpdateDetection = useCallback((info: any) => {
    const type = info.updateType;
    if (type === 'downgrade') toast("Aviso: Downgrade disponível", { icon: '⚠️' });
    else toast("Nova atualização encontrada!", { icon: '✨' });
    setUpdateInfo({ ...info, currentVersion: currentAppVersion, isManual: manualCheckRef.current });
    manualCheckRef.current = false;
  }, [currentAppVersion]);

  useEffect(() => {
    const electron = (window as any).electron;
    if (electron) {
      electron.on('app-version', (v: string) => setCurrentAppVersion(v));
      electron.on('sync-versions', (v: any) => setRemoteVersions(v));
      electron.on('update-available', handleUpdateDetection);
      electron.on('update-not-available', () => {
        if (manualCheckRef.current) toast.success("Você já está na versão sincronizada!");
        manualCheckRef.current = false;
      });
      electron.on('update-downloading', (p: any) => setDownloadProgress(p.percent));
      electron.on('update-ready', () => {
        setUpdateReady(true);
        setDownloadProgress(100);
        toast.success("Download pronto!");
      });
      return () => electron.removeAllListeners('update-available');
    }
  }, [handleUpdateDetection]);

  const handleSchemaLoaded = (loadedSchema: DatabaseSchema, creds: DbCredentials) => {
    setSchema(loadedSchema);
    setCredentials(creds);
    if (loadedSchema.connectionSource === 'simulated') setSimulationData(initializeSimulation(loadedSchema));
    setGlobalStep('query');
    updateActiveTab(() => ({ currentStep: 'builder' }));
  };

  const handleGenerateSql = async () => {
    if (!schema) return;
    const currentGenId = ++generationIdRef.current;
    updateActiveTab(() => ({ isGenerating: true }));
    
    try {
      let result = settings.enableAiGeneration 
        ? await generateSqlFromBuilderState(schema, activeTab.builderState, settings.enableAiTips)
        : generateLocalSql(schema, activeTab.builderState);
      
      if (currentGenId !== generationIdRef.current) return;

      updateActiveTab(() => ({ 
        queryResult: result, 
        currentStep: 'preview', 
        isGenerating: false 
      }));
    } catch (error: any) { 
      if (currentGenId !== generationIdRef.current) return;
      updateActiveTab(() => ({ isGenerating: false }));
      toast.error(error.message || "Erro ao gerar SQL"); 
    }
  };

  const handleExecuteQuery = async (sqlOverride?: string) => {
    if (!credentials || !schema) return;
    const sqlToRun = sqlOverride || activeTab.queryResult?.sql;
    if (!sqlToRun) return;
    updateActiveTab(() => ({ isExecuting: true }));
    try {
       let data = credentials.host === 'simulated'
          ? executeOfflineQuery(schema, simulationData, activeTab.builderState)
          : await executeQueryReal(credentials, sqlToRun);
       updateActiveTab(() => ({ 
         executionResult: data, 
         currentStep: 'results', 
         isExecuting: false,
         resultsState: { ...INITIAL_RESULTS_STATE } // Resetar estado visual para novos dados
       }));
    } catch (error: any) { 
      updateActiveTab(() => ({ isExecuting: false }));
      toast.error(error.message || "Falha na execução"); 
    }
  };

  const handleSidebarNavigate = (step: AppStep) => {
    if (['builder', 'preview', 'results', 'queryflow'].includes(step)) {
      setGlobalStep('query');
      updateActiveTab(() => ({ currentStep: step as AppStep }));
    } else {
      setGlobalStep(step);
    }
  };

  if (!isHydrated) {
      return (
          <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-indigo-400">
              <Loader2 className="w-12 h-12 animate-spin mb-4" />
              <span className="text-xs font-black uppercase tracking-[0.3em]">Restaurando Sessão...</span>
          </div>
      );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-500">
      <Toaster position="top-right" />
      
      <Sidebar 
        currentStep={globalStep === 'query' ? activeTab.currentStep : globalStep} 
        onNavigate={handleSidebarNavigate} schema={schema} hasResults={activeTab.executionResult.length > 0}
        onOpenSettings={() => { setSettingsTab('interface'); setShowSettings(true); }} onOpenDiagram={() => setShowDiagram(true)}
        onOpenHistory={() => setShowHistory(true)} onOpenShortcuts={() => setShowShortcuts(true)}
        onOpenCheatSheet={() => setShowCheatSheet(true)} onOpenVirtualRelations={() => setShowVirtualRelations(true)}
        onOpenLogAnalyzer={() => setShowLogAnalyzer(true)} onOpenTemplates={() => setShowTemplates(true)}
        onOpenSqlExtractor={() => setShowSqlExtractor(true)} 
        onCheckUpdate={() => { 
          const electron = (window as any).electron;
          if (electron) { manualCheckRef.current = true; electron.send('check-update', settings.updateBranch); }
        }}
      />
      
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {globalStep === 'query' && (
          <TabBar 
            tabs={tabs} 
            activeTabId={activeTabId} 
            onSwitch={setActiveTabId} 
            onClose={handleCloseTab} 
            onAdd={handleAddTab} 
          />
        )}
        
        <div className="flex-1 overflow-hidden h-full relative">
           <AnimatePresence mode="popLayout">
             <motion.div
               key={`${globalStep}-${activeTabId}-${activeTab.currentStep}`}
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               transition={{ duration: 0.15, ease: "linear" }}
               className="h-full w-full absolute top-0 left-0 p-6"
             >
               {globalStep === 'connection' && <ConnectionStep onSchemaLoaded={handleSchemaLoaded} settings={settings} />}
               {globalStep === 'query' && activeTab.currentStep === 'builder' && schema && (
                  <BuilderStep 
                    schema={schema} state={activeTab.builderState} 
                    onStateChange={(s) => updateActiveTab(() => ({ builderState: s }))} 
                    onGenerate={handleGenerateSql} isGenerating={activeTab.isGenerating} 
                    settings={settings} 
                  />
               )}
               {globalStep === 'query' && activeTab.currentStep === 'queryflow' && schema && (
                  <VisualQueryFlowStep schema={schema} state={activeTab.builderState} />
               )}
               {globalStep === 'query' && activeTab.currentStep === 'preview' && activeTab.queryResult && (
                  <PreviewStep 
                    queryResult={activeTab.queryResult} onExecute={handleExecuteQuery} 
                    onBack={() => updateActiveTab(() => ({ currentStep: 'builder' }))} 
                    isExecuting={activeTab.isExecuting} isValidating={false} schema={schema || undefined} settings={settings} credentials={credentials} />
               )}
               {globalStep === 'query' && activeTab.currentStep === 'results' && (
                  <ResultsStep 
                    data={activeTab.executionResult} sql={activeTab.queryResult?.sql || ''} 
                    onBackToBuilder={() => updateActiveTab(() => ({ currentStep: 'builder' }))} 
                    onNewConnection={() => setGlobalStep('connection')} settings={settings} 
                    onShowToast={(m) => toast(m)} credentials={credentials} schema={schema || undefined} 
                    resultsState={activeTab.resultsState} onResultsStateChange={updateActiveResultsState}
                  />
               )}
               {globalStep === 'datadiff' && schema && <DataDiffStep schema={schema} credentials={credentials} simulationData={simulationData} settings={settings} />}
               {globalStep === 'dashboard' && <DashboardStep items={dashboardItems} onRemoveItem={(id) => setDashboardItems(prev => prev.filter(i => i.id !== id))} onClearAll={() => setDashboardItems([])} />}
               {globalStep === 'serverhealth' && <ServerHealthStep credentials={credentials} />}
               {globalStep === 'roadmap' && <RoadmapStep onNavigate={handleSidebarNavigate} />}
             </motion.div>
           </AnimatePresence>
        </div>
      </main>

      {showSettings && <SettingsModal settings={settings} onSave={setSettings} onClose={() => setShowSettings(false)} simulationData={simulationData} schema={schema} credentials={credentials} remoteVersions={remoteVersions} initialTab={settingsTab} />}
      {showDiagram && schema && <SchemaDiagramModal schema={schema} onClose={() => setShowDiagram(false)} credentials={credentials} />}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} onLoadQuery={sql => { updateActiveTab(() => ({ queryResult: { sql, explanation: '', tips: [] }, currentStep: 'preview' })); setGlobalStep('query'); }} />}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showCheatSheet && <SqlCheatSheetModal onClose={() => setShowCheatSheet(false)} />}
      {showVirtualRelations && schema && <VirtualRelationsModal schema={schema} existingRelations={virtualRelations} onAddRelation={r => setVirtualRelations(p => [...p, r])} onRemoveRelation={id => setVirtualRelations(p => p.filter(r => r.id !== id))} onClose={() => setShowVirtualRelations(false)} credentials={credentials} />}
      {showLogAnalyzer && schema && <LogAnalyzerModal schema={schema} onClose={() => setShowLogAnalyzer(false)} onRunSql={sql => { updateActiveTab(() => ({ queryResult: { sql, explanation: '', tips: [] }, currentStep: 'preview' })); setGlobalStep('query'); }} />}
      {showTemplates && <TemplateModal onClose={() => setShowTemplates(false)} onRunTemplate={sql => { updateActiveTab(() => ({ queryResult: { sql, explanation: '', tips: [] }, currentStep: 'preview' })); setGlobalStep('query'); }} />}
      {showSqlExtractor && <SqlExtractorModal onClose={() => setShowSqlExtractor(false)} onRunSql={sql => { updateActiveTab(() => ({ queryResult: { sql, explanation: '', tips: [] }, currentStep: 'preview' })); setGlobalStep('query'); }} settings={settings} />}
      {updateInfo && <UpdateModal updateInfo={updateInfo} downloadProgress={downloadProgress} isReady={updateReady} onClose={() => setUpdateInfo(null)} onStartDownload={() => { setDownloadProgress(0); (window as any).electron.send('start-download'); }} onInstall={() => (window as any).electron.send('install-update')} onIgnore={() => setUpdateInfo(null)} />}
    </div>
  );
};

export default App;
