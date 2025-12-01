
import React, { useState, useMemo, useEffect, useCallback, useDeferredValue, memo, useRef } from 'react';
import { DatabaseSchema, BuilderState, ExplicitJoin, JoinType, Filter, Operator, OrderBy, AppSettings, SavedQuery, AggregateFunction, Column } from '../../types';
import { Layers, ChevronRight, Settings2, RefreshCw, Search, X, CheckSquare, Square, Plus, Trash2, ArrowRightLeft, Filter as FilterIcon, ArrowDownAZ, List, Link2, Check, ChevronDown, Pin, XCircle, Undo2, Redo2, Save, FolderOpen, Calendar, Clock, Sigma, Key, Combine, ArrowRight, ArrowLeft } from 'lucide-react';

interface BuilderStepProps {
  schema: DatabaseSchema;
  state: BuilderState;
  onStateChange: (state: BuilderState) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  settings: AppSettings;
}

type TabType = 'columns' | 'joins' | 'filters' | 'sortgroup';

// --- Sub-components Memoized for Performance ---

interface ColumnItemProps {
  col: Column;
  tableName: string;
  isSelected: boolean;
  aggregation: AggregateFunction;
  onToggle: (tableName: string, colName: string) => void;
  onAggregationChange: (tableName: string, colName: string, func: AggregateFunction) => void;
}

