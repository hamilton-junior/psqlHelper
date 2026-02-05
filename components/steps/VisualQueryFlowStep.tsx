
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { DatabaseSchema, BuilderState } from '../../types';
import { 
  Database, Link2, Filter, Calculator, ListOrdered, 
  Table2, Braces, Terminal, 
  Sparkles, Info, Activity, Zap, ArrowDown, ArrowLeft, ArrowRight, X, ChevronUp, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VisualQueryFlowStepProps {
  schema: DatabaseSchema;
  state: BuilderState;
}

const FlowNode = React.forwardRef<HTMLDivElement, { 
  id: string;
  title: string; 
  icon: React.ReactNode; 
  colorClass: string; 
  children: React.ReactNode;
  isActive?: boolean;
  onHover: (id: string | null) => void;
  isHighlighted?: boolean;
}>(({ id, title, icon, colorClass, children, isActive = true, onHover, isHighlighted }, ref) => {
  const colors: Record<string, string> = {
    indigo: 'border-indigo-500 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30',
    cyan: 'border-cyan-500 text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30',
    rose: 'border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-900/30',
    amber: 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-900/30',
    emerald: 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30',
  };

  return (
    <motion.div 
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: isActive ? 1 : 0.2, 
        scale: isHighlighted ? 1.02 : 1,
      }}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      className="relative flex flex-col w-full max-w-sm"
    >
      <div className={`p-6 rounded-[2.5rem] border-2 shadow-2xl bg-white dark:bg-slate-800 transition-all duration-500
        ${isActive ? `border-slate-200 dark:border-slate-700` : 'border-slate-100 dark:border-slate-800'}
        ${isHighlighted ? `ring-8 ring-indigo-500/10 border-indigo-500 shadow-indigo-500/30 z-20` : ''}
      `}>
         <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-2xl transition-colors ${isHighlighted ? 'bg-indigo-600 text-white' : colors[colorClass] || colors.indigo}`}>
               {React.cloneElement(icon as React.ReactElement, { size: 24 })}
            </div>
            <h4 className="font-black text-sm uppercase tracking-[0.2em] text-slate-800 dark:text-white truncate">{title}</h4>
         </div>
         <div className="space-y-3 min-h-[100px] max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
            {children}
         </div>
      </div>
    </motion.div>
  );
});

const VisualQueryFlowStep: React.FC<VisualQueryFlowStepProps> = ({ schema, state }) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [coords, setCoords] = useState<Record<string, { x: number, y: number }>>({});
  const [showFooterInfo, setShowFooterInfo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const nodeRefs = {
    sources: useRef<HTMLDivElement>(null),
    joins: useRef<HTMLDivElement>(null),
    filters: useRef<HTMLDivElement>(null),
    aggregations: useRef<HTMLDivElement>(null),
    calculated: useRef<HTMLDivElement>(null),
    projection: useRef<HTMLDivElement>(null),
  };

  const updateCoords = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newCoords: Record<string, { x: number, y: number }> = {};

    Object.entries(nodeRefs).forEach(([id, ref]) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        newCoords[id] = {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2
        };
      }
    });
    setCoords(newCoords);
  };

  useEffect(() => {
    updateCoords();
    window.addEventListener('resize', updateCoords);
    const timer = setTimeout(updateCoords, 800); 
    return () => {
      window.removeEventListener('resize', updateCoords);
      clearTimeout(timer);
    };
  }, [state]);

  const hasTables = state.selectedTables.length > 0;
  const hasJoins = state.joins.length > 0;
  const hasFilters = state.filters.length > 0;
  const hasAggs = Object.values(state.aggregations).some(a => a !== 'NONE') || state.groupBy.length > 0;
  const hasCalculated = state.calculatedColumns && state.calculatedColumns.length > 0;

  const nodeOrder = ['sources', 'joins', 'filters', 'aggregations', 'calculated', 'projection'];
  
  const activeNodes = useMemo(() => {
    const active = new Set(['projection']);
    if (hasTables) active.add('sources');
    if (hasJoins) active.add('joins');
    if (hasFilters) active.add('filters');
    if (hasAggs) active.add('aggregations');
    if (hasCalculated) active.add('calculated');
    return active;
  }, [hasTables, hasJoins, hasFilters, hasAggs, hasCalculated]);

  const getTransformationText = (id: string) => {
    switch (id) {
      case 'sources': return "Carregando Tabelas";
      case 'joins': return `Merging ${state.joins.length} Vínculos`;
      case 'filters': return `Redução de I/O`;
      case 'aggregations': return `Consolidação`;
      case 'calculated': return `Cálculo Escalar`;
      default: return "Preparando Saída";
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-700 bg-slate-50/50 dark:bg-slate-950/20">
      <div className="p-10 pb-0 shrink-0">
        <div className="flex items-center justify-between">
           <div>
              <h2 className="text-4xl font-black text-slate-800 dark:text-white flex items-center gap-4 tracking-tighter">
                <Activity className="w-10 h-10 text-indigo-600 animate-pulse" />
                Pipeline de Execução
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-xl font-medium mt-1">
                Acompanhe o trajeto lógico dos seus dados.
              </p>
           </div>
           <div className="flex items-center gap-4 px-6 py-3 bg-indigo-600 text-white rounded-[2rem] shadow-xl shadow-indigo-900/20">
              <Sparkles className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">Visual Engine v3.5</span>
           </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-y-auto custom-scrollbar p-12">
        
        {/* Camada SVG de Conexão Zig-Zag */}
        <svg className="absolute inset-0 pointer-events-none w-full h-full" style={{ zIndex: 0, minHeight: '1000px' }}>
          <defs>
            <filter id="ultra-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="12" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="path-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>

          {nodeOrder.map((id, idx) => {
            if (idx === nodeOrder.length - 1) return null;
            const nextId = nodeOrder[idx + 1];
            const p1 = coords[id];
            const p2 = coords[nextId];

            if (!p1 || !p2) return null;

            const isPathActive = activeNodes.has(id) && activeNodes.has(nextId);
            const isHovered = hoveredNode === id || hoveredNode === nextId;
            
            const midY = p1.y + (p2.y - p1.y) / 2;
            const pathD = `M ${p1.x} ${p1.y} C ${p1.x} ${midY}, ${p2.x} ${midY}, ${p2.x} ${p2.y}`;

            return (
              <g key={`link-${id}`}>
                <path d={pathD} stroke={isPathActive ? "#818cf8" : "#cbd5e1"} strokeWidth={isHovered ? 8 : 4} fill="none" opacity={isPathActive ? 0.3 : 0.05} />
                
                {isPathActive && (
                  <motion.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    d={pathD}
                    stroke="url(#path-grad)"
                    strokeWidth={isHovered ? 6 : 3}
                    fill="none"
                    filter={isHovered ? "url(#ultra-glow)" : ""}
                    className="transition-all duration-500"
                  />
                )}

                {isPathActive && (
                  <motion.path
                    d={pathD}
                    stroke="white"
                    strokeWidth={isHovered ? 5 : 3}
                    fill="none"
                    strokeDasharray="4, 80"
                    animate={{ strokeDashoffset: [0, -160] }}
                    transition={{ duration: isHovered ? 0.6 : 1.2, repeat: Infinity, ease: "linear" }}
                  />
                )}

                {isHovered && isPathActive && (
                  <foreignObject x={(p1.x + p2.x) / 2 - 75} y={midY - 15} width="150" height="30">
                    <div className="flex items-center justify-center">
                       <div className="bg-indigo-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded-full shadow-lg border border-indigo-400 flex items-center gap-1.5">
                          <Zap size={10} fill="currentColor" /> {getTransformationText(id)}
                       </div>
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>

        {/* Grade de Blocos em Zig-Zag */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-24 gap-y-32 relative z-10 max-w-6xl mx-auto">
          
          <FlowNode 
            id="sources" ref={nodeRefs.sources} title="Origens (FROM)" 
            icon={<Database />} colorClass="indigo" isActive={hasTables}
            onHover={setHoveredNode} isHighlighted={hoveredNode === 'sources'}
          >
             {state.selectedTables.length > 0 ? state.selectedTables.map(t => (
                <div key={t} className="flex items-center gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:border-indigo-400 transition-colors">
                   <Table2 className="text-indigo-500 shrink-0" />
                   <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{t}</span>
                </div>
             )) : <p className="text-xs text-slate-400 italic p-4 text-center border-2 border-dashed rounded-3xl uppercase font-black opacity-30">Aguardando definição</p>}
          </FlowNode>

          <FlowNode 
            id="joins" ref={nodeRefs.joins} title="Relacionamentos" 
            icon={<Link2 />} colorClass="cyan" isActive={hasJoins}
            onHover={setHoveredNode} isHighlighted={hoveredNode === 'joins'}
          >
             {state.joins.length > 0 ? state.joins.map(j => (
                <div key={j.id} className="p-4 bg-cyan-50/50 dark:bg-cyan-900/10 border border-cyan-100 dark:border-cyan-800 rounded-[1.5rem] hover:scale-[1.02] transition-transform">
                   <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black text-white bg-cyan-600 px-3 py-1 rounded-full uppercase tracking-widest">{j.type} JOIN</span>
                      <span className="text-[10px] text-slate-500 font-mono font-bold">→ {j.toTable.split('.').pop()}</span>
                   </div>
                   <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center gap-3 bg-white dark:bg-slate-950 p-2 rounded-xl border border-white/10 shadow-inner">
                      <span className="truncate">{j.fromColumn}</span>
                      <span className="text-cyan-500 font-black">==</span>
                      <span className="truncate">{j.toColumn}</span>
                   </div>
                </div>
             )) : <div className="text-center p-10 opacity-20"><Info size={40} className="mx-auto" /></div>}
          </FlowNode>

          <div className="order-4 md:order-3">
            <FlowNode 
              id="aggregations" ref={nodeRefs.aggregations} title="Fatoração / Agrupar" 
              icon={<ListOrdered />} colorClass="amber" isActive={hasAggs}
              onHover={setHoveredNode} isHighlighted={hoveredNode === 'aggregations'}
            >
               {hasAggs ? (
                  <div className="space-y-4">
                     {state.groupBy.length > 0 && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl shadow-inner">
                           <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest block mb-2">Grão:</span>
                           <div className="flex flex-wrap gap-2">
                              {state.groupBy.map(g => <span key={g} className="text-xs bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-amber-200 font-bold shadow-sm">BY {g.split('.').pop()}</span>)}
                           </div>
                        </div>
                     )}
                     {Object.entries(state.aggregations).map(([col, func]) => func !== 'NONE' && (
                        <div key={col} className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-md">
                           <Calculator size={20} className="text-amber-500" />
                           <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase">{func}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{col.split('.').pop()}</span>
                           </div>
                        </div>
                     ))}
                  </div>
               ) : <div className="text-center p-10 opacity-20"><Info size={40} className="mx-auto" /></div>}
            </FlowNode>
          </div>

          <div className="order-3 md:order-4">
            <FlowNode 
              id="filters" ref={nodeRefs.filters} title="Restrições (WHERE)" 
              icon={<Filter />} colorClass="rose" isActive={hasFilters}
              onHover={setHoveredNode} isHighlighted={hoveredNode === 'filters'}
            >
               {state.filters.length > 0 ? state.filters.map(f => {
                  const isUnary = f.operator === 'IS NULL' || f.operator === 'IS NOT NULL';
                  return (
                    <div key={f.id} className="flex flex-col gap-1.5 p-4 bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800 rounded-3xl hover:border-rose-400 transition-colors shadow-sm">
                       <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-rose-600 dark:text-rose-400 font-black uppercase">{f.column.split('.').pop()}</span>
                          <span className="text-sm font-black text-rose-700 dark:text-rose-300 px-2 py-0.5 bg-white dark:bg-slate-900 rounded-lg whitespace-nowrap">{f.operator}</span>
                       </div>
                       {!isUnary && (
                          <span className="text-xs text-slate-500 italic font-bold ml-6">"{f.value}"</span>
                       )}
                    </div>
                  );
               }) : <p className="text-xs text-slate-400 font-black uppercase text-center p-8 opacity-40 leading-relaxed border-2 border-dashed rounded-3xl"> Dataset Sem Poda </p>}
            </FlowNode>
          </div>

          <FlowNode 
            id="calculated" ref={nodeRefs.calculated} title="Camada de Cálculo" 
            icon={<Braces />} colorClass="emerald" isActive={hasCalculated}
            onHover={setHoveredNode} isHighlighted={hoveredNode === 'calculated'}
          >
             {hasCalculated ? state.calculatedColumns?.map(calc => (
                <div key={calc.id} className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-3xl shadow-md group hover:bg-emerald-100 transition-all">
                   <div className="text-xs font-black text-emerald-600 truncate mb-2 uppercase tracking-tighter">AS {calc.alias}</div>
                   <div className="bg-white/90 dark:bg-slate-950 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-inner">
                      <code className="text-xs font-mono text-emerald-800 dark:text-emerald-300 leading-relaxed block break-all">{calc.expression}</code>
                   </div>
                </div>
             )) : <div className="text-center p-10 opacity-20"><Info size={40} className="mx-auto" /></div>}
          </FlowNode>

          <FlowNode 
            id="projection" ref={nodeRefs.projection} title="Saída (SELECT)" 
            icon={<Terminal />} colorClass="indigo"
            onHover={setHoveredNode} isHighlighted={hoveredNode === 'projection'}
          >
             <div className="p-8 bg-slate-900 rounded-[3rem] border-4 border-slate-800 shadow-[0_30px_60px_rgba(0,0,0,0.4)] overflow-hidden relative group">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                <div className="flex items-center gap-4 mb-8 relative z-10">
                   <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.8)] animate-pulse"></div>
                   <span className="text-sm font-black text-emerald-400 uppercase tracking-[0.3em]">Buffer Ready</span>
                </div>
                <div className="space-y-5 relative z-10">
                   <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Colunas:</span>
                      <span className="text-white font-mono text-2xl font-black">{state.selectedColumns.length || '*'}</span>
                   </div>
                   <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Limite:</span>
                      <span className="text-white font-mono text-2xl font-black">{state.limit}</span>
                   </div>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-800 flex items-center gap-3">
                   <Database size={20} className="text-indigo-400" />
                   <span className="text-sm font-black text-indigo-200 truncate uppercase tracking-tighter">{schema.name}</span>
                </div>
             </div>
          </FlowNode>
        </div>
      </div>

      {/* Footer Info Otimizado e On-Demand */}
      <div className="mt-auto relative z-[60]">
         <div className="flex justify-center -mb-px">
            <button 
               onClick={() => setShowFooterInfo(!showFooterInfo)}
               className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-b-0 rounded-t-2xl px-6 py-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-all shadow-sm"
            >
               {showFooterInfo ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
               Explicação do Fluxo
            </button>
         </div>
         
         <AnimatePresence>
            {showFooterInfo && (
               <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-20px_50px_rgba(0,0,0,0.1)]"
               >
                  <div className="p-8 flex items-center justify-between gap-10">
                     <div className="flex items-center gap-10">
                        <div className="p-6 bg-indigo-50 dark:bg-indigo-900/30 rounded-[2.5rem] shadow-inner border border-indigo-100 dark:border-indigo-800 shrink-0">
                           <Zap className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="max-w-3xl">
                           <h4 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-widest mb-1">Entenda o Processamento</h4>
                           <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                              O fluxo serpentinado (S) mostra como o motor de banco de dados extrai dados brutos, aplica junções, filtra linhas irrelevantes, realiza cálculos matemáticos e projeta os resultados finais. Passe o mouse nos blocos para ver as transformações aplicadas em tempo real.
                           </p>
                        </div>
                     </div>
                     <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Live Sync Ativo</span>
                        </div>
                     </div>
                  </div>
               </motion.div>
            )}
         </AnimatePresence>
      </div>
    </div>
  );
};

export default VisualQueryFlowStep;
