import React, { useState, useEffect, useMemo } from 'react';
import { 
  HeartPulse, Activity, Database, Users, Clock, 
  RefreshCw, Trash2, Search, AlertCircle, 
  Loader2, Zap, ShieldAlert, Terminal, ZapOff, 
  Cpu, BarChart3, AlertTriangle, Ghost, ListOrdered, Sparkles, X, ChevronDown, CheckCircle2, Timer, Settings,
  FileJson, FileText, Download, Share2, Layers, Anchor, ActivitySquare, Gauge, ShieldCheck, Info, Sparkle, Brush, HelpCircle, Network, ChevronRight, Play, HardDrive, PieChart as PieChartIcon
} from 'lucide-react';
import { DbCredentials, ServerStats, ActiveProcess, TableInsight, UnusedIndex, StorageStats } from '../../types';
import { getServerHealth, terminateProcess, vacuumTable, dropIndex, fetchStorageStats } from '../../services/dbService';
import { getHealthDiagnosis } from '../../services/geminiService';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { toast, Toaster } from 'react-hot-toast';
import Dialog from '../common/Dialog';
import { Skeleton, CardSkeleton, TableSkeleton } from '../common/Skeleton';

interface ServerHealthStepProps {
  credentials: DbCredentials | null;
}

type HealthTab = 'processes' | 'locks' | 'storage';

