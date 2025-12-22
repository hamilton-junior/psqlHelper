
import React from 'react';
import { X, Keyboard, Command, Search, Play, Database } from 'lucide-react';

interface ShortcutsModalProps {
  onClose: () => void;
}

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ onClose }) => {
  const shortcuts = [
    { keys: ['Ctrl', 'Enter'], desc: 'Executar Query SQL (Builder/Editor)', icon: <Play className="w-3 h-3" /> },
    { keys: ['Ctrl', 'K'], desc: 'Focar na Busca de Tabelas', icon: <Search className="w-3 h-3" /> },
    { keys: ['Esc'], desc: 'Fechar Modais / Limpar Seleção', icon: <X className="w-3 h-3" /> },
    { keys: ['Shift', '?'], desc: 'Abrir este menu de Atalhos', icon: <Keyboard className="w-3 h-3" /> },
    { keys: ['F11'], desc: 'Alternar Tela Cheia (Navegador)', icon: <Database className="w-3 h-3" /> },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden" onClick={e => e.stopPropagation()}>
        
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Keyboard className="w-5 h-5" />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Atalhos de Teclado</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Navegue mais rápido pelo PSQL Buddy</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-2">
           <div className="space-y-1">
              {shortcuts.map((sc, idx) => (
                 <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors group">
                    <div className="flex items-center gap-3">
                       <span className="text-slate-400 group-hover:text-indigo-500 transition-colors">{sc.icon}</span>
                       <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{sc.desc}</span>
                    </div>
                    <div className="flex gap-1">
                       {sc.keys.map((k, i) => (
                          <kbd key={i} className="px-2 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-bold text-slate-500 dark:text-slate-400 font-mono shadow-sm min-w-[24px] text-center">
                             {k}
                          </kbd>
                       ))}
                    </div>
                 </div>
              ))}
           </div>
        </div>
        
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 text-center">
           <p className="text-[10px] text-slate-400">Dica: Você pode usar <span className="font-mono font-bold">Tab</span> para navegar entre os campos do formulário.</p>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsModal;
