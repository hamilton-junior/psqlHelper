import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, MessageRole } from '../types';
import { 
  Send, Bot, User, Loader2, Sparkles, 
  CheckCircle2, ShieldAlert, Activity, 
  Terminal, Code, MessageSquare, CornerDownLeft
} from 'lucide-react';

interface QueryBuilderProps {
  messages: ChatMessage[];
  onSendMessage: (msg: string) => void;
  loading: boolean;
  validating: boolean;
  placeholder?: string;
}

/**
 * Renderizador simples de Markdown para as respostas da IA
 */
const MessageContent: React.FC<{ text: string }> = ({ text }) => {
  // Regex para identificar blocos de código SQL
  const parts = text.split(/(```sql[\s\S]*?```|```[\s\S]*?```)/g);

  return (
    <div className="space-y-3">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const code = part.replace(/```sql|```/g, '').trim();
          return (
            <div key={i} className="my-3 rounded-xl overflow-hidden border border-slate-700 shadow-lg">
              <div className="bg-slate-800 px-3 py-1.5 flex justify-between items-center border-b border-slate-700">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Terminal className="w-3 h-3" /> SQL Output
                </span>
                <Code className="w-3 h-3 text-indigo-400" />
              </div>
              <pre className="p-4 bg-black text-emerald-400 font-mono text-xs overflow-x-auto custom-scrollbar leading-relaxed">
                {code}
              </pre>
            </div>
          );
        }

        // Formatação básica de negrito e quebra de linha
        const formattedText = part.split('\n').map((line, j) => {
          const boldLine = line.split(/\*\*(.*?)\*\*/g).map((chunk, k) => 
            k % 2 === 1 ? <strong key={k} className="font-bold text-indigo-900 dark:text-indigo-200">{chunk}</strong> : chunk
          );
          return <React.Fragment key={j}>{boldLine}<br /></React.Fragment>;
        });

        return <p key={i} className="text-sm leading-relaxed">{formattedText}</p>;
      })}
    </div>
  );
};

const QueryBuilder: React.FC<QueryBuilderProps> = ({ 
  messages, 
  onSendMessage, 
  loading, 
  validating,
  placeholder = "Descreva a consulta que você deseja gerar..."
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, loading, validating]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !loading && !validating) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const isBusy = loading || validating;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-inner relative">
      
      {/* Mensagens */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-32"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
            <div className="p-6 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm mb-4">
              <Sparkles className="w-12 h-12 text-indigo-400" />
            </div>
            <h3 className="text-lg font-black text-slate-700 dark:text-white uppercase tracking-tight">AI SQL Architect</h3>
            <p className="max-w-xs text-sm text-slate-500 mt-2">
              Transforme perguntas simples em queries complexas. Digite abaixo para começar.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
              msg.role === MessageRole.USER ? 'flex-row-reverse' : ''
            }`}
          >
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
              msg.role === MessageRole.USER 
                ? 'bg-indigo-600 text-white' 
                : 'bg-emerald-500 text-white'
            }`}>
              {msg.role === MessageRole.USER ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>

            <div className={`flex flex-col max-w-[85%] ${msg.role === MessageRole.USER ? 'items-end' : 'items-start'}`}>
              <div className={`px-5 py-4 rounded-[2rem] shadow-sm ${
                msg.role === MessageRole.USER
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tr-none border border-slate-100 dark:border-slate-800'
                  : 'bg-indigo-50 dark:bg-indigo-900/30 text-slate-800 dark:text-slate-100 rounded-tl-none border border-indigo-100/50 dark:border-indigo-800/50'
              }`}>
                <MessageContent text={msg.content} />
              </div>
              
              {msg.role === MessageRole.ASSISTANT && msg.queryResult?.validation && (
                <div className={`mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  msg.queryResult.validation.isValid 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' 
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                }`}>
                  {msg.queryResult.validation.isValid ? <CheckCircle2 className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                  {msg.queryResult.validation.isValid ? 'Sintaxe Validada' : 'Erro de Estrutura'}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading States */}
        {isBusy && (
          <div className="flex items-start gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-5 py-4 rounded-[2rem] rounded-tl-none shadow-sm flex items-center gap-3">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                {loading ? 'IA Gerando Consulta...' : 'Validando SQL...'}
                {!loading && <Activity className="w-3 h-3 animate-pulse" />}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input de Mensagem */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-50 dark:from-slate-950 via-slate-50 dark:via-slate-950 to-transparent pt-12">
        <form 
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto relative group"
        >
          <div className={`absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-500 ${isBusy ? 'animate-pulse' : ''}`}></div>
          
          <div className="relative flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden px-4">
            <div className="p-2 text-slate-400">
               <MessageSquare className="w-5 h-5" />
            </div>
            
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isBusy ? "Aguarde a conclusão..." : placeholder}
              disabled={isBusy}
              className="w-full py-4 px-2 bg-transparent text-sm text-slate-800 dark:text-white outline-none placeholder-slate-400 font-medium"
            />

            <div className="flex items-center gap-2 pr-1">
              {input.length > 0 && !isBusy && (
                <div className="hidden sm:flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <CornerDownLeft className="w-2.5 h-2.5" /> Enter
                </div>
              )}
              
              <button
                type="submit"
                disabled={!input.trim() || isBusy}
                className={`p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center shadow-lg
                  ${!input.trim() || isBusy 
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-900/20'
                  }
                `}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </form>
      </div>

    </div>
  );
};

export default QueryBuilder;