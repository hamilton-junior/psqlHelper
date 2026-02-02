import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  DatabaseSchema, AppStep, BuilderState, QueryResult, DbCredentials, 
  AppSettings, DEFAULT_SETTINGS, VirtualRelation, DashboardItem
} from './types';
import { Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import ConnectionStep from '@/components/steps/ConnectionStep';
import BuilderStep from '@/components/steps/BuilderStep';
import PreviewStep from '@/components/steps/PreviewStep';
import ResultsStep from '@/components/steps/ResultsStep';
import DataDiffStep from '@/components/steps/DataDiffStep';
import DashboardStep from '@/components/steps/DashboardStep';
import RoadmapStep from '@/components/steps/RoadmapStep';
import ServerHealthStep from '@/components/steps/ServerHealthStep';
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
  const [showKeyPrompt, setShowKeyPrompt] = useState(false);
  
  const [updateInfo, setUpdateInfo] = useState<{version: string, notes: string, branch?: string, updateType?: 'upgrade' | 'downgrade', currentVersion?: string, isManual?: boolean} | null>(null);
  const [remoteVersions, setRemoteVersions] = useState<{ stable: string; wip: string; bleedingEdge: string; totalCommits?: number } | null>(null);
  const [currentAppVersion, setCurrentAppVersion] = useState<string>('...');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const manualCheckRef = useRef(false);

  // Ref para controle de concorrência na geração de IA
  const generationIdRef = useRef(0);

  // Monitor de navegação para Logs
  useEffect(() => {
    console.log(`[NAVIGATION] Mudando para o step: ${currentStep.toUpperCase()} | Pure Cross-fade Speed: 150ms`);
  }, [currentStep]);

  // --- PERSISTÊNCIA EM DISCO (ELECTRON) ---
  
  useEffect(() => {
    const hydrateFromDisk = async () => {
        const electron = (window as any).electron;
        if (electron && electron.invoke) {
            console.log("[PERSISTENCE] Iniciando restauração de dados do disco...");
            try {
                const diskData = await electron.invoke('get-persistent-store');
                if (diskData && Object.keys(diskData).length > 0) {
                    Object.entries(diskData).forEach(([key, val]) => {
                        localStorage.setItem(key, val as string);
                    });
                    console.log(`[PERSISTENCE] ${Object.keys(diskData).length} chaves restauradas com sucesso.`);
                    
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
            console.log("[PERSISTENCE] Sync automático localStorage -> Disco executado.");
        }
    };

    const timer = setTimeout(syncToDisk, 2000); 
    return () => clearTimeout(timer);
  }, [settings, dashboardItems, virtualRelations, executionResult, isHydrated]);

  useEffect(() => {
    if (settings.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('psqlBuddy-settings', JSON.stringify(settings));
  }, [settings.theme, settings]);

  const handleUpdateDetection = useCallback((info: any) => {
    const ignoredVersions = JSON.parse(localStorage.getItem('psqlBuddy-ignored-versions') || '[]');
    const isManual = manualCheckRef.current || info.isManual;
    const type = info.updateType || (compareVersions(info.version, currentAppVersion) < 0 ? 'downgrade' : 'upgrade');
    if (type === 'downgrade') toast("Aviso: Downgrade disponível", { icon: '⚠️' });
    else toast("Nova atualização encontrada!", { icon: '✨' });
    if (isManual || !ignoredVersions.includes(info.version)) {
      setUpdateInfo({
        version: info.version,
        notes: info.releaseNotes || (type === 'downgrade' ? 'Uma versão anterior foi solicitada ou está disponível para restauração.' : 'Novas melhorias e correções disponíveis.'),
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
        if (manualCheckRef.current) toast.success("Você já está na versão sincronizada!");
        manualCheckRef.current = false;
        setUpdateInfo(null);
      });
      electron.on('update-downloading', (p: any) => setDownloadProgress(p.percent));
      electron.on('update-ready', () => {
        setUpdateReady(true);
        setDownloadProgress(100);
        toast.success("Download pronto!");
      });
      electron.on('update-error', (msg: string) => {
        if (manualCheckRef.current) toast.error("Falha ao verificar alterações.");
        manualCheckRef.current = false;
        setDownloadProgress(null);
      });
      return () => electron.removeAllListeners('update-available');
    }
  }, [handleUpdateDetection]);

  const handleStartDownload = () => {
    const electron = (window as any).electron;
    if (electron) { 
      setDownloadProgress(0); 
      electron.send('start-download');
      toast.loading("Iniciando transferência...");
    }
  };

  const handleSchemaLoaded = (loadedSchema: DatabaseSchema, creds: DbCredentials) => {
    console.log(`[SCHEMA_LOADED] Novo schema detectado: ${loadedSchema.name}`);
    setSchema(loadedSchema);
    setCredentials(creds);
    if (loadedSchema.connectionSource === 'simulated') setSimulationData(initializeSimulation(loadedSchema));
    setCurrentStep('builder');
  };

  const checkApiKey = useCallback(() => {
    if (!settings.geminiApiKey || settings.geminiApiKey.trim() === '') {
       console.log("[APP] API Key faltando no localStorage. Verificando ambiente...");
       if (!process.env.API_KEY) {
          setShowKeyPrompt(true);
          return false;
       }
    }
    return true;
  }, [settings.geminiApiKey]);

  const handleGenerateSql = async () => {
    if (!schema) return;
    if (settings.enableAiGeneration && !checkApiKey()) return;

    const currentGenId = ++generationIdRef.current;
    setIsGenerating(true);
    console.log(`[AI_GEN] Iniciando geração (ID: ${currentGenId}) via Gemini...`);
    
    try {
      let result = settings.enableAiGeneration 
        ? await generateSqlFromBuilderState(schema, builderState, settings.enableAiTips)
        : generateLocalSql(schema, builderState);
      
      // Se o ID mudou, o usuário pulou ou iniciou outra geração
      if (currentGenId !== generationIdRef.current) {
        console.log(`[AI_GEN] Geração ID ${currentGenId} descartada (ID atual: ${generationIdRef.current}).`);
        return;
      }

      setQueryResult(result);
      setCurrentStep('preview');
      console.log("[AI_GEN] Geração concluída.");
    } catch (error: any) { 
      if (currentGenId !== generationIdRef.current) return;
      
      console.error("[AI_GEN] Erro na geração:", error);
      if (error.message === 'MISSING_API_KEY') {
        setShowKeyPrompt(true);
      } else {
        toast.error(error.message || "Erro ao gerar SQL"); 
      }
    }
    finally { 
      if (currentGenId === generationIdRef.current) {
        setIsGenerating(false); 
      }
    }
  };

  // Função para pular a geração por IA e usar lógica local determinística
  const handleSkipAi = useCallback(() => {
    if (!schema) return;
    console.log(`[BUILDER] Usuário optou por pular IA. Invalidando geração ID: ${generationIdRef.current}`);
    
    // Incrementa o ID para que a promessa da IA em curso seja ignorada ao retornar
    generationIdRef.current++;
    setIsGenerating(false);
    
    const result = generateLocalSql(schema, builderState);
    setQueryResult(result);
    setCurrentStep('preview');
    // Corrigido: toast.info não existe no react-hot-toast. Usando chamada base com ícone.
    toast("Geração por IA interrompida. Usando lógica local.", { icon: 'ℹ️' });
  }, [schema, builderState]);

  const handleExecuteQuery = async (sqlOverride?: string) => {
    if (!credentials || !schema) return;
    const sqlToRun = sqlOverride || queryResult?.sql;
    if (!sqlToRun) return;
    setIsExecuting(true);
    console.log("[DB_EXEC] Executando query no banco...");
    try {
       let data = credentials.host === 'simulated'
          ? executeOfflineQuery(schema, simulationData, builderState)
          : await executeQueryReal(credentials, sqlToRun);
       setExecutionResult(data);
       setCurrentStep('results');
       console.log(`[DB_EXEC] Sucesso. ${data.length} linhas retornadas.`);
    } catch (error: any) { 
      console.error("[DB_EXEC] Falha na execução:", error);
      toast.error(error.message || "Falha na execução"); 
    }
    finally { setIsExecuting(false); }
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
      
      {showKeyPrompt && (
        <Dialog 
          isOpen={true}
          type="prompt"
          title="Configuração de IA Necessária"
          message="Para utilizar as funções de Inteligência Artificial, você precisa configurar sua API Key do Gemini. Deseja ir para a tela de configurações agora?"
          confirmLabel="Ir para Configurações"
          cancelLabel="Agora não"
          onConfirm={() => {
             setSettingsTab('ai');
             setShowSettings(true);
             setShowKeyPrompt(false);
          }}
          onClose={() => setShowKeyPrompt(false)}
        />
      )}

      <Sidebar 
        currentStep={currentStep} onNavigate={setCurrentStep} schema={schema} hasResults={executionResult.length > 0}
        onOpenSettings={() => { setSettingsTab('interface'); setShowSettings(true); }} onOpenDiagram={() => setShowDiagram(true)}
        onOpenHistory={() => setShowHistory(true)} onOpenShortcuts={() => setShowShortcuts(true)}
        onOpenCheatSheet={() => setShowCheatSheet(true)} onOpenVirtualRelations={() => setShowVirtualRelations(true)}
        onOpenLogAnalyzer={() => setShowLogAnalyzer(true)} onOpenTemplates={() => setShowTemplates(true)}
        onOpenSqlExtractor={() => setShowSqlExtractor(true)} 
        onCheckUpdate={() => { 
          const electron = (window as any).electron;
          if (electron) {
            manualCheckRef.current = true; 
            electron.send('check-update', settings.updateBranch); 
          }
        }}
      />
      <main className="flex-1 overflow-hidden relative flex flex-col">
        <div className="flex-1 overflow-hidden h-full relative">
           <AnimatePresence mode="popLayout">
             <motion.div
               key={currentStep}
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               transition={{ duration: 0.15, ease: "linear" }}
               className="h-full w-full absolute top-0 left-0 p-6"
             >
               {currentStep === 'connection' && <ConnectionStep onSchemaLoaded={handleSchemaLoaded} settings={settings} />}
               {currentStep === 'builder' && schema && (
                  <BuilderStep 
                    schema={schema} 
                    state={builderState} 
                    onStateChange={setBuilderState} 
                    onGenerate={handleGenerateSql} 
                    onSkipAi={handleSkipAi}
                    isGenerating={isGenerating} 
                    settings={settings} 
                  />
               )}
               {currentStep === 'preview' && queryResult && (
                  <PreviewStep queryResult={queryResult} onExecute={handleExecuteQuery} onBack={() => setCurrentStep('builder')} isExecuting={isExecuting} isValidating={false} schema={schema || undefined} settings={settings} />
               )}
               {currentStep === 'results' && (
                  <ResultsStep data={executionResult} sql={queryResult?.sql || ''} onBackToBuilder={() => setCurrentStep('builder')} onNewConnection={() => setCurrentStep('connection')} settings={settings} onShowToast={(m) => toast(m)} credentials={credentials} schema={schema || undefined} />
               )}
               {currentStep === 'datadiff' && schema && <DataDiffStep schema={schema} credentials={credentials} simulationData={simulationData} settings={settings} />}
               {currentStep === 'dashboard' && <DashboardStep items={dashboardItems} onRemoveItem={(id) => setDashboardItems(prev => prev.filter(i => i.id !== id))} onClearAll={() => setDashboardItems([])} />}
               {currentStep === 'serverhealth' && <ServerHealthStep credentials={credentials} />}
               {currentStep === 'roadmap' && <RoadmapStep onNavigate={setCurrentStep} />}
             </motion.div>
           </AnimatePresence>
        </div>
      </main>
      {showSettings && <SettingsModal settings={settings} onSave={setSettings} onClose={() => setShowSettings(false)} simulationData={simulationData} schema={schema} credentials={credentials} remoteVersions={remoteVersions} initialTab={settingsTab} />}
      {showDiagram && schema && <SchemaDiagramModal schema={schema} onClose={() => setShowDiagram(false)} credentials={credentials} />}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} onLoadQuery={sql => { setQueryResult({sql, explanation:'', tips:[]}); setCurrentStep('preview'); }} />}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showCheatSheet && <SqlCheatSheetModal onClose={() => setShowCheatSheet(false)} />}
      {showVirtualRelations && schema && <VirtualRelationsModal schema={schema} existingRelations={virtualRelations} onAddRelation={r => setVirtualRelations(p => [...p, r])} onRemoveRelation={id => setVirtualRelations(p => p.filter(r => r.id !== id))} onClose={() => setShowVirtualRelations(false)} credentials={credentials} />}
      {showLogAnalyzer && schema && <LogAnalyzerModal schema={schema} onClose={() => setShowLogAnalyzer(false)} onRunSql={sql => { setQueryResult({sql, explanation:'', tips:[]}); setCurrentStep('preview'); }} />}
      {showTemplates && <TemplateModal onClose={() => setShowTemplates(false)} onRunTemplate={sql => { setQueryResult({sql, explanation:'', tips:[]}); setCurrentStep('preview'); }} />}
      {showSqlExtractor && <SqlExtractorModal onClose={() => setShowSqlExtractor(false)} onRunSql={sql => { setQueryResult({sql, explanation:'', tips:[]}); setCurrentStep('preview'); }} settings={settings} />}
      {updateInfo && (
        <UpdateModal 
          updateInfo={updateInfo} 
          downloadProgress={downloadProgress} 
          isReady={updateReady} 
          onClose={() => setUpdateInfo(null)} 
          onStartDownload={handleStartDownload} 
          onInstall={() => {
            const electron = (window as any).electron;
            if (electron) electron.send('install-update');
          }} 
          onIgnore={() => { 
            const ign = JSON.parse(localStorage.getItem('psqlBuddy-ignored-versions') || '[]'); 
            ign.push(updateInfo.version); 
            localStorage.setItem('psqlBuddy-ignored-versions', JSON.stringify(ign)); 
            setUpdateInfo(null); 
          }} 
        />
      )}
    </div>
  );
};

export default App;