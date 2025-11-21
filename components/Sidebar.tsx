
import React from 'react';
import { AppStep } from '../types';
import { Database, Layers, Terminal, Table, Server, ArrowRight } from 'lucide-react';

interface SidebarProps {
  currentStep: AppStep;
  onNavigate: (step: AppStep) => void;
  hasSchema: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentStep, onNavigate, hasSchema }) => {
  
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
    <div className="w-64 shrink-0 flex flex-col p-6">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="p-2 bg-indigo-500 rounded-lg shadow-lg shadow-indigo-500/30">
          <Database className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight text-white">PSQL Buddy</h1>
          <p className="text-xs text-slate-400">Visual Query Builder</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="px-4 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Navigation</div>
        {navItem('connection', 'Database Connection', <Server className="w-4 h-4" />)}
        {navItem('builder', 'Query Builder', <Layers className="w-4 h-4" />, !hasSchema)}
        {navItem('preview', 'Query Preview', <Terminal className="w-4 h-4" />, currentStep === 'connection' || currentStep === 'builder')}
        {navItem('results', 'Query History', <Table className="w-4 h-4" />, currentStep !== 'results')}
      </div>

      <div className="mt-auto pt-6 border-t border-slate-800">
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
          <h4 className="text-indigo-400 text-xs font-bold uppercase mb-2">Pro Tip</h4>
          <p className="text-slate-400 text-xs leading-relaxed">
            {currentStep === 'connection' ? "Enter your DB details. We'll use AI to infer the schema since browsers can't connect directly." :
             currentStep === 'builder' ? "Select multiple tables. The builder will automatically figure out how to JOIN them." :
             "Check the generated SQL validation status before executing."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
