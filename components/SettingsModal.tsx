import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Settings, Save, X, Bot, Zap, 
  ShieldCheck, Lightbulb, Clock, LayoutList, ListFilter, 
  AlertCircle, GraduationCap, PenTool, DatabaseZap, HeartPulse, 
  Activity, CheckCircle2, XCircle, RefreshCw, Play, 
  Bug, Loader2, Database, User, Server, Hash, Shield, Terminal, ZapOff, ActivitySquare,
  LayoutGrid, Monitor, Moon, Sun, ChevronRight, Gauge, GitCompare, GitBranch, FlaskConical, Tag, Info
} from 'lucide-react';
import { AppSettings, DatabaseSchema, DbCredentials } from '../types';
import { runFullHealthCheck, HealthStatus, runRandomizedStressTest, StressTestLog } from '../services/healthService';
import { SimulationData } from '../services/simulationService';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  onClose: () => void;
  quotaExhausted?: boolean;
  schema?: DatabaseSchema | null;
  credentials?: DbCredentials | null;
  simulationData?: SimulationData;
  remoteVersions?: { stable: string, main: string } | null;
}

type TabId = 'interface' | 'ai' | 'database' | 'diagnostics';

declare const __APP_VERSION__: string;
const CURRENT_APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.10';

/**
 * Utilitário visual para formatar a versão no padrão legível X.0Y.0Z
 */
const formatVersionDisplay = (v: string | undefined): string => {
  if (!v || v === '---') return '...';
  if (v === 'Erro') return 'Erro';
  
  const clean = v.replace(/^v/, '');
  const parts = clean.split('.');
  
  if (parts.length !== 3) return v;
  
  const major = parts[0];
  const minor = parts[1].padStart(2, '0');
  const patch = parts[2].padStart(2, '0');
  
  return `v${major}.${minor}.${patch}`;
};

