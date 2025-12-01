
import React, { useState } from 'react';
import { AppStep, DatabaseSchema } from '../types';
import { Database, Layers, Terminal, Table, Server, ArrowRight, Settings, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  currentStep: AppStep;
  onNavigate: (step: AppStep) => void;
  schema: DatabaseSchema | null;
  onOpenSettings: () => void;
  onRegenerateClick?: () => void;
  onDescriptionChange?: (tableName: string, newDesc: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentStep, onNavigate, schema, onOpenSettings, onRegenerateClick, onDescriptionChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const navItem = (step: AppStep, label: string, icon: React.ReactNode, disabled: boolean = false, tooltip: string) => {
    const isActive = currentStep === step;
    return (
      <button
        onClick={() => !disabled && onNavigate(step)}
        disabled={disabled}
        title={isCollapsed ? tooltip : undefined}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium relative group
          ${isActive 
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
            : disabled 
              ? 'text-slate-600 cursor-not-allowed opacity-50' 
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }
          ${isCollapsed ? 'justify-center px-2' : ''}
        `}
      >
        <div className="shrink-0">
           {icon}
        </div>
        
        {!isCollapsed && (
           <span className="truncate transition-opacity duration-200 animate-in fade-in">{label}</span>
        )}
        
        {!isCollapsed && isActive && <ArrowRight className="w-4 h-4 ml-auto opacity-60" />}
        
        {/* Tooltip for collapsed state */}
        {isCollapsed && (
           <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-slate-700">
              {label}
           </div>
        )}
      </button>
    );
  };

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-72'} shrink-0 flex flex-col border-r border-slate-800 bg-slate-900 text-slate-200 h-full transition-all duration-300 ease-in-out relative`}>
      
      {/* Collapse Toggle */}
      <button 
         onClick={toggleSidebar}
         className="absolute -right-3 top-8 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-full p-1 shadow-md z-50 hover:bg-slate-700 transition-colors"
         title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
      >
         {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Header */}
      <div className={`p-6 shrink-0 ${isCollapsed ? 'px-2 flex flex-col items-center' : ''}`}>
        <div className={`flex items-center gap-3 mb-6 px-2 overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''}`} title="PSQL Buddy - AI Query Builder">
          <div className="p-2 bg-indigo-500 rounded-lg shadow-lg shadow-indigo-500/30 shrink-0">
            <Database className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
             <div className="min-w-0">
               <h1 className="font-bold text-lg tracking-tight text-white truncate">PSQL Buddy</h1>
               <p className="text-xs text-slate-400 truncate">Construtor SQL Visual</p>
             </div>
          )}
        </div>

        <div className="space-y-2">
          {navItem('connection', 'Conexão', <Server className="w-4 h-4" />, false, "Configurar conexão")}
          {navItem('builder', 'Construtor', <Layers className="w-4 h-4" />, !schema, "Construir queries")}
          {navItem('preview', 'Visualização', <Terminal className="w-4 h-4" />, currentStep === 'connection' || currentStep === 'builder', "Visualizar SQL")}
          {navItem('results', 'Resultados', <Table className="w-4 h-4" />, currentStep !== 'results', "Ver resultados")}
        </div>
      </div>

      <div className="flex-1"></div>

      {/* Settings Button */}
      <div className={`px-6 pb-4 shrink-0 ${isCollapsed ? 'px-2' : ''}`}>
        <button 
           onClick={onOpenSettings}
           title={isCollapsed ? "Configurações" : "Abrir configurações gerais e de IA"}
           className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 ${isCollapsed ? 'justify-center px-2' : ''}`}
         >
           <Settings className="w-4 h-4 shrink-0" />
           {!isCollapsed && <span>Configurações</span>}
         </button>
      </div>
    </div>
  );
};

export default Sidebar;
