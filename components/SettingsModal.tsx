
import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings, Moon, Sun, Save, X, AlertTriangle, Bot, Zap, 
  ShieldCheck, Lightbulb, Clock, LayoutList, ListFilter, 
  AlertCircle, GraduationCap, PenTool, DatabaseZap, HeartPulse, 
  Activity, CheckCircle2, XCircle, Info, RefreshCw, Play, 
  Beaker, Terminal, Bug, Loader2, Database, User, Server, Hash 
} from 'lucide-react';
import { AppSettings, DatabaseSchema, DbCredentials } from '../types';
import { runFullHealthCheck, HealthStatus, runRandomizedStressTest, StressTestLog } from '../services/healthService';
import { SimulationData } from '../services/simulationService';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  onClose: () => void;
  quotaExhausted?: boolean;
  // Novos props de contexto
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

  const handleToggleTheme = () => {
    setFormData(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }));
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

  const isAiDisabled = !formData.enableAiGeneration;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 font-sans">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-100 dark:bg-slate-900 p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Configurações do Sistema</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 custom-scrollbar">
          
          {/* Section: Diagnóstico e Saúde (Movido para topo por solicitação) */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider flex items-center gap-2">
                <HeartPulse className="w-4 h-4" /> Diagnóstico & Estresse
              </h4>
              <div className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${isConnected ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                {isConnected ? `Conexão Ativa: ${schema?.name}` : 'Modo Offline (Base Exemplo)'}
              </div>
            </div>
            
            {!isConnected && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg flex gap-2 items-start text-[10px] text-amber-800 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>Nenhuma conexão ativa detectada. Os testes de estresse serão executados na base de dados de exemplo (E-Commerce) para validar a integridade do motor.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Quick Health Check */}
               <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-2">
                        <Activity className={`w-5 h-5 ${isChecking ? 'text-indigo-500 animate-pulse' : 'text-slate-400'}`} />
                        <h5 className="text-sm font-bold">Saúde do Sistema</h5>
                     </div>
                     <button 
                        type="button"
                        onClick={handleHealthCheck}
                        disabled={isChecking}
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50"
                        title="Verificar conectividade básica"
                     >
                        <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                     </button>
                  </div>

                  <div className="space-y-2">
                     {healthResults ? healthResults.map(res => (
                        <div key={res.id} className="flex items-center justify-between text-xs p-1">
                           <span className="text-slate-500">{res.name}</span>
                           {res.status === 'success' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                           ) : (
                              <XCircle className="w-4 h-4 text-rose-500" />
                           )}
                        </div>
                     )) : (
                        <p className="text-[10px] text-slate-400 italic">Clique no ícone de atualização acima.</p>
                     )}
                  </div>
               </div>

               {/* randomized Stress Test */}
               <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-2">
                        <Bug className={`w-5 h-5 ${isStressing ? 'text-amber-500 animate-bounce' : 'text-slate-400'}`} />
                        <h5 className="text-sm font-bold">Fuzzing (Estresse)</h5>
                     </div>
                     <button 
                        type="button"
                        onClick={handleRunStressTest}
                        disabled={isStressing}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                     >
                        {isStressing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Executar
                     </button>
                  </div>
                  
                  <div className="h-20 overflow-y-auto bg-slate-950 rounded border border-slate-800 p-2 font-mono text-[9px] custom-scrollbar">
                     {stressLogs.length === 0 ? (
                        <span className="text-slate-600 italic">Teste de estresse lógico inativo.</span>
                     ) : (
                        stressLogs.map((log, idx) => (
                           <div key={idx} className={log.status === 'ok' ? 'text-emerald-500' : 'text-rose-500'}>
                              [{log.iteration}] {log.type}: {log.detail}
                           </div>
                        ))
                     )}
                     <div ref={logEndRef} />
                  </div>
               </div>
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-700" />

          {/* Section: Interface e Comportamento */}
          <div>
             <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <LayoutList className="w-4 h-4" /> Interface & Comportamento
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800/30 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <GraduationCap className="w-5 h-5 text-emerald-600" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">Modo Iniciante</span>
                        <span className="text-[10px] text-slate-500">Exibe dicas de SQL</span>
                      </div>
                   </div>
                   <input 
                     type="checkbox" 
                     checked={formData.beginnerMode} 
                     onChange={e => setFormData({...formData, beginnerMode: e.target.checked})}
                     className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500" 
                   />
                </div>

                <div className="bg-orange-50/50 dark:bg-orange-900/10 p-3 rounded-lg border border-orange-100 dark:border-orange-800/30 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <PenTool className="w-5 h-5 text-orange-600" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">Modo CRUD</span>
                        <span className="text-[10px] text-slate-500">Edição em tempo real</span>
                      </div>
                   </div>
                   <input 
                     type="checkbox" 
                     checked={formData.advancedMode} 
                     onChange={e => setFormData({...formData, advancedMode: e.target.checked})}
                     className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500" 
                   />
                </div>

                <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/30 flex items-center justify-between md:col-span-2">
                   <div className="flex items-center gap-3">
                      <DatabaseZap className="w-5 h-5 text-indigo-600" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">Otimização de Vínculos</span>
                        <span className="text-[10px] text-slate-500">Carregar relações em background para drill-down instantâneo</span>
                      </div>
                   </div>
                   <input 
                     type="checkbox" 
                     checked={formData.backgroundLoadLinks} 
                     onChange={e => setFormData({...formData, backgroundLoadLinks: e.target.checked})}
                     className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" 
                   />
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
               <div className="flex items-start justify-between bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="flex gap-3">
                     <Zap className={`w-5 h-5 ${formData.enableAiGeneration ? 'text-amber-500' : 'text-slate-300'}`} />
                     <div>
                       <span className="text-sm font-bold block">Geração Automática de SQL</span>
                       <p className="text-[10px] text-slate-500 leading-tight mt-1">Habilita tradução de linguagem natural e sugestões de joins por IA.</p>
                     </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={formData.enableAiGeneration} 
                    onChange={e => setFormData({...formData, enableAiGeneration: e.target.checked})}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                  />
               </div>

               <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 transition-all duration-300 ${isAiDisabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
                     <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-medium">Validação de Sintaxe</span>
                     </div>
                     <input type="checkbox" checked={formData.enableAiValidation} onChange={e => setFormData({...formData, enableAiValidation: e.target.checked})} />
                  </div>
                  <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
                     <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-medium">Sugestões de Performance</span>
                     </div>
                     <input type="checkbox" checked={formData.enableAiTips} onChange={e => setFormData({...formData, enableAiTips: e.target.checked})} />
                  </div>
                  <div className="sm:col-span-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700">
                     <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                           <Clock className="w-3.5 h-3.5" /> Timeout da Resposta (ms)
                        </div>
                        <span className="text-xs font-mono text-indigo-600">{formData.aiGenerationTimeout}ms</span>
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
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
               <Server className="w-4 h-4" /> Padrões de Conexão & Banco
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
                     <Server className="w-3 h-3" /> Nome do Banco Padrão
                  </label>
                  <input 
                     type="text" 
                     value={formData.defaultDbName} 
                     onChange={e => setFormData({...formData, defaultDbName: e.target.value})} 
                     className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500" 
                     placeholder="ex: prod_db"
                  />
               </div>

               <div className="sm:col-span-2 border-t border-slate-50 dark:border-slate-700 pt-4">
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
                     <span className="text-[10px] text-slate-400 italic">Registros retornados por consulta no Construtor.</span>
                  </div>
               </div>
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-700" />

          {/* Section: Aparência e Grid */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
               <LayoutList className="w-4 h-4" /> Aparência & Grid
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-sm font-medium">Tema Visual</span>
                  <button
                    type="button"
                    onClick={handleToggleTheme}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                      formData.theme === 'dark' ? 'bg-slate-700 border-slate-600 text-yellow-300' : 'bg-white border-slate-200 text-amber-500'
                    }`}
                  >
                    {formData.theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    <span className="text-xs font-bold uppercase">{formData.theme === 'light' ? 'Claro' : 'Escuro'}</span>
                  </button>
               </div>

               <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Linhas por Página (Grid)</label>
                  <select 
                     value={formData.defaultRowsPerPage} 
                     onChange={e => setFormData({...formData, defaultRowsPerPage: parseInt(e.target.value) || 25})} 
                     className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs p-2 outline-none"
                  >
                     <option value={10}>10 registros</option>
                     <option value={25}>25 registros</option>
                     <option value={50}>50 registros</option>
                     <option value={100}>100 registros</option>
                  </select>
               </div>
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors">Cancelar</button>
          <button onClick={handleSubmit} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-lg flex items-center gap-2 transition-all">
            <Save className="w-4 h-4" /> Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
