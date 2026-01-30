
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Rocket, Bot, Eye, Zap, Terminal, 
  Sparkles, ChevronDown, ChevronUp, 
  Code2, Layers, Loader2, AlertCircle, RefreshCcw,
  CloudDownload, LayoutGrid, ListTodo, CheckCircle2,
  Clock, History, Dna, Play, Info, ThumbsUp, ArrowUpRight,
  GitCommit, Flag, GitBranch
} from 'lucide-react';
import { Skeleton } from '../common/Skeleton';
import { AppStep } from '../../types';

declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

const ROADMAP_URL = "https://raw.githubusercontent.com/Hamilton-Junior/psqlBuddy/main/roadmap.json";

interface RoadmapItem {
  title: string;
  desc: string;
  status: string;
  size?: 'Pequeno' | 'Médio' | 'Grande';
  progress?: number;
  votes?: number;
  addedInVersion?: string;
  releasedInVersion?: string;
  featureLink?: AppStep;
  implementationPlan?: string[];
}

interface RoadmapCategory {
  title: string;
  icon: string;
  items: RoadmapItem[];
}

interface RoadmapData {
  categories: RoadmapCategory[];
}

const IconMap: Record<string, React.ReactNode> = {
  "Bot": <Bot className="w-6 h-6 text-indigo-600" />,
  "Eye": <Eye className="w-6 h-6 text-emerald-600" />,
  "Zap": <Zap className="w-6 h-6 text-amber-600" />,
  "Terminal": <Terminal className="w-6 h-6 text-rose-600" />
};

const SizeIconMap: Record<string, React.ReactNode> = {
  "Pequeno": <Zap className="w-3 h-3" />,
  "Médio": <Layers className="w-3 h-3" />,
  "Grande": <Dna className="w-3 h-3" />
};

