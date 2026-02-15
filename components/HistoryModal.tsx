
import React, { useState, useEffect } from 'react';
import { X, History, Trash2, Play, Search, Clock, CheckCircle2, AlertCircle, User, Globe, Cpu, Timer, Shield, Info, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { QueryHistoryItem } from '../types';
import { getHistory, clearHistory, removeFromHistory } from '../services/historyService';
import Dialog from './common/Dialog';

interface HistoryModalProps {
  onClose: () => void;
  onLoadQuery: (sql: string) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ onClose, onLoadQuery }) => {
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogConfig, setDialogConfig] = useState<{ isOpen: boolean, type: 'danger', title: string, message: string, onConfirm: () => void } | null>(null);

  useEffect(() => { setHistory(getHistory()); }, []);

  const handleClearAll = () => {
    setDialogConfig({
      isOpen: true,
      type: 'danger',
      title: 'Limpar Histórico de Auditoria',
      message: 'Deseja apagar todos os registros de execução? Esta ação limpará inclusive os metadados de performance.',
      onConfirm: () => { clearHistory(); setHistory([]); }
    });
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDialogConfig({
      isOpen: true,
      type: 'danger',
      title: 'Excluir Rastro',
      message: 'Remover este registro do histórico?',
      onConfirm: () => { setHistory(removeFromHistory(id)); }
    });
  };

  const filteredHistory = history.filter(item => 
    item.sql.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      {dialogConfig && (
        <Dialog isOpen={dialogConfig.isOpen} title={dialogConfig.title} message={dialogConfig.message} type={dialogConfig.type} onConfirm={dialogConfig.onConfirm} onClose={() => setDialogConfig(null)} confirmLabel="Sim, Excluir" />
      )}
      
      <div className="bg-white dark:bg-slate-800 w-full max-w-4xl h-[85vh] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl">
                <History className="w-6 h-6" />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">Log de Auditoria</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Rastro técnico de todas as execuções</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-500 transition-all"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex gap-4 justify-between items-center bg-white dark:bg-slate-800">
           <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Filtrar por SQL ou Schema..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500" />
           </div>
           {history.length > 0 && (
              <button onClick={handleClearAll} className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-2 font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-rose-100 dark:border-rose-900 transition-all">
                 <Trash2 className="w-4 h-4" /> Limpar Histórico
              </button>
           )}
        </div>

        <div className="flex-1 overflow-auto p-6 bg-slate-50/50 dark:bg-slate-900/50 space-y-4 custom-scrollbar">
           {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                 <History className="w-16 h-16 mb-4" />
                 <p className="font-bold uppercase tracking-widest text-sm">Vazio</p>
              </div>
           ) : (
              filteredHistory.map(item => (
                 <div key={item.id} className={`bg-white dark:bg-slate-800 rounded-3xl border transition-all duration-300 relative overflow-hidden shadow-sm hover:shadow-md
                    ${expandedId === item.id ? 'border-amber-400 ring-4 ring-amber-500/5' : 'border-slate-100 dark:border-slate-700 hover:border-amber-200'}
                 `}>
                    <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                       <div className="flex items-center gap-6">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center
                             ${item.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}
                          `}>
                             {item.status === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                          </div>
                          <div className="flex flex-col">
                             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(item.timestamp).toLocaleString()}</div>
                             <div className="text-sm font-black text-slate-800 dark:text-white truncate max-w-sm">{item.sql.substring(0, 100)}...</div>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                             <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{item.durationMs.toFixed(0)} ms</div>
                             <div className="text-[10px] font-bold text-slate-400">{item.rowCount} registros</div>
                          </div>
                          {expandedId === item.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                       </div>
                    </div>

                    {expandedId === item.id && (
                       <div className="p-6 pt-0 border-t border-slate-50 dark:border-slate-700 animate-in slide-in-from-top-2">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
                             <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 space-y-3">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><User className="w-3 h-3" /> Contexto do Cliente</div>
                                <div className="space-y-1.5">
                                   <div className="flex justify-between text-xs"><span className="text-slate-500">Usuário:</span><span className="font-bold text-slate-700 dark:text-slate-200">{item.audit?.server.dbUser || 'postgres'}</span></div>
                                   <div className="flex justify-between text-xs"><span className="text-slate-500">Sessão:</span><span className="font-mono text-indigo-500">{item.audit?.server.sessionId || 'isolada'}</span></div>
                                   <div className="flex justify-between text-xs"><span className="text-slate-500">OS:</span><span className="font-bold text-slate-700 dark:text-slate-200">{item.audit?.client.os || '--'}</span></div>
                                </div>
                             </div>
                             <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 space-y-3">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Cpu className="w-3 h-3" /> Performance Server</div>
                                <div className="space-y-1.5">
                                   <div className="flex justify-between text-xs"><span className="text-slate-500">Proc. Servidor:</span><span className="font-bold text-emerald-600">{item.audit?.performance.serverProcessMs || '--'} ms</span></div>
                                   <div className="flex justify-between text-xs"><span className="text-slate-500">Total Latência:</span><span className="font-bold text-slate-700 dark:text-slate-200">{item.durationMs.toFixed(2)} ms</span></div>
                                   <div className="flex justify-between text-xs"><span className="text-slate-500">Schema:</span><span className="font-bold text-slate-700 dark:text-slate-200">{item.schemaName}</span></div>
                                </div>
                             </div>
                             <div className="flex flex-col justify-center gap-2">
                                <button onClick={() => { onLoadQuery(item.sql); onClose(); }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2"><Play className="w-4 h-4 fill-current" /> Restaurar SQL</button>
                                <button onClick={(e) => handleDeleteItem(item.id, e)} className="w-full py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> Excluir Rastro</button>
                             </div>
                          </div>

                          <div className="space-y-4">
                             <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><Terminal className="w-3 h-3" /> SQL Executado</div>
                             <pre className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-slate-950 p-6 rounded-3xl border border-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                                {item.sql}
                             </pre>

                             {item.status === 'error' && item.audit?.server.rawErrorStack && (
                                <>
                                  <div className="flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-widest mt-6"><Shield className="w-3 h-3" /> Stack de Erro Nativo</div>
                                  <pre className="text-[10px] font-mono text-rose-400 bg-rose-950/50 p-6 rounded-3xl border border-rose-900/50 overflow-x-auto leading-relaxed italic">
                                     {item.audit.server.rawErrorStack}
                                  </pre>
                                </>
                             )}
                          </div>
                       </div>
                    )}
                 </div>
              ))
           )}
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
