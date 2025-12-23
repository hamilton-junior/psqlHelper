
import React from 'react';
import { Settings, Save, X, AlertTriangle, Bot, Zap, ShieldCheck, Lightbulb, Clock, LayoutList, ListFilter, AlertCircle, GraduationCap, PenTool, DatabaseZap } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  onClose: () => void;
  quotaExhausted?: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose, quotaExhausted }) => {
  const [formData, setFormData] = React.useState<AppSettings>({ ...settings });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const isAiDisabled = !formData.enableAiGeneration;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-700 max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 p-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">Configurações</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-800 text-slate-100">
          
          <div className="space-y-3">
             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Interface</h4>
             
             {/* Beginner Mode */}
             <div className="bg-emerald-900/10 p-3 rounded-lg border border-emerald-800/30">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-900/50 text-emerald-400 rounded-lg">
                         <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                         <h4 className="font-bold text-white text-sm">Modo Iniciante</h4>
                         <p className="text-xs text-slate-400 mt-0.5">
                            Exibe dicas educativas sobre SQL.
                         </p>
                      </div>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                     <input 
                       type="checkbox" 
                       checked={formData.beginnerMode} 
                       onChange={e => setFormData({...formData, beginnerMode: e.target.checked})}
                       className="sr-only peer" 
                     />
                     <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                   </label>
                </div>
             </div>

             {/* Background Loading Toggle */}
             <div className="bg-indigo-900/10 p-3 rounded-lg border border-indigo-800/30">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-900/50 text-indigo-400 rounded-lg">
                         <DatabaseZap className="w-5 h-5" />
                      </div>
                      <div>
                         <h4 className="font-bold text-white text-sm">Otimização de Vínculos</h4>
                         <p className="text-xs text-slate-400 mt-0.5">
                            Carregar todos os vínculos em background.
                         </p>
                      </div>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                     <input 
                       type="checkbox" 
                       checked={formData.backgroundLoadLinks} 
                       onChange={e => setFormData({...formData, backgroundLoadLinks: e.target.checked})}
                       className="sr-only peer" 
                     />
                     <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                   </label>
                </div>
             </div>
          </div>

          <hr className="border-slate-700" />

          {/* AI Master Section */}
          <div>
             <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                <Bot className="w-4 h-4" /> Inteligência Artificial
             </h4>
             
             {quotaExhausted && (
                <div className="mb-4 p-3 bg-amber-900/30 border border-amber-800 rounded-lg flex gap-3 items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200">
                    <span className="font-bold block mb-1">Cota de IA Atingida</span>
                    <p>Economizando recursos da API do Gemini.</p>
                  </div>
                </div>
              )}

             <div className="space-y-4">
               {/* Master Switch */}
               <div className="flex items-start justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                  <div className="flex gap-3">
                     <div className={`mt-0.5 p-1.5 rounded-md ${formData.enableAiGeneration ? 'bg-indigo-900 text-indigo-400' : 'bg-slate-700 text-slate-500'}`}>
                        <Zap className="w-4 h-4" />
                     </div>
                     <div className="flex flex-col">
                       <span className="text-sm font-bold text-slate-200">Habilitar Gemini AI</span>
                       <span className="text-[10px] text-slate-400 leading-tight mt-1 max-w-[240px]">
                         Geração de SQL via linguagem natural.
                       </span>
                     </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer mt-1">
                    <input 
                      type="checkbox" 
                      checked={formData.enableAiGeneration} 
                      onChange={e => setFormData({...formData, enableAiGeneration: e.target.checked})}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
               </div>

               <div className={`space-y-3 pl-4 border-l-2 border-slate-700 ml-3 transition-opacity duration-200 ${isAiDisabled ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <ShieldCheck className="w-4 h-4 text-emerald-500" />
                       <div className="flex flex-col">
                         <span className="text-sm font-medium text-slate-300">Validação Automática</span>
                       </div>
                     </div>
                     <label className="relative inline-flex items-center cursor-pointer">
                       <input 
                         type="checkbox" 
                         checked={quotaExhausted ? false : formData.enableAiValidation} 
                         onChange={e => setFormData({...formData, enableAiValidation: e.target.checked})}
                         disabled={quotaExhausted}
                         className="sr-only peer" 
                       />
                       <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                     </label>
                  </div>

                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <Lightbulb className="w-4 h-4 text-amber-500" />
                       <div className="flex flex-col">
                         <span className="text-sm font-medium text-slate-300">Sugestões e Dicas</span>
                       </div>
                     </div>
                     <label className="relative inline-flex items-center cursor-pointer">
                       <input 
                         type="checkbox" 
                         checked={quotaExhausted ? false : formData.enableAiTips} 
                         onChange={e => setFormData({...formData, enableAiTips: e.target.checked})}
                         disabled={quotaExhausted}
                         className="sr-only peer" 
                       />
                       <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                     </label>
                  </div>

                  <div className="pt-2">
                     <div className="flex items-center gap-2 mb-2 text-slate-300">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        <label className="text-sm font-medium">Timeout IA (ms)</label>
                     </div>
                     <div className="flex gap-2 items-center">
                        <input 
                           type="number" 
                           min="1000"
                           step="500"
                           value={formData.aiGenerationTimeout} 
                           onChange={e => setFormData({...formData, aiGenerationTimeout: parseInt(e.target.value) || 3000})}
                           className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                     </div>
                  </div>
               </div>
             </div>
          </div>

          <hr className="border-slate-700" />

          {/* Connection Defaults */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Padrões do Banco</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Host Padrão</label>
                <input 
                  type="text" 
                  value={formData.defaultDbHost} 
                  onChange={e => setFormData({...formData, defaultDbHost: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                   <ListFilter className="w-3.5 h-3.5" /> Limite de Linhas Padrão
                </label>
                <div className="relative">
                  <input 
                     type="number" 
                     min="1"
                     max="10000"
                     value={formData.defaultLimit} 
                     onChange={e => setFormData({...formData, defaultLimit: parseInt(e.target.value) || 100})}
                     className="w-full pl-3 pr-16 py-2.5 bg-slate-900 border border-slate-600 rounded text-sm font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <div className="absolute right-3 top-2.5 text-xs text-slate-500 font-medium pointer-events-none">
                     registros
                  </div>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-700" />

          {/* Advanced Zone */}
          <div className="bg-orange-900/10 p-4 rounded-xl border border-orange-800/30">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-orange-900/50 text-orange-400 rounded-lg">
                      <PenTool className="w-5 h-5" />
                   </div>
                   <div>
                      <h4 className="font-bold text-white text-sm">Modo Edição (CRUD)</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                         Habilita alteração de dados inline.
                      </p>
                   </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.advancedMode} 
                    onChange={e => setFormData({...formData, advancedMode: e.target.checked})}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
             </div>
          </div>

        </form>

        {/* Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-700 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
