
import React, { useState, useEffect } from 'react';
import { 
  Rocket, Bot, Eye, Zap, Terminal, 
  Github, Sparkles, ChevronDown, ChevronUp, 
  Code2, Layers, Loader2, AlertCircle, RefreshCcw,
  CloudDownload
} from 'lucide-react';
import { Skeleton } from '../common/Skeleton';

// Safely get the version from Vite define or fallback
declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

const ROADMAP_URL = "https://raw.githubusercontent.com/Hamilton-Junior/psqlBuddy/main/roadmap.json";

interface RoadmapItem {
  title: string;
  desc: string;
  status: string;
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

const RoadmapSkeleton = () => (
  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
    {[1, 2, 3, 4].map(cat => (
      <div key={cat} className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="w-48 h-6" />
        </div>
        <div className="space-y-4">
          {[1, 2].map(item => (
            <div key={item} className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex justify-between items-start">
                <Skeleton className="w-1/2 h-5" />
                <Skeleton className="w-20 h-5 rounded-full" />
              </div>
              <Skeleton className="w-full h-3" />
              <Skeleton className="w-3/4 h-3" />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const RoadmapStep: React.FC = () => {
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const fetchRoadmap = async () => {
    setLoading(true);
    setError(null);
    console.log(`[ROADMAP] Buscando dados dinâmicos em: ${ROADMAP_URL}`);
    try {
      const response = await fetch(ROADMAP_URL);
      if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
      const json = await response.json();
      setData(json);
      console.log("[ROADMAP] Dados carregados com sucesso.");
    } catch (err: any) {
      console.error("[ROADMAP] Falha ao carregar roadmap dinâmico:", err);
      setError("Não foi possível carregar o roadmap do servidor. Verifique sua conexão.");
    } finally {
      // Pequeno delay para suavizar a transição do skeleton para o conteúdo real
      setTimeout(() => setLoading(false), 400);
    }
  };

  useEffect(() => {
    fetchRoadmap();
  }, []);

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
           <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Ops! Falha de Conexão</h3>
           <p className="text-slate-500 max-w-md">{error}</p>
        </div>
        <button 
          onClick={fetchRoadmap}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all"
        >
          <RefreshCcw className="w-4 h-4" /> Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <Rocket className="w-8 h-8 text-indigo-600 animate-bounce-slow" />
            Roadmap do Produto
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">
            Acompanhe a visão técnica para transformar o <span className="font-bold text-indigo-600">PSQL Buddy</span> em uma ferramenta Enterprise.
          </p>
        </div>
        
        <div className="hidden md:flex bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm items-center gap-4">
           <div className="text-right">
              <span className="block text-xs font-black text-slate-400 uppercase tracking-widest">Versão App</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">v{APP_VERSION}</span>
           </div>
           <div className="w-px h-8 bg-slate-100 dark:bg-slate-700"></div>
           <div className="flex items-center gap-2 text-emerald-500" title="Dados sincronizados com o GitHub">
              <CloudDownload className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase">Live</span>
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-20">
        {loading ? (
          <RoadmapSkeleton />
        ) : data && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {data.categories.map((cat, idx) => (
              <div key={idx} className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                        {IconMap[cat.icon] || <Layers className="w-6 h-6 text-slate-400" />}
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 dark:text-white uppercase tracking-tight">
                        {cat.title}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {cat.items.map((item, iIdx) => {
                      const isExpanded = expandedItem === item.title;
                      return (
                          <div 
                            key={iIdx} 
                            onClick={() => toggleItem(item.title)}
                            className={`group bg-white dark:bg-slate-800 p-5 rounded-3xl border transition-all duration-300 relative overflow-hidden cursor-pointer
                                ${isExpanded ? 'border-indigo-500 shadow-2xl ring-1 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-xl'}
                            `}
                          >
                            <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors ${isExpanded ? 'bg-indigo-600' : 'bg-slate-100 dark:bg-slate-700 group-hover:bg-indigo-500'}`}></div>
                            
                            <div className="flex justify-between items-start mb-3">
                                <h4 className={`text-base font-black transition-colors ${isExpanded ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`}>
                                  {item.title}
                                </h4>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border
                                      ${item.status === 'Finalizado' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400' :
                                        item.status === 'Planejado' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 
                                        item.status === 'Em Discussão' ? 'bg-cyan-50 text-cyan-600 border-cyan-100' :
                                        'bg-slate-50 text-slate-500 border-slate-100'}
                                  `}>
                                      {item.status}
                                  </span>
                                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                </div>
                            </div>
                            
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                {item.desc}
                            </p>

                            {isExpanded && item.implementationPlan && (
                                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                                  <div className="flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em]">
                                      <Code2 className="w-4 h-4" /> Visão de Implementação
                                  </div>
                                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 space-y-3">
                                      {item.implementationPlan.map((step, sIdx) => (
                                        <div key={sIdx} className="flex items-start gap-3">
                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></div>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{step}</p>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                            )}
                            
                            {!isExpanded && (
                                <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-700/50 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">Clique para ver detalhes técnicos</span>
                                  <button className="text-[10px] font-black uppercase text-indigo-500 hover:underline flex items-center gap-1">
                                      Votar Sugestão <Sparkles className="w-3 h-3" />
                                  </button>
                                </div>
                            )}
                          </div>
                      );
                    })}
                  </div>
              </div>
            ))}
          </div>
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
      `}</style>
    </div>
  );
};

export default RoadmapStep;
