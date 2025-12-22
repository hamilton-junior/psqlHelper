
import React, { useState, useEffect } from 'react';
import { X, History, Trash2, Play, Search, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { QueryHistoryItem } from '../types';
import { getHistory, clearHistory, removeFromHistory } from '../services/historyService';

interface HistoryModalProps {
  onClose: () => void;
  onLoadQuery: (sql: string) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ onClose, onLoadQuery }) => {
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleClearAll = () => {
    if (confirm('Tem certeza que deseja limpar TODO o histórico?')) {
      clearHistory();
      setHistory([]);
    }
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Excluir este registro do histórico?')) {
      const updated = removeFromHistory(id);
      setHistory(updated);
    }
  };

  const filteredHistory = history.filter(item => 
    item.sql.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => b.timestamp - a.timestamp);

  const formatTime = (ms: number) => {
    const date = new Date(ms);
    return date.toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-3xl h-[80vh] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                <History className="w-5 h-5" />
             </div>
             <div>
                <h3 className="font-bold text-slate-800 dark:text-white">Histórico de Execuções</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Suas últimas 50 queries executadas.</p>
             </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex gap-2 justify-between items-center bg-white dark:bg-slate-800">
           <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
              <input 
                 type="text" 
                 placeholder="Buscar no histórico..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-amber-500"
              />
           </div>
           {history.length > 0 && (
              <button onClick={handleClearAll} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                 <Trash2 className="w-3.5 h-3.5" /> Limpar Tudo
              </button>
           )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-2 bg-slate-50/50 dark:bg-slate-900/50 space-y-2 custom-scrollbar">
           {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                 <History className="w-12 h-12 mb-2" />
                 <p className="text-sm">Nenhum registro encontrado.</p>
              </div>
           ) : (
              filteredHistory.map(item => (
                 <div key={item.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:border-amber-400 dark:hover:border-amber-500 transition-all group relative">
                    <div className="flex justify-between items-start mb-2">
                       <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                             <Clock className="w-3 h-3" /> {formatTime(item.timestamp)}
                          </span>
                          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${item.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-100 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 text-red-600 border-red-100 dark:border-red-800'}`}>
                             {item.status === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                             {item.status === 'success' ? `${item.rowCount} linhas` : 'Erro'}
                          </span>
                          <span className="text-slate-400">em {item.durationMs.toFixed(0)}ms</span>
                       </div>
                       
                       <div className="flex gap-2">
                          <button 
                             onClick={() => { onLoadQuery(item.sql); onClose(); }}
                             className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-colors opacity-0 group-hover:opacity-100"
                          >
                             <Play className="w-3 h-3 fill-current" /> Reutilizar
                          </button>
                          <button 
                             onClick={(e) => handleDeleteItem(item.id, e)}
                             className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                             title="Excluir este item"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
                    </div>
                    <pre className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800 overflow-x-auto whitespace-pre-wrap">
                       {item.sql}
                    </pre>
                 </div>
              ))
           )}
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
