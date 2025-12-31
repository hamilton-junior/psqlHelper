
import React, { useState, useEffect, useMemo } from 'react';
import { DatabaseSchema, QueryResult, OptimizationAnalysis } from '../../types';
import { Terminal, Play, ArrowLeft, CheckCircle2, ShieldAlert, Info, Copy, Check, Loader2, Lightbulb, ShieldOff, AlertCircle, AlignLeft, Minimize2, Split, Code2, Zap, TrendingUp, Gauge, X, Shield } from 'lucide-react';
import Editor, { useMonaco, DiffEditor } from '@monaco-editor/react';
import { analyzeQueryPerformance } from '../../services/geminiService';

interface PreviewStepProps {
  queryResult: QueryResult;
  onExecute: (sqlOverride?: string) => void;
  onBack: () => void;
  isExecuting: boolean;
  isValidating: boolean;
  validationDisabled?: boolean;
  schema?: DatabaseSchema;
}

const PreviewStep: React.FC<PreviewStepProps> = ({ queryResult, onExecute, onBack, isExecuting, isValidating, validationDisabled, schema }) => {
  const [copied, setCopied] = useState(false);
  const [editedSql, setEditedSql] = useState(queryResult.sql || '');
  const [viewMode, setViewMode] = useState<'edit' | 'diff'>('edit');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<OptimizationAnalysis | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  const monaco = useMonaco();

  useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
           e.preventDefault();
           if (!isExecuting && editedSql.trim()) onExecute(editedSql);
        }
     };
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExecuting, editedSql, onExecute]);

  useEffect(() => {
    if (!monaco || !schema) return;
    const disposable = monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        const suggestions: any[] = [];
        schema.tables.forEach(table => {
           suggestions.push({ label: table.name, kind: monaco.languages.CompletionItemKind.Class, insertText: table.name, detail: `Table`, range });
           table.columns.forEach(col => {
              suggestions.push({ label: col.name, kind: monaco.languages.CompletionItemKind.Field, insertText: col.name, detail: `Column in ${table.name}`, range });
           });
        });
        return { suggestions };
      }
    });
    return () => disposable.dispose();
  }, [monaco, schema]);

  useEffect(() => {
    if (queryResult.sql && editedSql === '') setEditedSql(queryResult.sql);
  }, [queryResult.sql, editedSql]);

  const handleCopy = () => {
    navigator.clipboard.writeText(editedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBeautify = () => {
     let sql = editedSql.replace(/\s+/g, ' ').trim();
     const keywords = ['SELECT', 'FROM', 'WHERE', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'JOIN', 'GROUP BY', 'ORDER BY', 'LIMIT', 'HAVING'];
     keywords.forEach(kw => {
        const regex = new RegExp(`\\b${kw}\\b`, 'gi');
        sql = sql.replace(regex, `\n${kw}`);
     });
     sql = sql.replace(/,/g, ',\n  ');
     setEditedSql(sql.trim());
  };

  const handleAnalyzePerformance = async () => {
     if (!schema || !editedSql) return;
     setIsAnalyzing(true);
     setShowAnalysis(true);
     try {
        const result = await analyzeQueryPerformance(schema, editedSql);
        setAnalysisResult(result);
     } catch (e) {
        console.error("Analysis failed", e);
     } finally {
        setIsAnalyzing(false);
     }
  };

  const isValid = queryResult.validation?.isValid ?? true;
  const hasChanges = editedSql.trim() !== (queryResult.sql || '').trim();

  const commonOptions = useMemo(() => ({
     fontSize: 14,
     padding: { top: 16, bottom: 16 },
     lineNumbers: 'on' as const,
     scrollBeyondLastLine: false,
     automaticLayout: true,
     fontFamily: "'Fira Code', monospace",
     scrollbar: { vertical: 'visible' as const, horizontal: 'visible' as const, useShadows: false, verticalScrollbarSize: 10 },
  }), []);

  return (
    <div className="w-full h-full flex flex-col relative animate-in fade-in duration-500">
      
      {showAnalysis && (
         <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-lg h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
               <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Gauge className="w-5 h-5 text-indigo-500" /> Consultor DBA (IA)</h3>
                  <button onClick={() => setShowAnalysis(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500"><X className="w-5 h-5" /></button>
               </div>
               <div className="flex-1 overflow-y-auto p-6">
                  {isAnalyzing ? (
                     <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /><p className="text-sm">Analisando performance...</p></div>
                  ) : analysisResult && (
                     <div className="space-y-6">
                        <div className="flex items-center gap-4">
                           <div className="relative w-16 h-16 flex items-center justify-center">
                              <svg className="w-full h-full transform -rotate-90">
                                 <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-200 dark:text-slate-800" />
                                 <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={175.9} strokeDashoffset={175.9 - (175.9 * analysisResult.rating) / 100} className={`${analysisResult.rating > 80 ? 'text-emerald-500' : 'text-amber-500'} transition-all duration-1000 ease-out`} />
                              </svg>
                              <span className="absolute text-sm font-bold text-slate-700 dark:text-slate-200">{analysisResult.rating}</span>
                           </div>
                           <div><h4 className="font-bold text-slate-800 dark:text-white">{analysisResult.summary}</h4><p className="text-xs text-slate-500">Avaliação de performance por IA.</p></div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800"><p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{analysisResult.explanation}</p></div>
                     </div>
                  )}
               </div>
            </div>
         </div>
      )}

      <div className="mb-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><Terminal className="w-6 h-6 text-indigo-600" /> Editor SQL</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Revise e edite antes de rodar.</p>
        </div>
        <div className="flex gap-2">
           <button onClick={handleAnalyzePerformance} disabled={!schema} className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded-lg text-xs font-bold transition-all border border-amber-200 dark:border-amber-800"><Zap className="w-3.5 h-3.5 fill-current" /> Otimizar</button>
           <div className="bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-1 shadow-sm">
              <button onClick={() => setViewMode('edit')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'edit' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 shadow-inner' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}><Code2 className="w-3.5 h-3.5" /> Editor</button>
              <button onClick={() => setViewMode('diff')} disabled={!hasChanges} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'diff' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 shadow-inner' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50 disabled:opacity-30'}`}><Split className="w-3.5 h-3.5" /> Diff</button>
           </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl bg-[#1e1e1e] flex flex-col group min-h-[350px]">
           <div className="px-4 py-2 bg-[#252526] border-b border-[#333] flex justify-between items-center shrink-0">
             <div className="flex items-center gap-3">
                <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div><div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div><div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div></div>
                <span className="text-xs font-mono text-slate-400 tracking-wide flex items-center gap-2 ml-2"><Terminal className="w-3 h-3" /> query.sql</span>
             </div>
             <div className="flex items-center gap-2">
                <button onClick={handleBeautify} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-[10px] uppercase font-bold bg-[#333] px-2 py-1 rounded">Format</button>
                <button onClick={handleCopy} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-[10px] uppercase font-bold bg-[#333] px-2 py-1 rounded">{copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} {copied ? 'Copiado' : 'Copiar'}</button>
             </div>
           </div>
           
           <div className="flex-1 relative bg-[#1e1e1e]">
             {viewMode === 'diff' ? (
                <DiffEditor height="100%" theme="vs-dark" original={queryResult.sql || ''} modified={editedSql || ''} options={{ ...commonOptions, minimap: { enabled: false }, readOnly: true }} />
             ) : (
                <Editor height="100%" defaultLanguage="sql" theme="vs-dark" value={editedSql} onChange={(v) => setEditedSql(v || '')} options={commonOptions} />
             )}
           </div>
        </div>

        <div className={`rounded-xl border overflow-hidden transition-all shrink-0 ${isValidating ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20' : isValid ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20' : 'bg-red-50 border-red-200 dark:bg-red-900/10'}`}>
          <div className="p-4 flex items-start gap-3">
             {isValidating ? <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" /> : isValid ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <ShieldAlert className="w-5 h-5 text-red-600" />}
             <div className="flex-1">
                <h4 className={`font-bold text-sm ${isValidating ? 'text-indigo-800 dark:text-indigo-200' : isValid ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'}`}>
                {isValidating ? 'Validando Sintaxe...' : isValid ? 'Sintaxe Validada' : 'Erro Detectado'}
                </h4>
             </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
           <div className="flex items-center gap-2 mb-3"><Info className="w-4 h-4 text-indigo-500" /><h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">Explicação da Lógica</h4></div>
           <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">{queryResult.explanation}</p>
        </div>

        <div className="flex items-center justify-between pt-4 pb-10 shrink-0">
           <button onClick={onBack} className="px-6 py-3 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</button>
           <button onClick={() => onExecute(editedSql)} disabled={isExecuting || isValidating || !editedSql.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-900/20 dark:shadow-none transition-all disabled:opacity-50 flex items-center gap-2">
              {isExecuting ? 'Executando...' : 'Executar Query'} <Play className="w-4 h-4 fill-current" />
           </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewStep;
