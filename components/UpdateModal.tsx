
import React from 'react';
import { Download, Rocket, RefreshCw, X, CheckCircle2, Sparkles, Loader2, GitBranch, FlaskConical, BellRing } from 'lucide-react';

interface UpdateModalProps {
  updateInfo: { version: string, notes: string, branch?: string } | null;
  downloadProgress: number | null;
  isReady: boolean;
  onClose: () => void;
  onStartDownload: () => void;
  onInstall: () => void;
}

const UpdateModal: React.FC<UpdateModalProps> = ({ updateInfo, downloadProgress, isReady, onClose, onStartDownload, onInstall }) => {
  if (!updateInfo) return null;

  const isDownloading = downloadProgress !== null && !isReady;

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        <div className="p-8 text-center relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
           
           <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
              {isReady ? (
                 <Rocket className="w-10 h-10 text-indigo-600 animate-bounce" />
              ) : isDownloading ? (
                 <Download className="w-10 h-10 text-indigo-600 animate-pulse" />
              ) : (
                 <BellRing className="w-10 h-10 text-indigo-600" />
              )}
           </div>

           <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                 <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Nova Versão v{updateInfo.version}</h3>
                 {updateInfo.branch === 'Main' ? (
                    <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 text-[9px] font-black px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800 flex items-center gap-1 uppercase tracking-widest">
                       <GitBranch className="w-2.5 h-2.5" /> Main Branch
                    </span>
                 ) : (
                    <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 text-[9px] font-black px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 uppercase tracking-widest">
                       <CheckCircle2 className="w-2.5 h-2.5" /> Stable Branch
                    </span>
                 )}
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Uma atualização importante está disponível para você.</p>
           </div>
        </div>

        <div className="px-8 pb-8 space-y-6">
           <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 flex items-center gap-1.5">
                 <Sparkles className="w-3 h-3 text-amber-500" /> Novidades
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic">
                 "{updateInfo.notes}"
              </p>
           </div>

           {isDownloading && (
              <div className="space-y-3 animate-in slide-in-from-top-2">
                 <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-slate-500">Baixando arquivos...</span>
                    <span className="text-sm font-black text-indigo-600">{Math.round(downloadProgress)}%</span>
                 </div>
                 <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-300 shadow-[0_0_10px_rgba(79,70,229,0.5)]" 
                      style={{ width: `${downloadProgress}%` }}
                    />
                 </div>
              </div>
           )}

           {isReady && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-2xl flex items-center gap-3 text-emerald-800 dark:text-emerald-400 animate-in slide-in-from-bottom-2">
                 <CheckCircle2 className="w-6 h-6 shrink-0" />
                 <span className="text-xs font-bold">Download concluído! Reinicie para aplicar as mudanças.</span>
              </div>
           )}

           <div className="flex gap-3">
              {!isDownloading && !isReady && (
                <>
                  <button onClick={onClose} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-bold transition-all">
                     Lembrar depois
                  </button>
                  <button 
                    onClick={onStartDownload}
                    className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-sm font-black text-white shadow-xl shadow-indigo-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Baixar Agora
                  </button>
                </>
              )}

              {isDownloading && (
                <div className="flex-1 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-sm font-bold text-slate-400 flex items-center justify-center gap-3 cursor-wait">
                   <Loader2 className="w-4 h-4 animate-spin" />
                   Preparando pacotes...
                </div>
              )}

              {isReady && (
                <button 
                  onClick={onInstall}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-sm font-black text-white shadow-xl shadow-indigo-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Instalar e Reiniciar
                </button>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;
