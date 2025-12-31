
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

  const isBusy = loading || validating;
  
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 relative">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 pb-24" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8 opacity-60">
            <Sparkles className="w-16 h-16 mb-4 text-indigo-300 dark:text-indigo-900/50" />
            <h3 className="text-xl font-medium text-slate-600 dark:text-slate-400 mb-2">Comece a Construir</h3>
            <p className="max-w-md">
              Peça dados em linguagem natural. Tente "Mostre todos os usuários que entraram no mês passado".
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
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none'
              }`}
            >
              {msg.content}
            </div>
            
            {msg.role === MessageRole.ASSISTANT && msg.queryResult && (
               <div className="mt-4 w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="bg-slate-900 dark:bg-black text-slate-300 text-xs flex justify-between items-center px-4 py-2">
                     <span className="font-mono uppercase tracking-wider flex items-center gap-2">
                        PostgreSQL
                     </span>
                     {msg.queryResult.validation && (
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-medium ${msg.queryResult.validation.isValid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {msg.queryResult.validation.isValid ? (
                            <><CheckCircle2 className="w-3 h-3" /><span>Válido</span></>
                          ) : (
                            <><ShieldAlert className="w-3 h-3" /><span>Erro de Sintaxe</span></>
                          )}
                        </div>
                     )}
                  </div>

                  {msg.queryResult.validation && !msg.queryResult.validation.isValid && (
                    <div className="bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/50 p-4 text-xs text-red-800 dark:text-red-300 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-bold text-sm mb-1">Falha na Validação</p>
                        <p className="mb-2">{msg.queryResult.validation.error}</p>
                        {msg.queryResult.validation.correctedSql && (
                           <div className="mt-2 p-2 bg-white/50 dark:bg-black/30 rounded border border-red-200 dark:border-red-800">
                             <p className="font-semibold text-red-600 dark:text-red-400 text-[10px] uppercase mb-1">Sugestão de Correção</p>
                             <code className="block font-mono text-red-700 dark:text-red-300">{msg.queryResult.validation.correctedSql}</code>
                           </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-900 dark:bg-black text-slate-50 p-4 font-mono text-sm border-t border-slate-800 dark:border-slate-900 overflow-x-auto">
                     <pre className="text-emerald-400">{msg.queryResult.sql}</pre>
                  </div>

                  <div className="p-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                     <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Explicação</h4>
                     <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">{msg.queryResult.explanation}</p>
                  </div>

                  {msg.mockData && msg.mockData.length > 0 && (
                    <div className="overflow-x-auto bg-white dark:bg-slate-900">
                      <div className="px-4 py-2 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/50 text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                        <span>Preview Results</span>
                        <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900 rounded text-[10px] uppercase tracking-wide">Read-Only</span>
                      </div>
                      <table className="w-full text-left text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            {Object.keys(msg.mockData[0]).map((key) => (
                              <th key={key} className="px-4 py-2 whitespace-nowrap">{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {msg.mockData.map((row, i) => (
                            <tr key={i} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                              {Object.values(row).map((val: any, j) => (
                                <td key={j} className="px-4 py-2 whitespace-nowrap font-mono text-xs">
                                  {val === null ? <span className="text-slate-400 italic">null</span> : String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
               </div>
            )}
          </div>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-20">
        <div className={`absolute -top-10 left-0 right-0 flex justify-center transition-all duration-300 ${isBusy ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full shadow-lg text-xs font-bold border transition-all ${loading ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-emerald-600 text-white border-emerald-500'}`}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 animate-pulse" />}
            <span>{loading ? "IA Gerando Query..." : "Validando SQL..."}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative flex items-center">
          <div className="absolute left-4 text-slate-400"><Play className="w-4 h-4 fill-current" /></div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Faça uma pergunta sobre seus dados..."
            className="w-full pl-10 pr-12 py-3.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner outline-none"
            disabled={isBusy}
          />
          <button type="submit" disabled={!input.trim() || isBusy} className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"><Send className="w-4 h-4" /></button>
        </form>
      </div>
    </div>
  );
};

export default QueryBuilder;
