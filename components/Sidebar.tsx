
import React from 'react';
import { AppStep, DatabaseSchema } from '../types';
import { Database, Layers, Terminal, Table, Server, ArrowRight, Settings } from 'lucide-react';

interface SidebarProps {
  currentStep: AppStep;
  onNavigate: (step: AppStep) => void;
  schema: DatabaseSchema | null;
  onOpenSettings: () => void;
  onRegenerateClick?: () => void;
  onDescriptionChange?: (tableName: string, newDesc: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentStep, onNavigate, schema, onOpenSettings, onRegenerateClick, onDescriptionChange }) => {
  
  const navItem = (step: AppStep, label: string, icon: React.ReactNode, disabled: boolean = false, tooltip: string) => {
    const isActive = currentStep === step;
    return (
      <button
        onClick={() => !disabled && onNavigate(step)}
        disabled={disabled}
        title={tooltip}
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
    <div className="w-80 shrink-0 flex flex-col border-r border-slate-800 bg-slate-900 text-slate-200 h-full overflow-hidden">
      {/* Header */}
      <div className="p-6 shrink-0">
        <div className="flex items-center gap-3 mb-6 px-2" title="PSQL Buddy - AI Query Builder">
          <div className="p-2 bg-indigo-500 rounded-lg shadow-lg shadow-indigo-500/30">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white">PSQL Buddy</h1>
            <p className="text-xs text-slate-400">Construtor SQL Visual</p>
          </div>
        </div>

        <div className="space-y-2">
          {navItem('connection', 'Conexão', <Server className="w-4 h-4" />, false, "Configurar conexão com banco de dados ou simulação")}
          {navItem('builder', 'Construtor', <Layers className="w-4 h-4" />, !schema, "Construir queries visualmente selecionando tabelas e colunas")}
          {navItem('preview', 'Visualização', <Terminal className="w-4 h-4" />, currentStep === 'connection' || currentStep === 'builder', "Visualizar, validar e copiar o SQL gerado")}
          {navItem('results', 'Resultados', <Table className="w-4 h-4" />, currentStep !== 'results', "Ver os dados retornados pela execução da query")}
        </div>
      </div>

      <div className="flex-1"></div>

      {/* Settings Button */}
      <div className="px-6 pb-4 shrink-0">
        <button 
           onClick={onOpenSettings}
           title="Abrir configurações gerais e de IA"
           className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
         >
           <Settings className="w-4 h-4" />
           <span>Configurações</span>
         </button>
      </div>
    </div>
  );
};

export default Sidebar;
