
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  HeartPulse, Activity, Database, Users, Clock, 
  RefreshCw, Trash2, Search, Filter, AlertCircle, 
  CheckCircle2, Loader2, Play, Zap, ShieldAlert,
  BarChart3,
  Terminal,
  ZapOff,
  Cpu
} from 'lucide-react';
import { DbCredentials, ServerStats, ActiveProcess } from '../../types';
import { getServerHealth, terminateProcess } from '../../services/dbService';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { toast } from 'react-hot-toast';

interface ServerHealthStepProps {
  credentials: DbCredentials | null;
}

const ServerHealthStep: React.FC<ServerHealthStepProps> = ({ credentials }) => {
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [processes, setProcesses] = useState<ActiveProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [terminatingPid, setTerminatingPid] = useState<number | null>(null);
  
  // Histórico de conexões para o mini-gráfico
  const [connHistory, setConnHistory] = useState<{val: number}[]>([]);

  const fetchHealth = async (isManual = false) => {
    if (!credentials || credentials.host === 'simulated') {
       setError("Telemetria real disponível apenas em conexões ativas do PostgreSQL.");
       setLoading(false);
       return;
    }

    if (isManual) setLoading(true);
    
    try {
      const data = await getServerHealth(credentials);
      setStats(data.summary);
      setProcesses(data.processes);
      setError(null);
      
      setConnHistory(prev => {
         const next = [...prev, { val: data.summary.connections }];
         return next.slice(-20); // Mantém os últimos 20 pontos
      });
    } catch (err: any) {
      setError(err.message || "Falha ao sincronizar telemetria.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth(true);
  }, [credentials]);

  useEffect(() => {
    let interval: any;
    if (autoRefresh && credentials && credentials.host !== 'simulated') {
       interval = setInterval(() => fetchHealth(), 5000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, credentials]);

  /**
   * Formata com segurança a duração de uma query.
   * Lida com strings brutas do Postgres e objetos retornados pelo driver.
   */
  const formatDurationDisplay = (duration: any): string => {
    if (!duration) return '0s';
    
    // Se for um objeto (comum no driver pg para intervalos), tenta converter para algo legível
    if (typeof duration === 'object') {
       const parts = [];
       if (duration.hours) parts.push(`${duration.hours}h`);
       if (duration.minutes) parts.push(`${duration.minutes}m`);
       if (duration.seconds) parts.push(`${duration.seconds}s`);
       if (duration.milliseconds) parts.push(`${Math.round(duration.milliseconds)}ms`);
       return parts.length > 0 ? parts.join(' ') : '0s';
    }

    // Se for string, remove os milissegundos excedentes do formato Postgres (ex: 00:00:05.123 -> 00:00:05)
    if (typeof duration === 'string') {
       return duration.split('.')[0];
    }

    return String(duration);
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
    } finally {
      setTerminatingPid(null);
    }
  };

  const filteredProcesses = useMemo(() => {
    return processes.filter(p => 
       p.query.toLowerCase().includes(searchTerm.toLowerCase()) || 
       p.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
       p.pid.toString().includes(searchTerm)
    );
  }, [processes, searchTerm]);

  const StatCard = ({ title, value, sub, icon: Icon, colorClass, highlight = false }: any) => (
    <div className={`p-5 rounded-2xl border transition-all shadow-sm bg-white dark:bg-slate-800 ${highlight ? 'border-indigo-400 ring-1 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
       <div className="flex justify-between items-start mb-4">
          <div className={`p-2 rounded-xl ${colorClass}`}>
             <Icon className="w-5 h-5" />
          </div>
          {title === 'Conexões' && connHistory.length > 1 && (
             <div className="h-10 w-24">
                <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={connHistory}>
                      <Line type="monotone" dataKey="val" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                   </LineChart>
                </ResponsiveContainer>
             </div>
          )}
       </div>
       <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">{title}</div>
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
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
               <HeartPulse className="w-7 h-7 text-rose-500" />
               Saúde do Servidor
            </h2>
            <p className="text-sm text-slate-500 mt-1">Telemetria em tempo real do host <strong>{credentials?.host}</strong></p>
         </div>
         <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
               <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Auto-Refresh</span>
               <label className="relative inline-flex items-center cursor-pointer scale-75 origin-right mr-1">
                  <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
               </label>
            </div>
            <button 
               onClick={() => fetchHealth(true)} 
               disabled={loading}
               className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all"
               title="Sincronizar agora"
            >
               {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            </button>
         </div>
      </div>

      {error ? (
         <div className="p-8 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 rounded-2xl flex flex-col items-center justify-center text-center">
            <ShieldAlert className="w-12 h-12 text-rose-500 mb-4" />
            <h4 className="font-bold text-rose-900 dark:text-rose-200">Erro de Sincronização</h4>
            <p className="text-sm text-rose-700 dark:text-rose-400 mt-2 max-w-sm">{error}</p>
         </div>
      ) : (
         <div className="flex-1 flex flex-col min-h-0 gap-6">
            
            {/* Grid de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
               <StatCard 
                  title="Conexões" 
                  value={stats?.connections || 0} 
                  sub="Backends ativos no momento"
                  icon={Users}
                  colorClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30"
               />
               <StatCard 
                  title="Tamanho do Banco" 
                  value={stats?.dbSize || '---'} 
                  sub={`Banco: ${credentials?.database}`}
                  icon={Database}
                  colorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30"
               />
               <StatCard 
                  title="Cache Hit Rate" 
                  value={stats?.cacheHitRate || '---'} 
                  sub="Eficiência de leitura em memória"
                  icon={Activity}
                  colorClass="bg-amber-50 text-amber-600 dark:bg-amber-900/30"
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

            {/* Painel de Processos */}
            <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm flex flex-col overflow-hidden">
               <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                     <Terminal className="w-5 h-5 text-indigo-500" />
                     <h3 className="font-bold text-slate-700 dark:text-slate-200">Processos Ativos</h3>
                     <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase">{filteredProcesses.length} Sessões</span>
                  </div>
                  <div className="relative group">
                     <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500" />
                     <input 
                        type="text" 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Filtrar por query, PID ou usuário..."
                        className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 w-64 shadow-inner"
                     />
                  </div>
               </div>

               <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                     <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">
                        <tr>
                           <th className="px-6 py-4 w-20">PID</th>
                           <th className="px-6 py-4 w-32">Usuário</th>
                           <th className="px-6 py-4 w-28">Duração</th>
                           <th className="px-6 py-4 w-24">Estado</th>
                           <th className="px-6 py-4">Query / Comando</th>
                           <th className="px-6 py-4 w-20">Ação</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {filteredProcesses.length === 0 ? (
                           <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">Nenhum processo ativo no momento.</td>
                           </tr>
                        ) : (
                           filteredProcesses.map(proc => (
                              <tr key={proc.pid} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                 <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">{proc.pid}</td>
                                 <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                       <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{proc.user}</span>
                                       <span className="text-[10px] text-slate-400 font-mono">{proc.clientAddr}</span>
                                    </div>
                                 </td>
                                 <td className="px-6 py-4">
                                    <span className={`text-xs font-bold font-mono ${proc.durationMs > 30000 ? 'text-rose-500' : proc.durationMs > 5000 ? 'text-amber-500' : 'text-slate-500'}`}>
                                       {formatDurationDisplay(proc.duration)}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4">
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border
                                       ${proc.state === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}
                                    `}>
                                       {proc.state}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4">
                                    <div className="max-w-[400px] xl:max-w-[600px]">
                                       <code className="text-[11px] font-mono text-slate-600 dark:text-slate-400 block truncate group-hover:whitespace-normal group-hover:break-all transition-all duration-300">
                                          {proc.query}
                                       </code>
                                       {proc.waitEvent !== 'None' && (
                                          <div className="flex items-center gap-1 text-[9px] text-amber-600 font-bold mt-1 uppercase">
                                             <AlertCircle className="w-2.5 h-2.5" /> Espera: {proc.waitEvent}
                                          </div>
                                       )}
                                    </div>
                                 </td>
                                 <td className="px-6 py-4">
                                    <button 
                                       onClick={() => handleKill(proc.pid)}
                                       disabled={terminatingPid === proc.pid}
                                       className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                       title="Encerrar Processo (Kill)"
                                    >
                                       {terminatingPid === proc.pid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    </button>
                                 </td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>
               
               <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-4">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active</div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300"></span> Idle</div>
                  <div className="flex items-center gap-1.5 ml-auto"><Cpu className="w-3 h-3" /> Frequência: 5s</div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default ServerHealthStep;
