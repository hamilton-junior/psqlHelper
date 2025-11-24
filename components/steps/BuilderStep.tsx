
import React, { useState, useMemo, useEffect } from 'react';
import { DatabaseSchema, BuilderState, ExplicitJoin, JoinType, Filter, Operator, OrderBy, AppSettings, SavedQuery } from '../../types';
import { Layers, ChevronRight, Settings2, RefreshCw, Search, X, CheckSquare, Square, Plus, Trash2, ArrowRightLeft, Filter as FilterIcon, ArrowDownAZ, List, Link2, Check, ChevronDown, Pin, XCircle, Undo2, Redo2, Save, FolderOpen, Calendar, Clock } from 'lucide-react';

interface BuilderStepProps {
  schema: DatabaseSchema;
  state: BuilderState;
  onStateChange: (state: BuilderState) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  settings: AppSettings;
}

type TabType = 'columns' | 'joins' | 'filters' | 'sortgroup';

const BuilderStep: React.FC<BuilderStepProps> = ({ schema, state, onStateChange, onGenerate, isGenerating, settings }) => {
  const [activeTab, setActiveTab] = useState<TabType>('columns');
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for column search within specific tables
  const [columnSearchTerms, setColumnSearchTerms] = useState<Record<string, string>>({});
  
  // State for collapsible tables
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(new Set());

  // --- Undo / Redo History State ---
  const [history, setHistory] = useState<BuilderState[]>([]);
  const [future, setFuture] = useState<BuilderState[]>([]);

  // --- Saved Queries State ---
  const [showSavedQueries, setShowSavedQueries] = useState(false);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);

  // Load saved queries on mount
  useEffect(() => {
    const saved = localStorage.getItem('psql-buddy-saved-queries');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedQueries(parsed);
      } catch (e) {
        console.error("Failed to parse saved queries", e);
      }
    }
  }, []);

  // Initialize defaults from settings if state is fresh
  useEffect(() => {
    if (state.limit === 100 && state.limit !== settings.defaultLimit) {
      onStateChange({ ...state, limit: settings.defaultLimit });
    }
  }, [settings.defaultLimit]);

  // --- History Management Wrappers ---
  
  const updateStateWithHistory = (newState: BuilderState) => {
    const currentStateCopy = JSON.parse(JSON.stringify(state));
    setHistory(prev => [...prev, currentStateCopy]);
    setFuture([]);
    onStateChange(newState);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    setFuture(prev => [state, ...prev]);
    setHistory(newHistory);
    onStateChange(previousState);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const nextState = future[0];
    const newFuture = future.slice(1);
    setHistory(prev => [...prev, state]);
    setFuture(newFuture);
    onStateChange(nextState);
  };

  // --- Saved Queries Logic ---
  
  const handleSaveQuery = () => {
    const name = window.prompt("Nome da consulta para salvar:", `Consulta ${new Date().toLocaleTimeString()}`);
    if (!name) return;

    const newQuery: SavedQuery = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      schemaName: schema.name,
      state: JSON.parse(JSON.stringify(state)) // Deep copy
    };

    const newSavedList = [newQuery, ...savedQueries];
    setSavedQueries(newSavedList);
    localStorage.setItem('psql-buddy-saved-queries', JSON.stringify(newSavedList));
  };

  const handleLoadQuery = (query: SavedQuery) => {
    if (window.confirm(`Carregar "${query.name}"? Isso substituirá sua seleção atual.`)) {
      updateStateWithHistory(query.state);
      setShowSavedQueries(false);
    }
  };

  const handleDeleteQuery = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Excluir esta consulta salva?")) {
      const newList = savedQueries.filter(q => q.id !== id);
      setSavedQueries(newList);
      localStorage.setItem('psql-buddy-saved-queries', JSON.stringify(newList));
    }
  };

  // Filter queries for current schema
  const relevantSavedQueries = savedQueries.filter(q => q.schemaName === schema.name);

  // --- Helpers ---
  const getColumnsForTable = (tableName: string) => {
    const t = schema.tables.find(table => table.name === tableName);
    return t ? t.columns : [];
  };

  const getAllSelectedTableColumns = () => {
    let cols: {table: string, column: string}[] = [];
    state.selectedTables.forEach(tName => {
      const t = schema.tables.find(table => table.name === tName);
      if (t) {
        t.columns.forEach(c => cols.push({ table: tName, column: c.name }));
      }
    });
    return cols;
  };

  const toggleTableCollapse = (tableName: string) => {
    const newSet = new Set(collapsedTables);
    if (newSet.has(tableName)) {
      newSet.delete(tableName);
    } else {
      newSet.add(tableName);
    }
    setCollapsedTables(newSet);
  };

  // --- Advanced Search Logic ---
  const matchColumnName = (colName: string, searchInput: string): boolean => {
    if (!searchInput.trim()) return true;
    const orGroups = searchInput.split(/\s+OR\s+/i);
    return orGroups.some(group => {
      const andTerms = group.trim().split(/\s+/);
      return andTerms.every(term => {
        const escaped = term.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        const regexPattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
        try {
          const regex = new RegExp(regexPattern, 'i');
          return regex.test(colName);
        } catch (e) {
          return colName.toLowerCase().includes(term.toLowerCase());
        }
      });
    });
  };

  // --- Table Selection Logic ---
  const toggleTable = (tableName: string) => {
    const isSelected = state.selectedTables.includes(tableName);
    let newTables = [];
    if (isSelected) {
      newTables = state.selectedTables.filter(t => t !== tableName);
      const newColumns = state.selectedColumns.filter(c => !c.startsWith(`${tableName}.`));
      const newJoins = state.joins.filter(j => j.fromTable !== tableName && j.toTable !== tableName);
      const newFilters = state.filters.filter(f => !f.column.startsWith(`${tableName}.`));
      updateStateWithHistory({ ...state, selectedTables: newTables, selectedColumns: newColumns, joins: newJoins, filters: newFilters });
      const newSearchTerms = { ...columnSearchTerms };
      delete newSearchTerms[tableName];
      setColumnSearchTerms(newSearchTerms);
    } else {
      newTables = [...state.selectedTables, tableName];
      updateStateWithHistory({ ...state, selectedTables: newTables });
    }
  };

  const clearAllTables = () => {
     updateStateWithHistory({ ...state, selectedTables: [], selectedColumns: [], joins: [], filters: [] });
  };

  // --- Column Selection Logic ---
  const toggleColumn = (tableName: string, colName: string) => {
    const fullId = `${tableName}.${colName}`;
    const isSelected = state.selectedColumns.includes(fullId);
    let newColumns = [];
    if (isSelected) newColumns = state.selectedColumns.filter(c => c !== fullId);
    else newColumns = [...state.selectedColumns, fullId];
    
    let newTables = state.selectedTables;
    if (!state.selectedTables.includes(tableName)) newTables = [...state.selectedTables, tableName];

    updateStateWithHistory({ ...state, selectedTables: newTables, selectedColumns: newColumns });
  };

  const selectAllColumns = (tableName: string, visibleColumns: string[]) => {
    const newColsSet = new Set(state.selectedColumns);
    visibleColumns.forEach(colName => newColsSet.add(`${tableName}.${colName}`));
    const newCols = Array.from(newColsSet);
    let newTables = state.selectedTables;
    if (!state.selectedTables.includes(tableName)) newTables = [...state.selectedTables, tableName];
    updateStateWithHistory({ ...state, selectedTables: newTables, selectedColumns: newCols });
  };

  const selectNoneColumns = (tableName: string, visibleColumns: string[]) => {
    const visibleSet = new Set(visibleColumns.map(c => `${tableName}.${c}`));
    const newCols = state.selectedColumns.filter(c => !visibleSet.has(c));
    updateStateWithHistory({ ...state, selectedColumns: newCols });
  };

  // --- Joins/Filters/Sort Wrappers ---
  const addJoin = () => {
    const newJoin: ExplicitJoin = {
      id: crypto.randomUUID(),
      fromTable: state.selectedTables[0] || '',
      fromColumn: '',
      type: 'INNER',
      toTable: state.selectedTables[1] || '',
      toColumn: ''
    };
    updateStateWithHistory({ ...state, joins: [...state.joins, newJoin] });
  };

  const updateJoin = (id: string, field: keyof ExplicitJoin, value: string) => {
    const newJoins = state.joins.map(j => j.id === id ? { ...j, [field]: value } : j);
    updateStateWithHistory({ ...state, joins: newJoins });
  };

  const removeJoin = (id: string) => {
    updateStateWithHistory({ ...state, joins: state.joins.filter(j => j.id !== id) });
  };

  const addFilter = () => {
    const newFilter: Filter = {
      id: crypto.randomUUID(),
      column: state.selectedColumns[0] || (state.selectedTables[0] ? `${state.selectedTables[0]}.id` : ''),
      operator: '=',
      value: ''
    };
    updateStateWithHistory({ ...state, filters: [...state.filters, newFilter] });
  };

  const updateFilter = (id: string, field: keyof Filter, value: string) => {
    const newFilters = state.filters.map(f => f.id === id ? { ...f, [field]: value } : f);
    updateStateWithHistory({ ...state, filters: newFilters });
  };

  const removeFilter = (id: string) => {
    updateStateWithHistory({ ...state, filters: state.filters.filter(f => f.id !== id) });
  };

  const toggleGroupBy = (col: string) => {
    const exists = state.groupBy.includes(col);
    const newGroup = exists ? state.groupBy.filter(g => g !== col) : [...state.groupBy, col];
    updateStateWithHistory({ ...state, groupBy: newGroup });
  };

  const addSort = () => {
    const newSort: OrderBy = {
      id: crypto.randomUUID(),
      column: state.selectedColumns[0] || '',
      direction: 'ASC'
    };
    updateStateWithHistory({ ...state, orderBy: [...state.orderBy, newSort] });
  };

  const updateSort = (id: string, field: keyof OrderBy, value: string) => {
    const newSorts = state.orderBy.map(s => s.id === id ? { ...s, [field]: value } : s);
    updateStateWithHistory({ ...state, orderBy: newSorts });
  };

  const removeSort = (id: string) => {
    updateStateWithHistory({ ...state, orderBy: state.orderBy.filter(s => s.id !== id) });
  };


  // --- Render Helpers ---
  
  const { pinnedTables, unpinnedTables } = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    let allMatches = schema.tables;
    if (term) {
       allMatches = schema.tables.filter(table => 
        table.name.toLowerCase().includes(term) || 
        (table.description && table.description.toLowerCase().includes(term))
      );
    }
    const pinned: typeof schema.tables = [];
    const unpinned: typeof schema.tables = [];
    allMatches.forEach(table => {
      if (state.selectedTables.includes(table.name)) pinned.push(table);
      else unpinned.push(table);
    });
    const sorter = (a: typeof schema.tables[0], b: typeof schema.tables[0]) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      if (term) {
        if (nameA === term && nameB !== term) return -1;
        if (nameB === term && nameA !== term) return 1;
        const startsA = nameA.startsWith(term);
        const startsB = nameB.startsWith(term);
        if (startsA && !startsB) return -1;
        if (!startsA && startsB) return 1;
      }
      return nameA.localeCompare(nameB);
    };
    return {
      pinnedTables: pinned.sort(sorter),
      unpinnedTables: unpinned.sort(sorter)
    };
  }, [schema.tables, searchTerm, state.selectedTables]);

  const renderTabButton = (id: TabType, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        activeTab === id 
          ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 dark:text-indigo-300' 
          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const renderTableListItem = (table: typeof schema.tables[0], isPinned: boolean) => (
    <div 
      key={table.name}
      onClick={() => toggleTable(table.name)}
      className={`p-2.5 rounded-lg cursor-pointer transition-all border relative group flex items-start justify-between gap-2 ${
        isPinned
          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400 shadow-sm' 
          : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
      }`}
    >
      <div className="min-w-0">
        <span className={`font-bold text-sm block truncate ${isPinned ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
            {table.name}
        </span>
        {table.description && (
          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
            {table.description}
          </p>
        )}
      </div>
      
      {isPinned ? (
        <button 
          onClick={(e) => { e.stopPropagation(); toggleTable(table.name); }}
          className="mt-0.5 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-700 rounded-full p-0.5 shadow-sm hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          title="Unselect Table"
        >
          <X className="w-3 h-3" strokeWidth={3} />
        </button>
      ) : (
        <div className="mt-0.5 opacity-0 group-hover:opacity-50 text-slate-400">
           <Plus className="w-3 h-3" />
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col relative">
      <div className="flex justify-between items-end mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            Query Builder (Construtor)
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Conectado a: <span className="font-mono text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded text-xs">{schema.name}</span>
          </p>
        </div>

        {/* Toolbar: Undo/Redo + Save/Load */}
        <div className="flex items-center gap-3">
          
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
             <button 
               onClick={handleSaveQuery} 
               disabled={state.selectedTables.length === 0}
               className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-all disabled:opacity-30"
               title="Salvar Consulta"
             >
               <Save className="w-4 h-4" />
             </button>
             <button 
               onClick={() => setShowSavedQueries(true)} 
               className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-all"
               title="Carregar Consulta Salva"
             >
               <FolderOpen className="w-4 h-4" />
             </button>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
             <button 
               onClick={handleUndo} 
               disabled={history.length === 0}
               className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-all disabled:opacity-30 disabled:hover:bg-transparent"
               title="Desfazer (Undo)"
             >
               <Undo2 className="w-4 h-4" />
             </button>
             <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
             <button 
               onClick={handleRedo} 
               disabled={future.length === 0}
               className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-all disabled:opacity-30 disabled:hover:bg-transparent"
               title="Refazer (Redo)"
             >
               <Redo2 className="w-4 h-4" />
             </button>
          </div>
        </div>
      </div>

      {/* SAVED QUERIES MODAL/OVERLAY */}
      {showSavedQueries && (
        <div className="absolute inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/50 backdrop-blur-sm rounded-xl">
           <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[70vh]">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                 <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-indigo-500" />
                    Consultas Salvas ({relevantSavedQueries.length})
                 </h3>
                 <button onClick={() => setShowSavedQueries(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                 </button>
              </div>
              <div className="overflow-y-auto p-2 space-y-2 flex-1">
                 {relevantSavedQueries.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                       Nenhuma consulta salva para o banco <strong>{schema.name}</strong>.
                    </div>
                 ) : (
                    relevantSavedQueries.map(q => (
                       <div key={q.id} onClick={() => handleLoadQuery(q)} className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-400 cursor-pointer group transition-all">
                          <div className="flex justify-between items-start">
                             <div>
                                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">{q.name}</h4>
                                <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                                   <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(q.createdAt).toLocaleDateString()}</span>
                                   <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(q.createdAt).toLocaleTimeString()}</span>
                                </div>
                             </div>
                             <button onClick={(e) => handleDeleteQuery(q.id, e)} className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                          <div className="mt-2 text-[10px] text-slate-500 flex gap-2">
                             <span className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">{q.state.selectedTables.length} tabelas</span>
                             <span className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">{q.state.filters.length} filtros</span>
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Main Layout: Sidebar + Content */}
      <div className="flex-1 flex gap-6 min-h-0">
        
        {/* Left: Table Selection Sidebar */}
        <div className="w-1/4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden shadow-sm">
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 text-sm flex justify-between items-center">
            <span>Tabelas ({schema.tables.length})</span>
            {state.selectedTables.length > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                {state.selectedTables.length} Selecionadas
              </span>
            )}
          </div>
          
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar tabelas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-300"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
             {pinnedTables.length === 0 && unpinnedTables.length === 0 && (
                <div className="text-center py-4 text-xs text-slate-400 italic">Nenhuma tabela encontrada</div>
             )}

             {/* Pinned / Selected Section */}
             {pinnedTables.length > 0 && (
               <>
                 <div className="px-2 py-1 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase flex items-center gap-1">
                    <Pin className="w-3 h-3" /> Selecionadas
                 </div>
                 {pinnedTables.map(t => renderTableListItem(t, true))}
                 <div className="my-2 border-b border-slate-100 dark:border-slate-700"></div>
               </>
             )}

             {/* Unpinned Section */}
             {unpinnedTables.length > 0 && (
               <>
                 {pinnedTables.length > 0 && (
                   <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase">
                      Disponíveis
                   </div>
                 )}
                 {unpinnedTables.map(t => renderTableListItem(t, false))}
               </>
             )}
          </div>
        </div>

        {/* Right: Tabbed Builder Area */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden shadow-sm">
           
           {/* Tabs Header */}
           <div className="flex border-b border-slate-100 dark:border-slate-700">
             {renderTabButton('columns', 'Colunas', <List className="w-4 h-4" />)}
             {renderTabButton('joins', `Joins (${state.joins.length})`, <Link2 className="w-4 h-4" />)}
             {renderTabButton('filters', `Filtros (${state.filters.length})`, <FilterIcon className="w-4 h-4" />)}
             {renderTabButton('sortgroup', 'Ordenar/Agrupar', <ArrowDownAZ className="w-4 h-4" />)}
           </div>

           {/* Tabs Content */}
           <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 dark:bg-slate-900/50">
             
             {/* --- COLUMNS TAB --- */}
             {activeTab === 'columns' && (
               <div className="space-y-4">
                 {state.selectedTables.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                     <Layers className="w-12 h-12 mb-2 opacity-20" />
                     <p className="text-sm">Selecione tabelas na barra lateral para ver colunas</p>
                   </div>
                 ) : (
                   state.selectedTables.map(tableName => {
                     const table = schema.tables.find(t => t.name === tableName);
                     if (!table) return null;
                     
                     const colSearch = columnSearchTerms[tableName] || '';
                     const filteredColumns = table.columns.filter(col => matchColumnName(col.name, colSearch));
                     const visibleColNames = filteredColumns.map(c => c.name);
                     const isCollapsed = collapsedTables.has(tableName);
                     
                     return (
                       <div key={tableName} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                         {/* Card Header */}
                         <div 
                           className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                           onClick={() => toggleTableCollapse(tableName)}
                         >
                           <div className="flex items-center gap-2">
                              {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                              <h4 className="font-bold text-slate-700 dark:text-slate-300">{tableName}</h4>
                              <span className="text-xs text-slate-400 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full">
                                {state.selectedColumns.filter(c => c.startsWith(tableName)).length} selecionadas
                              </span>
                           </div>
                           <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                              <button onClick={() => selectAllColumns(tableName, visibleColNames)} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-1 rounded transition-colors">Todas</button>
                              <button onClick={() => selectNoneColumns(tableName, visibleColNames)} className="text-xs font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded transition-colors">Nenhuma</button>
                           </div>
                         </div>

                         {!isCollapsed && (
                           <>
                             {/* Column Search Bar */}
                             <div className="px-3 py-2 border-b border-slate-50 dark:border-slate-700 bg-white dark:bg-slate-800">
                                <div className="relative">
                                   <Search className="absolute left-2.5 top-1.5 w-3.5 h-3.5 text-slate-300" />
                                   <input 
                                      type="text" 
                                      value={colSearch}
                                      onChange={(e) => setColumnSearchTerms(prev => ({...prev, [tableName]: e.target.value}))}
                                      placeholder={`Filtrar colunas em ${tableName}... (suporta *, ?, OR)`}
                                      className="w-full pl-8 pr-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-400 text-slate-700 dark:text-slate-300"
                                   />
                                   {colSearch && (
                                      <button 
                                        onClick={() => setColumnSearchTerms(prev => ({...prev, [tableName]: ''}))}
                                        className="absolute right-2 top-1.5 text-slate-300 hover:text-slate-500"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                   )}
                                </div>
                             </div>

                             {/* Columns Grid */}
                             <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                               {filteredColumns.length === 0 ? (
                                  <div className="col-span-full text-center py-4 text-xs text-slate-400 italic">
                                     Nenhuma coluna encontrada para "{colSearch}"
                                  </div>
                               ) : (
                                  filteredColumns.map(col => {
                                    const isChecked = state.selectedColumns.includes(`${tableName}.${col.name}`);
                                    return (
                                      <div 
                                        key={col.name}
                                        onClick={() => toggleColumn(tableName, col.name)}
                                        className={`flex items-center p-2 rounded border cursor-pointer transition-all duration-200 ease-in-out ${
                                          isChecked 
                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500 shadow-sm scale-[1.01]' 
                                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 hover:scale-[1.01]'
                                        }`}
                                      >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center mr-2 transition-all ${
                                            isChecked ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                                          }`}>
                                           {isChecked && <div className="w-1.5 h-1.5 bg-white rounded-[1px]"></div>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                           <div className={`text-sm font-medium truncate transition-colors ${isChecked ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{col.name}</div>
                                           <div className="text-[10px] text-slate-400">{col.type}</div>
                                        </div>
                                      </div>
                                    );
                                  })
                               )}
                             </div>
                           </>
                         )}
                       </div>
                     );
                   })
                 )}
               </div>
             )}

             {/* --- JOINS TAB --- */}
             {activeTab === 'joins' && (
               <div className="max-w-3xl mx-auto">
                 <div className="mb-4 flex justify-between items-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Defina como suas tabelas se relacionam.</p>
                    <button onClick={addJoin} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 transition-colors shadow-sm">
                       <Plus className="w-3.5 h-3.5" /> Adicionar Join
                    </button>
                 </div>
                 
                 {state.joins.length === 0 ? (
                   <div className="bg-white dark:bg-slate-800 p-8 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-center">
                      <p className="text-slate-400 text-sm mb-2">Nenhum JOIN explícito definido.</p>
                      <p className="text-xs text-slate-400">Se deixar vazio, tentaremos detectar automaticamente via Foreign Keys.</p>
                   </div>
                 ) : (
                   <div className="space-y-3">
                     {state.joins.map((join) => (
                       <div key={join.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center gap-3">
                          <select 
                             value={join.fromTable}
                             onChange={(e) => updateJoin(join.id, 'fromTable', e.target.value)}
                             className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                          >
                             <option value="" disabled>Tabela A</option>
                             {state.selectedTables.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <select 
                             value={join.fromColumn}
                             onChange={(e) => updateJoin(join.id, 'fromColumn', e.target.value)}
                             className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none min-w-[100px]"
                          >
                             <option value="" disabled>Coluna A</option>
                             {getColumnsForTable(join.fromTable).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                          </select>
                          <div className="flex items-center gap-2">
                             <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                             <select 
                                value={join.type}
                                onChange={(e) => updateJoin(join.id, 'type', e.target.value as any)}
                                className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 border-none bg-transparent outline-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 rounded px-1"
                             >
                                <option value="INNER">INNER JOIN</option>
                                <option value="LEFT">LEFT JOIN</option>
                                <option value="RIGHT">RIGHT JOIN</option>
                                <option value="FULL">FULL JOIN</option>
                             </select>
                             <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                          </div>
                          <select 
                             value={join.toTable}
                             onChange={(e) => updateJoin(join.id, 'toTable', e.target.value)}
                             className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                          >
                             <option value="" disabled>Tabela B</option>
                             {state.selectedTables.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <select 
                             value={join.toColumn}
                             onChange={(e) => updateJoin(join.id, 'toColumn', e.target.value)}
                             className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none min-w-[100px]"
                          >
                             <option value="" disabled>Coluna B</option>
                             {getColumnsForTable(join.toTable).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                          </select>
                          <button onClick={() => removeJoin(join.id)} className="ml-auto text-slate-400 hover:text-red-500">
                             <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             )}

             {/* --- FILTERS TAB --- */}
             {activeTab === 'filters' && (
               <div className="max-w-3xl mx-auto">
                 <div className="mb-4 flex justify-between items-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Adicione condições para filtrar seus resultados (WHERE).</p>
                    <button onClick={addFilter} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 transition-colors shadow-sm">
                       <Plus className="w-3.5 h-3.5" /> Adicionar Filtro
                    </button>
                 </div>
                 {state.filters.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-center">
                       <p className="text-slate-400 text-sm">Nenhum filtro aplicado.</p>
                    </div>
                 ) : (
                    <div className="space-y-3">
                       {state.filters.map(filter => (
                          <div key={filter.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center gap-3">
                             <div className="text-xs font-bold text-slate-400 uppercase">WHERE</div>
                             <select
                                value={filter.column}
                                onChange={(e) => updateFilter(filter.id, 'column', e.target.value)}
                                className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none max-w-[200px]"
                             >
                                <option value="" disabled>Selecione a Coluna</option>
                                {getAllSelectedTableColumns().map(c => (
                                   <option key={`${c.table}.${c.column}`} value={`${c.table}.${c.column}`}>
                                      {c.table}.{c.column}
                                   </option>
                                ))}
                             </select>
                             <select
                                value={filter.operator}
                                onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}
                                className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
                             >
                                <option value="=">=</option>
                                <option value="!=">!=</option>
                                <option value=">">&gt;</option>
                                <option value="<">&lt;</option>
                                <option value=">=">&gt;=</option>
                                <option value="<=">&lt;=</option>
                                <option value="LIKE">LIKE</option>
                                <option value="ILIKE">ILIKE</option>
                                <option value="IN">IN</option>
                                <option value="IS NULL">IS NULL</option>
                                <option value="IS NOT NULL">IS NOT NULL</option>
                             </select>
                             {!['IS NULL', 'IS NOT NULL'].includes(filter.operator) && (
                                <input
                                   type="text"
                                   value={filter.value}
                                   onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                                   placeholder="Valor..."
                                   className="flex-1 min-w-[120px] text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                             )}
                             <button onClick={() => removeFilter(filter.id)} className="ml-auto text-slate-400 hover:text-red-500">
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                       ))}
                    </div>
                 )}
               </div>
             )}

             {/* --- SORT & GROUP TAB --- */}
             {activeTab === 'sortgroup' && (
               <div className="max-w-3xl mx-auto space-y-8">
                 <div>
                    <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                       <List className="w-4 h-4 text-indigo-600" /> Agrupar Por (Group By)
                    </h3>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                       <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Selecione colunas para agrupar (útil para agregações).</p>
                       <div className="flex flex-wrap gap-2">
                          {getAllSelectedTableColumns().map(col => {
                             const fullId = `${col.table}.${col.column}`;
                             const isGrouped = state.groupBy.includes(fullId);
                             return (
                                <button
                                   key={fullId}
                                   onClick={() => toggleGroupBy(fullId)}
                                   className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                                      isGrouped 
                                       ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800' 
                                       : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 hover:border-indigo-300'
                                   }`}
                                >
                                   {fullId}
                                </button>
                             )
                          })}
                       </div>
                    </div>
                 </div>

                 <div>
                    <div className="mb-2 flex justify-between items-center">
                       <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <ArrowDownAZ className="w-4 h-4 text-indigo-600" /> Ordenar Por (Order By)
                       </h3>
                       <button onClick={addSort} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Adicionar Regra
                       </button>
                    </div>
                    {state.orderBy.length === 0 ? (
                       <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-center">
                          <p className="text-xs text-slate-400">Nenhuma regra de ordenação.</p>
                       </div>
                    ) : (
                       <div className="space-y-2">
                          {state.orderBy.map(sort => (
                             <div key={sort.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
                                <select
                                   value={sort.column}
                                   onChange={(e) => updateSort(sort.id, 'column', e.target.value)}
                                   className="flex-1 text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                                >
                                   <option value="" disabled>Selecione a Coluna</option>
                                   {getAllSelectedTableColumns().map(c => (
                                      <option key={`${c.table}.${c.column}`} value={`${c.table}.${c.column}`}>
                                         {c.table}.{c.column}
                                      </option>
                                   ))}
                                </select>
                                <div className="flex bg-slate-100 dark:bg-slate-700 rounded p-1">
                                   <button 
                                      onClick={() => updateSort(sort.id, 'direction', 'ASC')}
                                      className={`px-2 py-0.5 text-xs rounded ${sort.direction === 'ASC' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}
                                   >ASC</button>
                                   <button 
                                      onClick={() => updateSort(sort.id, 'direction', 'DESC')}
                                      className={`px-2 py-0.5 text-xs rounded ${sort.direction === 'DESC' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}
                                   >DESC</button>
                                </div>
                                <button onClick={() => removeSort(sort.id)} className="text-slate-400 hover:text-red-500">
                                   <Trash2 className="w-4 h-4" />
                                </button>
                             </div>
                          ))}
                       </div>
                    )}
                 </div>
               </div>
             )}
           </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-6 bg-slate-800 text-white p-4 rounded-xl flex items-center justify-between shadow-lg">
         <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-2">
                 Tabelas Selecionadas
                 {state.selectedTables.length > 0 && (
                   <button onClick={clearAllTables} className="text-slate-500 hover:text-red-400 transition-colors" title="Limpar tudo">
                      <Trash2 className="w-3 h-3" />
                   </button>
                 )}
              </span>
              <span className="font-mono text-xl font-bold">{state.selectedTables.length}</span>
            </div>
            <div className="w-px h-8 bg-slate-700"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Colunas Selecionadas</span>
              <span className="font-mono text-xl font-bold">{state.selectedColumns.length === 0 ? (state.selectedTables.length > 0 ? 'TODAS (*)' : '0') : state.selectedColumns.length}</span>
            </div>
         </div>

         <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded border border-slate-700">
               <Settings2 className="w-4 h-4 text-slate-400" />
               <span className="text-xs text-slate-400">Limite:</span>
               <input 
                 type="number" 
                 value={state.limit}
                 onChange={(e) => updateStateWithHistory({...state, limit: parseInt(e.target.value) || 10})}
                 className="w-16 bg-transparent text-right font-mono text-sm outline-none focus:text-indigo-400 text-white"
               />
            </div>

            <button
              onClick={onGenerate}
              disabled={state.selectedTables.length === 0 || isGenerating}
              className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-indigo-900/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Construindo...
                </>
              ) : (
                <>
                  Visualizar & Executar
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
         </div>
      </div>
    </div>
  );
};

export default BuilderStep;