import React, { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { DatabaseSchema, BuilderState, ExplicitJoin, JoinType, Filter, Operator, OrderBy, AppSettings, SavedQuery, AggregateFunction, Column, Table, CalculatedColumn, WildcardPosition } from '../../types';
import { Layers, ChevronRight, Settings2, RefreshCw, Search, X, Plus, Trash2, ArrowRightLeft, Filter as FilterIcon, ArrowDownAZ, List, Link2, ChevronDown, Save, FolderOpen, Calendar, Clock, Key, Combine, ArrowRight, ArrowLeft, FastForward, Target, CornerDownRight, Wand2, Loader2, Undo2, Redo2, Calculator, Sparkles, LayoutTemplate, PlayCircle, Eye, Info, ChevronUp, Link as LinkIcon, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import SchemaViewer from '../SchemaViewer';
import { generateBuilderStateFromPrompt } from '../../services/geminiService';
import { generateLocalSql } from '../../services/localSqlService';
import BeginnerTip from '../BeginnerTip';
import FormulaModal from '../FormulaModal';
import TieredColumnSelector from '../TieredColumnSelector';

interface BuilderStepProps {
  schema: DatabaseSchema;
  state: BuilderState;
  onStateChange: (state: BuilderState) => void;
  onGenerate: () => void;
  onSkipAi?: () => void;
  isGenerating: boolean;
  progressMessage?: string;
  settings: AppSettings;
  onDescriptionChange?: (tableName: string, newDesc: string) => void;
  onPreviewTable?: (tableName: string) => void; 
}

type TabType = 'columns' | 'joins' | 'filters' | 'sortgroup';

const getTableId = (t: Table) => `${t.schema || 'public'}.${t.name}`;
const getColId = (tableId: string, colName: string) => `${tableId}.${colName}`;

const ColumnItem = memo(({ col, tableId, isSelected, aggregation, isHovered, isRelTarget, isRelSource, onToggle, onAggregationChange, onHover, onHoverOut }: any) => {
  let containerClasses = "bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-700/50 hover:scale-[1.01]";
  let textClasses = "text-slate-300";
  
  if (isSelected) {
     containerClasses = "bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500 shadow-sm z-10";
     textClasses = "text-indigo-300 font-bold";
  }

  if (isHovered) containerClasses = "bg-slate-700 border-slate-500 ring-1 ring-slate-500 z-20";
  else if (isRelTarget) { containerClasses = "bg-amber-900/30 border-amber-400 ring-1 ring-amber-400 shadow-md z-20"; textClasses = "text-amber-100 font-medium"; }
  else if (isRelSource) { containerClasses = "bg-emerald-900/30 border-emerald-400 ring-1 ring-emerald-400 shadow-md z-20"; textClasses = "text-emerald-100 font-medium"; }

  return (
    <div onClick={() => onToggle(tableId, col.name)} onMouseEnter={() => onHover(tableId, col.name, col.references)} onMouseLeave={onHoverOut} className={`flex items-center p-2 rounded border cursor-pointer transition-all duration-200 ease-in-out relative group ${containerClasses}`}>
      <div className={`w-4 h-4 rounded border flex items-center justify-center mr-2 transition-all shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'border-slate-600 bg-slate-800'}`}>{isSelected && <div className="w-1.5 h-1.5 bg-white rounded-[1px]"></div>}</div>
      <div className="flex-1 min-w-0 pr-8">
         <div className={`text-sm font-medium truncate transition-colors flex items-center gap-1.5 ${textClasses}`}>{col.name}{col.isPrimaryKey && <Key className="w-3 h-3 text-amber-500 shrink-0 transform rotate-45" />}{col.isForeignKey && <Link2 className="w-3 h-3 text-blue-400 shrink-0" />}</div>
         <div className="flex items-center gap-2 mt-0.5"><span className="text-[10px] text-slate-500 font-mono">{col.type}</span></div>
      </div>
      {isSelected && (
         <div className="absolute right-1 top-1/2 -translate-y-1/2" onClick={e => e.stopPropagation()}>
            <select value={aggregation} onChange={(e) => onAggregationChange(tableId, col.name, e.target.value as AggregateFunction)} className={`text-[10px] font-bold uppercase rounded px-1 py-0.5 outline-none border cursor-pointer transition-colors ${aggregation !== 'NONE' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
               <option value="NONE">--</option><option value="COUNT">CNT</option><option value="SUM">SUM</option><option value="AVG">AVG</option><option value="MIN">MIN</option><option value="MAX">MAX</option>
            </select>
         </div>
      )}
    </div>
  );
});

const TableCard = memo(({ table, selectedColumns, aggregations, isCollapsed, colSearchTerm, hoveredColumn, onToggleCollapse, onToggleColumn, onAggregationChange, onSelectAll, onSelectNone, onSearchChange, onClearSearch, onSearchBlur, onHoverColumn, onHoverOutColumn }: any) => {
  const tableId = getTableId(table);
  const filteredColumns = useMemo(() => {
    if (!colSearchTerm.trim()) return table.columns;
    return table.columns.filter((col: any) => col.name.toLowerCase().includes(colSearchTerm.toLowerCase()));
  }, [table.columns, colSearchTerm]);

  const selectedCount = selectedColumns.filter((c: string) => c.startsWith(`${tableId}.`)).length;

  return (
    <div className={`bg-slate-800 rounded-lg border overflow-hidden shadow-sm transition-all duration-300 ${isCollapsed ? 'border-slate-700' : 'border-slate-600 ring-1 ring-slate-700'}`}>
       <div className="px-4 py-3 border-b border-slate-700 flex justify-between items-center cursor-pointer hover:bg-slate-700/50 bg-slate-900/50" onClick={() => onToggleCollapse(tableId)}>
         <div className="flex items-center gap-2">
            {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            <h4 className="font-bold text-sm text-slate-200"><span className="text-[10px] font-normal text-slate-500 mr-1">{table.schema}.</span>{table.name}</h4>
            <span className="text-[10px] text-slate-400 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-full">{selectedCount} selecionadas</span>
         </div>
         <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => onSelectAll(tableId, filteredColumns.map((c: any) => c.name))} className="text-[10px] font-bold text-indigo-400">Todas</button>
            <button onClick={() => onSelectNone(tableId, filteredColumns.map((c: any) => c.name))} className="text-[10px] font-bold text-slate-500">Limpar</button>
         </div>
       </div>
       {!isCollapsed && (
         <React.Fragment>
            <div className="px-3 py-2 border-b border-slate-700 bg-slate-900/30">
               <div className="relative">
                  <Search className="absolute left-2.5 top-1.5 w-3.5 h-3.5 text-slate-500" />
                  <input type="text" value={colSearchTerm} onChange={(e) => onSearchChange(tableId, e.target.value)} onBlur={() => onSearchBlur(tableId)} placeholder={`Filtrar em ${table.name}...`} className="w-full pl-8 pr-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs outline-none text-slate-300" />
               </div>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
               {filteredColumns.length === 0 ? (
                  <div className="col-span-full text-center py-4 text-xs text-slate-500 italic">Nenhuma coluna encontrada</div>
               ) : (
                  filteredColumns.map((col: any) => (
                     <ColumnItem key={col.name} col={col} tableId={tableId} isSelected={selectedColumns.includes(getColId(tableId, col.name))} aggregation={aggregations[getColId(tableId, col.name)] || 'NONE'} isHovered={hoveredColumn?.tableId === tableId && hoveredColumn?.col === col.name} onToggle={onToggleColumn} onAggregationChange={onAggregationChange} onHover={onHoverColumn} onHoverOut={onHoverOutColumn} />
                  ))
               )}
            </div>
         </React.Fragment>
       )}
    </div>
  );
});

const BuilderStep: React.FC<BuilderStepProps> = ({ schema, state, onStateChange, onGenerate, onSkipAi, isGenerating, progressMessage, settings, onDescriptionChange, onPreviewTable }) => {
  const [activeTab, setActiveTab] = useState<TabType>('columns');
  const [columnSearchTerms, setColumnSearchTerms] = useState<Record<string, string>>({});
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(new Set());
  const [hoveredColumn, setHoveredColumn] = useState<any>(null);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [magicPrompt, setMagicPrompt] = useState('');
  const [isMagicFilling, setIsMagicFilling] = useState(false);

  const toggleTable = useCallback((tableId: string) => {
    const isSelected = state.selectedTables.includes(tableId);
    if (isSelected) {
      onStateChange({ ...state, selectedTables: state.selectedTables.filter(t => t !== tableId) });
    } else {
      onStateChange({ ...state, selectedTables: [...state.selectedTables, tableId] });
    }
  }, [state, onStateChange]);

  const toggleColumn = useCallback((tableId: string, colName: string) => {
    const fullId = getColId(tableId, colName);
    const isSelected = state.selectedColumns.includes(fullId);
    const newCols = isSelected ? state.selectedColumns.filter(c => c !== fullId) : [...state.selectedColumns, fullId];
    onStateChange({ ...state, selectedColumns: newCols });
  }, [state, onStateChange]);
  
  const updateAggregation = useCallback((tableId: string, colName: string, func: AggregateFunction) => {
    const fullId = getColId(tableId, colName);
    onStateChange({ ...state, aggregations: { ...state.aggregations, [fullId]: func } });
  }, [state, onStateChange]);

  const handleMagicFill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicPrompt.trim() || isMagicFilling) return;
    setIsMagicFilling(true);
    try {
       const newStatePartial = await generateBuilderStateFromPrompt(schema, magicPrompt);
       if (newStatePartial) onStateChange({ ...state, ...newStatePartial as BuilderState });
    } catch (e) { alert("Erro ao preencher com IA."); } finally { setIsMagicFilling(false); }
  };

  return (
    <div className="w-full h-full flex flex-col relative">
      <FormulaModal isOpen={showFormulaModal} onClose={() => setShowFormulaModal(false)} onSave={(alias, expr) => onStateChange({...state, calculatedColumns: [...(state.calculatedColumns || []), {id: crypto.randomUUID(), alias, expression: expr}]})} availableColumns={state.selectedTables.flatMap(tId => { const t = schema.tables.find(tbl => getTableId(tbl) === tId); return t ? t.columns.map(c => ({ table: t.name, column: c.name, fullId: `${tId}.${c.name}`, type: c.type })) : []; })} />
      <div className="flex justify-between items-end mb-4 shrink-0">
        <div><h2 className="text-2xl font-bold text-white flex items-center gap-2"><Layers className="w-6 h-6 text-indigo-50" />Query Builder</h2></div>
      </div>
      
      {settings.enableAiGeneration && (
        <form onSubmit={handleMagicFill} className="mb-4 relative shrink-0"><div className="relative group flex items-center bg-slate-900 rounded-lg border border-slate-700 p-1"><input type="text" value={magicPrompt} onChange={e => setMagicPrompt(e.target.value)} placeholder="Magic Fill: O que você quer consultar?" className="w-full p-2 bg-transparent outline-none text-sm text-slate-200" disabled={isMagicFilling} /><button type="submit" className="p-2 bg-indigo-600 text-white rounded-lg"><Wand2 className="w-4 h-4" /></button></div></form>
      )}

      <div className="flex-1 flex gap-6 min-h-0">
        <div className="w-1/4 bg-slate-900 rounded-xl border border-slate-700 overflow-hidden"><SchemaViewer schema={schema} selectionMode={true} selectedTableIds={state.selectedTables} onToggleTable={toggleTable} onDescriptionChange={onDescriptionChange} onPreviewTable={onPreviewTable} /></div>
        <div className="flex-1 bg-slate-900 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
           <div className="flex border-b border-slate-700 bg-slate-900/50">
             {[['columns', 'Colunas', <List className="w-4 h-4" />], ['joins', 'Joins', <Link2 className="w-4 h-4" />], ['filters', 'Filtros', <FilterIcon className="w-4 h-4" />]].map(([id, label, icon]: any) => (<button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === id ? 'border-indigo-500 text-indigo-400 bg-indigo-900/20' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>{icon}{label}</button>))}
           </div>
           <div className="flex-1 overflow-y-auto p-4">
             {activeTab === 'columns' && state.selectedTables.map(tId => { const t = schema.tables.find(tbl => getTableId(tbl) === tId); return t ? <TableCard key={tId} table={t} selectedColumns={state.selectedColumns} aggregations={state.aggregations} isCollapsed={collapsedTables.has(tId)} colSearchTerm={columnSearchTerms[tId] || ''} onToggleCollapse={() => setCollapsedTables(prev => { const n = new Set(prev); if (n.has(tId)) n.delete(tId); else n.add(tId); return n; })} onToggleColumn={toggleColumn} onAggregationChange={updateAggregation} onSelectAll={(id: any, cols: any) => onStateChange({...state, selectedColumns: Array.from(new Set([...state.selectedColumns, ...cols.map((c: any) => getColId(id, c))]))})} onSelectNone={(id: any, cols: any) => onStateChange({...state, selectedColumns: state.selectedColumns.filter(c => !cols.map((cn: any) => getColId(id, cn)).includes(c))})} onSearchChange={(id: any, val: string) => setColumnSearchTerms({...columnSearchTerms, [id]: val})} /> : null; })}
           </div>
        </div>
      </div>

      <div className="mt-6 bg-slate-800 p-4 rounded-xl flex items-center justify-between border border-slate-700 shrink-0">
         <div className="flex items-center gap-6"><div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Tabelas</span><span className="font-mono text-xl font-bold text-indigo-400">{state.selectedTables.length}</span></div></div>
         <div className="flex items-center gap-4"><button onClick={onGenerate} disabled={state.selectedTables.length === 0 || isGenerating} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2">{isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />} Visualizar & Executar</button></div>
      </div>
    </div>
  );
};

export default BuilderStep;