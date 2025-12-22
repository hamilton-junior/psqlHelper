
import React, { useState } from 'react';
import { X, FileSearch, Sparkles, Loader2, Play, AlertTriangle } from 'lucide-react';
import { DatabaseSchema } from '../types';
import { analyzeLog } from '../services/geminiService';

interface LogAnalyzerModalProps {
  schema: DatabaseSchema;
  onClose: () => void;
  onRunSql: (sql: string) => void;
}

const LogAnalyzerModal: React.FC<LogAnalyzerModalProps> = ({ schema, onClose, onRunSql }) => {
  const [logText, setLogText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<{sql: string, explanation: string} | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
     if (!logText.trim()) return;
     setIsAnalyzing(true);
     setError(null);
     setResult(null);
     
     try {
        const res = await analyzeLog(schema, logText);
        setResult(res);
     } catch (e: any) {
        setError(e.message);
     } finally {
        setIsAnalyzing(false);
     }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden max-h-[85vh]" onClick={e => e.stopPropagation()}>
         
         <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-rose-50 dark:bg-rose-900/20">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-white dark:bg-slate-800 text-rose-500 rounded-lg shadow-sm">
                  <FileSearch className="w-5 h-5" />
               </div>
               <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">Analisador de Logs (IA)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Cole um erro e receba a query investigativa.</p>
               </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/50 dark:hover:bg-slate-800 rounded text-slate-500"><X className="w-5 h-5" /></button>
         </div>

         <div className="flex-1 overflow-auto p-6 space-y-6">
            
            <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 uppercase">Cole o Log / Erro Aqui</label>
               <textarea 
                  value={logText}
                  onChange={e => setLogText(e.target.value)}
                  className="w-full h-32 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  placeholder='Ex: Key (email)=(bob@gmail.com) already exists...'
               />
               <div className="flex justify-end">
                  <button onClick={handleAnalyze} disabled={isAnalyzing || !logText.trim()} className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50">
                     {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                     Analisar Erro
                  </button>
               </div>
            </div>

            {error && (
               <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  {error}
               </div>
            )}

            {result && (
               <div className="space-y-4 animate-in slide-in-from-bottom-4 fade-in duration-500">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                     <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Diagnóstico</h4>
                     <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{result.explanation}</p>
                  </div>

                  <div className="bg-[#1e1e1e] p-4 rounded-xl border border-slate-700 relative group">
                     <div className="absolute top-2 right-2 flex gap-2">
                        <button onClick={() => { onRunSql(result.sql); onClose(); }} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded flex items-center gap-1.5 transition-colors">
                           <Play className="w-3 h-3" /> Executar
                        </button>
                     </div>
                     <pre className="font-mono text-sm text-green-400 overflow-x-auto pt-6">{result.sql}</pre>
                  </div>
               </div>
            )}

         </div>
      </div>
    </div>
  );
};

export default LogAnalyzerModal;
