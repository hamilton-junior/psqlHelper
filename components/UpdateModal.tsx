import React, { useState } from 'react';
import { Download, Rocket, RefreshCw, X, CheckCircle2, Sparkles, Loader2, GitBranch, FlaskConical, BellRing, AlertTriangle } from 'lucide-react';

interface UpdateModalProps {
  updateInfo: { 
    version: string, 
    notes: string, 
    branch?: string,
    isPrerelease?: boolean,
    url?: string,
    updateType?: 'upgrade' | 'downgrade',
    currentVersion?: string
  } | null;
  downloadProgress: number | null;
  isReady: boolean;
  onClose: () => void;
  onStartDownload: () => void;
  onInstall: () => void;
  onIgnore?: () => void;
}

const UpdateModal: React.FC<UpdateModalProps> = ({ updateInfo, downloadProgress, isReady, onClose, onStartDownload, onInstall, onIgnore }) => {
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);

  if (!updateInfo) return null;

  const isDownloading = downloadProgress !== null && !isReady;
  const isDowngrade = updateInfo.updateType === 'downgrade';

  const handleUpdateClick = () => {
    if (isDowngrade && !showDowngradeConfirm) {
      setShowDowngradeConfirm(true);
    } else {
      onStartDownload();
    }
  };

  const handleCancelDowngrade = () => {
    if (onIgnore) {
      onIgnore(); // Salva no localStorage que esta versão foi rejeitada
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        <div className="p-8 text-center relative overflow-hidden">
           <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${isDowngrade ? 'from-amber-500 to-orange-600' : 'from-indigo-500 via-purple-500 to-pink-500'}`}></div>
           
           <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 ${isDowngrade ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-indigo-50 dark:bg-indigo-900/30'}`}>
              {isReady ? (
                 <Rocket className="w-10 h-10 text-indigo-600 animate-bounce" />
              ) : isDownloading ? (
                 <Download className="w-10 h-10 text-indigo-600 animate-pulse" />
              ) : isDowngrade ? (
                 <AlertTriangle className="w-10 h-10 text-amber-600" />
              ) : (
                 <BellRing className="w-10 h-10 text-indigo-600" />
              )}
           </div>

           <div className="flex flex-col items-center gap-2">
              <div className="flex flex-col items-center gap-2">
                 <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">v{updateInfo.version}</h3>
                    {isDowngrade && (
                       <span className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-[8px] font-black px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 uppercase tracking-widest">
                          Versão Anterior
                       </span>
                    )}
                 </div>
                 
                 <div className="flex gap-2">
                    {updateInfo.branch === 'Main' ? (
                       <span className="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 text-[9px] font-black px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800 flex items-center gap-1 uppercase tracking-widest">
                          <GitBranch className="w-2.5 h-2.5" /> Canal Main
                       </span>
                    ) : (
                       <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 text-[9px] font-black px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 uppercase tracking-widest">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Canal Estável
                       </span>
                    )}
                 </div>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium">
                 {isDowngrade 
                    ? `A versão disponível no GitHub (v${updateInfo.version}) é anterior à sua atual (v${updateInfo.currentVersion}).` 
                    : 'Uma nova atualização foi encontrada no GitHub.'}
              </p>
           </div>
        </div>

        <div className="px-8 pb-8 space-y-6">
           {showDowngradeConfirm ? (
              <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 animate-in zoom-in-95">
                 <h4 className="text-sm font-black text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Confirmar Downgrade
                 </h4>
                 <p className="text-xs text-amber-700 dark:text-amber-200/70 leading-relaxed mb-4 font-medium">
                    Você está prestes a instalar a versão <strong>v{updateInfo.version}</strong>, que é inferior à sua atual (v{updateInfo.currentVersion}). Deseja prosseguir com a reinstalação?
                 </p>
                 <div className="flex gap-2">
                    <button onClick={handleCancelDowngrade} className="flex-1 py-2 bg-white dark:bg-slate-800 text-xs font-bold rounded-lg border border-amber-200 dark:border-amber-700">Não, cancelar</button>
                    <button onClick={onStartDownload} className="flex-1 py-2 bg-amber-600 text-white text-xs font-black rounded-lg shadow-md">Sim, instalar v{updateInfo.version}</button>
                 </div>
              </div>
           ) : (
              <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 max-h-40 overflow-y-auto custom-scrollbar">
                 <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-50" /> Notas da Versão
                 </span>
                 <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic whitespace-pre-wrap">
                    {updateInfo.notes}
                 </p>
              </div>
           )}

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
                 <span className="text-xs font-bold">Arquivos preparados! O app será reiniciado ao confirmar.</span>
              </div>
           )}

           <div className="flex gap-3">
              {!isDownloading && !isReady && !showDowngradeConfirm && (
                <>
                  <button onClick={handleCancelDowngrade} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-bold transition-all">
                     Depois
                  </button>
                  <button 
                    onClick={handleUpdateClick}
                    className={`flex-[2] py-4 rounded-2xl text-sm font-black text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${isDowngrade ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/20'}`}
                  >
                    {isDowngrade ? <RefreshCw className="w-4 h-4" /> : <Download className="w-4 h-4" />} 
                    {isDowngrade ? 'Reinstalar v' + updateInfo.version : 'Atualizar agora'}
                  </button>
                </>
              )}

              {isDownloading && (
                <div className="flex-1 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-sm font-bold text-slate-400 flex items-center justify-center gap-3 cursor-wait">
                   <Loader2 className="w-4 h-4 animate-spin" /> Extraindo pacotes...
                </div>
              )}

              {isReady && (
                <button 
                  onClick={onInstall}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-sm font-black text-white shadow-xl shadow-indigo-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Reiniciar Agora
                </button>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;