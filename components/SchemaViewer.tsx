
import React, { useState, useMemo } from 'react';
import { DatabaseSchema, Table, Column } from '../types';
import { Database, Table as TableIcon, Key, ArrowRight, Search, ChevronDown, ChevronRight, Link2, ArrowUpRight, ArrowDownLeft, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface SchemaViewerProps {
  schema: DatabaseSchema;
  onRegenerateClick: () => void;
  loading?: boolean;
}

type SortField = 'name' | 'type' | 'key';
type SortDirection = 'asc' | 'desc';

const SchemaViewer: React.FC<SchemaViewerProps> = ({ schema, onRegenerateClick, loading = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  // Store expanded table names. Initialize with empty or all based on preference.
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  
  // Hover state for relationship highlighting
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [hoveredFkTarget, setHoveredFkTarget] = useState<string | null>(null);

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('key'); // Default to showing keys first
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const filteredTables = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return schema.tables;

    return schema.tables.filter(table => {
      // Match Table Name
      const nameMatch = table.name.toLowerCase().includes(term);
      // Match Description
      const descMatch = table.description && table.description.toLowerCase().includes(term);
      // Match Column Names
      const colMatch = table.columns.some(col => col.name.toLowerCase().includes(term));

      return nameMatch || descMatch || colMatch;
    });
  }, [schema.tables, searchTerm]);

  // Expand/Collapse logic
  const toggleTable = (tableName: string) => {
    const newSet = new Set(expandedTables);
    if (newSet.has(tableName)) {
      newSet.delete(tableName);
    } else {
      newSet.add(tableName);
    }
    setExpandedTables(newSet);
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

  const getSortedColumns = (columns: Column[]) => {
    return [...columns].sort((a, b) => {
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
    if (!hoveredTable) return { parents: [], children: [] };

    const parents: string[] = []; // Tables the hovered table points TO
    const children: string[] = []; // Tables that point TO the hovered table

    // 1. Find Parents (Foreign Keys in hovered table)
    const currentTableObj = schema.tables.find(t => t.name === hoveredTable);
    if (currentTableObj) {
      currentTableObj.columns.forEach(col => {
        if (col.isForeignKey && col.references) {
          const targetTable = col.references.split('.')[0];
          if (targetTable && targetTable !== hoveredTable) parents.push(targetTable);
        }
      });
    }

    // 2. Find Children (Other tables pointing to hovered table)
    schema.tables.forEach(t => {
      if (t.name === hoveredTable) return;
      t.columns.forEach(col => {
        if (col.isForeignKey && col.references) {
          const targetTable = col.references.split('.')[0];
          if (targetTable === hoveredTable) children.push(t.name);
        }
      });
    });

    return { parents, children };
  }, [hoveredTable, schema.tables]);

  // Helper to determine visuals based on relationships
  const getTableVisuals = (tableName: string) => {
    // Default State (No hover)
    if (!hoveredTable && !hoveredFkTarget) {
      return {
        containerClass: 'opacity-100 border-l-4 border-l-transparent border-slate-200',
        label: null
      };
    }

    // FK Hover Mode (Hovering a specific column)
    if (hoveredFkTarget) {
      if (tableName === hoveredFkTarget) {
        return {
          containerClass: 'opacity-100 ring-1 ring-amber-400 bg-amber-50/50 border-amber-200 border-l-4 border-l-amber-500 shadow-md transform scale-[1.01]',
          label: <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded ml-auto flex items-center gap-1">Target <ArrowDownLeft className="w-3 h-3" /></span>
        };
      }
      // Keep the source table visible but standard
      if (expandedTables.has(tableName) && schema.tables.find(t => t.name === tableName)?.columns.some(c => c.references?.startsWith(hoveredFkTarget))) {
         return {
           containerClass: 'opacity-100 border-l-4 border-l-indigo-300 border-indigo-200 bg-indigo-50/30',
           label: <span className="text-[10px] font-bold text-indigo-600 px-1.5 py-0.5 rounded ml-auto">Source</span>
         };
      }
      return { containerClass: 'opacity-30 blur-[1px] grayscale border-slate-100', label: null };
    }

    // General Table Hover Mode (Hovering a table header)
    if (tableName === hoveredTable) {
      return {
        containerClass: 'opacity-100 ring-1 ring-indigo-500 bg-indigo-50 border-indigo-200 border-l-4 border-l-indigo-600 shadow-md z-10 transform scale-[1.01]',
        label: <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded ml-auto">Focus</span>
      };
    }
    
    if (relationships.parents.includes(tableName)) {
      return {
        containerClass: 'opacity-100 border-amber-300 bg-amber-50/50 border-l-4 border-l-amber-400 shadow-sm',
        label: <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded ml-auto flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Parent</span>
      };
    }
    
    if (relationships.children.includes(tableName)) {
      return {
        containerClass: 'opacity-100 border-emerald-300 bg-emerald-50/50 border-l-4 border-l-emerald-400 shadow-sm',
        label: <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded ml-auto flex items-center gap-1"><ArrowDownLeft className="w-3 h-3" /> Child</span>
      };
    }

    // Unrelated tables
    return {
      containerClass: 'opacity-40 grayscale-[0.5] scale-[0.98] border-slate-100',
      label: null
    };
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />;
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200 overflow-hidden select-none">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-slate-700">
          <Database className="w-5 h-5 text-indigo-600" />
          <div className="overflow-hidden">
             <h2 className="font-semibold text-sm uppercase tracking-wider truncate max-w-[120px]" title={schema.name}>
               {loading ? 'Loading...' : schema.name}
             </h2>
             <p className="text-[10px] text-slate-400">{filteredTables.length} tables</p>
          </div>
        </div>
        <button 
          onClick={onRegenerateClick}
          disabled={loading}
          className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline disabled:opacity-50"
        >
          Change DB
        </button>
      </div>

      {/* Search Bar & Controls */}
      <div className="p-2 border-b border-slate-100 shrink-0 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter tables or columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={loading}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex justify-end gap-2 px-1">
           <button onClick={expandAll} className="text-[10px] text-slate-400 hover:text-indigo-600">Expand All</button>
           <button onClick={collapseAll} className="text-[10px] text-slate-400 hover:text-indigo-600">Collapse All</button>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 relative" onMouseLeave={() => { setHoveredTable(null); setHoveredFkTarget(null); }}>
        {loading ? (
          // Skeleton Loader
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2 border border-slate-100 rounded-lg p-3">
                <div className="flex items-center gap-2">
                   <div className="w-4 h-4 bg-slate-200 rounded"></div>
                   <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs italic">
            No tables match your search.
          </div>
        ) : (
          filteredTables.map((table) => {
            const isExpanded = expandedTables.has(table.name);
            const { containerClass, label } = getTableVisuals(table.name);

            return (
              <div 
                key={table.name} 
                className={`border rounded-lg transition-all duration-200 ${containerClass} ${isExpanded ? 'bg-white' : 'bg-white hover:bg-slate-50'}`}
                onMouseEnter={() => !hoveredFkTarget && setHoveredTable(table.name)}
              >
                {/* Table Header */}
                <div 
                  className="flex items-center gap-2 p-3 cursor-pointer"
                  onClick={() => toggleTable(table.name)}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <TableIcon className={`w-4 h-4 ${isExpanded ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-700 truncate">{table.name}</span>
                        {label}
                     </div>
                     {table.description && (
                       <p className="text-[10px] text-slate-400 truncate">{table.description}</p>
                     )}
                  </div>
                </div>

                {/* Columns Accordion Body */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-slate-50">
                    
                    {/* Sort Controls */}
                    <div className="flex gap-2 py-2 mb-1 border-b border-slate-50 justify-end">
                       <button onClick={() => handleSortChange('name')} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-600 px-1.5 py-0.5 rounded hover:bg-slate-100">
                         Name <SortIcon field="name" />
                       </button>
                       <button onClick={() => handleSortChange('type')} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-600 px-1.5 py-0.5 rounded hover:bg-slate-100">
                         Type <SortIcon field="type" />
                       </button>
                       <button onClick={() => handleSortChange('key')} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-600 px-1.5 py-0.5 rounded hover:bg-slate-100">
                         Key <SortIcon field="key" />
                       </button>
                    </div>

                    <div className="space-y-0.5">
                      {getSortedColumns(table.columns).map((col) => {
                         const targetTable = col.references ? col.references.split('.')[0] : null;
                         const isMatch = searchTerm && col.name.toLowerCase().includes(searchTerm.toLowerCase());
                         
                         return (
                          <div 
                             key={col.name} 
                             className={`flex items-center text-xs text-slate-600 py-1.5 px-2 hover:bg-slate-50 rounded group transition-colors ${isMatch ? 'bg-yellow-50' : ''}`}
                             onMouseEnter={() => targetTable && setHoveredFkTarget(targetTable)}
                             onMouseLeave={() => setHoveredFkTarget(null)}
                          >
                            <div className="w-5 mr-1 flex justify-center shrink-0">
                              {col.isPrimaryKey && (
                                <Key className="w-3.5 h-3.5 text-amber-500 transform rotate-45" />
                              )}
                              {col.isForeignKey && (
                                <Link2 className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-600" />
                              )}
                            </div>
                            
                            <div className="flex-1 flex justify-between items-center min-w-0">
                               <div className="flex flex-col truncate">
                                  <span className={`font-mono ${col.isForeignKey ? 'text-blue-700 font-medium' : 'text-slate-700'}`} title={col.name}>
                                    {col.name}
                                  </span>
                                  {col.isForeignKey && (
                                    <span className="text-[9px] text-blue-400 flex items-center gap-0.5 group-hover:text-blue-600 transition-colors">
                                      <ArrowRight className="w-2 h-2" /> {col.references}
                                    </span>
                                  )}
                               </div>
                               <span className="text-[10px] text-slate-400 ml-2 font-mono shrink-0">{col.type.toLowerCase()}</span>
                            </div>
                          </div>
                         )
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* Legend */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 shrink-0">
        <p className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Selected</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Parent</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Child</span>
        </p>
      </div>
    </div>
  );
};

export default SchemaViewer;