const formatBytes = (bytes: number) => {
   if (bytes === 0) return '0 B';
   const k = 1024;
   const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
   const i = Math.floor(Math.log(bytes) / Math.log(k));
   return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const LockTreeNode: React.FC<{ 
  pid: number, 
  processes: ActiveProcess[], 
  blockingTree: Record<number, number[]>,
  onKill: (pid: number) => void,
  depth: number
}> = ({ pid, processes, blockingTree, onKill, depth }) => {
  const proc = processes.find(p => p.pid === pid);
  const children = blockingTree[pid] || [];
  const [isExpanded, setIsExpanded] = useState(true);

  if (!proc) return null;

  return (
    <div className="flex flex-col">
      <div 
        className={`flex items-center gap-3 p-3 rounded-xl border transition-all group mb-2
          ${depth === 0 ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 ml-8'}
        `}
      >
        <div className="flex items-center gap-2 shrink-0">
           {children.length > 0 && (
              <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:bg-black/5 rounded">
                 {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
              </button>
           )}
           <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[10px] font-black
              ${depth === 0 ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}
           `}>
              {pid}
           </div>
        </div>

        <div className="flex-1 min-w-0">
           <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tighter">{proc.user}</span>
              <span className="text-[10px] text-slate-400 font-bold bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded uppercase">{proc.state}</span>
              {depth === 0 && <span className="text-[9px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full animate-pulse">ROOT BLOCKER</span>}
           </div>
           <code className="text-[10px] font-mono text-slate-500 block truncate mt-0.5 group-hover:text-slate-700 dark:group-hover:text-slate-300">
              {proc.query || '(sem query ativa)'}
           </code>
        </div>

        <div className="flex items-center gap-3 shrink-0">
           <div className="text-right">
              <div className="text-[10px] font-black text-rose-500">{proc.duration}</div>
              <div className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">{proc.waitEvent}</div>
           </div>
           <button 
              onClick={() => onKill(pid)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
              title="Encerrar processo raiz"
           >
              <Trash2 className="w-4 h-4" />
           </button>
        </div>
      </div>

      {isExpanded && children.length > 0 && (
         <div className="relative">
            <div className="absolute left-10 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700"></div>
            {children.map(childPid => (
               <LockTreeNode 
                  key={childPid} 
                  pid={childPid} 
                  processes={processes} 
                  blockingTree={blockingTree} 
                  onKill={onKill}
                  depth={depth + 1}
               />
            ))}
         </div>
      )}
    </div>
  );
};

const ServerHealthStep: React.FC<ServerHealthStepProps> = ({ credentials }) => {
  const [activeSubTab, setActiveSubTab] = useState<HealthTab>('processes');
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [processes, setProcesses] = useState<ActiveProcess[]>([]);
  const [tableInsights, setTableInsights] = useState<TableInsight[]>([]);
  const [unusedIndexes, setUnusedIndexes] = useState<UnusedIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); 
  const [showSystemProcesses, setShowSystemProcesses] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [terminatingPid, setTerminatingPid] = useState<number | null>(null);
  const [optimizingItems, setOptimizingItems] = useState<Set<string>>(new Set());
  const [showIndexWarningInfo, setShowIndexWarningInfo] = useState(false);
  
  const [dialogConfig, setDialogConfig] = useState<{ 
     isOpen: boolean, 
     type: 'confirm' | 'danger' | 'prompt', 
     title: string, 
     message: string, 
     onConfirm: (val?: string) => void 
  } | null>(null);

  const [aiDiagnosis, setAiDiagnosis] = useState<string | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [history, setHistory] = useState<{conn: number, cache: number, tps: number, time: string}[]>([]);

  const fetchHealth = async (isManual = false) => {
    if (!credentials || credentials.host === 'simulated') {
       setError("Telemetria real disponível apenas em conexões ativas do PostgreSQL.");
       setLoading(false);
       return;
    }
    
    if (isManual || !stats) {
        console.log(`[HEALTH] Iniciando busca ${isManual ? 'manual' : 'inicial'} de dados.`);
        setLoading(true);
    }

    try {
      const [healthData, storageData] = await Promise.all([
         getServerHealth(credentials),
         fetchStorageStats(credentials)
      ]);

      const cacheVal = parseFloat((healthData.summary.cacheHitRate || '0').replace('%', '')) || 0;
      
      setStats(healthData.summary);
      setStorage(storageData);
      setProcesses(healthData.processes);
      setTableInsights(healthData.tableInsights || []);
      setUnusedIndexes(healthData.unusedIndexes || []);
      setError(null);
      
      setHistory(prev => {
         const next = [...prev, { 
           conn: healthData.summary.connections, 
           cache: cacheVal, 
           tps: healthData.summary.transactionsCommit,
           time: new Date().toLocaleTimeString()
         }];
         return next.slice(-100); 
      });
    } catch (err: any) {
      console.error("[HEALTH] Falha na sincronização:", err);
      setError(err.message || "Falha ao sincronizar telemetria.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchHealth(false); 
  }, [credentials]);

  useEffect(() => {
    let interval: any;
    if (autoRefresh && credentials && credentials.host !== 'simulated' && activeSubTab !== 'storage') {
       interval = setInterval(() => fetchHealth(), refreshInterval);
    }
    return () => {
        if (interval) clearInterval(interval);
    };
  }, [autoRefresh, credentials, refreshInterval, activeSubTab]);

  const handleAiDiagnosis = async () => {
     if (!stats || processes.length === 0) return;
     setIsDiagnosing(true);
     console.log("[HEALTH] Gerando diagnóstico via Gemini 3 Pro...");
     try {
        const res = await getHealthDiagnosis(stats, processes);
        setAiDiagnosis(res);
     } catch (e) { 
        toast.error("Falha ao gerar diagnóstico."); 
     }
     finally { setIsDiagnosing(false); }
  };

  const executeKill = async (pid: number) => {
    if (!credentials) return;
    setTerminatingPid(pid);
    console.log(`[HEALTH] Finalizando processo PID ${pid}.`);
    try {
      await terminateProcess(credentials, pid);
      toast.success(`Processo ${pid} encerrado.`);
      fetchHealth();
    } catch (err: any) {
      toast.error(`Falha ao matar processo: ${err.message}`);
    } finally { setTerminatingPid(null); }
  };

  const handleKill = (pid: number) => {
    setDialogConfig({
      isOpen: true,
      type: 'danger',
      title: 'Encerrar Processo',
      message: `Deseja realmente forçar o encerramento do processo PID ${pid}? Esta ação interromperá a query em execução.`,
      onConfirm: () => executeKill(pid)
    });
  };

  const handleVacuum = async (schema: string, table: string) => {
    if (!credentials) return;
    const itemKey = `vacuum-${schema}.${table}`;
    if (optimizingItems.has(itemKey)) return;
    setOptimizingItems(prev => new Set(prev).add(itemKey));
    try {
      await vacuumTable(credentials, schema, table);
      toast.success(`Tabela ${table} otimizada.`);
      fetchHealth();
    } catch (err: any) {
      toast.error(`Falha na limpeza: ${err.message}`);
    } finally {
      setOptimizingItems(prev => {
        const next = new Set(prev);
        next.delete(itemKey);
        return next;
      });
    }
  };

  const executeDropUnusedIndex = async (schema: string, index: string) => {
    if (!credentials) return;
    const itemKey = `drop-${schema}.${index}`;
    if (optimizingItems.has(itemKey)) return;
    setOptimizingItems(prev => new Set(prev).add(itemKey));
    try {
      await dropIndex(credentials, schema, index);
      toast.success(`Índice ${index} removido.`);
      fetchHealth();
    } catch (err: any) {
      toast.error(`Falha ao remover índice: ${err.message}`);
    } finally {
      setOptimizingItems(prev => {
        const next = new Set(prev);
        next.delete(itemKey);
        return next;
      });
    }
  };

  const handleDropUnusedIndex = (schema: string, index: string) => {
    setDialogConfig({
      isOpen: true,
      type: 'danger',
      title: 'Excluir Índice Ocioso',
      message: `Deseja realmente remover o índice ${index}? Esta ação não pode ser desfeita.`,
      onConfirm: () => executeDropUnusedIndex(schema, index)
    });
  };

  const exportSnapshot = (format: 'json' | 'txt') => {
     const snapshot = {
       timestamp: new Date().toISOString(),
       host: credentials?.host,
       stats,
       processes: processes.map(p => ({ pid: p.pid, user: p.user, query: p.query, state: p.state })),
       tableInsights,
       storage
     };

     if (format === 'json') {
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pg_snapshot_${Date.now()}.json`;
        link.click();
     } else {
        let text = `PG SNAPSHOT - ${snapshot.timestamp}\nHost: ${snapshot.host}\n\nCONEXOES: ${stats?.connections}/${stats?.maxConnections}\nCACHE HIT: ${stats?.cacheHitRate}\n\nSTORAGE: ${storage?.partition.percent}% used (${formatBytes(storage?.partition.used || 0)} of ${formatBytes(storage?.partition.total || 0)})\n\nPROCESSOS ATIVOS:\n`;
        processes.forEach(p => { text += `[PID ${p.pid}] ${p.user}: ${p.state} - ${p.query.substring(0, 100)}...\n`; });
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pg_snapshot_${Date.now()}.txt`;
        link.click();
     }
     toast.success("Snapshot gerado!");
  };

  const filteredProcesses = useMemo(() => {
    return processes.filter(p => {
       const matchesSearch = (p.query || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.user || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.pid || '').toString().includes(searchTerm);
       if (!matchesSearch) return false;
       if (!showSystemProcesses && p.backendType !== 'client backend') return false;
       return true;
    });
  }, [processes, searchTerm, showSystemProcesses]);

  const blockingTree = useMemo(() => {
     const tree: Record<number, number[]> = {};
     processes.forEach(p => {
        if (p.blockingPids && p.blockingPids.length > 0) {
           p.blockingPids.forEach(blocker => {
              if (!tree[blocker]) tree[blocker] = [];
              if (!tree[blocker].includes(p.pid)) tree[blocker].push(p.pid);
           });
        }
     });
     return tree;
  }, [processes]);

  const rootBlockers = useMemo(() => {
     const blockers = Object.keys(blockingTree).map(Number);
     return blockers.filter(pid => {
        const proc = processes.find(p => p.pid === pid);
        return proc && (!proc.blockingPids || proc.blockingPids.length === 0);
     });
  }, [blockingTree, processes]);

  const getStatStatusColor = (key: string, value: any) => {
     if (key === 'cache') {
        const val = parseFloat(String(value).replace('%', ''));
        if (val < 80) return 'text-rose-500 bg-rose-50 dark:bg-rose-900/30';
        if (val < 90) return 'text-amber-500 bg-amber-50 dark:bg-amber-900/30';
        return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30';
     }
     if (key === 'wraparound') {
        if (value > 80) return 'text-rose-500 bg-rose-50 dark:bg-rose-900/30';
        if (value > 50) return 'text-amber-500 bg-amber-50 dark:bg-amber-900/30';
     }
     return 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30';
  };

  const StatCard = ({ title, value, sub, icon: Icon, type = 'default', historyKey }: any) => {
    const colorClass = getStatStatusColor(type, value);
    return (
      <div className={`p-5 rounded-3xl border transition-all shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-400`}>
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
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 pb-10">
      <Toaster position="top-right" />
      {dialogConfig && (
        <Dialog 
          isOpen={dialogConfig.isOpen}
          type={dialogConfig.type}
          title={dialogConfig.title}
          message={dialogConfig.message}
          onConfirm={dialogConfig.onConfirm}
          onClose={() => setDialogConfig(null)}
          confirmLabel="Sim, Executar"
        />
      )}

      <div className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shrink-0">
         <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
               <HeartPulse className="w-8 h-8 text-rose-500 hover:animate-pulse-soft cursor-default transition-all" />
               Saúde do Servidor
            </h2>
            <div className="flex items-center gap-3 mt-1">
               <span className="text-sm text-slate-500">Banco: <strong>{credentials?.database}</strong></span>
               <span className="text-slate-300 dark:text-slate-700">|</span>
               <span className="text-sm text-slate-500">Host: <strong>{credentials?.host}</strong></span>
               <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-black rounded-lg uppercase border border-emerald-200 dark:border-emerald-800">
                  <ActivitySquare className="w-3 h-3" /> Online
               </div>
            </div>
         </div>
         
         <div className="flex items-center gap-3">
            <div className="flex bg-white dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
               <button onClick={() => exportSnapshot('json')} className="p-2 text-slate-500 hover:text-indigo-600 transition-all" title="Exportar JSON Snapshot"><FileJson className="w-5 h-5" /></button>
               <button onClick={() => exportSnapshot('txt')} className="p-2 text-slate-500 hover:text-indigo-600 transition-all" title="Exportar TXT Snapshot"><FileText className="w-5 h-5" /></button>
            </div>
            <button onClick={handleAiDiagnosis} disabled={isDiagnosing || !stats} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-900/20 transition-all active:scale-95 disabled:opacity-50">
               {isDiagnosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Diagnóstico IA
            </button>
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
               <div className="flex items-center gap-2 border-r border-slate-100 dark:border-slate-700 pr-3">
                  <Timer className={`w-3.5 h-3.5 ${autoRefresh ? 'text-indigo-500' : 'text-slate-400'}`} />
                  <input type="number" step="500" value={refreshInterval} onChange={(e) => { const val = parseInt(e.target.value); if (val >= 2000) setRefreshInterval(val); }} className="w-16 bg-transparent text-xs font-black text-slate-700 dark:text-slate-200 outline-none" />
                  <span className="text-[10px] font-black text-slate-400 uppercase">ms</span>
               </div>
               <label className="relative inline-flex items-center cursor-pointer scale-90">
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
         <div className="mb-8 p-6 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-[2rem] relative animate-in slide-in-from-top-4 duration-300 shadow-sm">
            <button onClick={() => setAiDiagnosis(null)} className="absolute top-4 right-4 p-1.5 hover:bg-white/50 dark:hover:bg-slate-800 rounded-xl transition-colors"><X className="w-4 h-4" /></button>
            <div className="flex items-start gap-4">
               <div className="p-3 bg-white dark:bg-indigo-900 rounded-2xl shadow-sm"><Sparkles className="w-6 h-6 text-indigo-600" /></div>
               <div className="flex-1">
                  <h4 className="font-black text-indigo-900 dark:text-indigo-200 text-sm uppercase tracking-widest mb-3">Parecer Técnico IA</h4>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-indigo-100 whitespace-pre-wrap font-medium leading-relaxed font-mono">
                     {aiDiagnosis}
                  </div>
               </div>
            </div>
         </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 gap-8 overflow-y-auto custom-scrollbar pr-2">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
            {(loading && !stats) ? [1, 2, 3, 4].map(i => <CardSkeleton key={i} />) : (
               <>
                  <StatCard title="Pool de Conexões" value={`${stats?.connections || 0}/${stats?.maxConnections || '--'}`} sub={`${Math.round(((stats?.connections || 0) / (stats?.maxConnections || 1)) * 100)}% de ocupação`} icon={Users} historyKey="conn" />
                  <StatCard title="Cache Hit Rate" value={stats?.cacheHitRate || '---'} sub="Eficiência de Buffer Pool" icon={Activity} type="cache" historyKey="cache" />
                  <StatCard title="Transações (Commit)" value={stats?.transactionsCommit ? stats.transactionsCommit.toLocaleString() : '---'} sub="Throughput operacional" icon={BarChart3} historyKey="tps" />
                  <StatCard title="Uso de Disco Total" value={`${storage?.partition.percent || 0}%`} sub={`${formatBytes(storage?.partition.free || 0)} disponíveis`} icon={HardDrive} />
               </>
            )}
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0 shrink-0">
            <div className="lg:col-span-2 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2.5rem] shadow-sm overflow-hidden h-[540px]">
               <div className="px-8 pt-5 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                  <div className="flex gap-1">
                     <button 
                        onClick={() => setActiveSubTab('processes')}
                        className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2
                           ${activeSubTab === 'processes' ? 'border-indigo-600 text-indigo-600 bg-white dark:bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}
                        `}
                     >
                        <Terminal className="w-4 h-4" /> Processos
                     </button>
                     <button 
                        onClick={() => setActiveSubTab('locks')}
                        className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2
                           ${activeSubTab === 'locks' ? 'border-rose-600 text-rose-600 bg-white dark:bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}
                        `}
                     >
                        <Network className="w-4 h-4" /> Bloqueios
                        {rootBlockers.length > 0 && <span className="bg-rose-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{rootBlockers.length}</span>}
                     </button>
                     <button 
                        onClick={() => setActiveSubTab('storage')}
                        className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2
                           ${activeSubTab === 'storage' ? 'border-amber-600 text-amber-600 bg-white dark:bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}
                        `}
                     >
                        <HardDrive className="w-4 h-4" /> Armazenamento
                     </button>
                  </div>
               </div>

               <div className="flex-1 overflow-auto custom-scrollbar p-6">
                  {activeSubTab === 'processes' && (
                     <div className="space-y-4">
                        {(loading && processes.length === 0) ? <TableSkeleton rows={8} cols={4} /> : (
                           <table className="w-full text-left border-collapse">
                              <thead className="bg-slate-50/80 dark:bg-slate-800/80 sticky top-0 z-10 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100 dark:border-slate-700">
                                 <tr>
                                    <th className="px-6 py-4 w-20">PID</th>
                                    <th className="px-6 py-4 w-32">Usuário / Wait</th>
                                    <th className="px-6 py-4 w-24">Estado</th>
                                    <th className="px-6 py-4">Query / Árvore</th>
                                    <th className="px-6 py-4 w-20 text-center">Ação</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                 {filteredProcesses.map(proc => {
                                    const isBlocked = proc.blockingPids && proc.blockingPids.length > 0;
                                    const blockingOthers = blockingTree[proc.pid];
                                    const isNative = proc.backendType !== 'client backend';
                                    const waitColor = proc.waitEventType === 'Lock' ? 'text-rose-500' : proc.waitEventType === 'IO' ? 'text-amber-500' : 'text-slate-400';
                                    return (
                                       <tr key={proc.pid} className={`group transition-colors ${isBlocked ? 'bg-rose-50/30 dark:bg-rose-900/10' : blockingOthers ? 'bg-amber-50/30 dark:bg-amber-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                          <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">{proc.pid}</td>
                                          <td className="px-6 py-4"><div className="flex flex-col"><span className={`text-xs font-bold ${isNative ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{proc.user}</span><span className={`text-[9px] font-mono flex items-center gap-1 ${waitColor}`}><Anchor className="w-2.5 h-2.5" /> {proc.waitEvent}</span></div></td>
                                          <td className="px-6 py-4"><span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${proc.state === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{proc.state}</span></td>
                                          <td className="px-6 py-4 w-full max-w-0"><div className="flex flex-col gap-1.5"><code className={`text-[11px] font-mono block truncate group-hover:whitespace-pre-wrap group-hover:break-all transition-all duration-200 ${isNative ? 'text-slate-400 italic' : 'text-slate-600 dark:text-slate-400'}`}>{proc.query || (isNative ? `[${proc.backendType}]` : '(vazio)')}</code><div className="flex items-center gap-2">{isBlocked && <div className="flex items-center gap-1.5 text-[8px] text-rose-600 font-black uppercase bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800"><AlertTriangle className="w-2.5 h-2.5" /> Bloqueado por: {proc.blockingPids.join(', ')}</div>}{blockingOthers && <div className="flex items-center gap-1.5 text-[8px] text-amber-600 font-black uppercase bg-amber-100 dark:bg-rose-900/40 px-2 py-0.5 rounded border border-amber-200 dark:border-rose-800"><Layers className="w-2.5 h-2.5" /> Bloqueando: {blockingOthers.join(', ')}</div>}</div></div></td>
                                          <td className="px-6 py-4 text-center">{!isNative && <button onClick={() => handleKill(proc.pid)} disabled={terminatingPid === proc.pid} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all">{terminatingPid === proc.pid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</button>}</td>
                                       </tr>
                                    );
                                 })}
                              </tbody>
                           </table>
                        )}
                     </div>
                  )}

                  {activeSubTab === 'locks' && (
                     <div className="space-y-6">
                        {rootBlockers.length === 0 ? (
                           <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4 opacity-50">
                              <ShieldCheck className="w-16 h-16 text-emerald-500/50" />
                              <p className="text-sm font-bold uppercase tracking-widest">Nenhuma cadeia de bloqueio ativa.</p>
                           </div>
                        ) : (
                           <div className="space-y-4">
                              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex gap-3 text-amber-800 dark:text-amber-200 mb-6 shadow-sm">
                                 <Info className="w-5 h-5 shrink-0 mt-0.5" />
                                 <p className="text-xs font-medium leading-relaxed">
                                    Abaixo estão os <strong>Root Blockers</strong>. Matar o topo da cadeia libera todos os processos dependentes.
                                 </p>
                              </div>
                              {rootBlockers.map(pid => (
                                 <LockTreeNode 
                                    key={pid} 
                                    pid={pid} 
                                    processes={processes} 
                                    blockingTree={blockingTree} 
                                    onKill={handleKill}
                                    depth={0}
                                 />
                              ))}
                           </div>
                        )}
                     </div>
                  )}

                  {activeSubTab === 'storage' && storage && (
                     <div className="space-y-8 animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                              <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Ocupação da Partição ({storage.partition.mount})</h5>
                              <div className="flex items-center gap-8">
                                 <div className="relative w-28 h-28">
                                    <ResponsiveContainer width="100%" height="100%">
                                       <PieChart>
                                          <Pie data={[{v: storage.partition.used}, {v: storage.partition.free}]} innerRadius={35} outerRadius={50} dataKey="v">
                                             <Cell fill={storage.partition.percent > 85 ? '#ef4444' : '#6366f1'} />
                                             <Cell fill="#e2e8f0" className="dark:fill-slate-700" />
                                          </Pie>
                                       </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center font-black text-slate-700 dark:text-white text-lg">
                                       {storage.partition.percent}%
                                    </div>
                                 </div>
                                 <div className="space-y-1">
                                    <div className="text-sm font-black text-slate-700 dark:text-white">Físico Total: {formatBytes(storage.partition.total)}</div>
                                    <div className="text-xs text-slate-500 font-medium">Usado: {formatBytes(storage.partition.used)}</div>
                                    <div className="text-xs text-emerald-500 font-bold">Livre: {formatBytes(storage.partition.free)}</div>
                                 </div>
                              </div>
                           </div>
                           <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                              <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Projeção de Quota</h5>
                              <div className="flex flex-col gap-4">
                                 <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-amber-500"><AlertTriangle className="w-5 h-5" /></div>
                                    <div>
                                       <div className="text-xs font-black text-slate-700 dark:text-white uppercase">Alerta de Espaço</div>
                                       <div className="text-[10px] text-slate-500">Gatilho configurado em 90%</div>
                                    </div>
                                 </div>
                                 <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed italic">
                                    O diretório de dados está em <strong>{storage.dataDirectory}</strong>. Baseado na taxa de logs, certifique-se de ter ao menos 2x o tamanho do maior banco disponível.
                                 </p>
                              </div>
                           </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden">
                           <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 font-black text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-100 dark:border-slate-800">
                              Distribuição por Banco de Dados
                           </div>
                           <div className="h-64 p-6">
                              <ResponsiveContainer width="100%" height="100%">
                                 <BarChart data={storage.databases.slice(0, 8)}>
                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis hide />
                                    <Tooltip 
                                       formatter={(val: number) => formatBytes(val)}
                                       contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }}
                                    />
                                    <Bar dataKey="size" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} />
                                 </BarChart>
                              </ResponsiveContainer>
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            </div>

            <div className="bg-slate-950 rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl flex flex-col h-[540px]">
               <div className="flex items-center justify-between mb-8">
                  <div>
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-1"><ActivitySquare className="w-3.5 h-3.5 text-emerald-500" /> Carga Operacional</span>
                     <h4 className="text-xl font-black text-white">Transações / seg</h4>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">Last 100 samples</span>
               </div>
               <div className="flex-1 w-full">
                  {(loading && history.length === 0) ? <Skeleton className="w-full h-full rounded-2xl" /> : (
                     <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={history}>
                           <Line type="monotone" dataKey="tps" stroke="#10b981" strokeWidth={4} dot={false} isAnimationActive={false} />
                           <YAxis hide />
                           <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }} itemStyle={{ color: '#10b981' }} />
                        </LineChart>
                     </ResponsiveContainer>
                  )}
               </div>
               <div className="mt-6 pt-6 border-t border-slate-900">
                  <p className="text-xs text-slate-500 leading-relaxed">Frequência média de commits detectada no banco de dados. Picos repentinos podem indicar loops ou cargas massivas.</p>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 shrink-0">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2.5rem] shadow-sm flex flex-col overflow-hidden h-[380px]">
               <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2"><Anchor className="w-4 h-4 text-indigo-500" /> Índices Não Utilizados</h3>
                    <button onClick={() => setShowIndexWarningInfo(!showIndexWarningInfo)} className="p-1 text-slate-400 hover:text-indigo-500 transition-colors"><HelpCircle className="w-3.5 h-3.5" /></button>
                  </div>
                  {stats?.statsReset && <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">Coleta desde: {stats.statsReset}</span>}
               </div>
               <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-4">
                  {(loading && unusedIndexes.length === 0) ? [1, 2].map(i => (<div key={i} className="p-4 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-3"><Skeleton className="w-1/2 h-4" /><Skeleton className="w-1/3 h-3" /></div>)) : unusedIndexes.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-40"><ShieldCheck className="w-10 h-10 text-emerald-500 mb-2" /><p className="text-[10px] font-bold uppercase text-slate-400">Excelente! Nenhum índice ocioso encontrado.</p></div>) : (
                     unusedIndexes.map((idx, i) => (
                        <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 group hover:border-indigo-400 transition-all">
                           <div className="flex justify-between items-start mb-2"><span className="text-[11px] font-black text-slate-700 dark:text-white truncate pr-2">{idx.index}</span><div className="flex items-center gap-2"><span className="text-[10px] font-black text-rose-500 uppercase px-2 py-0.5 bg-rose-50 dark:bg-rose-900/30 rounded-lg">{idx.size}</span><button onClick={() => handleDropUnusedIndex(idx.schema, idx.index)} disabled={optimizingItems.has(`drop-${idx.schema}.${idx.index}`)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all">{optimizingItems.has(`drop-${idx.schema}.${idx.index}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button></div></div>
                           <div className="text-[9px] text-slate-400 flex items-center gap-1"><Database className="w-3 h-3" /> Tabela: <strong>{idx.schema}.{idx.table}</strong></div>
                        </div>
                     ))
                  )}
               </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2.5rem] shadow-sm flex flex-col overflow-hidden h-[380px]">
               <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                  <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2"><Gauge className="w-4 h-4 text-emerald-500" /> Autovacuum & Bloat</h3>
               </div>
               <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-4">
                  {(loading && tableInsights.length === 0) ? [1, 2].map(i => (<div key={i} className="p-4 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-3"><div className="flex justify-between"><Skeleton className="w-1/3 h-3" /><Skeleton className="w-1/4 h-3" /></div><Skeleton className="w-full h-2 rounded-full" /></div>)) : (
                     tableInsights.map((tbl, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 group hover:border-emerald-400/50 transition-all">
                           <div className="flex justify-between items-center mb-3"><span className="text-[11px] font-black text-slate-600 dark:text-slate-200 truncate">{tbl.schema}.{tbl.name}</span><div className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${tbl.deadTuples > 10000 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} /><span className="text-[9px] font-black text-slate-400 uppercase">{tbl.deadTuples.toLocaleString()} dead tuples</span><button onClick={() => handleVacuum(tbl.schema, tbl.name)} disabled={optimizingItems.has(`vacuum-${tbl.schema}.${tbl.name}`)} className="ml-1 p-1.5 text-slate-400 hover:text-emerald-500 rounded-lg transition-all">{optimizingItems.has(`vacuum-${tbl.schema}.${tbl.name}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brush className="w-3.5 h-3.5" />}</button></div></div>
                           <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"><div className={`h-full transition-all ${tbl.deadTuples > 10000 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min((tbl.deadTuples / (tbl.estimatedRows || 1)) * 100, 100)}%` }} /></div>
                        </div>
                     ))
                  )}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ServerHealthStep;