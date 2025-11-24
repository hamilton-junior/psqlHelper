
import React, { useState, useMemo, useEffect } from 'react';
import { DatabaseSchema, BuilderState, ExplicitJoin, JoinType, Filter, Operator, OrderBy, AppSettings } from '../../types';
import { Layers, ChevronRight, Settings2, RefreshCw, Search, X, CheckSquare, Square, Plus, Trash2, ArrowRightLeft, Filter as FilterIcon, ArrowDownAZ, List, Link2, Check, ChevronDown, Pin, XCircle } from 'lucide-react';

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

  // Initialize defaults from settings if state is fresh
  useEffect(() => {
    if (state.limit === 100 && state.limit !== settings.defaultLimit) {
      onStateChange({ ...state, limit: settings.defaultLimit });
    }
  }, [settings.defaultLimit]);

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

    // 1. Split by " OR " (case insensitive)
    const orGroups = searchInput.split(/\s+OR\s+/i);

    return orGroups.some(group => {
      // 2. Split by Space (Implicit AND)
      const andTerms = group.trim().split(/\s+/);

      return andTerms.every(term => {
        // 3. Convert Wildcards (*, ?) to Regex
        // Escape special regex chars except * and ?
        const escaped = term.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        
        // * matches anything (.*)
        // ? matches single char (.)
        const regexPattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
        
        try {
          const regex = new RegExp(regexPattern, 'i');
          return regex.test(colName);
        } catch (e) {
          // Fallback to simple includes if regex fails
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
      // Also remove related joins/filters
      const newJoins = state.joins.filter(j => j.fromTable !== tableName && j.toTable !== tableName);
      const newFilters = state.filters.filter(f => !f.column.startsWith(`${tableName}.`));
      
      onStateChange({ ...state, selectedTables: newTables, selectedColumns: newColumns, joins: newJoins, filters: newFilters });
      
      // Clear search term
      const newSearchTerms = { ...columnSearchTerms };
      delete newSearchTerms[tableName];
      setColumnSearchTerms(newSearchTerms);
    } else {
      newTables = [...state.selectedTables, tableName];
      onStateChange({ ...state, selectedTables: newTables });
    }
  };

  const clearAllTables = () => {
     onStateChange({ ...state, selectedTables: [], selectedColumns: [], joins: [], filters: [] });
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

    onStateChange({ ...state, selectedTables: newTables, selectedColumns: newColumns });
  };

  const selectAllColumns = (tableName: string, visibleColumns: string[]) => {
    const newColsSet = new Set(state.selectedColumns);
    visibleColumns.forEach(colName => newColsSet.add(`${tableName}.${colName}`));
    
    const newCols = Array.from(newColsSet);
    let newTables = state.selectedTables;
    if (!state.selectedTables.includes(tableName)) newTables = [...state.selectedTables, tableName];
    onStateChange({ ...state, selectedTables: newTables, selectedColumns: newCols });
  };

  const selectNoneColumns = (tableName: string, visibleColumns: string[]) => {
    const visibleSet = new Set(visibleColumns.map(c => `${tableName}.${c}`));
    const newCols = state.selectedColumns.filter(c => !visibleSet.has(c));
    onStateChange({ ...state, selectedColumns: newCols });
  };

  // --- Joins Logic ---
  const addJoin = () => {
    const newJoin: ExplicitJoin = {
      id: crypto.randomUUID(),
      fromTable: state.selectedTables[0] || '',
      fromColumn: '',
      type: 'INNER',
      toTable: state.selectedTables[1] || '',
      toColumn: ''
    };
    onStateChange({ ...state, joins: [...state.joins, newJoin] });
  };

  const updateJoin = (id: string, field: keyof ExplicitJoin, value: string) => {
    const newJoins = state.joins.map(j => j.id === id ? { ...j, [field]: value } : j);
    onStateChange({ ...state, joins: newJoins });
  };

  const removeJoin = (id: string) => {
    onStateChange({ ...state, joins: state.joins.filter(j => j.id !== id) });
  };

  // --- Filters Logic ---
  const addFilter = () => {
    const newFilter: Filter = {
      id: crypto.randomUUID(),
      column: state.selectedColumns[0] || (state.selectedTables[0] ? `${state.selectedTables[0]}.id` : ''),
      operator: '=',
      value: ''
    };
    onStateChange({ ...state, filters: [...state.filters, newFilter] });
  };

  const updateFilter = (id: string, field: keyof Filter, value: string) => {
    const newFilters = state.filters.map(f => f.id === id ? { ...f, [field]: value } : f);
    onStateChange({ ...state, filters: newFilters });
  };

  const removeFilter = (id: string) => {
    onStateChange({ ...state, filters: state.filters.filter(f => f.id !== id) });
  };

  // --- Sort & Group Logic ---
  const toggleGroupBy = (col: string) => {
    const exists = state.groupBy.includes(col);
    const newGroup = exists ? state.groupBy.filter(g => g !== col) : [...state.groupBy, col];
    onStateChange({ ...state, groupBy: newGroup });
  };

  const addSort = () => {
    const newSort: OrderBy = {
      id: crypto.randomUUID(),
      column: state.selectedColumns[0] || '',
      direction: 'ASC'
    };
    onStateChange({ ...state, orderBy: [...state.orderBy, newSort] });
  };

  const updateSort = (id: string, field: keyof OrderBy, value: string) => {
    const newSorts = state.orderBy.map(s => s.id === id ? { ...s, [field]: value } : s);
    onStateChange({ ...state, orderBy: newSorts });
  };

  const removeSort = (id: string) => {
    onStateChange({ ...state, orderBy: state.orderBy.filter(s => s.id !== id) });
  };


  // --- Render Helpers ---
  
  // Advanced Search Sorting
  const { pinnedTables, unpinnedTables } = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    
    let allMatches = schema.tables;

    // Filter logic
    if (term) {
       allMatches = schema.tables.filter(table => 
        table.name.toLowerCase().includes(term) || 
        (table.description && table.description.toLowerCase().includes(term))
      );
    }

    // Split into pinned and unpinned
    const pinned: typeof schema.tables = [];
    const unpinned: typeof schema.tables = [];

    allMatches.forEach(table => {
      if (state.selectedTables.includes(table.name)) {
        pinned.push(table);
      } else {
        unpinned.push(table);
      }
    });

    // Sort function
    const sorter = (a: typeof schema.tables[0], b: typeof schema.tables[0]) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();

      if (term) {
        // 1. Exact match
        if (nameA === term && nameB !== term) return -1;
        if (nameB === term && nameA !== term) return 1;
        // 2. Starts with
        const startsA = nameA.startsWith(term);
        const startsB = nameB.startsWith(term);
        if (startsA && !startsB) return -1;
        if (!startsA && startsB) return 1;
      }
      // 3. Alphabetical
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
          ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20' 
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
          className="mt-0.5 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-700 rounded-full p-0.5 shadow-sm hover:text-red-500 hover:bg-red-50"
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
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-end mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            Query Builder
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Connected to: <span className="font-mono text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded text-xs">{schema.name}</span>
          </p>
        </div>
      </div>

      {/* Main Layout: Sidebar + Content */}
      <div className="flex-1 flex gap-6 min-h-0">
        
        {/* Left: Table Selection Sidebar */}
        <div className="w-1/4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden shadow-sm">
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 text-sm flex justify-between items-center">
            <span>Tables ({schema.tables.length})</span>
            {state.selectedTables.length > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                {state.selectedTables.length} Selected
              </span>
            )}
          </div>
          
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter tables..."
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
                <div className="text-center py-4 text-xs text-slate-400 italic">No tables found</div>
             )}

             {/* Pinned / Selected Section */}
             {pinnedTables.length > 0 && (
               <>
                 <div className="px-2 py-1 text-[10px] font-bold text-indigo-500 uppercase flex items-center gap-1">
                    <Pin className="w-3 h-3" /> Selected
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
                      Available
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
             {renderTabButton('columns', 'Columns', <List className="w-4 h-4" />)}
             {renderTabButton('joins', `Joins (${state.joins.length})`, <Link2 className="w-4 h-4" />)}
             {renderTabButton('filters', `Filters (${state.filters.length})`, <FilterIcon className="w-4 h-4" />)}
             {renderTabButton('sortgroup', 'Sort & Group', <ArrowDownAZ className="w-4 h-4" />)}
           </div>

           {/* Tabs Content */}
           <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 dark:bg-slate-900/50">
             
             {/* --- COLUMNS TAB --- */}
             {activeTab === 'columns' && (
               <div className="space-y-4">
                 {state.selectedTables.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                     <Layers className="w-12 h-12 mb-2 opacity-20" />
                     <p className="text-sm">Select tables from the sidebar to view columns</p>
                   </div>
                 ) : (
                   state.selectedTables.map(tableName => {
                     const table = schema.tables.find(t => t.name === tableName);
                     if (!table) return null;
                     
                     const colSearch = columnSearchTerms[tableName] || '';
                     
                     // Use robust matching logic
                     const filteredColumns = table.columns.filter(col => 
                        matchColumnName(col.name, colSearch)
                     );
                     
                     const visibleColNames = filteredColumns.map(c => c.name);
                     const isCollapsed = collapsedTables.has(tableName);
                     
                     return (
                       <div key={tableName} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                         {/* Card Header (Clickable to Collapse) */}
                         <div 
                           className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                           onClick={() => toggleTableCollapse(tableName)}
                         >
                           <div className="flex items-center gap-2">
                              {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                              <h4 className="font-bold text-slate-700 dark:text-slate-300">{tableName}</h4>
                              <span className="text-xs text-slate-400 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full">
                                {state.selectedColumns.filter(c => c.startsWith(tableName)).length} selected
                              </span>
                           </div>
                           <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                              <button onClick={() => selectAllColumns(tableName, visibleColNames)} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-1 rounded transition-colors">All</button>
                              <button onClick={() => selectNoneColumns(tableName, visibleColNames)} className="text-xs font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded transition-colors">None</button>
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
                                      placeholder={`Filter columns in ${tableName}... (supports *, ?, OR)`}
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
                                     No columns match "{colSearch}"
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
                    <p className="text-sm text-slate-500 dark:text-slate-400">Define how your tables relate to each other.</p>
                    <button onClick={addJoin} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 transition-colors shadow-sm">
                       <Plus className="w-3.5 h-3.5" /> Add Join
                    </button>
                 </div>
                 
                 {state.joins.length === 0 ? (
                   <div className="bg-white dark:bg-slate-800 p-8 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-center">
                      <p className="text-slate-400 text-sm mb-2">No explicit joins defined.</p>
                      <p className="text-xs text-slate-400">If you leave this empty, we will attempt to auto-detect joins based on foreign keys.</p>
                   </div>
                 ) : (
                   <div className="space-y-3">
                     {state.joins.map((join) => (
                       <div key={join.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center gap-3">
                          {/* From Table */}
                          <select 
                             value={join.fromTable}
                             onChange={(e) => updateJoin(join.id, 'fromTable', e.target.value)}
                             className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                          >
                             <option value="" disabled>Table A</option>
                             {state.selectedTables.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          
                          {/* From Column */}
                          <select 
                             value={join.fromColumn}
                             onChange={(e) => updateJoin(join.id, 'fromColumn', e.target.value)}
                             className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none min-w-[100px]"
                          >
                             <option value="" disabled>Column A</option>
                             {getColumnsForTable(join.fromTable).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                          </select>

                          {/* Type */}
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

                          {/* To Table */}
                          <select 
                             value={join.toTable}
                             onChange={(e) => updateJoin(join.id, 'toTable', e.target.value)}
                             className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                          >
                             <option value="" disabled>Table B</option>
                             {state.selectedTables.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>

                          {/* To Column */}
                          <select 
                             value={join.toColumn}
                             onChange={(e) => updateJoin(join.id, 'toColumn', e.target.value)}
                             className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none min-w-[100px]"
                          >
                             <option value="" disabled>Column B</option>
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
                    <p className="text-sm text-slate-500 dark:text-slate-400">Add conditions to filter your results (WHERE clause).</p>
                    <button onClick={addFilter} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 transition-colors shadow-sm">
                       <Plus className="w-3.5 h-3.5" /> Add Filter
                    </button>
                 </div>

                 {state.filters.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-center">
                       <p className="text-slate-400 text-sm">No filters applied.</p>
                    </div>
                 ) : (
                    <div className="space-y-3">
                       {state.filters.map(filter => (
                          <div key={filter.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center gap-3">
                             {/* Column */}
                             <div className="text-xs font-bold text-slate-400 uppercase">WHERE</div>
                             <select
                                value={filter.column}
                                onChange={(e) => updateFilter(filter.id, 'column', e.target.value)}
                                className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none max-w-[200px]"
                             >
                                <option value="" disabled>Select Column</option>
                                {getAllSelectedTableColumns().map(c => (
                                   <option key={`${c.table}.${c.column}`} value={`${c.table}.${c.column}`}>
                                      {c.table}.{c.column}
                                   </option>
                                ))}
                             </select>

                             {/* Operator */}
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

                             {/* Value */}
                             {!['IS NULL', 'IS NOT NULL'].includes(filter.operator) && (
                                <input
                                   type="text"
                                   value={filter.value}
                                   onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                                   placeholder="Value..."
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
                 
                 {/* Group By Section */}
                 <div>
                    <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                       <List className="w-4 h-4 text-indigo-600" /> Group By
                    </h3>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                       <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Select columns to group results by (useful for aggregations).</p>
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

                 {/* Order By Section */}
                 <div>
                    <div className="mb-2 flex justify-between items-center">
                       <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <ArrowDownAZ className="w-4 h-4 text-indigo-600" /> Order By
                       </h3>
                       <button onClick={addSort} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add Sort Rule
                       </button>
                    </div>
                    
                    {state.orderBy.length === 0 ? (
                       <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-center">
                          <p className="text-xs text-slate-400">No sorting rules applied.</p>
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
                                   <option value="" disabled>Select Column</option>
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
                 Selected Tables 
                 {state.selectedTables.length > 0 && (
                   <button onClick={clearAllTables} className="text-slate-500 hover:text-red-400 transition-colors" title="Clear all selections">
                      <Trash2 className="w-3 h-3" />
                   </button>
                 )}
              </span>
              <span className="font-mono text-xl font-bold">{state.selectedTables.length}</span>
            </div>
            <div className="w-px h-8 bg-slate-700"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Selected Columns</span>
              <span className="font-mono text-xl font-bold">{state.selectedColumns.length === 0 ? (state.selectedTables.length > 0 ? 'ALL (*)' : '0') : state.selectedColumns.length}</span>
            </div>
         </div>

         <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded border border-slate-700">
               <Settings2 className="w-4 h-4 text-slate-400" />
               <span className="text-xs text-slate-400">Limit:</span>
               <input 
                 type="number" 
                 value={state.limit}
                 onChange={(e) => onStateChange({...state, limit: parseInt(e.target.value) || 10})}
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
                  Building...
                </>
              ) : (
                <>
                  Preview & Execute Query
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
