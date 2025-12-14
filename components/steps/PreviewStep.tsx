

import React, { useState, useEffect } from 'react';
import { DatabaseSchema, QueryResult, OptimizationAnalysis } from '../../types';
import { Terminal, Play, ArrowLeft, CheckCircle2, ShieldAlert, Info, Copy, Check, Loader2, Lightbulb, ShieldOff, AlertCircle, AlignLeft, Minimize2, Split, Code2, Zap, TrendingUp, Gauge, X } from 'lucide-react';
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
  
  // Optimization State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<OptimizationAnalysis | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  const monaco = useMonaco();

  // Shortcut Listener
  useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
           e.preventDefault();
           if (!isExecuting && editedSql.trim()) {
              onExecute(editedSql);
           }
        }
     };
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExecuting, editedSql, onExecute]);

  // Autocomplete Logic
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
    if (queryResult.sql && editedSql === '') {
       setEditedSql(queryResult.sql);
    }
  }, [queryResult.sql]);

  const handleCopy = () => {
    navigator.clipboard.writeText(editedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBeautify = () => {
     let sql = editedSql.replace(/\s+/g, ' ').trim();
     const keywords = ['SELECT', 'FROM', 'WHERE', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'JOIN', 'GROUP BY', 'ORDER BY', 'LIMIT', 'HAVING', 'UNION'];
     keywords.forEach(kw => {
        const regex = new RegExp(`\\b${kw}\\b`, 'gi');
        sql = sql.replace(regex, `\n${kw}`);
     });
     sql = sql.replace(/,/g, ',\n  ');
     sql = sql.replace(/^\s+/g, '');
     setEditedSql(sql);
  };

  const handleMinify = () => {
     setEditedSql(editedSql.replace(/\s+/g, ' ').trim());
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
        // Simple mock fallback if quota fails to show UI
        setAnalysisResult({
           rating: 50,
           summary: "Erro na análise",
           explanation: "Não foi possível conectar ao serviço de IA.",
           suggestedIndexes: [],
           optimizedSql: editedSql,
           improvementDetails: ""
        });
     } finally {
        setIsAnalyzing(false);
     }
  };

  const handleApplyOptimization = () => {
     if (analysisResult?.optimizedSql) {
        setEditedSql(analysisResult.optimizedSql);
        setShowAnalysis(false);
     }
  };

  const isValid = queryResult.validation?.isValid ?? true;
  const validationError = queryResult.validation?.error;
  const detailedError = queryResult.validation?.detailedError;
  const correctedSql = queryResult.validation?.correctedSql;
  const errorLine = queryResult.validation?.errorLine;
  const hasChanges = editedSql.trim() !== (queryResult.sql || '').trim();

  // Common options
  const commonOptions = {
     fontSize: 13,
     padding: { top: 16, bottom: 16 },
     lineNumbers: 'on' as const,
     scrollBeyondLastLine: false,
     automaticLayout: true,
     fontFamily: "'Fira Code', monospace",
     fontLigatures: true,
     scrollbar: { vertical: 'visible' as const, horizontal: 'visible' as const, useShadows: false, verticalScrollbarSize: 10 },
  };

  const editorOptions = {
     ...commonOptions,
     minimap: { enabled: false },
     renderLineHighlight: 'all' as const,
     overviewRulerLanes: 0,
     hideCursorInOverviewRuler: true,
  };

  const diffOptions = {
     ...commonOptions,
     renderSideBySide: true,
     readOnly: true, 
     originalEditable: false,
     minimap: { enabled: false }
  };

  return (
    <div className="w-full h-full flex flex-col relative">
      
      {/* Optimization Modal / Slide-over */}
      {showAnalysis && (
         <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-lg h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
               <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                     <Gauge className="w-5 h-5 text-indigo-500" /> Consultor DBA (IA)
                  </h3>
                  <button onClick={() => setShowAnalysis(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500"><X className="w-5 h-5" /></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-6">
                  {isAnalyzing ? (
                     <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                        <p className="text-sm">Analisando plano de execução e índices...</p>
                     </div>
                  ) : analysisResult ? (
                     <div className="space-y-6">
                        {/* Rating */}
                        <div className="flex items-center gap-4">
                           <div className="relative w-16 h-16 flex items-center justify-center">
                              <svg className="w-full h-full transform -rotate-90">
                                 <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-200 dark:text-slate-800" />
                                 <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={175.9} strokeDashoffset={175.9 - (175.9 * analysisResult.rating) / 100} className={`${analysisResult.rating > 80 ? 'text-emerald-500' : analysisResult.rating > 50 ? 'text-amber-500' : 'text-red-500'} transition-all duration-1000 ease-out`} />
                              </svg>
                              <span className="absolute text-sm font-bold text-slate-700 dark:text-slate-200">{analysisResult.rating}</span>
                           </div>
                           <div>
                              <h4 className="font-bold text-slate-800 dark:text-white">{analysisResult.summary}</h4>
                              <p className="text-xs text-slate-500">{analysisResult.rating > 80 ? 'Excelente performance estimada.' : 'Possíveis gargalos detectados.'}</p>
                           </div>
                        </div>

                        {/* Explanation */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                           <h5 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Info className="w-3.5 h-3.5" /> Diagnóstico</h5>
                           <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{analysisResult.explanation}</p>
                        </div>

                        {/* Indexes */}
                        {analysisResult.suggestedIndexes.length > 0 && (
                           <div>
                              <h5 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-500" /> Índices Sugeridos</h5>
                              <div className="space-y-2">
                                 {analysisResult.suggestedIndexes.map((idx, i) => (
                                    <div key={i} className="bg-slate-900 text-slate-300 p-3 rounded-lg text-xs font-mono border border-slate-700 relative group">
                                       {idx}
                                       <button onClick={() => navigator.clipboard.writeText(idx)} className="absolute top-2 right-2 p-1 bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"><Copy className="w-3 h-3" /></button>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        )}

                        {/* Optimized SQL */}
                        {analysisResult.optimizedSql !== editedSql && (
                           <div>
                              <h5 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Query Otimizada</h5>
                              <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                                 <p className="text-xs text-emerald-800 dark:text-emerald-200 mb-2 font-bold">{analysisResult.improvementDetails}</p>
                                 <button onClick={handleApplyOptimization} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
                                    <Check className="w-4 h-4" /> Aplicar Melhoria
                                 </button>
                              </div>
                           </div>
                        )}
                     </div>
                  ) : null}
               </div>
            </div>
         </div>
      )}

      <div className="mb-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><Terminal className="w-6 h-6 text-indigo-600" /> Editor SQL</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Revise e edite o SQL antes da execução. <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 ml-2 font-mono">Ctrl + Enter para Executar</span></p>
        </div>
        
        <div className="flex gap-2">
           <button onClick={handleAnalyzePerformance} disabled={!schema} className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded-lg text-xs font-bold transition-all border border-amber-200 dark:border-amber-800">
              <Zap className="w-3.5 h-3.5 fill-current" /> Otimizar (IA)
           </button>
           <div className="bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-1">
              <button onClick={() => setViewMode('edit')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'edit' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                 <Code2 className="w-3.5 h-3.5" /> Editor
              </button>
              <button onClick={() => setViewMode('diff')} disabled={!hasChanges} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'diff' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-50'}`}>
                 <Split className="w-3.5 h-3.5" /> Comparar
              </button>
           </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        
        {/* Monaco Editor Container */}
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl bg-[#1e1e1e] flex flex-col group min-h-[350px]">
           <div className="px-4 py-2 bg-[#252526] border-b border-[#333] flex justify-between items-center shrink-0">
             <div className="flex items-center gap-3">
                <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div><div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div><div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div></div>
                <div className="h-4 w-px bg-[#444] mx-1"></div>
                <span className="text-xs font-mono text-slate-400 tracking-wide flex items-center gap-2">
                   <Terminal className="w-3 h-3" /> query.sql
                </span>
                {hasChanges && <span className="text-[10px] text-amber-400 bg-amber-900/30 px-1.5 rounded ml-1 border border-amber-900/50">Modificado</span>}
             </div>
             
             {viewMode === 'edit' && (
                <div className="flex items-center gap-2">
                   <button onClick={handleBeautify} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider bg-[#333] hover:bg-[#444] px-2 py-1 rounded" title="Formatar SQL"><AlignLeft className="w-3.5 h-3.5" /> Format</button>
                   <button onClick={handleMinify} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider bg-[#333] hover:bg-[#444] px-2 py-1 rounded" title="Minificar"><Minimize2 className="w-3.5 h-3.5" /> Minify</button>
                   <div className="w-px h-4 bg-[#444]"></div>
                   <button onClick={handleCopy} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider bg-[#333] hover:bg-[#444] px-2 py-1 rounded">
                     {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                     {copied ? 'Copiado!' : 'Copiar'}
                   </button>
                </div>
             )}
           </div>
           
           <div className="flex-1 relative bg-[#1e1e1e]">
             {viewMode === 'diff' ? (
                <DiffEditor
                  height="100%"
                  theme="vs-dark"
                  original={queryResult.sql || ''}
                  modified={editedSql || ''}
                  options={diffOptions}
                />
             ) : (
                <Editor
                  height="100%"
                  defaultLanguage="sql"
                  theme="vs-dark"
                  value={editedSql}
                  onChange={(value) => setEditedSql(value || '')}
                  options={editorOptions}
                />
             )}
           </div>
           
           <div className="px-3 py-1 bg-[#007acc] text-white text-[10px] flex justify-between items-center font-mono">
              <div className="flex gap-3">
                 <span>SQL</span>
                 <span>UTF-8</span>
              </div>
              <div>
                 <span>Ready</span>
              </div>
           </div>
        </div>

        {validationDisabled ? (
           <div className="p-4 rounded-xl border flex items-start gap-3 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700 shrink-0">
             <ShieldOff className="w-5 h-5 text-slate-400 mt-0.5" />
             <div>
               <h4 className="font-bold text-sm text-slate-600 dark:text-slate-300">Validação Desativada</h4>
               <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">A verificação de sintaxe por IA está desligada nas configurações.</p>
             </div>
           </div>
        ) : (
          <div className={`rounded-xl border overflow-hidden transition-all duration-300 shrink-0 ${isValidating ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800' : isValid ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'}`}>
            <div className="p-4 flex items-start gap-3">
               {isValidating ? <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin mt-0.5" /> : isValid ? <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" /> : <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />}
               <div className="flex-1">
                  <h4 className={`font-bold text-sm ${isValidating ? 'text-indigo-800 dark:text-indigo-200' : isValid ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'}`}>
                  {isValidating ? 'Validando Sintaxe...' : isValid ? 'Sintaxe Validada' : 'Erro de Sintaxe Detectado'}
                  </h4>
                  {!isValidating && !isValid && (
                     <div className="mt-4 flex flex-col gap-4">
                        {validationError && <div className="flex items-center gap-2 text-red-700 dark:text-red-300 bg-red-100/50 dark:bg-red-900/30 px-3 py-2 rounded border border-red-200 dark:border-red-800 text-xs font-mono"><AlertCircle className="w-3.5 h-3.5" /><span>{validationError}</span>{errorLine && <span className="ml-auto font-bold opacity-70">Linha {errorLine}</span>}</div>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {detailedError && <div className="p-3 bg-white/60 dark:bg-slate-800/60 rounded border border-red-100 dark:border-red-900/30"><h5 className="text-[10px] font-bold text-red-600/80 dark:text-red-400/80 uppercase mb-2 flex items-center gap-1"><Info className="w-3 h-3" /> Diagnóstico</h5><p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{detailedError}</p></div>}
                           {correctedSql && <div className="p-3 bg-white/60 dark:bg-slate-800/60 rounded border border-emerald-100 dark:border-emerald-900/30"><h5 className="text-[10px] font-bold text-emerald-600/80 dark:text-emerald-400/80 uppercase mb-2 flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Sugestão de Correção</h5><code className="block font-mono text-xs text-slate-700 dark:text-slate-200 break-all bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded border border-emerald-100 dark:border-emerald-800/30">{correctedSql}</code></div>}
                        </div>
                     </div>
                  )}
               </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
           <div className="flex items-center gap-2 mb-3"><Info className="w-4 h-4 text-indigo-500" /><h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">Explicação da Lógica (Original)</h4></div>
           <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">{queryResult.explanation}</p>
           {queryResult.tips && queryResult.tips.length > 0 && (
             <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">DICAS GERAIS</h5>
                <ul className="list-disc pl-4 space-y-1">{queryResult.tips.map((tip, i) => <li key={i} className="text-xs text-slate-600 dark:text-slate-400">{tip}</li>)}</ul>
             </div>
           )}
        </div>

        <div className="flex items-center justify-between pt-4 pb-10 shrink-0">
           <button onClick={onBack} className="px-6 py-3 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Voltar ao Construtor</button>
           <button onClick={() => onExecute(editedSql)} disabled={(!isValid && !validationDisabled && editedSql === queryResult.sql) || isExecuting || isValidating || !editedSql.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-900/20 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">{isExecuting ? 'Executando...' : 'Executar Query'} <Play className="w-4 h-4 fill-current" /></button>
        </div>
      </div>
    </div>
  );
};

export default PreviewStep;
