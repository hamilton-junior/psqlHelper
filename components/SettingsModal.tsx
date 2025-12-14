

import React from 'react';
import { Settings, Moon, Sun, Save, X, AlertTriangle, Bot, Zap, ShieldCheck, Lightbulb, Clock, LayoutList, ListFilter, AlertCircle, GraduationCap, PenTool } from 'lucide-react';
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

  const handleToggleTheme = () => {
    setFormData(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }));
  };

  const isAiDisabled = !formData.enableAiGeneration;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-100 dark:bg-slate-900 p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Configurações</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
          
          {/* Modes Section */}
          <div className="space-y-3">
             <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Modos de Interface</h4>
             
             {/* Beginner Mode */}
             <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
                         <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                         <h4 className="font-bold text-slate-800 dark:text-white text-sm">Modo Iniciante</h4>
                         <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
                     <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                   </label>
                </div>
             </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          {/* AI Master Section */}
          <div>
             <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                <Bot className="w-4 h-4" /> Inteligência Artificial
             </h4>
             
             {quotaExhausted && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg flex gap-3 items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-200">
                    <span className="font-bold block mb-1">Cota de IA Atingida</span>
                    <p>Funcionalidades extras (Dicas, Validação) estão bloqueadas para economizar. Você ainda pode tentar gerar queries, mas falhas podem ocorrer.</p>
                  </div>
                </div>
              )}

             <div className="space-y-4">
               {/* Master Switch */}
               <div className="flex items-start justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                  <div className="flex gap-3">
                     <div className={`mt-0.5 p-1.5 rounded-md ${formData.enableAiGeneration ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                        <Zap className="w-4 h-4" />
                     </div>
                     <div className="flex flex-col">
                       <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Habilitar Geração com IA</span>
                       <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-1 max-w-[240px]">
                         Usa o Google Gemini para criar queries complexas e inferir joins automaticamente.
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
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
               </div>

               {/* Child Switches */}
               <div className={`space-y-3 pl-4 border-l-2 border-slate-100 dark:border-slate-700 ml-3 transition-opacity duration-200 ${isAiDisabled ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <ShieldCheck className="w-4 h-4 text-emerald-500" />
                       <div className="flex flex-col">
                         <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Validação Automática</span>
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
                       <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                     </label>
                  </div>

                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <Lightbulb className="w-4 h-4 text-amber-500" />
                       <div className="flex flex-col">
                         <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Sugestões e Dicas</span>
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
                       <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                     </label>
                  </div>

                  {/* AI Timeout Setting */}
                  <div className="pt-2">
                     <div className="flex items-center gap-2 mb-2 text-slate-700 dark:text-slate-300">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        <label className="text-sm font-medium">Tempo de Timeout da IA (ms)</label>
                     </div>
                     <div className="flex gap-2 items-center">
                        <input 
                           type="number" 
                           min="1000"
                           step="500"
                           value={formData.aiGenerationTimeout} 
                           onChange={e => setFormData({...formData, aiGenerationTimeout: parseInt(e.target.value) || 3000})}
                           className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <span className="text-xs text-slate-400">Padrão: 3000</span>
                     </div>
                     <p className="text-[10px] text-slate-400 mt-1">Tempo de espera antes de mostrar o botão "Pular IA".</p>
                  </div>
               </div>
             </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          {/* Connection Defaults */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Padrões do Banco</h4>
            
            {/* Limit Warning */}
            <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3 flex gap-2">
               <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
               <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                  Defina um limite de linhas seguro para evitar travamentos ao carregar grandes volumes de dados. Este valor será o padrão para todas as novas consultas.
               </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Host Padrão</label>
                <input 
                  type="text" 
                  value={formData.defaultDbHost} 
                  onChange={e => setFormData({...formData, defaultDbHost: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Usuário Padrão</label>
                <input 
                  type="text" 
                  value={formData.defaultDbUser} 
                  onChange={e => setFormData({...formData, defaultDbUser: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Porta Padrão</label>
                <input 
                  type="text" 
                  value={formData.defaultDbPort} 
                  onChange={e => setFormData({...formData, defaultDbPort: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                   <ListFilter className="w-3.5 h-3.5" /> Limite de Linhas (LIMIT Padrão)
                </label>
                <div className="relative">
                  <input 
                     type="number" 
                     min="1"
                     max="10000"
                     value={formData.defaultLimit} 
                     onChange={e => setFormData({...formData, defaultLimit: parseInt(e.target.value) || 100})}
                     className="w-full pl-3 pr-16 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <div className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium pointer-events-none">
                     registros
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Recomendado: 100-500 para testes rápidos.</p>
              </div>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          {/* Appearance */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Aparência e Grid</h4>
            <div className="space-y-4">
               <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                 <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tema</span>
                 <button
                   type="button"
                   onClick={handleToggleTheme}
                   className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                     formData.theme === 'dark' 
                       ? 'bg-slate-700 border-slate-600 text-yellow-300' 
                       : 'bg-white border-slate-200 text-amber-500'
                   }`}
                 >
                   {formData.theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                   <span className="text-xs font-bold uppercase">{formData.theme === 'light' ? 'Claro' : 'Escuro'}</span>
                 </button>
               </div>

               <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                     <LayoutList className="w-3.5 h-3.5" /> Linhas por página (Paginação)
                  </label>
                  <select 
                     value={formData.defaultRowsPerPage} 
                     onChange={e => setFormData({...formData, defaultRowsPerPage: parseInt(e.target.value) || 10})}
                     className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                     <option value={10}>10 linhas</option>
                     <option value={25}>25 linhas</option>
                     <option value={50}>50 linhas</option>
                     <option value={100}>100 linhas</option>
                  </select>
               </div>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          {/* Advanced Zone (Moved to Bottom) */}
          <div className="bg-orange-50/50 dark:bg-orange-900/10 p-4 rounded-xl border border-orange-100 dark:border-orange-800/30">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 rounded-lg">
                      <PenTool className="w-5 h-5" />
                   </div>
                   <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-sm">Modo Avançado (CRUD)</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                         Habilita edição inline na tabela de resultados.
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
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
             </div>
             
             {formData.advancedMode && (
                 <div className="flex gap-2 items-start text-orange-800 dark:text-orange-200 text-xs bg-white dark:bg-slate-900/50 p-3 rounded-lg border border-orange-100 dark:border-orange-900/50 animate-in fade-in slide-in-from-top-2">
                     <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-orange-600" />
                     <p className="leading-relaxed">
                         <strong>Atenção:</strong> Esta ferramenta serve apenas para auxílio. Você deve <u>sempre confirmar</u> a query gerada antes de executar qualquer comando de alteração no banco de dados real.
                     </p>
                 </div>
             )}
          </div>

        </form>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2"
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