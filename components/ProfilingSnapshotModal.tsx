import React, { useState, useEffect, useMemo } from 'react';
import { X, Camera, Clock, BarChart3, Trash2, ArrowRight, Gauge, Layers, Info, CheckCircle2, AlertTriangle, Sparkles, Loader2, Database, Zap, FileJson } from 'lucide-react';
import { QueryProfilingSnapshot } from '../types';
import { GoogleGenAI } from "@google/genai";
import { toast } from 'react-hot-toast';

interface ProfilingSnapshotModalProps {
  onClose: () => void;
}

const ProfilingSnapshotModal: React.FC<ProfilingSnapshotModalProps> = ({ onClose }) => {
  const [snapshots, setSnapshots] = useState<QueryProfilingSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<QueryProfilingSnapshot | null>(null);
  const [compareSnapshot, setCompareSnapshot] = useState<QueryProfilingSnapshot | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('psqlbuddy-profiling-snapshots');
    if (stored) {
      setSnapshots(JSON.parse(stored));
    }
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = snapshots.filter(s => s.id !== id);
    setSnapshots(updated);
    localStorage.setItem('psqlbuddy-profiling-snapshots', JSON.stringify(updated));
    if (selectedSnapshot?.id === id) setSelectedSnapshot(null);
    if (compareSnapshot?.id === id) setCompareSnapshot(null);
    toast.success("Snapshot removido.");
  };

  const handleAnalyzeIA = async () => {
    if (!selectedSnapshot) return;
    setIsAnalysing(true);
    setAiAdvice(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const comparisonContext = compareSnapshot 
        ? `COMPARAÇÃO COM SNAPSHOT ANTERIOR:
           Original: ${compareSnapshot.metrics.totalRuntime}ms, Buffers Read: ${compareSnapshot.metrics.sharedReadBuffers}
           Atual: ${selectedSnapshot.metrics.totalRuntime}ms, Buffers Read: ${selectedSnapshot.metrics.sharedReadBuffers}`
        : '';

      const prompt = `
        Aja como um DBA Sênior PostgreSQL. Analise os dados de PROFILING desta query:
        SQL: ${selectedSnapshot.sql}
        METRICAS: ${JSON.stringify(selectedSnapshot.metrics)}
        PLANO: ${JSON.stringify(selectedSnapshot.plan).substring(0, 3000)}
        
        ${comparisonContext}

        FORNEÇA:
        1. Diagnóstico de I/O (Buffers Read vs Hit).
        2. Alerta de Planning vs Execution time.
        3. 3 recomendações concretas de otimização baseadas no plano.
        
        Use Markdown. Responda em Português de forma técnica mas direta.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
      });

      setAiAdvice(response.text || "Não foi possível gerar análise.");
    } catch (e: any) {
      toast.error("Erro na análise de IA.");
    } finally {
      setIsAnalysing(false);
    }
  };

  const MetricItem = ({ label, value, unit = 'ms', icon: Icon, color = 'indigo' }: any) => (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
       <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-3.5 h-3.5 text-${color}-500`} />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
       </div>
       <div className="text-lg font-black text-slate-800 dark:text-white font-mono">
          {value}<span className="text-[10px] ml-0.5 opacity-50">{unit}</span>
       </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[140] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-6xl h-[90vh] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95">
        
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shrink-0">
           <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                 <Gauge className="w-6 h-6" />
              </div>
              <div>
                 <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Query Profiling History</h3>
                 <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Snapshot Analytics & Performance Gallery</p>
              </div>
           </div>
           <button onClick={onClose} className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-500 transition-all">
              <X className="w-6 h-6" />
           </button>
        </div>

        <div className="flex-1 flex min-h-0 overflow-hidden">
           {/* Sidebar: Galeria */}
           <div className="w-80 border-r border-slate-100 dark:border-slate-800 flex flex-col bg-slate-50/30 dark:bg-slate-950/20">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                 <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                    <span>Snapshots Capturados</span>
                    <span className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">{snapshots.length}</span>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                 {snapshots.length === 0 ? (
                    <div className="text-center py-12 px-4 opacity-40">
                       <Camera className="w-12 h-12 mx-auto mb-4" />
                       <p className="text-xs font-bold uppercase">Nenhum snapshot salvo ainda.</p>
                    </div>
                 ) : snapshots.map(s => {
                    const isSelected = selectedSnapshot?.id === s.id;
                    const isComparing = compareSnapshot?.id === s.id;
                    
                    return (
                       <div 
                          key={s.id}
                          onClick={() => setSelectedSnapshot(s)}
                          className={`p-4 rounded-[1.5rem] border transition-all cursor-pointer relative group
                             ${isSelected 
                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-900/20' 
                                : isComparing 
                                   ? 'bg-amber-100 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                                   : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-lg'
                             }
                          `}
                       >
                          <div className="flex justify-between items-start mb-2">
                             <span className={`text-[10px] font-black uppercase tracking-tighter ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {new Date(s.timestamp).toLocaleTimeString()} • {new Date(s.timestamp).toLocaleDateString()}
                             </span>
                             <button onClick={(e) => handleDelete(s.id, e)} className={`p-1 rounded hover:bg-black/10 ${isSelected ? 'text-indigo-300' : 'text-slate-400 hover:text-red-500'}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                             </button>
                          </div>
                          <div className="font-bold text-sm truncate">{s.name}</div>
                          <div className={`text-[10px] mt-1 font-mono flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                             <Zap className="w-3 h-3" /> {s.metrics.totalRuntime.toFixed(2)}ms
                          </div>
                          
                          {isSelected && (
                             <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-8 bg-indigo-500 rounded-l-full"></div>
                          )}
                       </div>
                    );
                 })}
              </div>
           </div>

           {/* Main Content: Analytics */}
           <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/30 p-8 custom-scrollbar">
              {selectedSnapshot ? (
                 <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                       <div>
                          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{selectedSnapshot.name}</h2>
                          <div className="flex items-center gap-3 mt-1">
                             <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Clock className="w-3.5 h-3.5" /> {new Date(selectedSnapshot.timestamp).toLocaleString()}
                             </div>
                             <span className="text-slate-200 dark:text-slate-800">|</span>
                             <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800 uppercase tracking-widest">Profiling Active</span>
                          </div>
                       </div>
                       <div className="flex gap-2">
                          {snapshots.length > 1 && (
                             <select 
                                value={compareSnapshot?.id || ''} 
                                onChange={(e) => setCompareSnapshot(snapshots.find(s => s.id === e.target.value) || null)}
                                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none shadow-sm focus:ring-2 focus:ring-amber-500"
                             >
                                <option value="">Comparar com...</option>
                                {snapshots.filter(s => s.id !== selectedSnapshot.id).map(s => (
                                   <option key={s.id} value={s.id}>{s.name} ({s.metrics.totalRuntime.toFixed(0)}ms)</option>
                                ))}
                             </select>
                          )}
                          <button 
                             onClick={handleAnalyzeIA}
                             disabled={isAnalysing}
                             className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-900/20 transition-all active:scale-95 disabled:opacity-50"
                          >
                             {isAnalysing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Analisar Performance
                          </button>
                       </div>
                    </div>

                    <div className="bg-slate-950 rounded-[2rem] p-6 border border-slate-800 shadow-2xl relative group">
                       <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { navigator.clipboard.writeText(selectedSnapshot.sql); toast.success("SQL Copiado!"); }} className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg"><FileJson className="w-4 h-4" /></button>
                       </div>
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">Consulta em Profiling</span>
                       <code className="text-xs font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed">
                          {selectedSnapshot.sql}
                       </code>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       <MetricItem label="Total Runtime" value={selectedSnapshot.metrics.totalRuntime.toFixed(2)} icon={Zap} />
                       <MetricItem label="Planning Time" value={selectedSnapshot.metrics.planningTime.toFixed(2)} icon={Layers} color="amber" />
                       <MetricItem label="Buffer Hits" value={selectedSnapshot.metrics.sharedHitBuffers?.toLocaleString()} icon={CheckCircle2} color="emerald" unit="blocks" />
                       <MetricItem label="Buffer Reads" value={selectedSnapshot.metrics.sharedReadBuffers?.toLocaleString()} icon={AlertTriangle} color="rose" unit="blocks" />
                    </div>

                    {aiAdvice && (
                       <div className="p-8 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-[2.5rem] shadow-sm animate-in slide-in-from-top-4 duration-300">
                          <div className="flex items-center gap-3 mb-6">
                             <div className="p-2 bg-white dark:bg-indigo-900 rounded-xl shadow-sm"><Sparkles className="w-5 h-5 text-indigo-600" /></div>
                             <h4 className="font-black text-indigo-900 dark:text-indigo-200 text-sm uppercase tracking-widest">Diagnóstico assistido por Gemini 3 Pro</h4>
                          </div>
                          <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-indigo-100/80 font-medium leading-relaxed font-mono whitespace-pre-wrap">
                             {aiAdvice}
                          </div>
                       </div>
                    )}

                    {!aiAdvice && !isAnalysing && (
                       <div className="p-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center text-center text-slate-400 gap-4 opacity-50">
                          <BarChart3 className="w-12 h-12" />
                          <p className="text-sm font-bold uppercase tracking-widest">Clique em "Analisar Performance" para gerar um diagnóstico completo via IA.</p>
                       </div>
                    )}

                    {isAnalysing && (
                       <div className="p-10 bg-white dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center gap-4 text-center">
                          <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
                          <div>
                             <h4 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">O Consultor DBA está analisando...</h4>
                             <p className="text-xs text-slate-500 font-bold uppercase mt-1 tracking-widest">Verificando Buffers, Sequential Scans e Regressões de Tempo</p>
                          </div>
                       </div>
                    )}
                 </div>
              ) : (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-6 opacity-30">
                    <div className="p-10 bg-white dark:bg-slate-800 rounded-full shadow-inner border border-slate-100 dark:border-slate-800">
                       <Gauge className="w-24 h-24" />
                    </div>
                    <div className="text-center max-w-sm">
                       <h4 className="text-xl font-black uppercase tracking-tight mb-2">Performance Center</h4>
                       <p className="text-sm font-bold leading-relaxed">Selecione um instantâneo de execução na galeria lateral para ver detalhes métricos e diagnósticos de IA.</p>
                    </div>
                 </div>
              )}
           </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end shrink-0">
           <button onClick={onClose} className="px-10 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-200 transition-all active:scale-95 shadow-sm">
              Fechar Analytics
           </button>
        </div>

      </div>
    </div>
  );
};

export default ProfilingSnapshotModal;