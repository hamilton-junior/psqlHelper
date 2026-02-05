
import React, { useState, useMemo } from 'react';
// Fix: Remove 'Type' from incorrect import from '../types'
import { ExplainNode, DatabaseSchema } from '../types';
import { Gauge, Clock, Layers, Hash, Database, ChevronRight, ChevronDown, AlertCircle, Sparkles, Loader2, Info, Activity, Terminal, ListOrdered } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { toast } from 'react-hot-toast';

interface ExplainVisualizerProps {
  plan: ExplainNode | null;
  loading: boolean;
  error: string | null;
  onCaptureProfiling: () => void;
  sql?: string;
}

type ExplainSubTab = 'tree' | 'timeline' | 'insights';

const ExplainVisualizer: React.FC<ExplainVisualizerProps> = ({ plan, loading, error, onCaptureProfiling, sql }) => {
  const [activeTab, setActiveTab] = useState<ExplainSubTab>('tree');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const flatNodes = useMemo(() => {
    if (!plan) return [];
    const list: (ExplainNode & { depth: number })[] = [];
    const traverse = (node: ExplainNode, depth: number) => {
      list.push({ ...node, depth });
      if (node.children) node.children.forEach(c => traverse(c, depth + 1));
    };
    traverse(plan, 0);
    return list;
  }, [plan]);

  const totalTime = plan?.actualTime?.total || 1;

  const handleAiInsights = async () => {
    if (!plan || !sql) return;
    setIsDiagnosing(true);
    setAiAnalysis(null);
    try {
      // Fix: Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        Analise este plano de execução PostgreSQL (EXPLAIN ANALYZE) para a query: "${sql}"
        PLANO (JSON): ${JSON.stringify(plan).substring(0, 4000)}
        
        INSTRUÇÃO: Identifique o nó mais lento e explique por que ele está atrasando a query. 
        Sugira exatamente 2 índices ou mudanças estruturais. Seja técnico e conciso.
      `;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      setAiAnalysis(response.text || "Não foi possível gerar análise.");
      setActiveTab('insights');
    } catch (e) {
      toast.error("Erro ao conectar com a IA");
    } finally {
      setIsDiagnosing(false);
    }
  };

  if (loading) return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="w-1/4 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          <div className="w-1/3 h-3 bg-slate-50 dark:bg-slate-900 rounded opacity-50 animate-pulse" />
        </div>
      </div>
      <div className="space-y-4 pl-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl space-y-3">
             <div className="w-1/3 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
             <div className="flex gap-4">
               <div className="w-20 h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
               <div className="w-20 h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
             </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div className="p-10 text-center flex flex-col items-center justify-center text-slate-400">
      <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-slate-700 dark:text-slate-200 font-bold mb-1">Falha na Análise</h3>
      <p className="text-sm max-w-md">{error}</p>
    </div>
  );

  if (!plan) return <div className="p-10 text-center text-slate-400">Nenhum plano disponível.</div>;

  const renderNode = (node: ExplainNode, depth: number = 0) => {
    const isHot = (node.exclusivePercent || 0) > 30;
    const isMed = (node.exclusivePercent || 0) > 10;
    
    return (
      <div key={Math.random()} style={{ marginLeft: depth * 20 }} className="mb-4 group">
        <div className={`bg-white dark:bg-slate-800 border-2 rounded-2xl p-4 shadow-sm inline-block min-w-[340px] transition-all
          ${isHot ? 'border-rose-500 ring-4 ring-rose-500/10' : isMed ? 'border-amber-400' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400'}
        `}>
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col">
              <span className={`font-black text-xs uppercase tracking-widest ${isHot ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                {node.type}
              </span>
              {node.relation && <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded mt-1 inline-block">{node.relation}</span>}
            </div>
            <div className={`px-2 py-1 rounded-lg text-[10px] font-black
              ${isHot ? 'bg-rose-100 text-rose-700' : isMed ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}
            `}>
              {node.exclusivePercent?.toFixed(1)}% exclusive
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-50 dark:border-slate-700">
             <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <Clock className="w-3 h-3 text-indigo-400" />
                <span>Time: <strong>{node.actualTime?.total?.toFixed(2)}ms</strong></span>
             </div>
             <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <ListOrdered className="w-3 h-3 text-indigo-400" />
                <span>Rows: <strong>{node.actualRows?.toLocaleString()}</strong></span>
             </div>
             {node.buffers && node.buffers.sharedHit !== undefined && (
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                   <Database className="w-3 h-3 text-emerald-500" />
                   <span>Cache Hits: <strong>{node.buffers.sharedHit}</strong></span>
                </div>
             )}
             {node.buffers && node.buffers.sharedRead !== undefined && node.buffers.sharedRead > 0 && (
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                   <Database className="w-3 h-3 text-rose-500" />
                   <span>Disk Reads: <strong>{node.buffers.sharedRead}</strong></span>
                </div>
             )}
          </div>
        </div>
        {node.children && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 font-sans">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
             <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest block">Profiling & Visual Explain</span>
             <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Tempo Total: {totalTime.toFixed(2)}ms</span>
          </div>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
           <button onClick={() => setActiveTab('tree')} className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${activeTab === 'tree' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Tree</button>
           <button onClick={() => setActiveTab('timeline')} className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${activeTab === 'timeline' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Timeline</button>
           <button onClick={() => setActiveTab('insights')} className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${activeTab === 'insights' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>IA Insights</button>
        </div>

        <div className="flex gap-2">
           <button onClick={handleAiInsights} disabled={isDiagnosing} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50">
              {isDiagnosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Interpretar Plano
           </button>
           <button onClick={onCaptureProfiling} className="flex items-center gap-2 px-4 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all">
              Snapshot
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'tree' && (
           <div className="h-full overflow-auto p-8 custom-scrollbar">
              {renderNode(plan)}
           </div>
        )}

        {activeTab === 'timeline' && (
           <div className="h-full overflow-auto p-8 space-y-2 custom-scrollbar bg-white dark:bg-slate-900">
              {flatNodes.map((node, i) => {
                 const exclusiveWidth = node.exclusivePercent || 0;
                 const isHot = exclusiveWidth > 30;
                 return (
                    <div key={i} className="flex items-center gap-4 group">
                       <div className="w-48 shrink-0">
                          <span className={`text-[10px] font-black uppercase tracking-tight truncate block ${isHot ? 'text-rose-500' : 'text-slate-600 dark:text-slate-400'}`} title={node.type}>
                             {node.type} {node.relation ? `(${node.relation})` : ''}
                          </span>
                       </div>
                       <div className="flex-1 h-8 bg-slate-50 dark:bg-slate-950 rounded-lg overflow-hidden relative border border-slate-100 dark:border-slate-800">
                          <div 
                             className={`h-full transition-all duration-1000 ease-out flex items-center justify-end pr-2
                                ${isHot ? 'bg-gradient-to-r from-rose-400 to-rose-600' : 'bg-gradient-to-r from-indigo-400 to-indigo-600'}
                             `}
                             style={{ width: `${Math.max(1, exclusiveWidth)}%` }}
                          >
                             <span className="text-[9px] font-black text-white">{node.exclusiveTime?.toFixed(2)}ms</span>
                          </div>
                       </div>
                       <div className="w-16 text-right shrink-0">
                          <span className="text-[10px] font-mono text-slate-400">{exclusiveWidth.toFixed(1)}%</span>
                       </div>
                    </div>
                 );
              })}
           </div>
        )}

        {activeTab === 'insights' && (
           <div className="h-full p-8 overflow-auto custom-scrollbar">
              {aiAnalysis ? (
                 <div className="max-w-3xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex gap-3 text-indigo-700 dark:text-indigo-200">
                       <Info className="w-6 h-6 shrink-0" />
                       <p className="text-sm leading-relaxed font-medium">Recomendações técnicas geradas pela IA baseadas nos dados reais de I/O e tempo da sua consulta.</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-xl prose prose-sm dark:prose-invert max-w-none">
                       <div dangerouslySetInnerHTML={{ 
                          __html: aiAnalysis
                             .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                             .replace(/\n/g, '<br />')
                       }} />
                    </div>
                 </div>
              ) : (
                 <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50">
                    <Sparkles className="w-12 h-12 mb-4" />
                    <p className="text-sm font-bold uppercase tracking-widest">Clique em "Interpretar Plano" para obter ajuda da IA.</p>
                 </div>
              )}
           </div>
        )}
      </div>
    </div>
  );
};

export default ExplainVisualizer;
