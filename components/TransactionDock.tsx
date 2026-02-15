
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Check, RotateCcw, Clock, Layers, Loader2, AlertTriangle, DatabaseZap, List, Terminal, ChevronUp, ChevronDown, History } from 'lucide-react';
import { TransactionInfo } from '../types';

interface TransactionDockProps {
  info: TransactionInfo;
  onCommit: () => void;
  onRollback: () => void;
  isProcessing: boolean;
}

const TransactionDock: React.FC<TransactionDockProps> = ({ info, onCommit, onRollback, isProcessing }) => {
  const [showSteps, setShowSteps] = useState(false);
  
  if (!info.isActive) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4"
      >
        {/* COMANDOS EXECUTADOS - OVERLAY */}
        <AnimatePresence>
           {showSteps && info.steps.length > 0 && (
              <motion.div 
                 initial={{ height: 0, opacity: 0 }}
                 animate={{ height: 'auto', opacity: 1 }}
                 exit={{ height: 0, opacity: 0 }}
                 className="bg-slate-900 border-x-4 border-t-4 border-amber-600 rounded-t-[2rem] overflow-hidden mb-[-1.5rem] pb-8 shadow-2xl"
              >
                 <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                       <h5 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] flex items-center gap-2">
                          <History className="w-3 h-3" /> Rastro da Sessão
                       </h5>
                       <span className="text-[9px] text-slate-500 font-bold uppercase">{info.steps.length} comandos pendentes</span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                       {info.steps.map((step, i) => (
                          <div key={i} className="flex items-start gap-3 p-2 bg-white/5 rounded-xl border border-white/5">
                             <div className="text-[9px] font-mono text-slate-500 mt-0.5">{new Date(step.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</div>
                             <div className="flex-1 min-w-0">
                                <div className="text-[9px] font-black text-indigo-400 uppercase mb-1">{step.tabName}</div>
                                <code className="text-[10px] font-mono text-slate-300 block truncate">{step.sql}</code>
                             </div>
                             <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-1" />
                          </div>
                       ))}
                    </div>
                 </div>
              </motion.div>
           )}
        </AnimatePresence>

        <div className="bg-amber-600 dark:bg-amber-700 rounded-[2rem] p-1 shadow-2xl shadow-amber-900/40 border-4 border-white dark:border-slate-800 relative z-10">
           <div className="bg-slate-900 rounded-[1.8rem] px-6 py-4 flex items-center justify-between gap-4 overflow-hidden relative">
              
              {/* Background Glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-amber-500/10 pointer-events-none"></div>

              <div className="flex items-center gap-4 relative z-10">
                 <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                    <ShieldAlert className="w-7 h-7 text-white" />
                 </div>
                 <div className="cursor-pointer group" onClick={() => setShowSteps(!showSteps)}>
                    <h4 className="text-white font-black text-sm uppercase tracking-widest leading-none flex items-center gap-2">
                       Transação Aberta
                       {showSteps ? <ChevronDown className="w-3 h-3 text-amber-500" /> : <ChevronUp className="w-3 h-3 text-amber-500" />}
                    </h4>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] font-bold text-amber-200 uppercase tracking-tighter">
                       <span className="flex items-center gap-1 group-hover:text-white transition-colors"><Layers className="w-3 h-3" /> {info.statementCount} Comandos</span>
                       <span className="text-white/20">|</span>
                       <span className="flex items-center gap-1"><DatabaseZap className="w-3 h-3" /> Session: {info.sessionId?.substring(0, 8)}</span>
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-2 relative z-10">
                 <button 
                    onClick={onRollback}
                    disabled={isProcessing}
                    className="px-5 py-3 bg-white/5 hover:bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 border border-white/10 flex items-center gap-2"
                 >
                    <RotateCcw className="w-3.5 h-3.5" /> Rollback
                 </button>
                 <button 
                    onClick={onCommit}
                    disabled={isProcessing}
                    className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-amber-500/20 flex items-center gap-2"
                 >
                    {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Commit Final
                 </button>
              </div>
           </div>
        </div>

        <div className="mt-3 flex justify-center">
           <div className="bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 px-4 py-1 rounded-full flex items-center gap-2 shadow-sm">
              <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span className="text-[9px] font-black text-amber-800 dark:text-amber-200 uppercase tracking-widest">
                 {info.sessionId === 'simulated-session' ? 'Simulando impacto em Cópia de Sombra (Shadow Staging)' : 'Os dados no servidor só serão efetivados após o Commit.'}
              </span>
           </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TransactionDock;
