
import React from 'react';
import { Bot, Zap, WifiOff } from 'lucide-react';

interface AiPreferenceModalProps {
  onSelect: (enableAi: boolean) => void;
}

const AiPreferenceModal: React.FC<AiPreferenceModalProps> = ({ onSelect }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 font-sans animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700 relative overflow-hidden">
        
        {/* Decorative Background Element */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
            <Bot className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Bem-vindo ao PSQL Buddy!</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Para começar, como você prefere gerar suas consultas SQL?
          </p>
        </div>

        <div className="space-y-3">
          <button 
            onClick={() => onSelect(true)}
            className="w-full group relative p-4 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl transition-all text-left flex items-center gap-4"
          >
            <div className="bg-indigo-600 text-white p-2 rounded-lg shrink-0">
               <Zap className="w-5 h-5" />
            </div>
            <div>
               <h3 className="font-bold text-indigo-900 dark:text-indigo-100 group-hover:text-indigo-700 dark:group-hover:text-white">Habilitar IA (Recomendado)</h3>
               <p className="text-xs text-indigo-700/70 dark:text-indigo-300/70 mt-0.5">
                  Usa Gemini AI para criar queries complexas, inferir joins e explicar código. Requer internet.
               </p>
            </div>
          </button>

          <button 
            onClick={() => onSelect(false)}
            className="w-full group p-4 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 rounded-xl transition-all text-left flex items-center gap-4"
          >
            <div className="bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 p-2 rounded-lg shrink-0">
               <WifiOff className="w-5 h-5" />
            </div>
            <div>
               <h3 className="font-bold text-slate-700 dark:text-slate-200">Modo Offline / Manual</h3>
               <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Gera SQL determinístico baseado estritamente na sua seleção. Não consome cota de API.
               </p>
            </div>
          </button>
        </div>
        
        <div className="mt-6 text-center">
           <p className="text-[10px] text-slate-400">Você pode alterar isso a qualquer momento nas Configurações.</p>
        </div>
      </div>
    </div>
  );
};

export default AiPreferenceModal;
