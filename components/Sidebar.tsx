import React from 'react';
import { AppStep } from '../types';
import { Database, Layers, Terminal, Table, Server, ArrowRight, Settings } from 'lucide-react';

interface SidebarProps {
  currentStep: AppStep;
  onNavigate: (step: AppStep) => void;
  hasSchema: boolean;
  onOpenSettings: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentStep, onNavigate, hasSchema, onOpenSettings }) => {
  
  const navItem = (step: AppStep, label: string, icon: React.ReactNode, disabled: boolean = false) => {
    const isActive = currentStep === step;
    return (
      <button
        onClick={() => !disabled && onNavigate(step)}
        disabled={disabled}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium
          ${isActive 
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
            : disabled 
              ? 'text-slate-600 cursor-not-allowed opacity-50' 
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }
        `}
      >
        {icon}
        <span>{label}</span>
        {isActive && <ArrowRight className="w-4 h-4 ml-auto opacity-60" />}
      </button>
    );
  };

  return (
    <div className="w-64 shrink-0 flex flex-col p-6 border-r border-slate-800 bg-slate-900 text-slate-200">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="p-2 bg-indigo-500 rounded-lg shadow-lg shadow-indigo-500/30">
          <Database className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight text-white">PSQL Buddy</h1>
          <p className="text-xs text-slate-400">Construtor SQL Visual</p>
        </div>
      </div>

      <div className="space-y-2 flex-1">
        <div className="px-4 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Navegação</div>
        {navItem('connection', 'Conexão', <Server className="w-4 h-4" />)}
        {navItem('builder', 'Construtor', <Layers className="w-4 h-4" />, !hasSchema)}
        {navItem('preview', 'Visualização', <Terminal className="w-4 h-4" />, currentStep === 'connection' || currentStep === 'builder')}
        {navItem('results', 'Resultados', <Table className="w-4 h-4" />, currentStep !== 'results')}
      </div>

      <div className="mt-auto space-y-4">
         <button 
           onClick={onOpenSettings}
           className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
         >
           <Settings className="w-4 h-4" />
           <span>Configurações</span>
         </button>

        <div className="pt-6 border-t border-slate-800">
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
            <h4 className="text-indigo-400 text-xs font-bold uppercase mb-2">Dica Pro</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              {currentStep === 'connection' ? "Insira os detalhes do seu BD. Usaremos IA para inferir o esquema, já que navegadores não conectam diretamente." :
               currentStep === 'builder' ? "Selecione várias tabelas. O construtor descobrirá automaticamente como fazer o JOIN delas." :
               "Verifique o status da validação do SQL gerado antes de executar."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;