// Memoized Column Item
// Using strict equality for function props is now safe because we will ensure handlers are stable via refs
const ColumnItem = memo(({ col, tableName, isSelected, aggregation, onToggle, onAggregationChange }: ColumnItemProps) => {
  return (
    <div 
      onClick={() => onToggle(tableName, col.name)}
      className={`flex items-center p-2 rounded border cursor-pointer transition-all duration-200 ease-in-out relative group ${
        isSelected 
          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500 shadow-sm z-10' 
          : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 hover:scale-[1.01]'
      }`}
    >
      <div className={`w-4 h-4 rounded border flex items-center justify-center mr-2 transition-all shrink-0 ${
          isSelected ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
        }`}>
         {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-[1px]"></div>}
      </div>
      <div className="flex-1 min-w-0 pr-8">
         <div className={`text-sm font-medium truncate transition-colors ${isSelected ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{col.name}</div>
         <div className="text-[10px] text-slate-400">{col.type}</div>
      </div>

      {/* Aggregation Selector (Visible when checked) */}
      {isSelected && (
         <div 
           className="absolute right-1 top-1/2 -translate-y-1/2"
           onClick={e => e.stopPropagation()}
         >
            <select
               value={aggregation}
               onChange={(e) => onAggregationChange(tableName, col.name, e.target.value as AggregateFunction)}
               className={`text-[10px] font-bold uppercase rounded px-1 py-0.5 outline-none border cursor-pointer transition-colors ${
                  aggregation !== 'NONE' 
                    ? 'bg-indigo-600 text-white border-indigo-600' 
                    : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300'
               }`}
            >
               <option value="NONE">--</option>
               <option value="COUNT">CNT</option>
               <option value="SUM">SUM</option>
               <option value="AVG">AVG</option>
               <option value="MIN">MIN</option>
               <option value="MAX">MAX</option>
            </select>
         </div>
      )}
    </div>
  );
}, (prev, next) => {
  return prev.isSelected === next.isSelected && 
         prev.aggregation === next.aggregation && 
         prev.col.name === next.col.name &&
         prev.tableName === next.tableName;
});

interface TableCardProps {
  table: { name: string, columns: Column[] };
  selectedColumns: string[];
  aggregations: Record<string, AggregateFunction>;
  isCollapsed: boolean;
  colSearchTerm: string;
  onToggleCollapse: (tableName: string) => void;
  onToggleColumn: (tableName: string, colName: string) => void;
  onAggregationChange: (tableName: string, colName: string, func: AggregateFunction) => void;
  onSelectAll: (tableName: string, visibleColumns: string[]) => void;
  onSelectNone: (tableName: string, visibleColumns: string[]) => void;
  onSearchChange: (tableName: string, term: string) => void;
  onClearSearch: (tableName: string) => void;
}

const TableCard = memo(({ 
  table, selectedColumns, aggregations, isCollapsed, colSearchTerm,
  onToggleCollapse, onToggleColumn, onAggregationChange, onSelectAll, onSelectNone, onSearchChange, onClearSearch
}: TableCardProps) => {

  // Advanced Search Logic moved inside TableCard and memoized
  const filteredColumns = useMemo(() => {
    if (!colSearchTerm.trim()) return table.columns;
    
    const term = colSearchTerm;
    const orGroups = term.split(/\s+OR\s+/i);
    
    return table.columns.filter(col => {
       return orGroups.some(group => {
        const andTerms = group.trim().split(/\s+/);
        return andTerms.every(t => {
          try {
             // Simple contains check is much faster than Regex for typing
             return col.name.toLowerCase().includes(t.toLowerCase());
          } catch (e) {
             return false;
          }
        });
      });
    });
  }, [table.columns, colSearchTerm]);

  const visibleColNames = useMemo(() => filteredColumns.map(c => c.name), [filteredColumns]);
  const selectedCount = selectedColumns.filter(c => c.startsWith(`${table.name}.`)).length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
       {/* Card Header */}
       <div 
         className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
         onClick={() => onToggleCollapse(table.name)}
       >
         <div className="flex items-center gap-2">
            {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            <h4 className="font-bold text-slate-700 dark:text-slate-300">{table.name}</h4>
            <span className="text-xs text-slate-400 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full">
              {selectedCount} selecionadas
            </span>
         </div>
         <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => onSelectAll(table.name, visibleColNames)} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-1 rounded transition-colors">Todas</button>
            <button onClick={() => onSelectNone(table.name, visibleColNames)} className="text-xs font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded transition-colors">Nenhuma</button>
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
                    value={colSearchTerm}
                    onChange={(e) => onSearchChange(table.name, e.target.value)}
                    placeholder={`Filtrar colunas em ${table.name}...`}
                    className="w-full pl-8 pr-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-400 text-slate-700 dark:text-slate-300"
                 />
                 {colSearchTerm && (
                    <button 
                      onClick={() => onClearSearch(table.name)}
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
                   Nenhuma coluna encontrada para "{colSearchTerm}"
                </div>
             ) : (
                filteredColumns.map(col => {
                  const colFullId = `${table.name}.${col.name}`;
                  const isChecked = selectedColumns.includes(colFullId);
                  const agg = aggregations[colFullId] || 'NONE';
                  
                  return (
                    <ColumnItem 
                      key={col.name}
                      col={col}
                      tableName={table.name}
                      isSelected={isChecked}
                      aggregation={agg}
                      onToggle={onToggleColumn}
                      onAggregationChange={onAggregationChange}
                    />
                  );
                })
             )}
           </div>
         </>
       )}
    </div>
  );
}, (prev, next) => {
   // Optimization: Only re-render if something RELEVANT changed for this table
   return prev.isCollapsed === next.isCollapsed &&
          prev.colSearchTerm === next.colSearchTerm &&
          prev.table.name === next.table.name &&
          // Shallow compare specific props that might change
          prev.selectedColumns === next.selectedColumns &&
          prev.aggregations === next.aggregations;
});


// --- Main Component ---

const BuilderStep: React.FC<BuilderStepProps> = ({ schema, state, onStateChange, onGenerate, isGenerating, settings }) => {
  const [activeTab, setActiveTab] = useState<TabType>('columns');
  
  // Search state for tables
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm); // DEFERRED: Avoid blocking UI on type
  
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

  // --- STABLE STATE REF PATTERN ---
  // To avoid re-rendering all memoized components when state changes, we use a ref to access the latest state
  // inside event handlers without changing the handler reference itself.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

  // --- History Management Wrappers (Stable) ---
  
  const updateStateWithHistory = useCallback((newState: BuilderState) => {
    const currentState = stateRef.current;
    // Deep copy for history safety
    const currentStateCopy = JSON.parse(JSON.stringify(currentState));
    setHistory(prev => [...prev, currentStateCopy]);
    setFuture([]);
    onStateChange(newState);
  }, [onStateChange]);

  const handleUndo = useCallback(() => {
    // Undo depends on history, which is local, so this recreates when history changes.
    // That's fine as it's not passed to heavy table components.
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    const currentState = stateRef.current;
    
    setFuture(prev => [currentState, ...prev]);
    setHistory(newHistory);
    onStateChange(previousState);
  }, [history, onStateChange]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const nextState = future[0];
    const newFuture = future.slice(1);
    const currentState = stateRef.current;

    setHistory(prev => [...prev, currentState]);
    setFuture(newFuture);
    onStateChange(nextState);
  }, [future, onStateChange]);

  // --- Saved Queries Logic ---
  
  const handleSaveQuery = () => {
    const name = window.prompt("Nome da consulta para salvar:", `Consulta ${new Date().toLocaleTimeString()}`);
    if (!name) return;

    const newQuery: SavedQuery = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      schemaName: schema.name,
      state: JSON.parse(JSON.stringify(stateRef.current)) // Deep copy
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
  const relevantSavedQueries = useMemo(() => 
    savedQueries.filter(q => q.schemaName === schema.name), 
  [savedQueries, schema.name]);

  // --- Helpers ---
  const getColumnsForTable = useCallback((tableName: string) => {
    const t = schema.tables.find(table => table.name === tableName);
    return t ? t.columns : [];
  }, [schema.tables]);

  // This one reads from stateRef to be safe if called asynchronously, though usually called in render cycle.
  // Actually used in render, so we should rely on props or make sure ref is current.
  // We'll use stateRef.current to be safe in event handlers, but props in render.
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

  const toggleTableCollapse = useCallback((tableName: string) => {
    setCollapsedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableName)) {
        newSet.delete(tableName);
      } else {
        newSet.add(tableName);
      }
      return newSet;
    });
  }, []);

  // --- Table Selection Logic (STABLE) ---
  const toggleTable = useCallback((tableName: string) => {
    const currentState = stateRef.current;
    const isSelected = currentState.selectedTables.includes(tableName);
    let newTables = [];
    
    if (isSelected) {
      newTables = currentState.selectedTables.filter(t => t !== tableName);
      const newColumns = currentState.selectedColumns.filter(c => !c.startsWith(`${tableName}.`));
      const newJoins = currentState.joins.filter(j => j.fromTable !== tableName && j.toTable !== tableName);
      const newFilters = currentState.filters.filter(f => !f.column.startsWith(`${tableName}.`));
      // Remove aggregations for columns of this table
      const newAggs = { ...currentState.aggregations };
      Object.keys(newAggs).forEach(key => {
        if (key.startsWith(`${tableName}.`)) delete newAggs[key];
      });

      updateStateWithHistory({ 
        ...currentState, 
        selectedTables: newTables, 
        selectedColumns: newColumns, 
        aggregations: newAggs,
        joins: newJoins, 
        filters: newFilters 
      });
      // Clear search terms for removed table
      setColumnSearchTerms(prev => {
         const next = { ...prev };
         delete next[tableName];
         return next;
      });
    } else {
      newTables = [...currentState.selectedTables, tableName];
      updateStateWithHistory({ ...currentState, selectedTables: newTables });
    }
  }, [updateStateWithHistory]);

  const clearAllTables = useCallback(() => {
     updateStateWithHistory({ ...stateRef.current, selectedTables: [], selectedColumns: [], aggregations: {}, joins: [], filters: [] });
  }, [updateStateWithHistory]);

  // --- Column Selection Logic (STABLE) ---
  const toggleColumn = useCallback((tableName: string, colName: string) => {
    const currentState = stateRef.current;
    const fullId = `${tableName}.${colName}`;
    const isSelected = currentState.selectedColumns.includes(fullId);
    let newColumns = [];
    const newAggs = { ...currentState.aggregations };

    if (isSelected) {
       newColumns = currentState.selectedColumns.filter(c => c !== fullId);
       delete newAggs[fullId];
    } else {
       newColumns = [...currentState.selectedColumns, fullId];
    }
    
    let newTables = currentState.selectedTables;
    if (!currentState.selectedTables.includes(tableName)) newTables = [...currentState.selectedTables, tableName];

    updateStateWithHistory({ ...currentState, selectedTables: newTables, selectedColumns: newColumns, aggregations: newAggs });
  }, [updateStateWithHistory]);
  
  const updateAggregation = useCallback((tableName: string, colName: string, func: AggregateFunction) => {
    const currentState = stateRef.current;
    const fullId = `${tableName}.${colName}`;
    const newAggs = { ...currentState.aggregations };
    if (func === 'NONE') {
      delete newAggs[fullId];
    } else {
      newAggs[fullId] = func;
    }
    
    // Ensure column is selected if an aggregation is applied
    let newColumns = currentState.selectedColumns;
    if (!currentState.selectedColumns.includes(fullId)) {
      newColumns = [...currentState.selectedColumns, fullId];
    }
    
    updateStateWithHistory({ ...currentState, selectedColumns: newColumns, aggregations: newAggs });
  }, [updateStateWithHistory]);

  const selectAllColumns = useCallback((tableName: string, visibleColumns: string[]) => {
    const currentState = stateRef.current;
    const newColsSet = new Set(currentState.selectedColumns);
    visibleColumns.forEach(colName => newColsSet.add(`${tableName}.${colName}`));
    const newCols = Array.from(newColsSet);
    let newTables = currentState.selectedTables;
    if (!currentState.selectedTables.includes(tableName)) newTables = [...currentState.selectedTables, tableName];
    updateStateWithHistory({ ...currentState, selectedTables: newTables, selectedColumns: newCols });
  }, [updateStateWithHistory]);

  const selectNoneColumns = useCallback((tableName: string, visibleColumns: string[]) => {
    const currentState = stateRef.current;
    const visibleSet = new Set(visibleColumns.map(c => `${tableName}.${c}`));
    const newCols = currentState.selectedColumns.filter(c => !visibleSet.has(c));
    // Clear aggs for these columns
    const newAggs = { ...currentState.aggregations };
    visibleSet.forEach(key => delete newAggs[key]);

    updateStateWithHistory({ ...currentState, selectedColumns: newCols, aggregations: newAggs });
  }, [updateStateWithHistory]);

  // --- Search Handlers (Stable) ---
  const handleColumnSearchChange = useCallback((tableName: string, term: string) => {
    setColumnSearchTerms(prev => ({...prev, [tableName]: term}));
  }, []);

  const handleClearColumnSearch = useCallback((tableName: string) => {
    setColumnSearchTerms(prev => ({...prev, [tableName]: ''}));
  }, []);

  // --- Joins/Filters/Sort Wrappers (STABLE) ---
  const addJoin = useCallback(() => {
    const currentState = stateRef.current;
    const newJoin: ExplicitJoin = {
      id: crypto.randomUUID(),
      fromTable: currentState.selectedTables[0] || '',
      fromColumn: '',
      type: 'INNER',
      toTable: currentState.selectedTables[1] || '',
      toColumn: ''
    };
    updateStateWithHistory({ ...currentState, joins: [...currentState.joins, newJoin] });
  }, [updateStateWithHistory]);

  const updateJoin = useCallback((id: string, field: keyof ExplicitJoin, value: string) => {
    const currentState = stateRef.current;
    const newJoins = currentState.joins.map(j => j.id === id ? { ...j, [field]: value } : j);
    updateStateWithHistory({ ...currentState, joins: newJoins });
  }, [updateStateWithHistory]);

  const removeJoin = useCallback((id: string) => {
    const currentState = stateRef.current;
    updateStateWithHistory({ ...currentState, joins: currentState.joins.filter(j => j.id !== id) });
  }, [updateStateWithHistory]);

  const addFilter = useCallback(() => {
    const currentState = stateRef.current;
    const newFilter: Filter = {
      id: crypto.randomUUID(),
      column: currentState.selectedColumns[0] || (currentState.selectedTables[0] ? `${currentState.selectedTables[0]}.id` : ''),
      operator: '=',
      value: ''
    };
    updateStateWithHistory({ ...currentState, filters: [...currentState.filters, newFilter] });
  }, [updateStateWithHistory]);

  const updateFilter = useCallback((id: string, field: keyof Filter, value: string) => {
    const currentState = stateRef.current;
    const newFilters = currentState.filters.map(f => f.id === id ? { ...f, [field]: value } : f);
    updateStateWithHistory({ ...currentState, filters: newFilters });
  }, [updateStateWithHistory]);

  const removeFilter = useCallback((id: string) => {
    const currentState = stateRef.current;
    updateStateWithHistory({ ...currentState, filters: currentState.filters.filter(f => f.id !== id) });
  }, [updateStateWithHistory]);

  const toggleGroupBy = useCallback((col: string) => {
    const currentState = stateRef.current;
    const exists = currentState.groupBy.includes(col);
    const newGroup = exists ? currentState.groupBy.filter(g => g !== col) : [...currentState.groupBy, col];
    updateStateWithHistory({ ...currentState, groupBy: newGroup });
  }, [updateStateWithHistory]);

  const addSort = useCallback(() => {
    const currentState = stateRef.current;
    const newSort: OrderBy = {
      id: crypto.randomUUID(),
      column: currentState.selectedColumns[0] || '',
      direction: 'ASC'
    };
    updateStateWithHistory({ ...currentState, orderBy: [...currentState.orderBy, newSort] });
  }, [updateStateWithHistory]);

  const updateSort = useCallback((id: string, field: keyof OrderBy, value: string) => {
    const currentState = stateRef.current;
    const newSorts = currentState.orderBy.map(s => s.id === id ? { ...s, [field]: value } : s);
    updateStateWithHistory({ ...currentState, orderBy: newSorts });
  }, [updateStateWithHistory]);

  const removeSort = useCallback((id: string) => {
    const currentState = stateRef.current;
    updateStateWithHistory({ ...currentState, orderBy: currentState.orderBy.filter(s => s.id !== id) });
  }, [updateStateWithHistory]);


  // --- Render Helpers ---
  
  const { pinnedTables, unpinnedTables } = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase().trim(); // Use Deferred Term
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
  }, [schema.tables, deferredSearchTerm, state.selectedTables]);

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

  // Helper component for enhanced column selection in Joins
  const renderColumnSelect = (tableName: string, value: string, onChange: (val: string) => void, placeholder: string) => {
    const cols = getColumnsForTable(tableName);
    // Group columns: Keys (PK/FK) and others
    const keys = cols.filter(c => c.isPrimaryKey || c.isForeignKey);
    const data = cols.filter(c => !c.isPrimaryKey && !c.isForeignKey);

    return (
       <div className="relative flex-1">
         <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
         >
            <option value="" disabled>{placeholder}</option>
            {keys.length > 0 && (
               <optgroup label="Keys (PK/FK)">
                  {keys.map(c => (
                     <option key={c.name} value={c.name}>
                        {c.isPrimaryKey ? '🔑 ' : '🔗 '} {c.name} ({c.type})
                     </option>
                  ))}
               </optgroup>
            )}
            {data.length > 0 && (
               <optgroup label="Data Columns">
                  {data.map(c => (
                     <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                  ))}
               </optgroup>
            )}
         </select>
       </div>
    );
  };

  const renderJoinTypeSelector = (value: string, onChange: (val: any) => void) => {
    const types = [
      { id: 'INNER', label: 'Inner', icon: <Combine className="w-3 h-3" /> },
      { id: 'LEFT', label: 'Left', icon: <ArrowLeft className="w-3 h-3" /> },
      { id: 'RIGHT', label: 'Right', icon: <ArrowRight className="w-3 h-3" /> },
      { id: 'FULL', label: 'Full', icon: <ArrowRightLeft className="w-3 h-3" /> },
    ];

    return (
       <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
          {types.map(t => (
             <button
               key={t.id}
               onClick={() => onChange(t.id)}
               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  value === t.id 
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800'
               }`}
             >
                {t.icon}
                {t.label}
             </button>
          ))}
       </div>
    );
  };

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
                     
                     // Use the memoized TableCard here
                     return (
                        <TableCard 
                           key={tableName}
                           table={table}
                           selectedColumns={state.selectedColumns}
                           aggregations={state.aggregations}
                           isCollapsed={collapsedTables.has(tableName)}
                           colSearchTerm={columnSearchTerms[tableName] || ''}
                           onToggleCollapse={toggleTableCollapse}
                           onToggleColumn={toggleColumn}
                           onAggregationChange={updateAggregation}
                           onSelectAll={selectAllColumns}
                           onSelectNone={selectNoneColumns}
                           onSearchChange={handleColumnSearchChange}
                           onClearSearch={handleClearColumnSearch}
                        />
                     );
                   })
                 )}
               </div>
             )}

             {/* --- JOINS TAB --- */}
             {activeTab === 'joins' && (
               <div className="max-w-4xl mx-auto pb-10">
                 <div className="mb-6 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white">Configuração de Relacionamentos</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Defina explicitamente como suas tabelas se conectam (JOIN).</p>
                    </div>
                    <button onClick={addJoin} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                       <Plus className="w-4 h-4" /> Novo Join
                    </button>
                 </div>
                 
                 {state.joins.length === 0 ? (
                   <div className="bg-slate-50 dark:bg-slate-800/50 p-10 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-center flex flex-col items-center">
                      <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-sm text-slate-300">
                        <Link2 className="w-8 h-8" />
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">Nenhum JOIN definido manualmente.</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        O sistema tentará detectar relacionamentos automaticamente via chaves estrangeiras (FK), mas para consultas complexas, recomendamos definir aqui.
                      </p>
                   </div>
                 ) : (
                   <div className="space-y-6">
                     {state.joins.map((join, idx) => (
                       <div key={join.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 relative group">
                          
                          {/* Card Header / Toolbar */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => removeJoin(join.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Remover Join">
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </div>

                          <div className="p-5">
                             <div className="flex flex-col gap-4">
                                
                                {/* Top Row: Table A -> Type -> Table B */}
                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                   <div className="flex-1 w-full">
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Tabela A (Left)</label>
                                      <div className="relative">
                                         <select 
                                            value={join.fromTable}
                                            onChange={(e) => updateJoin(join.id, 'fromTable', e.target.value)}
                                            className="w-full appearance-none pl-3 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                         >
                                            <option value="" disabled>Selecione...</option>
                                            {state.selectedTables.map(t => <option key={t} value={t}>{t}</option>)}
                                         </select>
                                         <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                                      </div>
                                   </div>

                                   {/* Join Type Visual Selector */}
                                   <div className="flex flex-col items-center shrink-0 mt-5">
                                      {renderJoinTypeSelector(join.type, (val) => updateJoin(join.id, 'type', val))}
                                   </div>

                                   <div className="flex-1 w-full">
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Tabela B (Right)</label>
                                      <div className="relative">
                                         <select 
                                            value={join.toTable}
                                            onChange={(e) => updateJoin(join.id, 'toTable', e.target.value)}
                                            className="w-full appearance-none pl-3 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                         >
                                            <option value="" disabled>Selecione...</option>
                                            {state.selectedTables.map(t => <option key={t} value={t}>{t}</option>)}
                                         </select>
                                         <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                                      </div>
                                   </div>
                                </div>

                                {/* Bottom Row: ON Clause */}
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row items-center gap-3">
                                   <div className="bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-1 rounded text-[10px] font-mono font-bold">ON</div>
                                   
                                   <div className="flex-1 w-full">
                                      {renderColumnSelect(
                                         join.fromTable, 
                                         join.fromColumn, 
                                         (val) => updateJoin(join.id, 'fromColumn', val), 
                                         "Coluna de Junção (A)"
                                      )}
                                   </div>

                                   <div className="text-slate-400 font-mono font-bold">=</div>

                                   <div className="flex-1 w-full">
                                      {renderColumnSelect(
                                         join.toTable, 
                                         join.toColumn, 
                                         (val) => updateJoin(join.id, 'toColumn', val), 
                                         "Coluna de Junção (B)"
                                      )}
                                   </div>
                                </div>

                             </div>
                          </div>
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
                 onChange={(e) => updateStateWithHistory({...stateRef.current, limit: parseInt(e.target.value) || 10})}
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
