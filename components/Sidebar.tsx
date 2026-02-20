
import React, { useState } from 'react';
import { AppStep, DatabaseSchema } from '../types';
import { 
  Database, Layers, Terminal, Table, Server, ArrowRight, Settings, 
  ChevronLeft, ChevronRight, Map, History, GitCompare, Link, 
  FileSearch, FileText, Scissors, BookOpen, Rocket, Tag, 
  CloudDownload, Keyboard, Zap, LayoutGrid, Github, HeartPulse, Route,
  Boxes
} from 'lucide-react';

interface SidebarProps {
  currentStep: AppStep;
  onNavigate: (step: AppStep) => void;
  schema: DatabaseSchema | null;
  hasResults?: boolean;
  onOpenSettings: () => void;
  onOpenDiagram: () => void; 
  onOpenHistory: () => void; 
  onOpenShortcuts: () => void;
  onOpenCheatSheet: () => void;
  onOpenVirtualRelations: () => void;
  onOpenLogAnalyzer: () => void;
  onOpenTemplates: () => void;
  onOpenSqlExtractor: () => void;
  onOpenWiki: () => void;
  onCheckUpdate: () => void;
}

declare const __APP_VERSION__: string;
const CURRENT_APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'd.e.v';

const formatVersionDisplay = (v: string): string => {
  const parts = v.split('.');
  if (parts.length !== 3) return v;
  return `${parts[0]}.${parts[1].padStart(2, '0')}.${parts[2].padStart(2, '0')}`;
};