export default function SettingsModal({ 
  settings, onSave, onClose, quotaExhausted,
  schema, credentials, simulationData = {}, remoteVersions
}: SettingsModalProps) {
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [activeTab, setActiveTab] = useState<TabId>('interface');
  const [healthResults, setHealthResults] = useState<HealthStatus[] | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  
  const [isStressing, setIsStressing] = useState(false);
  const [stressLogs, setStressLogs] = useState<StressTestLog[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const isConnected = !!schema;

  // Monitora a aba Diagnóstico para atualizar versões silenciosamente
  useEffect(() => {
    if (activeTab === 'diagnostics') {
      console.log("[SETTINGS] Aba diagnóstico ativa. Solicitando atualização silenciosa de versões...");
      if ((window as any).electron) {
        (window as any).electron.send('refresh-remote-versions');
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [stressLogs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleHealthCheck = async () => {
    setIsChecking(true);
    setHealthResults(null);
    try {
      const results = await runFullHealthCheck(credentials, schema);
      setHealthResults(results);
    } catch (e) {
      console.error("[SETTINGS] Health Check failed", e);
    } finally {
      setIsChecking(false);
    }
  };

  const handleRunStressTest = async () => {
    setIsStressing(true);
    setStressLogs([]);
    try {
      await runRandomizedStressTest(schema || null, simulationData, (newLog) => {
        setStressLogs(prev => [...prev, newLog]);
      });
    } catch (e) {
      console.error("[SETTINGS] Stress test failed", e);
    } finally {
      setIsStressing(false);
    }
  };

  const healthScore = useMemo(() => {
    if (!healthResults) return null;
    const total = healthResults.length;
    const success = healthResults.filter(r => r.status === 'success').length;
    return Math.round((success / total) * 100);
  }, [healthResults]);

  const Toggle = ({ checked, onChange, colorClass = "peer-checked:bg-indigo-600" }: { checked: boolean, onChange: (val: boolean) => void, colorClass?: string }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <div className={`w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${colorClass}`}></div>
    </label>
  );

  const TabButton = ({ id, label, icon: Icon }: { id: TabId, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
        activeTab === id 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{label}</span>
      {activeTab === id && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
    </button>
  );

  const getLatestVersionDisplay = () => {
    const latest = formData.updateBranch === 'stable' ? remoteVersions?.stable : remoteVersions?.main;
    
    if (!remoteVersions || latest === undefined || latest === '---') {
       return (
          <div className="flex items-center gap-2 text-slate-400">
             <Loader2 className="w-4 h-4 animate-spin" />
             <span className="text-xs font-bold uppercase tracking-tighter">Consultando...</span>
          </div>
       );
    }
    
    if (latest === "Erro") {
       return (
          <div className="flex items-center gap-2 text-rose-500">
             <XCircle className="w-4 h-4" />
             <span className="text-xs font-bold uppercase tracking-tighter">Falha na API</span>
          </div>
       );
    }

    return (
       <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
          {formatVersionDisplay(latest)}
       </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 font-sans animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        
        <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl">
                <Settings className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Preferências do Sistema</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Personalize sua experiência e monitore a saúde do banco.</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-500 transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          
          <div className="w-64 border-r border-slate-100 dark:border-slate-800 p-6 flex flex-col gap-2 shrink-0 bg-slate-50/50 dark:bg-slate-950/20">
             <TabButton id="interface" label="Interface" icon={LayoutGrid} />
             <TabButton id="ai" label="IA Gemini" icon={Bot} />
             <TabButton id="database" label="Banco de Dados" icon={Server} />
             <TabButton id="diagnostics" label="Diagnóstico" icon={HeartPulse} />
             
             <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Resumo do Host</p>
                   <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                         <span>Status:</span>
                         <span className={isConnected ? 'text-emerald-500' : 'text-amber-500'}>{isConnected ? 'Ativo' : 'Pendente'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                         <span>Sessão:</span>
                         <span className="text-indigo-500">{formatVersionDisplay(CURRENT_APP_VERSION)}</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
             
             {activeTab === 'interface' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                   <section>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                         <Monitor className="w-4 h-4" /> Personalização Visual
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                         <button 
                           type="button"
                           onClick={() => setFormData({...formData, theme: 'light'})}
                           className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${formData.theme === 'light' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200'}`}
                         >
                            <div className="w-full aspect-video bg-white border border-slate-200 rounded-lg shadow-inner overflow-hidden flex flex-col">
                               <div className="h-2 bg-slate-100 w-full mb-1"></div>
                               <div className="px-2 space-y-1">
                                  <div className="h-1 bg-slate-200 w-3/4 rounded-full"></div>
                                  <div className="h-1 bg-slate-100 w-1/2 rounded-full"></div>
                               </div>
                            </div>
                            <span className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200"><Sun className="w-4 h-4" /> Claro</span>
                         </button>
                         <button 
                           type="button"
                           onClick={() => setFormData({...formData, theme: 'dark'})}
                           className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${formData.theme === 'dark' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200'}`}
                         >
                            <div className="w-full aspect-video bg-slate-900 border border-slate-800 rounded-lg shadow-inner overflow-hidden flex flex-col">
                               <div className="h-2 bg-slate-800 w-full mb-1"></div>
                               <div className="px-2 space-y-1">
                                  <div className="h-1 bg-slate-700 w-3/4 rounded-full"></div>
                                  <div className="h-1 bg-slate-100 w-1/2 rounded-full"></div>
                               </div>
                            </div>
                            <span className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200"><Moon className="w-4 h-4" /> Escuro</span>
                         </button>
                      </div>
                   </section>

                   <section>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                         <PenTool className="w-4 h-4" /> Comportamento do Construtor
                      </h4>
                      <div className="grid grid-cols-1 gap-3">
                         <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between hover:shadow-sm transition-all group">
                            <div className="flex items-center gap-4">
                               <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
                                  <GraduationCap className="w-5 h-5" />
                               </div>
                               <div>
                                  <span className="text-sm font-black text-slate-700 dark:text-slate-200 block leading-tight">Modo Iniciante</span>
                                  <p className="text-xs text-slate-500">Exibe explicações didáticas em cada etapa.</p>
                               </div>
                            </div>
                            <Toggle checked={formData.beginnerMode} onChange={val => setFormData({...formData, beginnerMode: val})} colorClass="peer-checked:bg-emerald-500" />
                         </div>

                         <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between hover:shadow-sm transition-all group">
                            <div className="flex items-center gap-4">
                               <div className="p-2.5 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 rounded-xl group-hover:scale-110 transition-transform">
                                  <PenTool className="w-5 h-5" />
                               </div>
                               <div>
                                  <span className="text-sm font-black text-slate-700 dark:text-slate-200 block leading-tight">Modo Edição (CRUD)</span>
                                  <p className="text-xs text-slate-500">Permite editar registros diretamente na tabela de resultados.</p>
                               </div>
                            </div>
                            <Toggle checked={formData.advancedMode} onChange={val => setFormData({...formData, advancedMode: val})} colorClass="peer-checked:bg-orange-500" />
                         </div>
                      </div>
                   </section>
                </div>
             )}

             {activeTab === 'ai' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                   <div className="p-6 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2rem] text-white shadow-xl flex items-center justify-between">
                      <div className="flex items-center gap-5">
                         <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl">
                            <Zap className="w-8 h-8 fill-white" />
                         </div>
                         <div>
                            <h4 className="text-lg font-black tracking-tight">Inteligência Gemini</h4>
                            <p className="text-indigo-100 text-sm">Tradução de linguagem natural e sugestões proativas.</p>
                         </div>
                      </div>
                      <Toggle checked={formData.enableAiGeneration} onChange={val => setFormData({...formData, enableAiGeneration: val})} colorClass="peer-checked:bg-indigo-400" />
                   </div>

                   <div className={`grid grid-cols-2 gap-4 transition-all duration-500 ${!formData.enableAiGeneration ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                      <div className="p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col gap-4">
                         <div className="flex items-center justify-between">
                            <ShieldCheck className="w-6 h-6 text-emerald-500" />
                            <Toggle checked={formData.enableAiValidation} onChange={val => setFormData({...formData, enableAiValidation: val})} colorClass="peer-checked:bg-emerald-500" />
                         </div>
                         <div>
                            <span className="text-sm font-black text-slate-700 dark:text-slate-100 block">Validação em Tempo Real</span>
                            <p className="text-[11px] text-slate-500 mt-1">Verifica a sintaxe do SQL gerado automaticamente.</p>
                         </div>
                      </div>
                      
                      <div className="p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col gap-4">
                         <div className="flex items-center justify-between">
                            <Lightbulb className="w-6 h-6 text-amber-500" />
                            <Toggle checked={formData.enableAiTips} onChange={val => setFormData({...formData, enableAiTips: val})} colorClass="peer-checked:bg-amber-500" />
                         </div>
                         <div>
                            <span className="text-sm font-black text-slate-700 dark:text-slate-100 block">Dicas de Performance</span>
                            <p className="text-[11px] text-slate-500 mt-1">Sugere índices e otimizações de plano de execução.</p>
                         </div>
                      </div>

                      <div className="col-span-2 p-6 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem]">
                         <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                               <Clock className="w-4 h-4 text-indigo-500" />
                               <span className="text-xs font-black uppercase tracking-widest text-slate-500">Timeout de Processamento</span>
                            </div>
                            <span className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-black text-indigo-600 dark:text-indigo-400">
                               {formData.aiGenerationTimeout}ms
                            </span>
                         </div>
                         <input 
                            type="range" min="1000" max="10000" step="500"
                            value={formData.aiGenerationTimeout} 
                            onChange={e => setFormData({...formData, aiGenerationTimeout: parseInt(e.target.value)})}
                            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
                         />
                         <div className="flex justify-between mt-2 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                            <span>Rápido (1s)</span>
                            <span>Seguro (10s)</span>
                         </div>
                      </div>
                   </div>
                </div>
             )}

             {activeTab === 'database' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="col-span-2">
                         <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Database className="w-3.5 h-3.5" /> Endereço Padrão do Host
                         </label>
                         <input 
                            type="text" 
                            value={formData.defaultDbHost} 
                            onChange={e => setFormData({...formData, defaultDbHost: e.target.value})} 
                            className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                            placeholder="localhost"
                         />
                      </div>
                      
                      <div>
                         <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <User className="w-3.5 h-3.5" /> Usuário de Fallback
                         </label>
                         <input 
                            type="text" 
                            value={formData.defaultDbUser} 
                            onChange={e => setFormData({...formData, defaultDbUser: e.target.value})} 
                            className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                         />
                      </div>

                      <div>
                         <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Hash className="w-3.5 h-3.5" /> Porta de Escuta
                         </label>
                         <input 
                            type="text" 
                            value={formData.defaultDbPort} 
                            onChange={e => setFormData({...formData, defaultDbPort: e.target.value})} 
                            className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                         />
                      </div>

                      <div className="p-6 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 rounded-[2rem]">
                         <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                               <ListFilter className="w-4 h-4 text-indigo-500" />
                               <span className="text-xs font-black uppercase tracking-widest text-indigo-900 dark:text-indigo-200">Limite SQL Builder</span>
                            </div>
                         </div>
                         <div className="flex items-center gap-6">
                            <input 
                               type="number" 
                               value={formData.defaultLimit} 
                               onChange={e => setFormData({...formData, defaultLimit: parseInt(e.target.value) || 100})} 
                               className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-black text-center text-indigo-600 dark:text-indigo-400 shadow-sm" 
                            />
                         </div>
                         <p className="text-[10px] text-indigo-700/60 dark:text-indigo-300/60 mt-3 font-medium">
                            Sufixo <code>LIMIT</code> padrão para novas queries do builder.
                         </p>
                      </div>

                      <div className="p-6 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 rounded-[2rem]">
                         <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                               <GitCompare className="w-4 h-4 text-indigo-500" />
                               <span className="text-xs font-black uppercase tracking-widest text-indigo-900 dark:text-indigo-200">Limite Comparador</span>
                            </div>
                         </div>
                         <div className="flex items-center gap-6">
                            <input 
                               type="number" 
                               value={formData.defaultDiffLimit} 
                               onChange={e => setFormData({...formData, defaultDiffLimit: parseInt(e.target.value) || 500})} 
                               className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-black text-center text-indigo-600 dark:text-indigo-400 shadow-sm" 
                            />
                         </div>
                         <p className="text-[10px] text-indigo-700/60 dark:text-indigo-300/60 mt-3 font-medium">
                            Amostra de registros a carregar para auditoria.
                         </p>
                      </div>
                   </div>
                </div>
             )}

             {activeTab === 'diagnostics' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                   <section className="bg-white dark:bg-slate-800 p-8 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-sm overflow-hidden relative group">
                      <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors"></div>
                      
                      <div className="flex items-center gap-4 mb-8">
                         <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                            <Tag className="w-6 h-6" />
                         </div>
                         <div>
                            <h4 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">Estado do Software</h4>
                            <p className="text-xs text-slate-500 mt-1">Controle de versões e canais de atualização.</p>
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 mb-8">
                         <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Versão em Execução</span>
                            <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{formatVersionDisplay(CURRENT_APP_VERSION)}</div>
                            <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-tight flex items-center gap-1">
                               <Info className="w-3 h-3" /> Instância Local
                            </p>
                         </div>
                         <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Última Disponível ({formData.updateBranch === 'stable' ? 'Stable' : 'Main'})</span>
                            <div className="flex items-center justify-center min-h-[45px]">
                               {getLatestVersionDisplay()}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-tight flex items-center gap-1">
                               <RefreshCw className="w-3 h-3" /> Consulta em Nuvem
                            </p>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <GitBranch className="w-3.5 h-3.5" /> Canal de Lançamento Ativo
                         </label>
                         <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <button 
                               type="button"
                               onClick={() => setFormData({...formData, updateBranch: 'stable'})}
                               className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-xs transition-all
                                  ${formData.updateBranch === 'stable' 
                                     ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' 
                                     : 'text-slate-500 hover:text-slate-700'}
                               `}
                            >
                               <span className="flex items-center gap-2 font-black uppercase"><CheckCircle2 className="w-4 h-4" /> Estável</span>
                               <span className="text-[9px] opacity-70 font-mono">{formatVersionDisplay(remoteVersions?.stable)}</span>
                            </button>
                            <button 
                               type="button"
                               onClick={() => setFormData({...formData, updateBranch: 'main'})}
                               className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-xs transition-all
                                  ${formData.updateBranch === 'main' 
                                     ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' 
                                     : 'text-slate-500 hover:text-slate-700'}
                               `}
                            >
                               <span className="flex items-center gap-2 font-black uppercase"><FlaskConical className="w-4 h-4" /> Main / Dev</span>
                               <span className="text-[9px] opacity-70 font-mono">{formatVersionDisplay(remoteVersions?.main)}</span>
                            </button>
                         </div>
                         <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                            <p className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                               <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                               {formData.updateBranch === 'stable' 
                                 ? 'Canal Recomendado: Versões validadas e testadas para máxima estabilidade no dia a dia.' 
                                 : 'Acesso Antecipado: Versão atualizada a cada commit no repositório. Pode conter bugs experimentais.'}
                            </p>
                         </div>
                      </div>
                   </section>

                   <div className="grid grid-cols-5 gap-6">
                      <div className="col-span-2 flex flex-col gap-4">
                         <div className="bg-white dark:bg-slate-800 p-8 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center text-center shadow-sm">
                            <div className="relative w-32 h-32 mb-6">
                               <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                  <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100 dark:text-slate-900" />
                                  <circle 
                                     cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" 
                                     strokeDasharray={263.9} 
                                     strokeDashoffset={263.9 - (263.9 * (healthScore || 0)) / 100} 
                                     strokeLinecap="round"
                                     className={`${(healthScore || 0) > 80 ? 'text-emerald-500' : (healthScore || 0) > 50 ? 'text-amber-500' : 'text-rose-500'} transition-all duration-1000 ease-out`} 
                                  />
                               </svg>
                               <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <span className="text-3xl font-black text-slate-800 dark:text-white leading-none">{healthScore ?? '--'}%</span>
                                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter mt-1">Status</span>
                               </div>
                            </div>
                            <button 
                               type="button"
                               onClick={handleHealthCheck}
                               disabled={isChecking}
                               className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                               {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                               Check-up Completo
                            </button>
                         </div>

                         {healthResults && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                               {healthResults.map(res => (
                                  <div key={res.id} className="flex items-center gap-3 text-[11px] font-bold p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                                     {res.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                                     <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{res.name}</span>
                                  </div>
                               ))}
                            </div>
                         )}
                      </div>

                      <div className="col-span-3 bg-slate-950 rounded-[2.5rem] flex flex-col overflow-hidden border border-slate-800 shadow-2xl">
                         <div className="px-6 py-4 bg-slate-900 flex justify-between items-center border-b border-slate-800">
                            <div className="flex items-center gap-3">
                               <Terminal className="w-5 h-5 text-emerald-500" />
                               <span className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em]">Motor de Fuzzing</span>
                            </div>
                            <button 
                               type="button"
                               onClick={handleRunStressTest}
                               disabled={isStressing}
                               className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2
                                  ${isStressing 
                                     ? 'bg-rose-500 text-white animate-pulse' 
                                     : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/20'}
                               `}
                            >
                               {isStressing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                               {isStressing ? 'Executando' : 'Testar Carga'}
                            </button>
                         </div>
                         
                         <div ref={logContainerRef} className="flex-1 p-5 font-mono text-[10px] custom-scrollbar overflow-y-auto bg-black/50 min-h-[300px]">
                            {stressLogs.length === 0 ? (
                               <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-50">
                                  <ActivitySquare className="w-12 h-12" />
                                  <span className="text-center">Pronto para simulação de carga pesada.<br/>Fuzzer operacional v1.2</span>
                               </div>
                            ) : (
                               stressLogs.map((log, idx) => (
                                  <div key={idx} className={`mb-1.5 flex items-start gap-3 ${log.status === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                     <span className="opacity-30 shrink-0">[{log.iteration.toString().padStart(2, '0')}]</span>
                                     <span className="font-bold shrink-0 uppercase tracking-tighter">{log.type}:</span>
                                     <span className="opacity-90">{log.detail}</span>
                                  </div>
                               ))
                            )}
                         </div>

                         {isStressing && (
                           <div className="px-6 py-2 bg-rose-950/30 text-rose-300 text-[9px] font-black flex items-center justify-between border-t border-rose-900/50">
                              <div className="flex items-center gap-2">
                                 <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                                 TESTE DE CARGA EM CURSO
                              </div>
                              <span className="tracking-[0.3em]">{stressLogs.length}/20</span>
                           </div>
                         )}
                      </div>

                   </div>
                </div>
             )}

          </div>
        </div>

        <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-4 shrink-0">
          <button 
             onClick={onClose} 
             className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
          >
             Descartar
          </button>
          <button 
             onClick={handleSubmit} 
             className="px-10 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-2xl shadow-xl shadow-indigo-900/20 transition-all active:scale-95 flex items-center gap-3"
          >
            <Save className="w-5 h-5" /> Salvar Preferências
          </button>
        </div>

      </div>
    </div>
  );
}
