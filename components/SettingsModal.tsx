
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Settings, Save, X, Bot, Zap, 
  ShieldCheck, Lightbulb, Clock, LayoutList, ListFilter, 
  AlertCircle, GraduationCap, PenTool, DatabaseZap, HeartPulse, 
  Activity, CheckCircle2, XCircle, RefreshCw, Play, 
  Bug, Loader2, Database, User, Server, Hash, Shield, Terminal, ZapOff, ActivitySquare
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
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  settings, onSave, onClose, quotaExhausted,
  schema, credentials, simulationData = {}
}) => {
  const [formData, setFormData] = React.useState<AppSettings>({ ...settings });
  const [healthResults, setHealthResults] = useState<HealthStatus[] | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  
  // Stress Test State
  const [isStressing, setIsStressing] = useState(false);
  const [stressLogs, setStressLogs] = useState<StressTestLog[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const isConnected = !!schema;

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
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
      console.error("Health Check failed", e);
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
      console.error("Stress test failed", e);
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

  const isAiDisabled = !formData.enableAiGeneration;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 font-sans">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-100 dark:bg-slate-900 p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Configurações Avançadas</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 custom-scrollbar">
          
          {/* Section: Diagnóstico e Saúde - NEW VISUALS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-col">
                <h4 className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider flex items-center gap-2">
                  <HeartPulse className="w-4 h-4" /> Centro de Diagnóstico
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Validação de integridade e testes de carga lógica.</p>
              </div>
              <div className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${isConnected ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'}`}>
                {isConnected ? `Conectado: ${schema?.name}` : 'Ambiente Local (Fallback)'}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
               {/* Health Score / Summary */}
               <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 flex flex-col shadow-inner">
                  <div className="flex items-center justify-between mb-4">
                     <h5 className="text-xs font-bold uppercase tracking-widest text-slate-500">Status Geral</h5>
                     <button 
                        type="button"
                        onClick={handleHealthCheck}
                        disabled={isChecking}
                        className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-md transition-all disabled:opacity-50 text-indigo-500"
                        title="Verificar integridade"
                     >
                        <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                     </button>
                  </div>

                  {healthResults ? (
                    <div className="flex-1 flex flex-col justify-center items-center py-4">
                       <div className="relative w-24 h-24 mb-4">
                          <svg className="w-full h-full transform -rotate-90">
                             <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-200 dark:text-slate-800" />
                             <circle 
                                cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" 
                                strokeDasharray={276.5} 
                                strokeDashoffset={276.5 - (276.5 * (healthScore || 0)) / 100} 
                                className={`${(healthScore || 0) > 80 ? 'text-emerald-500' : (healthScore || 0) > 50 ? 'text-amber-500' : 'text-rose-500'} transition-all duration-1000 ease-out`} 
                             />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                             <span className="text-xl font-black text-slate-800 dark:text-white leading-none">{healthScore}%</span>
                             <span className="text-[8px] font-bold uppercase tracking-tighter text-slate-400 mt-1">Health</span>
                          </div>
                       </div>
                       <div className="grid grid-cols-1 w-full gap-1">
                          {healthResults.slice(0, 4).map(res => (
                             <div key={res.id} className="flex items-center gap-2 text-[10px] bg-white/50 dark:bg-slate-800/50 px-2 py-1 rounded-md">
                                {res.status === 'success' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                                <span className="flex-1 truncate font-medium text-slate-600 dark:text-slate-300">{res.name}</span>
                             </div>
                          ))}
                       </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                       <Shield className="w-10 h-10 text-slate-200 dark:text-slate-800 mb-3" />
                       <p className="text-[11px] text-slate-400 italic">Inicie o check-up para validar as conexões do sistema.</p>
                    </div>
                  )}
               </div>

               {/* Stress Test Visualizer */}
               <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                  <div className="px-4 py-3 bg-slate-800 flex justify-between items-center border-b border-slate-700">
                     <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Motor de Fuzzing (Estresse)</span>
                     </div>
                     <button 
                        type="button"
                        onClick={handleRunStressTest}
                        disabled={isStressing}
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5
                           ${isStressing 
                              ? 'bg-rose-500 text-white animate-pulse' 
                              : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'}
                        `}
                     >
                        {isStressing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                        {isStressing ? 'Executando...' : 'Iniciar Teste'}
                     </button>
                  </div>
                  
                  <div className="flex-1 p-3 font-mono text-[9px] custom-scrollbar overflow-y-auto min-h-[160px] bg-black/40">
                     {stressLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                           <ZapOff className="w-6 h-6 opacity-30" />
                           <span>Fuzzer ocioso. Pronto para teste de carga.</span>
                        </div>
                     ) : (
                        stressLogs.map((log, idx) => (
                           <div key={idx} className={`mb-1 flex items-start gap-2 ${log.status === 'ok' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              <span className="opacity-40 text-[8px] mt-0.5">[{log.iteration.toString().padStart(2, '0')}]</span>
                              <span className="font-bold shrink-0">{log.type}:</span>
                              <span className="opacity-80">{log.detail}</span>
                           </div>
                        ))
                     )}
                     <div ref={logEndRef} />
                  </div>

                  {isStressing && (
                    <div className="px-3 py-1 bg-rose-900/50 text-rose-300 text-[8px] font-bold flex items-center justify-between border-t border-rose-800/30">
                       <span className="flex items-center gap-1"><ActivitySquare className="w-2 h-2 animate-pulse" /> SIMULAÇÃO DE CARGA ATIVA</span>
                       <span>{stressLogs.length} ITENS PROCESSADOS</span>
                    </div>
                  )}
               </div>
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-700" />

          {/* Section: Interface e Comportamento */}
          <div>
             <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <LayoutList className="w-4 h-4" /> Interface & Construtor
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex items-center justify-between transition-all hover:shadow-sm">
                   <div className="flex items-center gap-3">
                      <GraduationCap className="w-5 h-5 text-emerald-600" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">Modo Iniciante</span>
                        <span className="text-[10px] text-slate-500">Exibe dicas pedagógicas de SQL</span>
                      </div>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={formData.beginnerMode} onChange={e => setFormData({...formData, beginnerMode: e.target.checked})} className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                   </label>
                </div>

                <div className="bg-orange-50/50 dark:bg-orange-900/10 p-3 rounded-xl border border-orange-100 dark:border-orange-800/30 flex items-center justify-between transition-all hover:shadow-sm">
                   <div className="flex items-center gap-3">
                      <PenTool className="w-5 h-5 text-orange-600" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">Modo Transacional (CRUD)</span>
                        <span className="text-[10px] text-slate-500">Habilita edição de registros no grid</span>
                      </div>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={formData.advancedMode} onChange={e => setFormData({...formData, advancedMode: e.target.checked})} className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                   </label>
                </div>

                <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex items-center justify-between md:col-span-2 transition-all hover:shadow-sm">
                   <div className="flex items-center gap-3">
                      <DatabaseZap className="w-5 h-5 text-indigo-600" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">Background Loading (Otimização de Vínculos)</span>
                        <span className="text-[10px] text-slate-500 leading-tight mt-1 max-w-sm">Carrega automaticamente o preview de relacionamentos em segundo plano para drill-down instantâneo. Requer mais recursos de rede.</span>
                      </div>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={formData.backgroundLoadLinks} onChange={e => setFormData({...formData, backgroundLoadLinks: e.target.checked})} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                   </label>
                </div>
             </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-700" />

          {/* Section: IA (Gemini) */}
          <div>
             <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Bot className="w-4 h-4" /> Inteligência Artificial (Gemini)
             </h4>
             
             <div className="space-y-4">
               <div className="flex items-start justify-between bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 hover:shadow-inner transition-shadow">
                  <div className="flex gap-3">
                     <Zap className={`w-5 h-5 ${formData.enableAiGeneration ? 'text-amber-500' : 'text-slate-300'}`} />
                     <div>
                       <span className="text-sm font-bold block">Geração Automática de SQL</span>
                       <p className="text-[10px] text-slate-500 leading-tight mt-1">Habilita tradução de linguagem natural e sugestões de joins inteligentes.</p>
                     </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={formData.enableAiGeneration} onChange={e => setFormData({...formData, enableAiGeneration: e.target.checked})} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                   </label>
               </div>

               <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 transition-all duration-300 ${isAiDisabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800">
                     <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-medium">Validação de Sintaxe</span>
                     </div>
                     <input type="checkbox" checked={formData.enableAiValidation} onChange={e => setFormData({...formData, enableAiValidation: e.target.checked})} className="rounded text-indigo-600" />
                  </div>
                  <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800">
                     <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-medium">Sugestões de Performance</span>
                     </div>
                     <input type="checkbox" checked={formData.enableAiTips} onChange={e => setFormData({...formData, enableAiTips: e.target.checked})} className="rounded text-indigo-600" />
                  </div>
                  <div className="sm:col-span-2 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                     <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                           <Clock className="w-3.5 h-3.5" /> Timeout de Resposta
                        </div>
                        <span className="text-xs font-mono font-bold text-indigo-600 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">{formData.aiGenerationTimeout}ms</span>
                     </div>
                     <input 
                        type="range" min="1000" max="10000" step="500"
                        value={formData.aiGenerationTimeout} 
                        onChange={e => setFormData({...formData, aiGenerationTimeout: parseInt(e.target.value)})}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                     />
                  </div>
               </div>
             </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-700" />

          {/* Section: Padrões de Banco */}
          <div className="space-y-4 pb-10">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
               <Server className="w-4 h-4" /> Configurações Padrão de Banco
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
               <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
                     <Database className="w-3 h-3" /> Host Padrão
                  </label>
                  <input 
                     type="text" 
                     value={formData.defaultDbHost} 
                     onChange={e => setFormData({...formData, defaultDbHost: e.target.value})} 
                     className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500" 
                     placeholder="localhost"
                  />
               </div>
               
               <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
                     <User className="w-3 h-3" /> Usuário Padrão
                  </label>
                  <input 
                     type="text" 
                     value={formData.defaultDbUser} 
                     onChange={e => setFormData({...formData, defaultDbUser: e.target.value})} 
                     className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500" 
                     placeholder="postgres"
                  />
               </div>

               <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
                     <Hash className="w-3 h-3" /> Porta Padrão
                  </label>
                  <input 
                     type="text" 
                     value={formData.defaultDbPort} 
                     onChange={e => setFormData({...formData, defaultDbPort: e.target.value})} 
                     className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500" 
                     placeholder="5432"
                  />
               </div>

               <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
                     <ListFilter className="w-3.5 h-3.5" /> Limite de Resultados (SQL LIMIT)
                  </label>
                  <div className="flex items-center gap-3">
                     <input 
                        type="number" 
                        value={formData.defaultLimit} 
                        onChange={e => setFormData({...formData, defaultLimit: parseInt(e.target.value) || 100})} 
                        className="w-32 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold" 
                     />
                     <span className="text-[10px] text-slate-400 italic">Registros padrão retornados por consulta.</span>
                  </div>
               </div>
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors">Cancelar</button>
          <button onClick={handleSubmit} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95">
            <Save className="w-4 h-4" /> Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