const Sidebar: React.FC<SidebarProps> = ({ 
  currentStep, onNavigate, schema, hasResults = false, onOpenSettings, 
  onOpenDiagram, onOpenHistory, onOpenShortcuts, onOpenCheatSheet, 
  onOpenVirtualRelations, onOpenLogAnalyzer, onOpenTemplates, 
  onOpenSqlExtractor, onOpenWiki, onCheckUpdate
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  const handleOpenGithub = (e: React.MouseEvent) => {
    e.preventDefault();
    const repoUrl = "https://github.com/Hamilton-Junior/psqlBuddy";
    if ((window as any).electron) {
      (window as any).electron.send('open-external', repoUrl);
    } else {
      window.open(repoUrl, '_blank');
    }
  };

  const navItem = (step: AppStep, label: string, icon: React.ReactNode, disabled: boolean = false) => {
    const isActive = currentStep === step;
    return (
      <button
        onClick={() => !disabled && onNavigate(step)}
        disabled={disabled}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-xs font-bold group
          ${isActive 
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' 
            : disabled 
              ? 'text-slate-600 cursor-not-allowed opacity-40' 
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
          }
          ${isCollapsed ? 'justify-center px-2' : ''}
        `}
      >
        <div className="shrink-0">{icon}</div>
        {!isCollapsed && <span className="truncate">{label}</span>}
        {!isCollapsed && isActive && <ArrowRight className="w-4 h-4 ml-auto opacity-60" />}
      </button>
    );
  };

  const toolItem = (label: string, icon: React.ReactNode, onClick: () => void) => {
    return (
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-xs font-bold text-slate-400 transition-all
          hover:bg-slate-800/50 hover:text-indigo-400
          ${isCollapsed ? 'justify-center px-2' : ''}
        `}
      >
        <div className="shrink-0">{icon}</div>
        {!isCollapsed && <span className="truncate">{label}</span>}
      </button>
    );
  };

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-72'} shrink-0 flex flex-col bg-[#050914] text-slate-400 h-full transition-all duration-300 relative border-r border-slate-900`}>
      
      <button onClick={toggleSidebar} className="absolute -right-3 top-8 bg-slate-900 border border-slate-800 text-slate-500 hover:text-indigo-400 rounded-full p-1 shadow-md z-50 transition-all">
         {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      <div className={`p-6 shrink-0 flex flex-col h-full ${isCollapsed ? 'px-2 items-center' : ''}`}>
        
        <div className={`flex items-center gap-3 mb-10 px-2 ${isCollapsed ? 'justify-center px-0' : ''}`}>
          <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20 shrink-0">
            <Database className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
             <div className="min-w-0">
               <h1 className="font-black text-lg tracking-tight text-white truncate leading-none">PSQL Buddy</h1>
               <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">AI Query Engine</p>
             </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1 -mr-1 space-y-1">
          {navItem('connection', 'Conexão', <Server className="w-5 h-5" />)}
          {navItem('builder', 'Construtor', <Layers className="w-5 h-5" />, !schema)}
          {navItem('objects', 'Funções & Triggers', <Boxes className="w-5 h-5" />, !schema)}
          {navItem('queryflow', 'Fluxo da Query', <Route className="w-5 h-5" />, !schema)}
          {navItem('preview', 'Visualização', <Terminal className="w-5 h-5" />, !schema)}
          {navItem('results', 'Resultados', <Table className="w-5 h-5" />, !hasResults)}
          
          <div className="my-6 border-t border-slate-900 opacity-50"></div>
          
          {navItem('datadiff', 'Comparador', <GitCompare className="w-5 h-5" />, !schema)}
          {navItem('serverhealth', 'Saúde do Banco', <HeartPulse className="w-5 h-5 transition-transform group-hover:animate-pulse-soft" />, !schema)}

          {schema && (
            <div className="pt-6 space-y-1">
              {!isCollapsed && (
                <div className="px-4 mb-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">
                  Ferramentas
                </div>
              )}
              {toolItem('Templates SQL', <FileText className="w-4.5 h-4.5" />, onOpenTemplates)}
              {toolItem('Wiki do Banco', <BookOpen className="w-4.5 h-4.5" />, onOpenWiki)}
              {toolItem('Extrator de SQL', <Scissors className="w-4.5 h-4.5" />, onOpenSqlExtractor)}
              {toolItem('Analisador de Logs', <FileSearch className="w-4.5 h-4.5" />, onOpenLogAnalyzer)}
              {toolItem('Vínculos Manuais', <Link className="w-4.5 h-4.5" />, onOpenVirtualRelations)}
              {toolItem('Mapa do Schema', <Map className="w-4.5 h-4.5" />, onOpenDiagram)}
              {toolItem('Histórico', <History className="w-4.5 h-4.5" />, onOpenHistory)}
            </div>
          )}
        </div>

        <div className="mt-auto pt-6 space-y-1">
          <button 
            onClick={onOpenCheatSheet}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-xs font-bold text-emerald-500 hover:bg-emerald-500/5 ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
             <BookOpen className="w-5 h-5" />
             {!isCollapsed && <span>Guia SQL</span>}
          </button>

          <button 
            onClick={onCheckUpdate} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-xs font-bold text-indigo-400 hover:bg-indigo-400/5 ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
             <CloudDownload className="w-5 h-5" />
             {!isCollapsed && <span>Atualizações</span>}
          </button>

          <button 
            onClick={onOpenSettings} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-xs font-bold text-slate-400 hover:bg-slate-800/50 hover:text-white ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
             <Settings className="w-5 h-5" />
             {!isCollapsed && <span>Configurações</span>}
           </button>

           {isCollapsed ? (
              <div className="flex flex-col items-center gap-3 pt-4 mt-2 border-t border-slate-900">
                <button 
                  onClick={handleOpenGithub}
                  className="text-slate-600 hover:text-white transition-colors"
                  title="GitHub Repository"
                >
                  <Github className="w-5 h-5" />
                </button>
              </div>
           ) : (
              <div className="px-4 pt-4 flex items-center justify-between mt-2 border-t border-slate-900">
                 <div className="flex items-center gap-3">
                    <button 
                      onClick={handleOpenGithub}
                      className="text-slate-600 hover:text-white transition-colors"
                      title="Abrir Repositório no GitHub"
                    >
                      <Github className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 text-[9px] font-black text-slate-600 uppercase tracking-widest" title="Versão atual do aplicativo">
                       <Tag className="w-3 h-3 opacity-50" /> {formatVersionDisplay(CURRENT_APP_VERSION)}
                    </div>
                 </div>
                 <button 
                    onClick={() => onNavigate('roadmap')}
                    className="group text-[9px] font-black text-slate-500 hover:text-orange-400 transition-colors uppercase tracking-widest flex items-center gap-1"
                 >
                    <Rocket className="w-3 h-3 transition-transform group-hover:animate-takeoff" /> Roadmap
                 </button>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
