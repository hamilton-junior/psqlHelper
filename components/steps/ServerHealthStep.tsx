
import React, { useState, useEffect, useMemo } from 'react';
import { 
  HeartPulse, Activity, Database, Users, Clock, 
  RefreshCw, Trash2, Search, AlertCircle, 
  Loader2, Zap, ShieldAlert, Terminal, ZapOff, 
  Cpu, BarChart3, AlertTriangle, Ghost, ListOrdered, Sparkles, X, ChevronDown, CheckCircle2
} from 'lucide-react';
import { DbCredentials, ServerStats, ActiveProcess, TableInsight } from '../../types';
import { getServerHealth, terminateProcess } from '../../services/dbService';
import { getHealthDiagnosis } from '../../services/geminiService';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip, AreaChart, Area } from 'recharts';
import { toast } from 'react-hot-toast';

interface ServerHealthStepProps {
  credentials: DbCredentials | null;
}

const ServerHealthStep: React.FC<ServerHealthStepProps> = ({ credentials }) => {
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [processes, setProcesses] = useState<ActiveProcess[]>([]);
  const [tableInsights, setTableInsights] = useState<TableInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [terminatingPid, setTerminatingPid] = useState<number | null>(null);
  
  // IA Diagnosis
  const [aiDiagnosis, setAiDiagnosis] = useState<string | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // Historico para Sparklines
  const [history, setHistory] = useState<{conn: number, cache: number, tps: number}[]>([]);

  const fetchHealth = async (isManual = false) => {
    if (!credentials || credentials.host === 'simulated') {
       setError("Telemetria real disponível apenas em conexões ativas do PostgreSQL.");
       setLoading(false);
       return;
    }
    if (isManual) setLoading(true);
    try {
      const data = await getServerHealth(credentials);
      const cacheVal = parseFloat(data.summary.cacheHitRate.replace('%', '')) || 0;
      
      setStats(data.summary);
      setProcesses(data.processes);
      setTableInsights(data.tableInsights || []);
      setError(null);
      
      setHistory(prev => {
         const next = [...prev, { conn: data.summary.connections, cache: cacheVal, tps: data.summary.transactionsCommit }];
         return next.slice(-20);
      });
    } catch (err: any) {
      setError(err.message || "Falha ao sincronizar telemetria.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHealth(true); }, [credentials]);

  useEffect(() => {
    let interval: any;
    if (autoRefresh && credentials && credentials.host !== 'simulated') {
       interval = setInterval(() => fetchHealth(), 5000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, credentials]);

  const handleAiDiagnosis = async () => {
     if (!stats || processes.length === 0) return;
     setIsDiagnosing(true);
     try {
        const res = await getHealthDiagnosis(stats, processes);
        setAiDiagnosis(res);
     } catch (e) { toast.error("Falha ao gerar diagnóstico."); }
     finally { setIsDiagnosing(false); }
  };

  const handleKill = async (pid: number) => {
    if (!credentials) return;
    if (!confirm(`Deseja forçar o encerramento do processo ${pid}?`)) return;
    setTerminatingPid(pid);
    try {
      await terminateProcess(credentials, pid);
      toast.success(`Processo ${pid} encerrado.`);
      fetchHealth();
    } catch (err: any) {
      toast.error(`Falha ao matar processo: ${err.message}`);
    } finally { setTerminatingPid(null); }
  };

  const filteredProcesses = useMemo(() => {
    return processes.filter(p => 
       p.query.toLowerCase().includes(searchTerm.toLowerCase()) || 
       p.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
       p.pid.toString().includes(searchTerm)
    );
  }, [processes, searchTerm]);

  const formatDurationDisplay = (duration: any): string => {
    if (!duration) return '0s';
    if (typeof duration === 'object') {
       const parts = [];
       if (duration.hours) parts.push(`${duration.hours}h`);
       if (duration.minutes) parts.push(`${duration.minutes}m`);
       if (duration.seconds) parts.push(`${duration.seconds}s`);
       return parts.length > 0 ? parts.join(' ') : '0s';
    }
    return typeof duration === 'string' ? duration.split('.')[0] : String(duration);
  };

  const StatCard = ({ title, value, sub, icon: Icon, colorClass, highlight = false, historyKey }: any) => (
    <div className={`p-5 rounded-3xl border transition-all shadow-sm bg-white dark:bg-slate-800 ${highlight ? 'border-indigo-400 ring-1 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
       <div className="flex justify-between items-start mb-4">
          <div className={`p-2.5 rounded-2xl ${colorClass}`}>
             <Icon className="w-5 h-5" />
          </div>
          {historyKey && history.length > 1 && (
             <div className="h-10 w-24">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={history}>
                      <defs>
                        <linearGradient id={`grad-${historyKey}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey={historyKey} stroke="#6366f1" fill={`url(#grad-${historyKey})`} strokeWidth={2} dot={false} isAnimationActive={false} />
                      <YAxis hide domain={['auto', 'auto']} />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          )}
       </div>
       <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{title}</div>
       <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{value}</div>
       <div className="text-[11px] text-slate-500 mt-1 font-medium">{sub}</div>
    </div>
  );

  if (credentials?.host === 'simulated') {
     return (
        <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-50 dark:bg-slate-950">
           <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-6">
              <ZapOff className="w-12 h-12 text-indigo-400" />
           </div>
           <h3 className="text-2xl font-black text-slate-700 dark:text-slate-300 mb-2">Telemetria Offline</h3>
           <p className="text-slate-500 max-w-md">O monitor de saúde requer uma conexão real com o PostgreSQL para ler as estatísticas de sistema.</p>
        </div>
     );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 pb-10">
      
      <div className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
         <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
               <HeartPulse className="w-8 h-8 text-rose-500" />
               Saúde do Servidor
            </h2>
            <p className="text-sm text-slate-500 mt-1">Status operacional em tempo real: <strong>{credentials?.host}</strong></p>
         </div>
         <div className="flex items-center gap-3">
            <button 
               onClick={handleAiDiagnosis}
               disabled={isDiagnosing || !stats}
               className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-900/20 transition-all active:scale-95 disabled:opacity-50"
            >
               {isDiagnosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
               Analisar com Gemini
            </button>
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
               <span className="text-[10px] font-black text-slate-400 uppercase px-2">Auto-Refresh</span>
               <label className="relative inline-flex items-center cursor-pointer scale-90 mr-1">
                  <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
               </label>
            </div>
            <button onClick={() => fetchHealth(true)} disabled={loading} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all">
               {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            </button>
         </div>
      </div>

      {aiDiagnosis && (
         <div className="mb-8 p-6 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-[2rem] relative animate-in slide-in-from-top-4 duration-300">
            <button onClick={() => setAiDiagnosis(null)} className="absolute top-4 right-4 p-1.5 hover:bg-white/50 dark:hover:bg-slate-800 rounded-xl transition-colors"><X className="w-4 h-4" /></button>
            <div className="flex items-start gap-4">
               <div className="p-3 bg-white dark:bg-indigo-900 rounded-2xl shadow-sm"><Sparkles className="w-6 h-6 text-indigo-600" /></div>
               <div className="flex-1">
                  <h4 className="font-black text-indigo-900 dark:text-indigo-200 text-sm uppercase tracking-widest mb-3">Parecer Técnico IA</h4>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-indigo-100 whitespace-pre-wrap font-medium leading-relaxed">
                     {aiDiagnosis}
                  </div>
               </div>
            </div>
         </div>
      )}

      {error ? (
         <div className="p-12 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 rounded-[2.5rem] flex flex-col items-center justify-center text-center">
            <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
            <h4 className="font-black text-rose-900 dark:text-rose-200 text-xl">Erro de Sincronização</h4>
            <p className="text-sm text-rose-700 dark:text-rose-400 mt-2 max-w-sm">{error}</p>
         </div>
      ) : (
         <div className="flex-1 flex flex-col min-h-0 gap-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
               <StatCard 
                  title="Conexões" 
                  value={stats?.connections || 0} 
                  sub="Backends ativos"
                  icon={Users}
                  colorClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30"
                  historyKey="conn"
               />
               <StatCard 
                  title="Cache Hit Rate" 
                  value={stats?.cacheHitRate || '---'} 
                  sub="Eficiência de memória"
                  icon={Activity}
                  colorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30"
                  historyKey="cache"
               />
               <StatCard 
                  title="Transactions/S" 
                  value={stats?.tps || '---'} 
                  sub="Total de Commits"
                  icon={BarChart3}
                  colorClass="bg-amber-50 text-amber-600 dark:bg-amber-900/30"
                  historyKey="tps"
               />
               <StatCard 
                  title="Query Mais Longa" 
                  value={formatDurationDisplay(stats?.maxQueryDuration)} 
                  sub="Tempo de execução do topo"
                  icon={Clock}
                  colorClass="bg-rose-50 text-rose-600 dark:bg-rose-900/30"
                  highlight={(stats?.activeQueries || 0) > 0}
               />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
               {/* Painel de Processos */}
               <div className="lg:col-span-2 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm overflow-hidden">
                  <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
                     <div className="flex items-center gap-3">
                        <Terminal className="w-5 h-5 text-indigo-500" />
                        <h3 className="font-black text-slate-700 dark:text-slate-200 uppercase tracking-tighter">Processos Ativos</h3>
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase">{filteredProcesses.length} Sessões</span>
                     </div>
                     <div className="relative group">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input 
                           type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                           placeholder="Filtrar processos..."
                           className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 w-48 shadow-inner"
                        />
                     </div>
                  </div>

                  <div className="flex-1 overflow-auto custom-scrollbar">
                     <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/80 dark:bg-slate-800/80 sticky top-0 z-10 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100 dark:border-slate-700">
                           <tr>
                              <th className="px-6 py-4 w-20">PID</th>
                              <th className="px-6 py-4 w-32">Usuário</th>
                              <th className="px-6 py-4 w-24">Estado</th>
                              <th className="px-6 py-4">Comando / Bloqueios</th>
                              <th className="px-6 py-4 w-20">Ação</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800 font-medium">
                           {filteredProcesses.map(proc => {
                              const isZombie = proc.state === 'idle in transaction';
                              const isBlocked = proc.blockingPids && proc.blockingPids.length > 0;
                              return (
                                 <tr key={proc.pid} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">{proc.pid}</td>
                                    <td className="px-6 py-4">
                                       <div className="flex flex-col">
                                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{proc.user}</span>
                                          <span className="text-[9px] text-slate-400 font-mono">{proc.duration.split('.')[0]}</span>
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="flex flex-col gap-1">
                                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border text-center
                                             ${proc.state === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}
                                          `}>{proc.state}</span>
                                          {isZombie && <span className="flex items-center gap-1 text-[8px] text-rose-500 font-black animate-pulse"><Ghost className="w-2.5 h-2.5" /> ZUMBI</span>}
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="max-w-[300px] xl:max-w-[500px]">
                                          <code className="text-[11px] font-mono text-slate-600 dark:text-slate-400 block truncate group-hover:whitespace-normal group-hover:break-all">
                                             {proc.query}
                                          </code>
                                          {isBlocked && (
                                             <div className="flex items-center gap-1.5 text-[9px] text-rose-600 font-black mt-1 uppercase bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 rounded-lg w-fit border border-rose-100 dark:border-rose-800">
                                                <AlertTriangle className="w-2.5 h-2.5" /> BLOQUEADO POR: {proc.blockingPids.join(', ')}
                                             </div>
                                          )}
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <button 
                                          onClick={() => handleKill(proc.pid)}
                                          disabled={terminatingPid === proc.pid}
                                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all"
                                          title="Kill Connection"
                                       >
                                          {terminatingPid === proc.pid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                       </button>
                                    </td>
                                 </tr>
                              );
                           })}
                        </tbody>
                     </table>
                  </div>
               </div>

               {/* Table Insights (Bloat/Size) */}
               <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm overflow-hidden">
                  <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                     <div className="flex items-center gap-3">
                        <ListOrdered className="w-5 h-5 text-indigo-500" />
                        <h3 className="font-black text-slate-700 dark:text-slate-200 uppercase tracking-tighter">Volume de Dados</h3>
                     </div>
                  </div>
                  <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-4">
                     {tableInsights.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 opacity-50">
                           <BarChart3 className="w-10 h-10" />
                           <p className="text-xs font-bold uppercase tracking-widest">Sincronizando tabelas...</p>
                        </div>
                     ) : (
                        tableInsights.map((tbl, idx) => (
                           <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 group hover:border-indigo-300 transition-colors">
                              <div className="flex justify-between items-start mb-3">
                                 <span className="text-xs font-black text-slate-800 dark:text-white truncate pr-2">{tbl.name}</span>
                                 <span className="text-[10px] font-black text-indigo-500 uppercase">{tbl.totalSize}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                 <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min((parseInt(tbl.totalSize) / 500) * 100, 100)}%` }}></div>
                                 </div>
                                 <span className="text-[9px] font-bold text-slate-400 shrink-0">{tbl.estimatedRows.toLocaleString()} rows</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                 <div>
                                    <span className="block text-[8px] font-black text-slate-400 uppercase">Dados</span>
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{tbl.tableSize}</span>
                                 </div>
                                 <div>
                                    <span className="block text-[8px] font-black text-slate-400 uppercase">Índices</span>
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{tbl.indexSize}</span>
                                 </div>
                              </div>
                           </div>
                        ))
                     )}
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
                     <p className="text-[9px] font-bold text-slate-400 uppercase">Top 5 tabelas por armazenamento total</p>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default ServerHealthStep;
