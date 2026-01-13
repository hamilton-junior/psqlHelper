import React, { useState, useEffect, useRef } from 'react';
import { 
  DatabaseSchema, AppStep, BuilderState, QueryResult, DbCredentials, 
  AppSettings, DEFAULT_SETTINGS, VirtualRelation, DashboardItem
} from './types';
import { Rocket } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ConnectionStep from './components/steps/ConnectionStep';
import BuilderStep from './components/steps/BuilderStep';
import PreviewStep from './components/steps/PreviewStep';
import ResultsStep from './components/steps/ResultsStep';
import DataDiffStep from './components/steps/DataDiffStep';
import DashboardStep from './components/steps/DashboardStep';
import RoadmapStep from './components/steps/RoadmapStep';
import SettingsModal from './components/SettingsModal';
import SchemaDiagramModal from './components/SchemaDiagramModal';
import HistoryModal from './components/HistoryModal';
import ShortcutsModal from './components/ShortcutsModal';
import SqlCheatSheetModal from './components/SqlCheatSheetModal';
import VirtualRelationsModal from './components/VirtualRelationsModal';
import LogAnalyzerModal from './components/LogAnalyzerModal';
import TemplateModal from './components/TemplateModal';
import SqlExtractorModal from './components/SqlExtractorModal';
import UpdateModal from './components/UpdateModal';
import { generateSqlFromBuilderState } from './services/geminiService';
import { generateLocalSql } from './services/localSqlService';
import { executeQueryReal } from './services/dbService';
import { executeOfflineQuery, initializeSimulation, SimulationData } from './services/simulationService';
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

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>('connection');
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [credentials, setCredentials] = useState<DbCredentials | null>(null);
  const [simulationData, setSimulationData] = useState<SimulationData>({});
  const [builderState, setBuilderState] = useState<BuilderState>(INITIAL_BUILDER_STATE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [executionResult, setExecutionResult] = useState<any[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem('psqlBuddy-settings');
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  const [dashboardItems, setDashboardItems] = useState<DashboardItem[]>(() => {
    try {
      const stored = localStorage.getItem('psqlBuddy-dashboard');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Modal Visibility States
  const [showSettings, setShowSettings] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [showVirtualRelations, setShowVirtualRelations] = useState(false);
  const [showLogAnalyzer, setShowLogAnalyzer] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSqlExtractor, setShowSqlExtractor] = useState(false);
  const [virtualRelations, setVirtualRelations] = useState<VirtualRelation[]>([]);
  
  // Update States
  const [updateInfo, setUpdateInfo] = useState<{version: string, notes: string, branch?: string, updateType?: 'upgrade'|'downgrade', currentVersion?: string} | null>(null);
  const [remoteVersions, setRemoteVersions] = useState<{stable: string, main: string} | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const manualCheckRef = useRef(false);

  useEffect(() => {
    if (settings.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('psqlBuddy-settings', JSON.stringify(settings));
  }, [settings.theme, settings.updateBranch]);

  useEffect(() => {
    localStorage.setItem('psqlBuddy-dashboard', JSON.stringify(dashboardItems));
  }, [dashboardItems]);

  // Listener para IPC do Electron (Atualização)
  useEffect(() => {
    const electron = (window as any).electron;
    if (electron) {
      const handleUpdateResult = (res: any) => {
        console.log("%c[UPDATE-IPC] Objeto recebido:", "color: #6366f1; font-weight: bold;", res);
        const { comparison, remoteVersion, localVersion, notes, branch } = res;
        const isManual = manualCheckRef.current;
        manualCheckRef.current = false;

        const ignoredVersionsStr = localStorage.getItem('psqlBuddy-ignored-downgrades') || '[]';
        const ignoredVersions = JSON.parse(ignoredVersionsStr);

        if (comparison === 'newer') {
          setUpdateInfo({ version: remoteVersion, notes, branch, updateType: 'upgrade', currentVersion: localVersion });
          toast.success(`Nova versão disponível: v${remoteVersion}`, { id: 'update-toast' });
        } else if (comparison === 'older') {
          // Se o usuário já rejeitou essa versão específica de downgrade, não mostramos novamente a não ser que seja manual
          if (!isManual && ignoredVersions.includes(remoteVersion)) {
            console.log(`[UPDATE] Downgrade para v${remoteVersion} ignorado pelo usuário.`);
            setUpdateInfo(null);
            return;
          }
          setUpdateInfo({ version: remoteVersion, notes, branch, updateType: 'downgrade', currentVersion: localVersion });
          if (isManual) {
            toast(`Versão local (v${localVersion}) é mais recente que v${remoteVersion}.`, { id: 'update-toast', icon: '✅' });
          }
        } else {
          // Versões iguais
          setUpdateInfo(null);
          if (isManual) {
            toast.success("O aplicativo já está atualizado.", { id: 'update-toast' });
          } else {
            toast.dismiss('update-toast');
          }
        }
      };

      const handleUpdateError = (err: any) => {
        console.error("[UPDATE-IPC] Erro:", err);
        manualCheckRef.current = false;
        toast.error(`Falha ao buscar atualizações: ${err.message}`, { id: 'update-toast' });
      };

      electron.on('update-check-result', handleUpdateResult);
      electron.on('update-error', handleUpdateError);
      electron.on('sync-versions', (v: any) => {
        setRemoteVersions(v);
      });
      electron.on('update-downloading', (p: any) => {
        setDownloadProgress(p.percent);
      });
      electron.on('update-ready', () => {
        setUpdateReady(true);
        toast.success("Download concluído! Pronto para instalar.", { id: 'update-toast' });
      });
      
      // Auto-check on mount
      electron.send('check-update', settings.updateBranch);

      return () => {
         electron.removeAllListeners('update-check-result');
         electron.removeAllListeners('update-error');
         electron.removeAllListeners('sync-versions');
         electron.removeAllListeners('update-downloading');
         electron.removeAllListeners('update-ready');
      }
    }
  }, [settings.updateBranch]);

  const handleCheckUpdate = () => {
    const electron = (window as any).electron;
    if (electron) {
      manualCheckRef.current = true;
      toast.loading("Verificando GitHub...", { id: 'update-toast' });
      electron.send('check-update', settings.updateBranch);
    } else {
      toast.error("Atualizações automáticas disponíveis apenas no Desktop.");
    }
  };

  const handleIgnoreUpdate = (version: string) => {
    console.log(`[UPDATE] Ignorando versão ${version}.`);
    const ignoredVersionsStr = localStorage.getItem('psqlBuddy-ignored-downgrades') || '[]';
    const ignoredVersions = JSON.parse(ignoredVersionsStr);
    if (!ignoredVersions.includes(version)) {
      ignoredVersions.push(version);
      localStorage.setItem('psqlBuddy-ignored-downgrades', JSON.stringify(ignoredVersions));
    }
    setUpdateInfo(null);
  };

  const handleStartDownload = () => {
    const electron = (window as any).electron;
    if (electron) {
      setDownloadProgress(0);
      electron.send('start-download');
    }
  };

  const handleInstallUpdate = () => {
    const electron = (window as any).electron;
    if (electron) {
      console.log("[UPDATE] Iniciando reinício para instalação...");
      electron.send('install-update');
    }
  };

  const handleSchemaLoaded = (loadedSchema: DatabaseSchema, creds: DbCredentials) => {
    setSchema(loadedSchema);
    setCredentials(creds);
    if (loadedSchema.connectionSource === 'simulated') setSimulationData(initializeSimulation(loadedSchema));
    setCurrentStep('builder');
  };

  const handleGenerateSql = async () => {
    if (!schema) return;
    setIsGenerating(true);
    try {
      let result: QueryResult;
      if (settings.enableAiGeneration) {
         result = await generateSqlFromBuilderState(schema, builderState, settings.enableAiTips);
      } else {
         result = generateLocalSql(schema, builderState);
      }
      setQueryResult(result);
      setCurrentStep('preview');
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar SQL");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteQuery = async (sqlOverride?: string) => {
    if (!credentials || !schema) return;
    const sqlToRun = sqlOverride || queryResult?.sql;
    if (!sqlToRun) return;
    setIsExecuting(true);
    try {
       let data: any[] = [];
       if (credentials.host === 'simulated') {
          data = executeOfflineQuery(schema, simulationData, builderState);
          await new Promise(r => setTimeout(r, 600));
       } else {
          data = await executeQueryReal(credentials, sqlToRun);
       }
       setExecutionResult(data);
       setCurrentStep('results');
    } catch (error: any) {
       toast.error(error.message || "Erro na execução");
    } finally {
       setIsExecuting(false);
    }
  };

  const handleRunSqlExternal = (sql: string) => {
    setQueryResult({ sql, explanation: 'Carregado de ferramenta externa.', tips: [] });
    setCurrentStep('preview');
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-500">
      <Toaster position="top-right" />
      
      <Sidebar 
        currentStep={currentStep} 
        onNavigate={setCurrentStep} 
        schema={schema} 
        hasResults={executionResult.length > 0}
        onOpenSettings={() => setShowSettings(true)} 
        onOpenDiagram={() => setShowDiagram(true)}
        onOpenHistory={() => setShowHistory(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
        onOpenCheatSheet={() => setShowCheatSheet(true)}
        onOpenVirtualRelations={() => setShowVirtualRelations(true)}
        onOpenLogAnalyzer={() => setShowLogAnalyzer(true)}
        onOpenTemplates={() => setShowTemplates(true)}
        onOpenSqlExtractor={() => setShowSqlExtractor(true)}
        onCheckUpdate={handleCheckUpdate}
      />

      <main className="flex-1 overflow-hidden relative flex flex-col">
        <div className="flex-1 p-6 overflow-hidden h-full">
           {currentStep === 'connection' && <ConnectionStep onSchemaLoaded={handleSchemaLoaded} settings={settings} />}
           {currentStep === 'builder' && schema && (
              <BuilderStep schema={schema} state={builderState} onStateChange={setBuilderState} onGenerate={handleGenerateSql} isGenerating={isGenerating} settings={settings} />
           )}
           {currentStep === 'preview' && queryResult && (
              <PreviewStep queryResult={queryResult} onExecute={handleExecuteQuery} onBack={() => setCurrentStep('builder')} isExecuting={isExecuting} isValidating={false} schema={schema || undefined} />
           )}
           {currentStep === 'results' && (
              <ResultsStep data={executionResult} sql={queryResult?.sql || ''} onBackToBuilder={() => setCurrentStep('builder')} onNewConnection={() => setCurrentStep('connection')} settings={settings} onShowToast={(m) => toast(m)} credentials={credentials} schema={schema || undefined} />
           )}
           {currentStep === 'datadiff' && schema && <DataDiffStep schema={schema} credentials={credentials} simulationData={simulationData} settings={settings} />}
           {currentStep === 'dashboard' && (
              <DashboardStep 
                items={dashboardItems} 
                onRemoveItem={(id) => setDashboardItems(prev => prev.filter(i => i.id !== id))} 
                onClearAll={() => setDashboardItems([])} 
              />
           )}
           {currentStep === 'roadmap' && <Rocket className="w-8 h-8 text-indigo-600 animate-bounce" />}
        </div>
      </main>

      {/* Modals */}
      {showSettings && (
        <SettingsModal 
          settings={settings} 
          onSave={setSettings} 
          onClose={() => setShowSettings(false)} 
          simulationData={simulationData} 
          schema={schema} 
          credentials={credentials} 
          remoteVersions={remoteVersions}
        />
      )}
      
      {showDiagram && schema && (
        <SchemaDiagramModal schema={schema} onClose={() => setShowDiagram(false)} credentials={credentials} />
      )}
      
      {showHistory && (
        <HistoryModal onClose={() => setShowHistory(false)} onLoadQuery={handleRunSqlExternal} />
      )}
      
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      
      {showCheatSheet && <SqlCheatSheetModal onClose={() => setShowCheatSheet(false)} />}
      
      {showVirtualRelations && schema && (
        <VirtualRelationsModal 
           schema={schema} 
           existingRelations={virtualRelations} 
           onAddRelation={(r) => setVirtualRelations(prev => [...prev, r])}
           onRemoveRelation={(id) => setVirtualRelations(prev => prev.filter(r => r.id !== id))}
           onClose={() => setShowVirtualRelations(false)}
           credentials={credentials}
        />
      )}
      
      {showLogAnalyzer && schema && (
        <LogAnalyzerModal schema={schema} onClose={() => setShowLogAnalyzer(false)} onRunSql={handleRunSqlExternal} />
      )}
      
      {showTemplates && (
        <TemplateModal onClose={() => setShowTemplates(false)} onRunTemplate={handleRunSqlExternal} />
      )}
      
      {showSqlExtractor && (
        <SqlExtractorModal onClose={() => setShowSqlExtractor(false)} onRunSql={handleRunSqlExternal} settings={settings} />
      )}
      
      {updateInfo && (
        <UpdateModal 
          updateInfo={updateInfo} 
          downloadProgress={downloadProgress} 
          isReady={updateReady} 
          onClose={() => setUpdateInfo(null)} 
          onStartDownload={handleStartDownload}
          onInstall={handleInstallUpdate} 
          onIgnore={() => handleIgnoreUpdate(updateInfo.version)}
        />
      )}
    </div>
  );
};

export default App;