import React from 'react';
import { Settings, Moon, Sun, Save, X, AlertTriangle } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
        
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
          
          {/* Appearance */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Aparência</h4>
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
          </div>

          {/* Connection Defaults */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Detalhes Padrão de Conexão</h4>
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
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nome do Banco Padrão</label>
                <input 
                  type="text" 
                  value={formData.defaultDbName} 
                  onChange={e => setFormData({...formData, defaultDbName: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Query & AI Defaults */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Preferências de Consulta e IA</h4>
            
            {quotaExhausted && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs text-red-700 dark:text-red-300">
                  <span className="font-bold block mb-1">Cota de IA Esgotada</span>
                  <p>Você atingiu o limite da API para o plano gratuito. As funcionalidades de IA foram desativadas temporariamente.</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Limite de Linhas Padrão (LIMIT)</label>
                <input 
                  type="number" 
                  value={formData.defaultLimit} 
                  onChange={e => setFormData({...formData, defaultLimit: parseInt(e.target.value) || 10})}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className={`flex items-center justify-between ${quotaExhausted ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Habilitar Validação por IA</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-500">Verifica erros de sintaxe SQL automaticamente</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={quotaExhausted ? false : formData.enableAiValidation} 
                    onChange={e => setFormData({...formData, enableAiValidation: e.target.checked})}
                    className="sr-only peer" 
                    disabled={quotaExhausted}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className={`flex items-center justify-between ${quotaExhausted ? 'opacity-50 pointer-events-none' : ''}`}>
                 <div className="flex flex-col">
                   <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Habilitar Dicas de IA</span>
                   <span className="text-[10px] text-slate-500 dark:text-slate-500">Gera sugestões de otimização</span>
                 </div>
                 <label className="relative inline-flex items-center cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={quotaExhausted ? false : formData.enableAiTips} 
                     onChange={e => setFormData({...formData, enableAiTips: e.target.checked})}
                     className="sr-only peer" 
                     disabled={quotaExhausted}
                   />
                   <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                 </label>
              </div>
            </div>
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