const RoadmapStep: React.FC<{ onNavigate?: (step: AppStep) => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [votedItems, setVotedItems] = useState<Set<string>>(new Set());

  const fetchRoadmap = async () => {
    console.log("[ROADMAP] Iniciando busca de dados do repositório...");
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(ROADMAP_URL);
      if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
      const json = await response.json();
      console.log("[ROADMAP] Dados recebidos com sucesso.");
      setData(json);
    } catch (err: any) {
      console.error("[ROADMAP] Falha ao carregar roadmap:", err);
      setError("Não foi possível carregar o roadmap do servidor.");
    } finally {
      setTimeout(() => setLoading(false), 400);
    }
  };

  useEffect(() => {
    fetchRoadmap();
  }, []);

  const handleVote = (e: React.MouseEvent, title: string) => {
    e.stopPropagation();
    if (votedItems.has(title)) return;
    setVotedItems(prev => new Set(prev).add(title));
  };

  const allItems = useMemo(() => {
    if (!data) return [];
    return data.categories.flatMap(cat => cat.items);
  }, [data]);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return allItems;
    return allItems.filter(item => item.status === activeFilter);
  }, [allItems, activeFilter]);

  const filterStats = useMemo(() => {
    const stats: Record<string, number> = { all: allItems.length };
    allItems.forEach(item => {
      stats[item.status] = (stats[item.status] || 0) + 1;
    });
    return stats;
  }, [allItems]);

  const toggleItem = (title: string) => {
    setExpandedItem(expandedItem === title ? null : title);
  };

  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
        <div className="p-6 bg-red-50 dark:bg-red-950/20 rounded-full">
           <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <div>
           <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Falha de Sincronização</h3>
           <p className="text-slate-500 max-w-md">{error}</p>
        </div>
        <button onClick={fetchRoadmap} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all">
          <RefreshCcw className="w-4 h-4" /> Recarregar Agora
        </button>
      </div>
    );
  }

  const renderItemCard = (item: RoadmapItem) => {
    const isExpanded = expandedItem === item.title;
    const hasVoted = votedItems.has(item.title);
    const isFinished = item.status === 'Finalizado';
    
    return (
      <div 
        onClick={() => toggleItem(item.title)}
        className={`group bg-white dark:bg-slate-800 p-6 rounded-[2rem] border transition-all duration-300 relative overflow-hidden cursor-pointer
            ${isExpanded ? 'border-indigo-500 shadow-2xl ring-1 ring-indigo-500/20' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-xl'}
        `}
      >
        <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors ${isExpanded ? 'bg-indigo-600' : 'bg-slate-100 dark:bg-slate-700 group-hover:bg-indigo-500'}`}></div>
        
        <div className="flex justify-between items-start mb-4">
            <div className="flex-1 min-w-0">
                <h4 className={`text-lg font-black transition-colors truncate ${isExpanded ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`}>
                  {item.title}
                </h4>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                   <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border
                      ${item.status === 'Finalizado' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400' :
                        item.status === 'Planejado' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/30' : 
                        item.status === 'Em Discussão' ? 'bg-cyan-50 text-cyan-600 border-cyan-100 dark:bg-cyan-900/30' :
                        item.status === 'Em Desenvolvimento' ? 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950 dark:text-orange-400' :
                        'bg-slate-50 text-slate-500 border-slate-100'}
                   `}>
                      {item.status}
                   </span>
                   {item.size && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase border border-slate-100 dark:border-slate-800 rounded-full">
                         {SizeIconMap[item.size]} {item.size}
                      </span>
                   )}
                </div>
            </div>
            {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
        
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium line-clamp-2">
            {item.desc}
        </p>

        {/* Barra de Progresso Real */}
        {item.status === 'Em Desenvolvimento' && item.progress !== undefined && (
          <div className="mt-6 space-y-2">
             <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <span>Progresso Técnico</span>
                <span className="text-orange-600 dark:text-orange-400">{item.progress}%</span>
             </div>
             <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-50 dark:border-slate-800">
                <div 
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-1000"
                  style={{ width: `${item.progress}%` }}
                />
             </div>
          </div>
        )}

        {isExpanded && (
            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-6 animate-in fade-in slide-in-from-top-1 duration-300">
              {item.implementationPlan && (
                <>
                  <div className="flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em]">
                      <Code2 className="w-4 h-4" /> Visão de Implementação
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 space-y-3">
                      {item.implementationPlan.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-3">
                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">{step}</p>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
        )}
        
        <div className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-700/50 flex justify-between items-center gap-4">
           {isFinished && item.featureLink ? (
             <button 
                onClick={(e) => { e.stopPropagation(); onNavigate?.(item.featureLink!); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-900/20 transition-all active:scale-95 group/btn"
             >
                <Play className="w-3.5 h-3.5 fill-current" /> Experimentar Agora
                <ArrowUpRight className="w-3 h-3 opacity-50 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
             </button>
           ) : (
             <button 
                onClick={(e) => handleVote(e, item.title)}
                disabled={hasVoted}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                   ${hasVoted 
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 scale-95' 
                      : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white dark:bg-indigo-950 dark:text-indigo-400'}
                `}
             >
                <ThumbsUp className={`w-3.5 h-3.5 ${hasVoted ? 'fill-current' : ''}`} />
                {hasVoted ? 'Votado' : 'Votar Sugestão'}
                <span className={`ml-1 px-2 py-0.5 rounded-full ${hasVoted ? 'bg-emerald-200/50' : 'bg-indigo-200/50'}`}>
                   {(item.votes || 0) + (hasVoted ? 1 : 0)}
                </span>
             </button>
           )}

           {!isExpanded && (
              <span className="text-[10px] text-slate-400 font-bold uppercase hidden sm:flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                <Info className="w-3 h-3" /> Detalhes
              </span>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden">
      {/* Header Operational */}
      <div className="mb-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-6 shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <Rocket className="w-8 h-8 text-indigo-600 hover:animate-takeoff cursor-default transition-all" />
            Roadmap Estratégico
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg font-medium">
            Transformando o <span className="font-bold text-indigo-600">PSQL Buddy</span> na ferramenta definitiva para PostgreSQL.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
           <button 
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              title="Visualização em Grade"
           >
              <LayoutGrid className="w-5 h-5" />
           </button>
           <button 
              onClick={() => setViewMode('timeline')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'timeline' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              title="Visualização em Linha do Tempo"
           >
              <ListTodo className="w-5 h-5" />
           </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 flex flex-wrap items-center gap-2 shrink-0">
         {[
           { id: 'all', label: 'Todos', icon: <Layers className="w-3.5 h-3.5" /> },
           { id: 'Finalizado', label: 'Lançados', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
           { id: 'Em Desenvolvimento', label: 'Desenvolvendo', icon: <RefreshCcw className="w-3.5 h-3.5" /> },
           { id: 'Planejado', label: 'Planejados', icon: <Clock className="w-3.5 h-3.5" /> },
           { id: 'Em Discussão', label: 'Feedback', icon: <ThumbsUp className="w-3.5 h-3.5" /> }
         ].map(filter => (
            <button
               key={filter.id}
               onClick={() => setActiveFilter(filter.id)}
               className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition-all active:scale-95
                  ${activeFilter === filter.id 
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/20' 
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-indigo-300'}
               `}
            >
               {filter.icon}
               {filter.label}
               <span className={`ml-1.5 px-1.5 rounded-full text-[10px] ${activeFilter === filter.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                  {filterStats[filter.id] || 0}
               </span>
            </button>
         ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-20">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {[1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-slate-100 dark:bg-slate-800 rounded-[2rem] animate-pulse" />)}
          </div>
        ) : data && (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
               {data.categories.map((cat, idx) => {
                  const filteredCatItems = cat.items.filter(i => activeFilter === 'all' || i.status === activeFilter);
                  if (filteredCatItems.length === 0) return null;

                  return (
                    <div key={idx} className="space-y-6">
                        <div className="flex items-center gap-4 px-4">
                           <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                               {IconMap[cat.icon] || <Layers className="w-6 h-6 text-slate-400" />}
                           </div>
                           <div>
                              <h3 className="text-xl font-black text-slate-700 dark:text-white uppercase tracking-tighter">
                                  {cat.title}
                              </h3>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{filteredCatItems.length} FUNCIONALIDADES</span>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                          {filteredCatItems.map((item, iIdx) => (
                             <React.Fragment key={iIdx}>{renderItemCard(item)}</React.Fragment>
                          ))}
                        </div>
                    </div>
                  );
               })}
            </div>
          ) : (
            <div className="max-w-4xl mx-auto py-10 relative">
               {/* Central line */}
               <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-1 bg-slate-200 dark:bg-slate-800 -translate-x-1/2 rounded-full"></div>
               
               <div className="space-y-16">
                  {filteredItems.map((item, idx) => {
                     const isEven = idx % 2 === 0;
                     const statusColor = item.status === 'Finalizado' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : item.status === 'Em Desenvolvimento' ? 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'bg-slate-400';
                     
                     return (
                        <div key={idx} className="relative flex flex-col md:flex-row items-start gap-10">
                           {/* Marker */}
                           <div className={`absolute left-8 md:left-1/2 w-6 h-6 rounded-full border-4 border-slate-50 dark:border-slate-900 -translate-x-1/2 z-10 transition-all duration-500 top-8 ${statusColor}`}></div>
                           
                           {/* Metadados de Versionamento */}
                           <div className={`w-full md:w-1/2 pl-16 md:pl-0 pt-4 ${isEven ? 'md:text-right md:order-1' : 'md:text-left md:order-3'}`}>
                              <div className={`flex flex-col gap-3 ${isEven ? 'md:items-end' : 'md:items-start'}`}>
                                 {/* Proposta */}
                                 <div className="flex items-center gap-2 bg-indigo-50/50 dark:bg-indigo-950/20 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                                    <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
                                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                       Proposta v{item.addedInVersion || '0.1.0'}
                                    </span>
                                 </div>

                                 {/* Lançamento (se houver) */}
                                 {item.status === 'Finalizado' && item.releasedInVersion && (
                                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900 animate-in slide-in-from-top-1">
                                       <Flag className="w-3.5 h-3.5 text-emerald-600" />
                                       <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                          Lançada {item.releasedInVersion}
                                       </span>
                                    </div>
                                 )}

                                 {/* Status Técnico Compacto */}
                                 <div className="flex items-center gap-2 opacity-50">
                                    <GitCommit className="w-3 h-3 text-slate-400" />
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.size || 'Médio'} Impacto</span>
                                 </div>
                              </div>
                           </div>
                           
                           {/* Card de Conteúdo */}
                           <div className={`w-full md:w-1/2 pl-16 md:pl-0 ${isEven ? 'md:order-3' : 'md:order-1'}`}>
                              {renderItemCard(item)}
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>
          )
        )}
      </div>

      <style>{`
        @keyframes bounce-slow {
           0%, 100% { transform: translateY(0); }
           50% { transform: translateY(-5px); }
        }
        .animate-bounce-slow {
           animation: bounce-slow 3s infinite;
        }
        .scrollbar-none::-webkit-scrollbar {
           display: none;
        }
      `}</style>
    </div>
  );
};

export default RoadmapStep;
