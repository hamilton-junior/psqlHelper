
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  DatabaseSchema, AppStep, BuilderState, QueryResult, DbCredentials, 
  AppSettings, DEFAULT_SETTINGS, VirtualRelation, DashboardItem
} from './types';
import { Rocket } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import ConnectionStep from '@/components/steps/ConnectionStep';
import BuilderStep from '@/components/steps/BuilderStep';
import PreviewStep from '@/components/steps/PreviewStep';
import ResultsStep from '@/components/steps/ResultsStep';
import DataDiffStep from '@/components/steps/DataDiffStep';
import DashboardStep from '@/components/steps/DashboardStep';
import RoadmapStep from '@/components/steps/RoadmapStep';
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

function compareVersions(v1: string, v2: string) {
  if (!v1 || v1 === '...' || !v2 || v2 === '...') return 0;
  const p1 = v1.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = v2.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

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
  
  const [updateInfo, setUpdateInfo] = useState<{version: string, notes: string, branch?: string, updateType?: 'upgrade' | 'downgrade', currentVersion?: string, isManual?: boolean} | null>(null);
  const [remoteVersions, setRemoteVersions] = useState<{stable: string, main: string} | null>(null);
  const [currentAppVersion, setCurrentAppVersion] = useState<string>('...');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const manualCheckRef = useRef(false);

  useEffect(() => {
    if (settings.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('psqlBuddy-settings', JSON.stringify(settings));
  }, [settings.theme]);

  const handleUpdateDetection = useCallback((info: any) => {
    const ignoredVersions = JSON.parse(localStorage.getItem('psqlBuddy-ignored-versions') || '[]');
    const isManual = manualCheckRef.current || info.isManual;
    
    // Se o backend já enviou o tipo, usamos ele. Senão, calculamos.
    const type = info.updateType || (compareVersions(info.version, currentAppVersion) < 0 ? 'downgrade' : 'upgrade');

    if (currentAppVersion !== '...' && compareVersions(info.version, currentAppVersion) === 0) {
      console.log("[APP] Mesma versão detectada. Ignorando aviso.");
      manualCheckRef.current = false;
      return;
    }

    if (isManual || !ignoredVersions.includes(info.version)) {
      setUpdateInfo({
        version: info.version,
        notes: info.releaseNotes || (type === 'downgrade' ? 'Versão de recuperação disponível.' : 'Novas melhorias e correções.'),
        branch: info.branch || (settings.updateBranch === 'main' ? 'Main' : 'Stable'),
        updateType: type as 'upgrade' | 'downgrade',
        currentVersion: currentAppVersion,
        isManual: !!isManual
      });
    }
    manualCheckRef.current = false;
  }, [settings.updateBranch, currentAppVersion]);

  useEffect(() => {
    const electron = (window as any).electron;
    if (electron) {
      electron.on('app-version', (v: string) => setCurrentAppVersion(v));
      electron.on('sync-versions', (v: any) => setRemoteVersions(v));
      electron.on('update-available', handleUpdateDetection);
      electron.on('update-not-available', () => {
        if (manualCheckRef.current) toast.success("Sua versão está sincronizada!");
        manualCheckRef.current = false;
        setUpdateInfo(null);
      });
      electron.on('update-downloading', (p: any) => setDownloadProgress(p.percent));
      electron.on('update-ready', () => {
        setUpdateReady(true);
        setDownloadProgress(100);
        toast.success("Atualização pronta!");
      });
      electron.on('update-error', (msg: string) => {
        console.warn("[UI] Status Atualizador:", msg);
        setDownloadProgress(null);
        if (msg === "MANUAL_DOWNLOAD_TRIGGERED") {
           toast("Abrindo navegador para download manual...", { icon: '🌐' });
           setUpdateInfo(null);
        } else if (manualCheckRef.current) {
           toast.error("Erro no atualizador automático.");
        }
        manualCheckRef.current = false;
      });
      return () => electron.removeAllListeners('update-available');
    }
  }, [handleUpdateDetection]);

  const handleStartDownload = () => {
    const electron = (window as any).electron;
    if (electron) { 
      setDownloadProgress(0); 
      electron.send('start-download', settings.updateBranch);
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
      let result = settings.enableAiGeneration 
        ? await generateSqlFromBuilderState(schema, builderState, settings.enableAiTips)
        : generateLocalSql(schema, builderState);
      setQueryResult(result);
      setCurrentStep('preview');
    } catch (error: any) { toast.error(error.message || "Erro SQL"); }
    finally { setIsGenerating(false); }
  };

  const handleExecuteQuery = async (sqlOverride?: string) => {
    if (!credentials || !schema) return;
    const sqlToRun = sqlOverride || queryResult?.sql;
    if (!sqlToRun) return;
    setIsExecuting(true);
    try {
       let data = credentials.host === 'simulated'
          ? executeOfflineQuery(schema, simulationData, builderState)
          : await executeQueryReal(credentials, sqlToRun);
       setExecutionResult(data);
       setCurrentStep('results');
    } catch (error: any) { toast.error(error.message || "Erro execução"); }
    finally { setIsExecuting(false); }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-500">
      <Toaster position="top-right" />
      <Sidebar 
        currentStep={currentStep} onNavigate={setCurrentStep} schema={schema} hasResults={executionResult.length > 0}
        onOpenSettings={() => setShowSettings(true)} onOpenDiagram={() => setShowDiagram(true)}
        onOpenHistory={() => setShowHistory(true)} onOpenShortcuts={() => setShowShortcuts(true)}
        onOpenCheatSheet={() => setShowCheatSheet(true)} onOpenVirtualRelations={() => setShowVirtualRelations(true)}
        onOpenLogAnalyzer={() => setShowLogAnalyzer(true)} onOpenTemplates={() => setShowTemplates(true)}
        onOpenSqlExtractor={() => setShowSqlExtractor(true)} onCheckUpdate={() => { manualCheckRef.current = true; (window as any).electron.send('check-update', settings.updateBranch); }}
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
           {currentStep === 'dashboard' && <DashboardStep items={dashboardItems} onRemoveItem={(id) => setDashboardItems(prev => prev.filter(i => i.id !== id))} onClearAll={() => setDashboardItems([])} />}
           {currentStep === 'roadmap' && <RoadmapStep />}
        </div>
      </main>
      {showSettings && <SettingsModal settings={settings} onSave={setSettings} onClose={() => setShowSettings(false)} simulationData={simulationData} schema={schema} credentials={credentials} remoteVersions={remoteVersions} />}
      {showDiagram && schema && <SchemaDiagramModal schema={schema} onClose={() => setShowDiagram(false)} credentials={credentials} />}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} onLoadQuery={sql => { setQueryResult({sql, explanation:'', tips:[]}); setCurrentStep('preview'); }} />}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showCheatSheet && <SqlCheatSheetModal onClose={() => setShowCheatSheet(false)} />}
      {showVirtualRelations && schema && <VirtualRelationsModal schema={schema} existingRelations={virtualRelations} onAddRelation={r => setVirtualRelations(p => [...p, r])} onRemoveRelation={id => setVirtualRelations(p => p.filter(r => r.id !== id))} onClose={() => setShowVirtualRelations(false)} credentials={credentials} />}
      {showLogAnalyzer && schema && <LogAnalyzerModal schema={schema} onClose={() => setShowLogAnalyzer(false)} onRunSql={sql => { setQueryResult({sql, explanation:'', tips:[]}); setCurrentStep('preview'); }} />}
      {showTemplates && <TemplateModal onClose={() => setShowTemplates(false)} onRunTemplate={sql => { setQueryResult({sql, explanation:'', tips:[]}); setCurrentStep('preview'); }} />}
      {showSqlExtractor && <SqlExtractorModal onClose={() => setShowSqlExtractor(false)} onRunSql={sql => { setQueryResult({sql, explanation:'', tips:[]}); setCurrentStep('preview'); }} settings={settings} />}
      {updateInfo && <UpdateModal updateInfo={updateInfo} downloadProgress={downloadProgress} isReady={updateReady} onClose={() => setUpdateInfo(null)} onStartDownload={handleStartDownload} onInstall={() => (window as any).electron.send('install-update')} onIgnore={() => { const ign = JSON.parse(localStorage.getItem('psqlBuddy-ignored-versions') || '[]'); ign.push(updateInfo.version); localStorage.setItem('psqlBuddy-ignored-versions', JSON.stringify(ign)); setUpdateInfo(null); }} />}
    </div>
  );
};

export default App;
