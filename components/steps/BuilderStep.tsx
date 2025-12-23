
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

// Added missing helper function to render join type selection buttons
const renderJoinTypeSelector = (value: JoinType, onChange: (val: JoinType) => void) => {
  const options: JoinType[] = ['INNER', 'LEFT', 'RIGHT', 'FULL'];
  return (
    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700 shrink-0">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1 text-[10px] rounded font-bold transition-all ${
            value === opt 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
};

const findBestJoin = (schema: DatabaseSchema, tableId1: string, tableId2: string): ExplicitJoin | null => {
  const t1Parts = tableId1.split('.');
  const t2Parts = tableId2.split('.');
  if (t1Parts.length < 2 || t2Parts.length < 2) return null;

  const t1Schema = t1Parts[0]; const t1Name = t1Parts[1];
  const t2Schema = t2Parts[0]; const t2Name = t2Parts[1];

  const table1 = schema.tables.find(t => t.name === t1Name && (t.schema || 'public') === t1Schema);
  const table2 = schema.tables.find(t => t.name === t2Name && (t.schema || 'public') === t2Schema);
  
  if (!table1 || !table2) return null;

  for (const col of table1.columns) {
      if (col.isForeignKey && col.references) {
          const refParts = col.references.split('.');
          let targetMatch = false;
          let targetColName = '';

          if (refParts.length === 3) {
             if (refParts[0] === t2Schema && refParts[1] === t2Name) {
                targetMatch = true;
                targetColName = refParts[2];
             }
          } else if (refParts.length === 2) {
             if (refParts[0] === t2Name) {
                targetMatch = true;
                targetColName = refParts[1];
             }
          }

          if (targetMatch) {
               return {
                   id: crypto.randomUUID(),
                   fromTable: tableId1,
                   fromColumn: col.name,
                   type: 'LEFT',
                   toTable: tableId2,
                   toColumn: targetColName
               };
          }
      }
  }

  for (const col of table2.columns) {
      if (col.isForeignKey && col.references) {
          const refParts = col.references.split('.');
          let targetMatch = false;
          let targetColName = '';

          if (refParts.length === 3) {
             if (refParts[0] === t1Schema && refParts[1] === t1Name) {
                targetMatch = true;
                targetColName = refParts[2];
             }
          } else if (refParts.length === 2) {
             if (refParts[0] === t1Name) {
                targetMatch = true;
                targetColName = refParts[1];
             }
          }

          if (targetMatch) {
               return {
                   id: tableId2,
                   fromTable: tableId2,
                   fromColumn: col.name,
                   type: 'LEFT',
                   toTable: tableId1,
                   toColumn: targetColName
               };
          }
      }
  }

  return null;
}

const ColumnItem = memo(({ col, tableId, isSelected, aggregation, isHovered, isRelTarget, isRelSource, onToggle, onAggregationChange, onHover, onHoverOut }: any) => {
  let containerClasses = "bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-700/50 hover:scale-[1.01]";
  let textClasses = "text-slate-300";
  
  if (isSelected) {
     containerClasses = "bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500 shadow-sm z-10";
     textClasses = "text-indigo-300 font-bold";
  }

  if (isHovered) {
     containerClasses = "bg-slate-700 border-slate-500 ring-1 ring-slate-500 z-20";
  } else if (isRelTarget) {
     containerClasses = "bg-amber-900/30 border-amber-400 ring-1 ring-amber-400 shadow-md z-20";
     textClasses = "text-amber-100 font-medium";
  } else if (isRelSource) {
     containerClasses = "bg-emerald-900/30 border-emerald-400 ring-1 ring-emerald-400 shadow-md z-20";
     textClasses = "text-emerald-100 font-medium";
  }

  return (
    <div 
      onClick={() => onToggle(tableId, col.name)}
      onMouseEnter={() => onHover(tableId, col.name, col.references)}
      onMouseLeave={onHoverOut}
      className={`flex items-center p-2 rounded border cursor-pointer transition-all duration-200 ease-in-out relative group ${containerClasses}`}
    >
      <div className={`w-4 h-4 rounded border flex items-center justify-center mr-2 transition-all shrink-0 ${
          isSelected ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'border-slate-600 bg-slate-800'
        }`}>
         {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-[1px]"></div>}
      </div>
      
      <div className="flex-1 min-w-0 pr-8">
         <div className={`text-sm font-medium truncate transition-colors flex items-center gap-1.5 ${textClasses}`}>
            {col.name}
            {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-500 shrink-0 transform rotate-45" />}
            {col.isForeignKey && <Link2 className="w-3 h-3 text-blue-400 shrink-0" />}
         </div>
         <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-500 font-mono">{col.type}</span>
         </div>
      </div>

      {isSelected && (
         <div className="absolute right-1 top-1/2 -translate-y-1/2" onClick={e => e.stopPropagation()}>
            <select value={aggregation} onChange={(e) => onAggregationChange(tableId, col.name, e.target.value as AggregateFunction)} className={`text-[10px] font-bold uppercase rounded px-1 py-0.5 outline-none border cursor-pointer transition-colors ${aggregation !== 'NONE' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-slate-400'}`}>
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
    const term = colSearchTerm;
    const orGroups = term.split(/\s+OR\s+/i);
    return table.columns.filter(col => orGroups.some(group => group.trim().split(/\s+/).every(t => col.name.toLowerCase().includes(t.toLowerCase()))));
  }, [table.columns, colSearchTerm]);

  const visibleColNames = useMemo(() => filteredColumns.map(c => c.name), [filteredColumns]);
  const selectedCount = selectedColumns.filter((c: string) => c.startsWith(`${tableId}.`)).length;
  const isTarget = useMemo(() => hoveredColumn?.references?.includes(table.name), [table.name, hoveredColumn]);
  const isChild = useMemo(() => table.columns.some((c: any) => c.references?.includes(hoveredColumn?.tableId.split('.')[1] || '---')), [table.columns, hoveredColumn]);

  return (
    <div className={`bg-slate-800 rounded-lg border overflow-hidden shadow-sm transition-all duration-300 ${isCollapsed ? 'border-slate-700' : 'border-slate-600 ring-1 ring-slate-700'} ${isTarget ? 'ring-2 ring-amber-400 border-amber-600 shadow-md scale-[1.01] z-10' : ''} ${isChild ? 'ring-2 ring-emerald-400 border-emerald-600 shadow-md scale-[1.01] z-10' : ''}`}>
       <div className={`px-4 py-3 border-b border-slate-700 flex justify-between items-center cursor-pointer hover:bg-slate-700/50 transition-colors ${isTarget ? 'bg-amber-900/20' : isChild ? 'bg-emerald-900/20' : 'bg-slate-900/50'}`} onClick={() => onToggleCollapse(tableId)}>
         <div className="flex items-center gap-2">
            {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            <h4 className={`font-bold text-sm ${isTarget ? 'text-amber-400' : isChild ? 'text-emerald-400' : 'text-slate-200'}`}><span className="text-[10px] font-normal text-slate-500 mr-1">{table.schema}.</span>{table.name}</h4>
            <span className="text-[10px] text-slate-400 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-full">{selectedCount} selecionadas</span>
         </div>
         <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => onSelectAll(tableId, visibleColNames)} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors">Todas</button>
            <button onClick={() => onSelectNone(tableId, visibleColNames)} className="text-[10px] font-bold text-slate-500 hover:text-slate-400 transition-colors">Nenhuma</button>
         </div>
       </div>
       {!isCollapsed && (
         <><div className="px-3 py-2 border-b border-slate-700 bg-slate-900/30"><div className="relative"><Search className="absolute left-2.5 top-1.5 w-3.5 h-3.5 text-slate-500" /><input type="text" value={colSearchTerm} onChange={(e) => onSearchChange(tableId, e.target.value)} onBlur={() => onSearchBlur(tableId)} placeholder={`Filtrar colunas em ${table.name}...`} className="w-full pl-8 pr-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none placeholder-slate-600 text-slate-300" />{colSearchTerm && <button onClick={() => onClearSearch(tableId)} className="absolute right-2 top-1.5 text-slate-500 hover:text-slate-300"><X className="w-3.5 h-3.5" /></button></div></div><div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">{filteredColumns.length === 0 ? <div className="col-span-full text-center py-4 text-xs text-slate-500 italic">Nenhuma coluna encontrada</div> : filteredColumns.map((col: any) => (<ColumnItem key={col.name} col={col} tableId={tableId} tableName={table.name} isSelected={selectedColumns.includes(getColId(tableId, col.name))} aggregation={aggregations[getColId(tableId, col.name)] || 'NONE'} isHovered={hoveredColumn?.tableId === tableId && hoveredColumn?.col === col.name} isRelTarget={hoveredColumn?.references?.includes(`${table.schema}.${table.name}.${col.name}`) || hoveredColumn?.references?.includes(`${table.name}.${col.name}`)} isRelSource={col.references && hoveredColumn && (col.references.includes(`${hoveredColumn.tableId.split('.')[1]}.${hoveredColumn.col}`)) } onToggle={onToggleColumn} onAggregationChange={onAggregationChange} onHover={onHoverColumn} 
         /* Fixed: correctly use onHoverOutColumn prop instead of undefined setHoveredColumn and use ColumnItem's correct onHoverOut prop */
         onHoverOut={onHoverOutColumn} />))}</div></>
       )}
    </div>
  );
});

const BuilderStep: React.FC<BuilderStepProps> = ({ schema, state, onStateChange, onGenerate, onSkipAi, isGenerating, progressMessage, settings, onDescriptionChange, onPreviewTable }) => {
  const [activeTab, setActiveTab] = useState<TabType>(() => (localStorage.getItem(`psql-buddy-tab-${schema.name}`) as TabType) || 'columns');
  useEffect(() => localStorage.setItem(`psql-buddy-tab-${schema.name}`, activeTab), [activeTab, schema.name]);
  
  const [columnSearchTerms, setColumnSearchTerms] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem(`psql-buddy-search-${schema.name}`) || '{}'); } catch { return {}; } });
  useEffect(() => localStorage.setItem(`psql-buddy-search-${schema.name}`, JSON.stringify(columnSearchTerms)), [columnSearchTerms, schema.name]);
  
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem(`psql-buddy-collapsed-${schema.name}`) || '[]')); } catch { return new Set(); } });
  useEffect(() => localStorage.setItem(`psql-buddy-collapsed-${schema.name}`, JSON.stringify(Array.from(collapsedTables))), [collapsedTables, schema.name]);

  const [hoveredColumn, setHoveredColumn] = useState<any>(null);
  const [suggestedJoin, setSuggestedJoin] = useState<ExplicitJoin | null>(null);
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [magicPrompt, setMagicPrompt] = useState('');
  const [isMagicFilling, setIsMagicFilling] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [liveSql, setLiveSql] = useState('');
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  useEffect(() => {
     if (state.selectedTables.length > 0) {
        try { setLiveSql(generateLocalSql(schema, state).sql); } catch (e) { setLiveSql('-- Complete a seleção para ver o SQL'); }
     } else setLiveSql('-- Selecione tabelas para começar');
  }, [state, schema]);

  useEffect(() => {
    let timer: any;
    if (isGenerating) {
       setShowSkipButton(false);
       timer = setTimeout(() => setShowSkipButton(true), settings.aiGenerationTimeout || 3000);
    } else setShowSkipButton(false);
    return () => clearTimeout(timer);
  }, [isGenerating, settings.aiGenerationTimeout]);

  const [history, setHistory] = useState<BuilderState[]>([]);
  const [future, setFuture] = useState<BuilderState[]>([]);
  const [showSavedQueries, setShowSavedQueries] = useState(false);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const saved = localStorage.getItem('psql-buddy-saved-queries');
    if (saved) try { setSavedQueries(JSON.parse(saved)); } catch (e) {}
  }, []);

  const updateStateWithHistory = useCallback((newState: BuilderState) => {
    setHistory(prev => [...prev, JSON.parse(JSON.stringify(stateRef.current))]);
    setFuture([]);
    onStateChange(newState);
  }, [onStateChange]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setFuture(prev => [stateRef.current, ...prev]);
    setHistory(history.slice(0, -1));
    onStateChange(previousState);
  }, [history, onStateChange]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const nextState = future[0];
    setHistory(prev => [...prev, stateRef.current]);
    setFuture(future.slice(1));
    onStateChange(nextState);
  }, [future, onStateChange]);

  const handleSaveQuery = () => {
    const name = window.prompt("Nome da consulta para salvar:", `Consulta ${new Date().toLocaleTimeString()}`);
    if (!name) return;
    const newQuery = { id: crypto.randomUUID(), name, createdAt: Date.now(), schemaName: schema.name, state: JSON.parse(JSON.stringify(stateRef.current)) };
    setSavedQueries(prev => [newQuery, ...savedQueries]);
    localStorage.setItem('psql-buddy-saved-queries', JSON.stringify([newQuery, ...savedQueries]));
  };

  const handleMagicFill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicPrompt.trim() || isMagicFilling) return;
    setIsMagicFilling(true);
    try {
       setHistory(prev => [...prev, JSON.parse(JSON.stringify(stateRef.current))]);
       const newStatePartial = await generateBuilderStateFromPrompt(schema, magicPrompt);
       if (newStatePartial && newStatePartial.selectedTables) {
          onStateChange({ ...stateRef.current, ...newStatePartial as BuilderState });
          setMagicPrompt("");
          if (newStatePartial.joins && newStatePartial.joins.length > 0) setActiveTab('joins'); else setActiveTab('columns');
       }
    } catch (e) { alert("Não foi possível preencher automaticamente."); } finally { setIsMagicFilling(false); }
  };
  
  const handleAddCalculatedColumn = (alias: string, expression: string) => {
    updateStateWithHistory({ ...stateRef.current, calculatedColumns: [...(stateRef.current.calculatedColumns || []), { id: crypto.randomUUID(), alias, expression }] });
  };

  const removeCalculatedColumn = (id: string) => {
    updateStateWithHistory({ ...stateRef.current, calculatedColumns: (stateRef.current.calculatedColumns || []).filter(c => c.id !== id) });
  };

  const toggleTable = useCallback((tableId: string) => {
    const isSelected = stateRef.current.selectedTables.includes(tableId);
    if (isSelected) {
      const newTables = stateRef.current.selectedTables.filter(t => t !== tableId);
      updateStateWithHistory({ 
        ...stateRef.current, 
        selectedTables: newTables, 
        selectedColumns: stateRef.current.selectedColumns.filter(c => !c.startsWith(`${tableId}.`)),
        aggregations: Object.fromEntries(Object.entries(stateRef.current.aggregations).filter(([k]) => !k.startsWith(`${tableId}.`))),
        joins: stateRef.current.joins.filter(j => j.fromTable !== tableId && j.toTable !== tableId), 
        filters: stateRef.current.filters.filter(f => !f.column.startsWith(`${tableId}.`)) 
      });
    } else {
      updateStateWithHistory({ ...stateRef.current, selectedTables: [...stateRef.current.selectedTables, tableId] });
      for (const existingId of stateRef.current.selectedTables) {
         const join = findBestJoin(schema, existingId, tableId) || findBestJoin(schema, tableId, existingId);
         if (join) { setSuggestedJoin(join); break; }
      }
    }
  }, [updateStateWithHistory, schema]);

  const toggleColumn = useCallback((tableId: string, colName: string) => {
    const fullId = getColId(tableId, colName);
    const isSelected = stateRef.current.selectedColumns.includes(fullId);
    const newCols = isSelected ? stateRef.current.selectedColumns.filter(c => c !== fullId) : [...stateRef.current.selectedColumns, fullId];
    const newAggs = { ...stateRef.current.aggregations };
    if (isSelected) delete newAggs[fullId];
    updateStateWithHistory({ ...stateRef.current, selectedTables: stateRef.current.selectedTables.includes(tableId) ? stateRef.current.selectedTables : [...stateRef.current.selectedTables, tableId], selectedColumns: newCols, aggregations: newAggs });
  }, [updateStateWithHistory]);
  
  const updateAggregation = useCallback((tableId: string, colName: string, func: AggregateFunction) => {
    const fullId = getColId(tableId, colName);
    const newAggs = { ...stateRef.current.aggregations };
    if (func === 'NONE') delete newAggs[fullId]; else newAggs[fullId] = func;
    updateStateWithHistory({ ...stateRef.current, selectedColumns: stateRef.current.selectedColumns.includes(fullId) ? stateRef.current.selectedColumns : [...stateRef.current.selectedColumns, fullId], aggregations: newAggs });
  }, [updateStateWithHistory]);

  const updateJoin = (id: string, field: keyof ExplicitJoin, value: string) => updateStateWithHistory({ ...stateRef.current, joins: stateRef.current.joins.map(j => j.id === id ? { ...j, [field]: value } : j) });
  const updateFilter = (id: string, field: keyof Filter, value: any) => updateStateWithHistory({ ...stateRef.current, filters: stateRef.current.filters.map(f => f.id === id ? { ...f, [field]: value } : f) });
  const updateSort = (id: string, field: keyof OrderBy, value: string) => updateStateWithHistory({ ...stateRef.current, orderBy: stateRef.current.orderBy.map(s => s.id === id ? { ...s, [field]: value } : s) });

  return (
    <div className="w-full h-full flex flex-col relative">
      <FormulaModal isOpen={showFormulaModal} onClose={() => setShowFormulaModal(false)} onSave={handleAddCalculatedColumn} availableColumns={state.selectedTables.flatMap(tId => { const t = schema.tables.find(tbl => getTableId(tbl) === tId); return t ? t.columns.map(c => ({ table: t.name, column: c.name, fullId: `${tId}.${c.name}`, type: c.type })) : []; })} />
      <div className="flex justify-between items-end mb-4 shrink-0">
        <div><h2 className="text-2xl font-bold text-white flex items-center gap-2"><Layers className="w-6 h-6 text-indigo-50" />Query Builder</h2><p className="text-sm text-slate-500 mt-1">Conectado a: <span className="font-mono text-indigo-400 bg-indigo-900/20 px-2 py-0.5 rounded text-xs">{schema.name}</span></p></div>
        <div className="flex items-center gap-3"><div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex gap-1"><button onClick={handleSaveQuery} className="p-2 text-slate-400 hover:text-indigo-400 transition-colors"><Save className="w-4 h-4" /></button><button onClick={() => setShowSavedQueries(true)} className="p-2 text-slate-400 hover:text-indigo-400 transition-colors"><FolderOpen className="w-4 h-4" /></button></div><div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex gap-1"><button onClick={handleUndo} disabled={history.length === 0} className="p-2 text-slate-400 disabled:opacity-30 hover:text-indigo-400 transition-colors"><Undo2 className="w-4 h-4" /></button><button onClick={handleRedo} disabled={future.length === 0} className="p-2 text-slate-400 disabled:opacity-30 hover:text-indigo-400 transition-colors"><Redo2 className="w-4 h-4" /></button></div></div>
      </div>
      
      {settings.enableAiGeneration && (
        <form id="magic-fill-bar" onSubmit={handleMagicFill} className="mb-4 relative shrink-0"><div className="relative group"><div className={`absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-indigo-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition ${isMagicFilling ? 'opacity-75 animate-pulse' : ''}`}></div><div className="relative flex items-center bg-slate-900 rounded-lg border border-slate-700"><div className="pl-3 text-indigo-500">{isMagicFilling ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}</div><input type="text" value={magicPrompt} onChange={(e) => setMagicPrompt(e.target.value)} placeholder="Magic Fill: O que você quer consultar?" className="w-full p-3 bg-transparent outline-none text-sm text-slate-200 placeholder-slate-600" disabled={isMagicFilling} /><button type="submit" className="mr-2 p-1.5 bg-indigo-900/30 text-indigo-400 rounded-md hover:bg-indigo-900/50"><ArrowRight className="w-4 h-4" /></button></div></div></form>
      )}

      {suggestedJoin && (<div className="mb-4 p-3 bg-indigo-900/20 border border-indigo-500/50 rounded-lg flex items-center justify-between shadow-sm animate-in slide-in-from-top-2"><div className="flex items-center gap-3"><LinkIcon className="w-4 h-4 text-indigo-400" /><div><p className="text-xs font-bold text-indigo-200">Sugestão de Join</p><p className="text-xs text-indigo-300/70">Conexão detectada entre {suggestedJoin.fromTable} e {suggestedJoin.toTable}.</p></div></div><div className="flex gap-2"><button onClick={() => setSuggestedJoin(null)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">Ignorar</button><button onClick={() => { updateStateWithHistory({ ...stateRef.current, joins: [...stateRef.current.joins, suggestedJoin] }); setSuggestedJoin(null); setActiveTab('joins'); }} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded font-bold hover:bg-indigo-500 transition-colors">Aceitar Join</button></div></div>)}

      <div className="flex-1 flex gap-6 min-h-0">
        <div className="w-1/4 bg-slate-900 rounded-xl border border-slate-700 flex flex-col overflow-hidden"><SchemaViewer schema={schema} selectionMode={true} selectedTableIds={state.selectedTables} onToggleTable={toggleTable} onDescriptionChange={onDescriptionChange} onPreviewTable={onPreviewTable} /></div>
        <div className="flex-1 w-full bg-slate-900 rounded-xl border border-slate-700 flex flex-col overflow-hidden shadow-sm relative">
           <div className="flex border-b border-slate-700 bg-slate-900/50">
             {[['columns', 'Colunas', <List className="w-4 h-4" />], ['joins', 'Joins', <Link2 className="w-4 h-4" />], ['filters', 'Filtros', <FilterIcon className="w-4 h-4" />], ['sortgroup', 'Ordenar/Agrupar', <ArrowDownAZ className="w-4 h-4" />]].map(([id, label, icon]: any) => (<button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === id ? 'border-indigo-500 text-indigo-400 bg-indigo-900/20' : 'border-transparent text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>{icon}{label}</button>))}
           </div>
           <div className="flex-1 overflow-y-auto p-4 bg-slate-900/20">
             {activeTab === 'columns' && (
               <div className="space-y-6">
                 {state.selectedTables.length > 0 && (<div className="mb-4"><div className="flex justify-between items-center mb-2"><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><Calculator className="w-3.5 h-3.5" /> Fórmulas</h3><button onClick={() => setShowFormulaModal(true)} className="text-xs text-indigo-400 font-bold hover:text-indigo-300 transition-colors"><Plus className="w-3 h-3" /> Nova Fórmula</button></div>{(state.calculatedColumns || []).map(calc => (<div key={calc.id} className="bg-slate-800 p-2 rounded border border-indigo-900/50 flex items-center justify-between group"><div className="flex-1 min-w-0"><div className="text-xs font-bold text-indigo-400 truncate">{calc.alias}</div><code className="text-[10px] text-slate-500 truncate">{calc.expression}</code></div><button onClick={() => removeCalculatedColumn(calc.id)} className="text-slate-500 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button></div>))}</div>)}
                 {state.selectedTables.length === 0 ? <div className="text-center py-20 text-slate-600">Selecione tabelas à esquerda para começar.</div> : state.selectedTables.map(tId => { const t = schema.tables.find(tbl => getTableId(tbl) === tId); return t ? <TableCard key={tId} table={t} selectedColumns={state.selectedColumns} aggregations={state.aggregations} isCollapsed={collapsedTables.has(tId)} colSearchTerm={columnSearchTerms[tId] || ''} hoveredColumn={hoveredColumn} onToggleCollapse={() => setCollapsedTables(prev => { const next = new Set(prev); if (next.has(tId)) next.delete(tId); else next.add(tId); return next; })} onToggleColumn={toggleColumn} onAggregationChange={updateAggregation} onSelectAll={(id: any, cols: any) => { const newCols = new Set(state.selectedColumns); cols.forEach((c: any) => newCols.add(getColId(id, c))); updateStateWithHistory({...state, selectedColumns: Array.from(newCols)}); }} onSelectNone={(id: any, cols: any) => { const visible = new Set(cols.map((c: any) => getColId(id, c))); updateStateWithHistory({...state, selectedColumns: state.selectedColumns.filter(c => !visible.has(c))}); }} onSearchChange={(id: any, term: any) => setColumnSearchTerms(prev => ({...prev, [id]: term}))} onClearSearch={(id: any) => setColumnSearchTerms(prev => ({...prev, [id]: ''}))} onHoverColumn={(id: any, col: any, ref: any) => setHoveredColumn({tableId: id, col, references: ref})} onHoverOutColumn={() => setHoveredColumn(null)} /> : null; })}
               </div>
             )}
             {activeTab === 'joins' && (
               <div className="max-w-4xl mx-auto space-y-6">
                 <div className="flex justify-between items-center"><h3 className="text-lg font-bold text-white">Relacionamentos</h3><button onClick={() => updateStateWithHistory({ ...stateRef.current, joins: [...stateRef.current.joins, { id: crypto.randomUUID(), fromTable: stateRef.current.selectedTables[0] || '', fromColumn: '', type: 'INNER', toTable: stateRef.current.selectedTables[1] || '', toColumn: '' }] })} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg shadow-md hover:bg-indigo-500 transition-colors"><Plus className="w-4 h-4" /> Novo Join</button></div>
                 {state.joins.length === 0 ? <div className="text-center py-10 text-slate-600 border-2 border-dashed border-slate-700 rounded-xl">Nenhum JOIN definido manualmente.</div> : state.joins.map(join => (<div key={join.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5 relative group shadow-lg"><button onClick={() => updateStateWithHistory({ ...stateRef.current, joins: stateRef.current.joins.filter(j => j.id !== join.id) })} className="absolute top-2 right-2 p-2 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button><div className="flex flex-col gap-4"><div className="flex items-center gap-4"><div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Tabela A</label><select value={join.fromTable} onChange={(e) => updateJoin(join.id, 'fromTable', e.target.value)} className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-bold text-slate-200">{state.selectedTables.map(tId => <option key={tId} value={tId}>{tId}</option>)}</select></div><div className="pt-5">{renderJoinTypeSelector(join.type, (val) => updateJoin(join.id, 'type', val))}</div><div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Tabela B</label><select value={join.toTable} onChange={(e) => updateJoin(join.id, 'toTable', e.target.value)} className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-bold text-slate-200">{state.selectedTables.map(tId => <option key={tId} value={tId}>{tId}</option>)}</select></div></div><div className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex items-center gap-3"><span className="text-[10px] font-mono font-bold text-slate-600">ON</span><div className="flex-1"><TieredColumnSelector value={`${join.fromTable}.${join.fromColumn}`} onChange={(v) => updateJoin(join.id, 'fromColumn', v.split('.').pop()!)} schema={schema} availableTablesOnly={[join.fromTable]} /></div><span className="font-mono text-slate-600">=</span><div className="flex-1"><TieredColumnSelector value={`${join.toTable}.${join.toColumn}`} onChange={(v) => updateJoin(join.id, 'toColumn', v.split('.').pop()!)} schema={schema} availableTablesOnly={[join.toTable]} /></div></div></div></div>))}
               </div>
             )}
             {activeTab === 'filters' && (
               <div className="max-w-4xl mx-auto space-y-4">
                 <div className="flex justify-between items-center"><p className="text-sm text-slate-500">Condições de filtro (WHERE).</p><button onClick={() => updateStateWithHistory({ ...stateRef.current, filters: [...stateRef.current.filters, { id: crypto.randomUUID(), column: stateRef.current.selectedColumns[0] || '', operator: '=', value: '', wildcardPosition: 'both' }] })} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded shadow-md hover:bg-indigo-500 transition-colors"><Plus className="w-3.5 h-3.5" /> Adicionar Filtro</button></div>
                 {state.filters.length === 0 ? <div className="text-center py-10 text-slate-600">Nenhum filtro aplicado.</div> : state.filters.map(filter => (<div key={filter.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex items-center gap-3 shadow-lg transition-all hover:border-slate-600"><div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">WHERE</div><TieredColumnSelector value={filter.column} onChange={(v) => updateFilter(filter.id, 'column', v)} schema={schema} /><select value={filter.operator} onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)} className="text-xs font-bold text-indigo-400 bg-slate-900 border border-slate-700 rounded p-1.5 outline-none focus:border-indigo-500 transition-colors"><option value="=">=</option><option value="!=">!=</option><option value=">">&gt;</option><option value="<">&lt;</option><option value="LIKE">LIKE</option><option value="ILIKE">ILIKE</option><option value="IS NULL">IS NULL</option></select>{!filter.operator.includes('NULL') && (<div className="flex-1 flex gap-2"><input type="text" value={filter.value} onChange={(e) => updateFilter(filter.id, 'value', e.target.value)} placeholder="Valor..." className="flex-1 p-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 outline-none focus:border-indigo-500" />{(filter.operator === 'LIKE' || filter.operator === 'ILIKE') && (<div className="flex bg-slate-900 p-0.5 rounded border border-slate-700 shrink-0">{[['end', <AlignLeft className="w-3.5 h-3.5" />], ['both', <AlignCenter className="w-3.5 h-3.5" />], ['start', <AlignRight className="w-3.5 h-3.5" />]].map(([pos, icon]: any) => (<button key={pos} onClick={() => updateFilter(filter.id, 'wildcardPosition', pos)} className={`p-1 rounded transition-colors ${filter.wildcardPosition === pos ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>{icon}</button>))}</div>)}</div>)}<button onClick={() => updateStateWithHistory({ ...stateRef.current, filters: stateRef.current.filters.filter(f => f.id !== filter.id) })} className="text-slate-600 hover:text-red-500 transition-colors p-1.5"><Trash2 className="w-4 h-4" /></button></div>))}
               </div>
             )}
             {activeTab === 'sortgroup' && (
               <div className="max-w-3xl mx-auto space-y-8">
                 <div><h3 className="font-bold text-slate-300 mb-2 flex items-center gap-2"><List className="w-4 h-4 text-indigo-400" /> Agrupar Por (Group By)</h3><div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-wrap gap-2">{state.selectedColumns.map(fullId => (<button key={fullId} onClick={() => updateStateWithHistory({...state, groupBy: state.groupBy.includes(fullId) ? state.groupBy.filter(g => g !== fullId) : [...state.groupBy, fullId]})} className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${state.groupBy.includes(fullId) ? 'bg-indigo-900/40 text-indigo-400 border-indigo-500' : 'bg-slate-900 text-slate-500 border-slate-700 hover:border-slate-500'}`}>{fullId.split('.').pop()}</button>))}</div></div>
                 <div><div className="mb-2 flex justify-between items-center"><h3 className="font-bold text-slate-300 flex items-center gap-2"><ArrowDownAZ className="w-4 h-4 text-indigo-400" /> Ordenar Por (Order By)</h3><button onClick={() => updateStateWithHistory({ ...stateRef.current, orderBy: [...stateRef.current.orderBy, { id: crypto.randomUUID(), column: stateRef.current.selectedColumns[0] || '', direction: 'ASC' }] })} className="text-xs text-indigo-400 font-bold hover:text-indigo-300 transition-colors flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar Regra</button></div>{state.orderBy.length === 0 ? <div className="text-center py-10 text-slate-600 border border-dashed border-slate-700 rounded-lg">Nenhuma ordenação definida.</div> : state.orderBy.map(sort => (<div key={sort.id} className="bg-slate-800 p-2 rounded-lg border border-slate-700 flex items-center gap-3 shadow-lg transition-all hover:border-slate-600"><TieredColumnSelector value={sort.column} onChange={(v) => updateSort(sort.id, 'column', v)} schema={schema} availableTablesOnly={state.selectedTables} /><div className="flex bg-slate-900 p-1 rounded border border-slate-700 shrink-0"><button onClick={() => updateSort(sort.id, 'direction', 'ASC')} className={`px-3 py-1 text-[10px] rounded font-bold transition-all ${sort.direction === 'ASC' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>ASC</button><button onClick={() => updateSort(sort.id, 'direction', 'DESC')} className={`px-3 py-1 text-[10px] rounded font-bold transition-all ${sort.direction === 'DESC' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>DESC</button></div><button onClick={() => updateStateWithHistory({ ...stateRef.current, orderBy: stateRef.current.orderBy.filter(s => s.id !== sort.id) })} className="text-slate-600 hover:text-red-500 transition-colors p-1.5 ml-auto"><Trash2 className="w-4 h-4" /></button></div>))}</div>
               </div>
             )}
           </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 shrink-0">
         <div className="flex justify-end px-4"><button onClick={() => setShowLivePreview(!showLivePreview)} className="flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-colors bg-slate-800 px-3 py-1.5 rounded-t-lg border border-b-0 border-slate-700">{showLivePreview ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}Live SQL Preview</button></div>
         {showLivePreview && (<div className="bg-slate-950 p-4 rounded-xl border border-slate-700 shadow-inner mb-2 animate-in slide-in-from-bottom-2"><pre className="text-[11px] font-mono text-emerald-500 whitespace-pre-wrap">{liveSql}</pre></div>)}
         <div className="bg-slate-800 text-white p-4 rounded-xl flex items-center justify-between shadow-lg border border-slate-700">
            <div className="flex items-center gap-6"><div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Tabelas</span><span className="font-mono text-xl font-bold text-indigo-400">{state.selectedTables.length}</span></div><div className="w-px h-8 bg-slate-700"></div><div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Colunas</span><span className="font-mono text-xl font-bold text-indigo-400">{state.selectedColumns.length === 0 ? '*' : state.selectedColumns.length}</span></div></div>
            <div className="flex items-center gap-4"><div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded border border-slate-700"><Settings2 className="w-4 h-4 text-slate-500" /><span className="text-xs text-slate-400">Limite:</span><input type="number" value={state.limit} onChange={(e) => updateStateWithHistory({...stateRef.current, limit: parseInt(e.target.value) || 10})} className="w-16 bg-transparent text-right font-mono text-sm outline-none text-indigo-400 font-bold" /></div>{isGenerating && showSkipButton && onSkipAi && settings.enableAiGeneration && (<button onClick={onSkipAi} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors">Pular IA</button>)}<button id="generate-sql-btn" onClick={onGenerate} disabled={state.selectedTables.length === 0 || isGenerating} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg transition-all disabled:opacity-50 flex items-center gap-2">{isGenerating ? (<><RefreshCw className="w-4 h-4 animate-spin" /><span className="text-xs">{progressMessage || "Processando..."}</span></>) : (<>Visualizar & Executar <ChevronRight className="w-4 h-4" /></>)}</button></div>
         </div>
      </div>
    </div>
  );
};

export default BuilderStep;
