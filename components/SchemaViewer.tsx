
import React, { useState, useMemo } from 'react';
import { DatabaseSchema, Table, Column } from '../types';
import { Database, Table as TableIcon, Key, ArrowRight, Search, ChevronDown, ChevronRight, Link, ArrowUpRight, ArrowDownLeft, X, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check, Filter, PlusCircle, Target, CornerDownRight } from 'lucide-react';

interface SchemaViewerProps {
  schema: DatabaseSchema;
  onRegenerateClick?: () => void;
  loading?: boolean;
  onDescriptionChange?: (tableName: string, newDescription: string) => void;
  // New props for Builder Integration
  selectionMode?: boolean;
  selectedTableIds?: string[];
  onToggleTable?: (tableName: string) => void;
}

type SortField = 'name' | 'type' | 'key';
type SortDirection = 'asc' | 'desc';

const SchemaViewer: React.FC<SchemaViewerProps> = ({ 
  schema, 
  onRegenerateClick, 
  loading = false, 
  onDescriptionChange,
  selectionMode = false,
  selectedTableIds = [],
  onToggleTable
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  // Store expanded table names. Initialize with empty or all based on preference.
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  
  // Hover state for relationship highlighting
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [hoveredFkTarget, setHoveredFkTarget] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<{ table: string; col: string; references?: string } | null>(null);

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('key'); // Default to showing keys first
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Type Filter State
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('');

  // Description Editing State
  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [tempDesc, setTempDesc] = useState('');

  // Extract all unique column types for the filter dropdown
  const allColumnTypes = useMemo(() => {
    const types = new Set<string>();
    schema.tables.forEach(t => t.columns.forEach(c => {
      // Simplify type (e.g., VARCHAR(255) -> VARCHAR) for cleaner filtering
      const simpleType = c.type.split('(')[0].toUpperCase();
      types.add(simpleType);
    }));
    return Array.from(types).sort();
  }, [schema]);

  const filteredTables = useMemo(() => {
    const term = searchTerm.toLowerCase();

    // In selection mode, we might want to sort selected tables to the top, but basic filtering first
    let tables = schema.tables.filter(table => {
      // 1. Text Search
      const nameMatch = table.name.toLowerCase().includes(term);
      const descMatch = table.description && table.description.toLowerCase().includes(term);
      const colMatch = table.columns.some(col => col.name.toLowerCase().includes(term));
      const matchesSearch = !term || nameMatch || descMatch || colMatch;

      // 2. Type Filter
      let matchesType = true;
      if (selectedTypeFilter) {
        matchesType = table.columns.some(col => col.type.toUpperCase().includes(selectedTypeFilter));
      }

      return matchesSearch && matchesType;
    });

    // Optional: If in selection mode, maybe sort pinned tables first? 
    // For now, keep alphabetical to avoid jumping UI
    return tables;
  }, [schema.tables, searchTerm, selectedTypeFilter]);

  // Expand/Collapse logic
  const toggleTableExpand = (e: React.MouseEvent, tableName: string) => {
    e.stopPropagation();
    const newSet = new Set(expandedTables);
    if (newSet.has(tableName)) {
      newSet.delete(tableName);
    } else {
      newSet.add(tableName);
    }
    setExpandedTables(newSet);
  };

  const handleTableClick = (tableName: string) => {
    if (selectionMode && onToggleTable) {
      onToggleTable(tableName);
    } else {
      // If not in selection mode, clicking body expands/collapses
      const newSet = new Set(expandedTables);
      if (newSet.has(tableName)) newSet.delete(tableName);
      else newSet.add(tableName);
      setExpandedTables(newSet);
    }
  };

  const expandAll = () => {
    setExpandedTables(new Set(filteredTables.map(t => t.name)));
  };

  const collapseAll = () => {
    setExpandedTables(new Set());
  };

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const startEditing = (e: React.MouseEvent, table: Table) => {
    e.stopPropagation();
    setEditingTable(table.name);
    setTempDesc(table.description || '');
  };

  const saveDescription = (e: React.MouseEvent | React.FormEvent, tableName: string) => {
    e.stopPropagation(); // Prevent toggle
    e.preventDefault();
    if (onDescriptionChange) {
      onDescriptionChange(tableName, tempDesc);
    }
    setEditingTable(null);
  };

  const getSortedAndFilteredColumns = (columns: Column[]) => {
    let cols = [...columns];

    // Apply Type Filter
    if (selectedTypeFilter) {
      cols = cols.filter(c => c.type.toUpperCase().includes(selectedTypeFilter));
    }

    return cols.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case 'type':
          valA = a.type.toLowerCase();
          valB = b.type.toLowerCase();
          break;
        case 'key':
          // Custom weight: PK = 2, FK = 1, Normal = 0
          valA = (a.isPrimaryKey ? 2 : 0) + (a.isForeignKey ? 1 : 0);
          valB = (b.isPrimaryKey ? 2 : 0) + (b.isForeignKey ? 1 : 0);
          // For keys, usually we want High weight first (desc) if direction is asc
          if (sortDirection === 'asc') return valB - valA;
          else return valA - valB;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Relationship Calculation
  const relationships = useMemo(() => {
    if (!hoveredTable && !hoveredFkTarget) return { parents: [], children: [] };

    const parents: string[] = []; // Tables the hovered table points TO
    const children: string[] = []; // Tables that point TO the hovered table
    
    // Determine the subject table
    const subject = hoveredFkTarget ? hoveredFkTarget : hoveredTable;

    if (!subject) return { parents: [], children: [] };

    // 1. Find Parents (Foreign Keys in subject table)
    const currentTableObj = schema.tables.find(t => t.name === subject);
    if (currentTableObj) {
      currentTableObj.columns.forEach(col => {
        if (col.isForeignKey && col.references) {
          const targetTable = col.references.split('.')[0];
          if (targetTable && targetTable !== subject) parents.push(targetTable);
        }
      });
    }

    // 2. Find Children (Other tables pointing to subject table)
    schema.tables.forEach(t => {
      if (t.name === subject) return;
      t.columns.forEach(col => {
        if (col.isForeignKey && col.references) {
          const targetTable = col.references.split('.')[0];
          if (targetTable === subject) children.push(t.name);
        }
      });
    });

    return { parents, children };
  }, [hoveredTable, hoveredFkTarget, schema.tables]);

  // Helper to determine visuals based on relationships
  const getTableVisuals = (tableName: string) => {
    // Default State (No hover)
    if (!hoveredTable && !hoveredFkTarget) {
      // In selection mode, highlight selected tables
      if (selectionMode && selectedTableIds.includes(tableName)) {
         return {
            containerClass: 'opacity-100 border-l-4 border-l-indigo-500 border-indigo-200 bg-indigo-50/20 dark:bg-indigo-900/10 dark:border-indigo-800',
            label: null
         };
      }
      return {
        containerClass: 'opacity-100 border-l-4 border-l-transparent border-slate-200 dark:border-slate-700 dark:bg-slate-800',
        label: null
      };
    }

    // FK Hover Mode (Hovering a specific column that is an FK)
    if (hoveredFkTarget) {
      if (tableName === hoveredFkTarget) {
        return {
          containerClass: 'opacity-100 ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 border-l-4 border-l-amber-500 shadow-lg z-10',
          label: <span className="absolute top-2 right-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm"><Target className="w-3 h-3" /> Alvo do Link</span>
        };
      }
      
      // Ensure the source table (where we are hovering) stays visible
      if (hoveredColumn && tableName === hoveredColumn.table) {
         return {
            containerClass: 'opacity-100 ring-1 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 border-l-4 border-l-indigo-600 shadow-md z-10',
            label: <span className="absolute top-2 right-2 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 rounded shadow-sm">Origem</span>
         };
      }
      
      return { containerClass: 'opacity-40 grayscale-[0.5] border-slate-100 dark:border-slate-800 dark:bg-slate-900', label: null };
    }

    // General Table Hover Mode (Hovering a table header)
    if (tableName === hoveredTable) {
      return {
        containerClass: 'opacity-100 ring-1 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 border-l-4 border-l-indigo-600 shadow-md z-10',
        label: <span className="absolute top-2 right-2 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 rounded shadow-sm">Foco</span>
      };
    }
    
    if (relationships.parents.includes(tableName)) {
      return {
        containerClass: 'opacity-100 border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 border-l-4 border-l-amber-400 shadow-sm',
        label: <span className="absolute top-2 right-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm"><ArrowUpRight className="w-3 h-3" /> Pai (Referenciado)</span>
      };
    }
    
    if (relationships.children.includes(tableName)) {
      return {
        containerClass: 'opacity-100 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 border-l-4 border-l-emerald-400 shadow-sm',
        label: <span className="absolute top-2 right-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm"><ArrowDownLeft className="w-3 h-3" /> Filho (Referencia)</span>
      };
    }

    // Unrelated tables
    return {
      containerClass: 'opacity-40 grayscale-[0.5] border-slate-100 dark:border-slate-800 dark:bg-slate-900',
      label: null
    };
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />;
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-hidden select-none">
      {/* Header */}
      {!selectionMode && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <span title="Database Schema" className="flex items-center">
              <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </span>
            <div className="overflow-hidden">
              <h2 className="font-semibold text-sm uppercase tracking-wider truncate max-w-[120px]" title={schema.name}>
                {loading ? 'Carregando...' : schema.name}
              </h2>
              <p className="text-[10px] text-slate-400">{filteredTables.length} tabelas</p>
            </div>
          </div>
          {onRegenerateClick && (
            <button 
              onClick={onRegenerateClick}
              disabled={loading}
              title="Alterar ou reconectar banco de dados"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline disabled:opacity-50"
            >
              Mudar BD
            </button>
          )}
        </div>
      )}

      {/* Search Bar & Controls */}
      <div className={`p-2 border-b border-slate-100 dark:border-slate-800 shrink-0 space-y-2 ${selectionMode ? 'bg-slate-50 dark:bg-slate-900' : ''}`}>
        <div className="flex gap-2">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
             <input
               type="text"
               placeholder="Buscar tabelas..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               disabled={loading}
               title="Buscar tabelas e colunas"
               className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-700 dark:text-slate-200 placeholder-slate-400"
             />
             {searchTerm && (
               <button 
                 onClick={() => setSearchTerm('')}
                 title="Limpar busca"
                 className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
               >
                 <X className="w-3 h-3" />
               </button>
             )}
           </div>
           
           {/* Type Filter Dropdown */}
           <div className="relative" title="Filtrar colunas por tipo de dado">
             <div className="absolute left-2 top-2 pointer-events-none">
               <Filter className={`w-4 h-4 ${selectedTypeFilter ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
             </div>
             <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className={`w-[100px] h-full pl-8 pr-2 py-2 border rounded text-xs outline-none appearance-none cursor-pointer font-medium ${
                  selectedTypeFilter 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' 
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
             >
                <option value="">Tipos</option>
                {allColumnTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
             </select>
           </div>
        </div>

        <div className="flex justify-between items-center px-1">
           <span className="text-[10px] text-slate-400 font-medium">
              {filteredTables.length} tabelas
           </span>
           <div className="flex gap-2">
             <button onClick={expandAll} className="text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400" title="Expandir todas as tabelas">Expandir</button>
             <button onClick={collapseAll} className="text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400" title="Recolher todas as tabelas">Recolher</button>
           </div>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 relative scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700" onMouseLeave={() => { setHoveredTable(null); setHoveredFkTarget(null); setHoveredColumn(null); }}>
        {loading ? (
          // Skeleton Loader
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2 border border-slate-100 dark:border-slate-700 rounded-lg p-3">
                <div className="flex items-center gap-2">
                   <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                   <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs italic">
             Nenhuma tabela encontrada.
          </div>
        ) : (
          filteredTables.map((table) => {
            const isExpanded = expandedTables.has(table.name);
            const { containerClass, label } = getTableVisuals(table.name);
            const isEditing = editingTable === table.name;
            const isSelected = selectedTableIds.includes(table.name);

            return (
              <div 
                key={table.name} 
                className={`border rounded-lg transition-all duration-200 relative ${containerClass} ${isExpanded ? 'bg-white dark:bg-slate-800' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                onMouseEnter={() => !hoveredFkTarget && setHoveredTable(table.name)}
              >
                {/* Absolute Positioning for Badge to prevent layout shifts */}
                {label}

                {/* Table Header */}
                <div 
                  className={`flex items-center gap-2 p-3 cursor-pointer ${selectionMode ? 'hover:bg-slate-50 dark:hover:bg-slate-700' : ''}`}
                  onClick={() => handleTableClick(table.name)}
                  title={selectionMode ? "Clique para selecionar" : "Clique para expandir"}
                >
                  {/* Selection Mode: Checkbox */}
                  {selectionMode && (
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                       isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                    }`}>
                       {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                  )}

                  {/* Expand Toggle */}
                  <div onClick={(e) => toggleTableExpand(e, table.name)} className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>

                  <TableIcon className={`w-4 h-4 ${isSelected || isExpanded ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  
                  <div className="flex-1 min-w-0 pr-6"> {/* Added padding right to avoid overlap with absolute badge */}
                     <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>{table.name}</span>
                     </div>
                     
                     {/* Editable Description Area */}
                     <div className="flex items-center gap-2 mt-0.5 min-h-[16px]">
                        {isEditing ? (
                           <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                             <input 
                               type="text" 
                               value={tempDesc}
                               onChange={(e) => setTempDesc(e.target.value)}
                               className="w-full text-xs bg-slate-100 dark:bg-slate-700 border border-indigo-300 dark:border-indigo-500 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                               autoFocus
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter') saveDescription(e, table.name);
                                 if (e.key === 'Escape') setEditingTable(null);
                               }}
                             />
                             <button onClick={(e) => saveDescription(e, table.name)} className="p-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-200" title="Salvar descrição">
                               <Check className="w-3 h-3" />
                             </button>
                           </div>
                        ) : (
                           <div className="flex items-center gap-2 group/desc max-w-full relative">
                              <p 
                                className={`text-[10px] truncate max-w-[180px] cursor-text ${table.description ? 'text-slate-400 dark:text-slate-500' : 'text-indigo-400/70 italic hover:text-indigo-500'}`} 
                                title={table.description || "Adicionar descrição"}
                                onClick={(e) => {
                                   if (!table.description) startEditing(e, table);
                                }}
                              >
                                {table.description || (
                                   <span className="flex items-center gap-1">
                                      <PlusCircle className="w-3 h-3" /> Adicionar descrição...
                                   </span>
                                )}
                              </p>
                              {onDescriptionChange && table.description && (
                                <button 
                                  onClick={(e) => startEditing(e, table)}
                                  className="opacity-0 group-hover/desc:opacity-100 p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-600 transition-all absolute right-0 bg-white dark:bg-slate-800 shadow-sm"
                                  title="Editar descrição"
                                >
                                  <Pencil className="w-2.5 h-2.5" />
                                </button>
                              )}
                           </div>
                        )}
                     </div>
                  </div>
                </div>

                {/* Columns Accordion Body */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-slate-50 dark:border-slate-700/50">
                    
                    {/* Sort Controls */}
                    <div className="flex gap-2 py-2 mb-1 border-b border-slate-50 dark:border-slate-700/50 justify-end">
                       <button onClick={() => handleSortChange('name')} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Ordenar por Nome">
                         Nome <SortIcon field="name" />
                       </button>
                       <button onClick={() => handleSortChange('type')} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Ordenar por Tipo">
                         Tipo <SortIcon field="type" />
                       </button>
                       <button onClick={() => handleSortChange('key')} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Ordenar por Chave">
                         Chave <SortIcon field="key" />
                       </button>
                    </div>

                    <div className="space-y-0.5">
                      {getSortedAndFilteredColumns(table.columns).map((col) => {
                         const targetTable = col.references ? col.references.split('.')[0] : null;
                         const isMatch = searchTerm && col.name.toLowerCase().includes(searchTerm.toLowerCase());
                         const tooltipText = col.isForeignKey && col.references 
                            ? `${col.name} references ${col.references}` 
                            : col.name;
                         
                         // Visual Highlight Logic for Column Hover
                         const isHovered = hoveredColumn?.table === table.name && hoveredColumn?.col === col.name;
                         const isRelTarget = hoveredColumn?.references === `${table.name}.${col.name}`;
                         const isRelSource = hoveredColumn && !hoveredColumn.references && col.references === `${hoveredColumn.table}.${hoveredColumn.col}`;
                         
                         let bgClass = '';
                         let colBadge = null;

                         if (isHovered) {
                            bgClass = 'bg-slate-100 dark:bg-slate-700 ring-1 ring-slate-300 dark:ring-slate-500';
                         } else if (isRelTarget) {
                            bgClass = 'bg-amber-100 dark:bg-amber-900/40 ring-1 ring-amber-400 font-bold';
                            colBadge = (
                              <span className="text-[9px] font-extrabold uppercase bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm ml-auto">
                                <Target className="w-2.5 h-2.5" /> Alvo
                              </span>
                            );
                         } else if (isRelSource) {
                            bgClass = 'bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-400 font-bold';
                            colBadge = (
                              <span className="text-[9px] font-extrabold uppercase bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm ml-auto">
                                <CornerDownRight className="w-2.5 h-2.5" /> Ref
                              </span>
                            );
                         }
                         
                         return (
                          <div 
                             key={col.name} 
                             className={`flex items-center text-xs py-1.5 px-2 rounded group transition-all duration-200
                                ${bgClass || `text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 ${col.isForeignKey ? 'hover:bg-amber-50 dark:hover:bg-amber-900/20' : ''}`}
                                ${isMatch && !bgClass ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}
                             `}
                             onMouseEnter={() => {
                               if (col.references) {
                                  setHoveredFkTarget(col.references.split('.')[0]);
                               }
                               setHoveredColumn({ table: table.name, col: col.name, references: col.references });
                             }}
                             onMouseLeave={() => {
                               setHoveredFkTarget(null);
                               setHoveredColumn(null);
                             }}
                          >
                            {/* Icon Gutter (Only PK here now) */}
                            <div className="w-5 mr-1 flex justify-center shrink-0" title={col.isPrimaryKey ? "Primary Key" : undefined}>
                              {col.isPrimaryKey && (
                                <Key className="w-3.5 h-3.5 text-amber-500 transform rotate-45" />
                              )}
                            </div>
                            
                            <div className="flex-1 flex items-center min-w-0">
                               <div className="flex flex-col truncate flex-1">
                                  <div className="flex items-center" title={tooltipText}>
                                    <span className={`font-mono truncate ${
                                       isRelTarget ? 'text-amber-800 dark:text-amber-200' :
                                       isRelSource ? 'text-emerald-800 dark:text-emerald-200' :
                                       col.isForeignKey ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300'
                                    }`}>
                                      {col.name}
                                    </span>
                                    {/* Link Icon next to name for FK */}
                                    {col.isForeignKey && (
                                      <span title={`Referencia ${col.references}`} className="flex items-center shrink-0">
                                        <Link className={`w-3 h-3 ml-1.5 opacity-70 ${isRelSource ? 'text-emerald-600' : 'text-blue-500'}`} aria-label="Foreign Key" />
                                      </span>
                                    )}
                                  </div>

                                  {col.isForeignKey && !isRelSource && (
                                    <span className={`text-[9px] flex items-center gap-0.5 transition-colors mt-0.5 truncate ${
                                       isRelSource ? 'text-emerald-600 dark:text-emerald-400' :
                                       'text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300'
                                    }`}>
                                      <ArrowRight className="w-2 h-2" /> {col.references}
                                    </span>
                                  )}
                               </div>
                               
                               {colBadge ? colBadge : (
                                  <span className="text-[10px] text-slate-400 ml-2 font-mono shrink-0" title={`Type: ${col.type}`}>{col.type.toLowerCase()}</span>
                               )}
                            </div>
                          </div>
                         )
                      })}
                      
                      {getSortedAndFilteredColumns(table.columns).length === 0 && (
                        <div className="text-[10px] text-slate-400 py-2 text-center italic">
                          Nenhuma coluna corresponde ao filtro.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* Legend */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
        <p className="flex items-center gap-3">
          <span className="flex items-center gap-1" title="Tabela selecionada"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Sel</span>
          <span className="flex items-center gap-1" title="Tabela pai (referenciada)"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Pai</span>
          <span className="flex items-center gap-1" title="Tabela filho (referencia)"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Filho</span>
        </p>
      </div>
    </div>
  );
};

export default SchemaViewer;
