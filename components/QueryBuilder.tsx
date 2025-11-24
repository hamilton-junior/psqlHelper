
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, MessageRole } from '../types';
import { Send, Play, AlertCircle, Loader2, Sparkles, CheckCircle2, XCircle, ShieldAlert, ShieldCheck, Activity } from 'lucide-react';

interface QueryBuilderProps {
  messages: ChatMessage[];
  onSendMessage: (msg: string) => void;
  loading: boolean;
  validating: boolean;
}

const QueryBuilder: React.FC<QueryBuilderProps> = ({ messages, onSendMessage, loading, validating }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, validating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading && !validating) {
      onSendMessage(input);
      setInput('');
    }
  };

  // Status unificado
  const isBusy = loading || validating;
  
  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8 opacity-60">
            <Sparkles className="w-16 h-16 mb-4 text-indigo-300" />
            <h3 className="text-xl font-medium text-slate-600 mb-2">Start Building Queries</h3>
            <p className="max-w-md">
              Ask for data in plain English. Try "Show me all users who joined last month" or "Total sales per country".
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col max-w-3xl ${msg.role === MessageRole.USER ? 'ml-auto items-end' : 'items-start'}`}
          >
            <div
              className={`px-5 py-3 rounded-2xl text-sm sm:text-base shadow-sm ${
                msg.role === MessageRole.USER
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
              }`}
            >
              {msg.content}
            </div>
            
            {msg.role === MessageRole.ASSISTANT && msg.queryResult && (
               <div className="mt-4 w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Header with Validation Badge */}
                  <div className="bg-slate-900 text-slate-300 text-xs flex justify-between items-center px-4 py-2">
                     <span className="font-mono uppercase tracking-wider flex items-center gap-2">
                        PostgreSQL
                     </span>
                     {msg.queryResult.validation && (
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-medium ${msg.queryResult.validation.isValid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {msg.queryResult.validation.isValid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Verified Valid</span>
                            </>
                          ) : (
                            <>
                              <ShieldAlert className="w-3 h-3" />
                              <span>Syntax Error</span>
                            </>
                          )}
                        </div>
                     )}
                  </div>

                  {/* Error Message if Invalid */}
                  {msg.queryResult.validation && !msg.queryResult.validation.isValid && (
                    <div className="bg-red-50 border-b border-red-100 p-4 text-xs text-red-800 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-bold text-sm mb-1">Syntax Validation Failed</p>
                        <p className="mb-2">{msg.queryResult.validation.error}</p>
                        {msg.queryResult.validation.correctedSql && (
                           <div className="mt-2 p-2 bg-white/50 rounded border border-red-200">
                             <p className="font-semibold text-red-600 text-[10px] uppercase mb-1">Suggested Correction</p>
                             <code className="block font-mono text-red-700">{msg.queryResult.validation.correctedSql}</code>
                           </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SQL Code Block */}
                  <div className="bg-slate-900 text-slate-50 p-4 font-mono text-sm border-t border-slate-800 overflow-x-auto">
                     <pre>{msg.queryResult.sql}</pre>
                  </div>

                  {/* Explanation & Tips */}
                  <div className="p-5 bg-white border-b border-slate-100">
                     <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Explanation</h4>
                     <p className="text-sm text-slate-700 leading-relaxed mb-4">{msg.queryResult.explanation}</p>
                     
                     {msg.queryResult.tips && msg.queryResult.tips.length > 0 && (
                        <div className="pt-4 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-xs font-bold text-amber-600 uppercase">Optimization Tips</span>
                          </div>
                          <ul className="space-y-1">
                            {msg.queryResult.tips.map((tip, idx) => (
                              <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                                <span className="block w-1 h-1 rounded-full bg-slate-400 mt-1.5 shrink-0"></span>
                                <span>{tip}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                     )}
                  </div>

                  {/* Mock Data Table */}
                  {msg.mockData && msg.mockData.length > 0 && (
                    <div className="overflow-x-auto">
                      <div className="px-4 py-2 bg-indigo-50/50 border-b border-indigo-100 text-xs font-semibold text-indigo-700 flex items-center justify-between">
                        <span>Preview Results (5 Rows)</span>
                        <span className="px-1.5 py-0.5 bg-indigo-100 rounded text-[10px] uppercase tracking-wide">Read-Only</span>
                      </div>
                      <table className="w-full text-left text-xs sm:text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                          <tr>
                            {Object.keys(msg.mockData[0]).map((key) => (
                              <th key={key} className="px-4 py-2 whitespace-nowrap">{key.replace(/_/g, ' ')}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {msg.mockData.map((row, i) => (
                            <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                              {Object.values(row).map((val: any, j) => (
                                <td key={j} className="px-4 py-2 whitespace-nowrap font-mono text-slate-600 text-xs">
                                  {val === null ? <span className="text-slate-400 italic">null</span> : String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {/* Execution Skipped Message */}
                  {msg.queryResult.validation && !msg.queryResult.validation.isValid && (
                    <div className="bg-slate-50 px-4 py-3 text-xs text-slate-500 text-center italic border-t border-slate-200 flex items-center justify-center gap-2">
                       <XCircle className="w-3 h-3 text-slate-400" />
                       Execution skipped due to syntax errors.
                    </div>
                  )}
               </div>
            )}

            {msg.isError && (
               <div className="mt-2 flex items-center gap-2 text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-100">
                 <AlertCircle className="w-4 h-4" />
                 <span>I couldn't generate a query for that request. Try rephrasing it.</span>
               </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 space-y-3">
        {/* Dynamic Unified Status Indicator */}
        {isBusy && (
          <div className="flex justify-center -mt-8 mb-2 pointer-events-none">
            <div className={`
              flex items-center gap-2 px-4 py-1.5 rounded-full shadow-md text-xs font-bold border backdrop-blur-sm transition-all duration-300
              ${loading 
                ? 'bg-indigo-600/90 text-white border-indigo-500' 
                : 'bg-emerald-500/90 text-white border-emerald-400'}
            `}>
              {loading ? (
                 <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                 <ShieldCheck className="w-3.5 h-3.5 animate-pulse" />
              )}
              <span>
                {loading ? "Gerando SQL com IA..." : "Validando Sintaxe & Segurança..."}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative flex items-center">
          <div className="absolute left-4 text-slate-400">
            <Play className="w-4 h-4 fill-current" />
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your data (e.g., 'Count users by country')"
            className="w-full pl-10 pr-12 py-3.5 bg-slate-100 border border-transparent rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-200 transition-all shadow-inner"
            disabled={isBusy}
          />
          <button
            type="submit"
            disabled={!input.trim() || isBusy}
            className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default QueryBuilder;
