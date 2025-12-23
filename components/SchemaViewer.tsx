
import React, { useState, useMemo, useEffect, useCallback, memo, useDeferredValue, useRef } from 'react';
import { DatabaseSchema, Table, Column } from '../types';
import { Database, Table as TableIcon, Key, Search, ChevronDown, ChevronRight, Link, ArrowUpRight, ArrowDownLeft, X, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check, Filter, PlusCircle, Target, CornerDownRight, Loader2, ArrowRight, Folder, FolderOpen, Play, Info, Star } from 'lucide-react';

interface SchemaViewerProps {
  schema: DatabaseSchema;
  onRegenerateClick?: () => void;
  loading?: boolean;
  onDescriptionChange?: (tableName: string, newDescription: string) => void;
  selectionMode?: boolean;
  selectedTableIds?: string[];
  onToggleTable?: (tableId: string) => void;
  onPreviewTable?: (tableName: string) => void;
}

type SortField = 'name' | 'type' | 'key';
type SortDirection = 'asc' | 'desc';
type VisualState = 'normal' | 'focused' | 'dimmed' | 'parent' | 'child' | 'target' | 'source';

// Helper to generate unique ID
const getTableId = (t: Table) => `${t.schema || 'public'}.${t.name}`;

// Helper to extract table ID from reference string (schema.table.col or table.col)
const getRefTableId = (ref: string, currentSchema: string) => {
  const parts = ref.split('.');
  if (parts.length === 3) {
    // schema.table.col
    return `${parts[0]}.${parts[1]}`;
  } else if (parts.length === 2) {
    // table.col (legacy/simulated) - assume same schema or public
    return `${currentSchema || 'public'}.${parts[0]}`;
  }
  return '';
};

// --- Sub-component Memoized: SchemaColumnItem ---

interface SchemaColumnItemProps {
  col: Column;
  tableId: string; 
  tableName: string; 
  isHovered: boolean;
  isSelected: boolean; 
  isRelTarget: boolean;
  isRelSource: boolean;
  debouncedTerm: string;
  onHover: (tableId: string, col: string, ref?: string) => void;
  onHoverOut: () => void;
  onClick: (tableId: string, col: string, ref?: string) => void; 
}

const SchemaColumnItem = memo(({ 
  col, tableId, tableName, isHovered, isSelected, isRelTarget, isRelSource, debouncedTerm, onHover, onHoverOut, onClick
}: SchemaColumnItemProps) => {
  const isMatch = debouncedTerm && col.name.toLowerCase().includes(debouncedTerm.toLowerCase());
  
  let bgClass = '';
  let colBadge = null;

  if (isSelected) {
     bgClass = 'bg-indigo-100 dark:bg-indigo-900/40 ring-2 ring-indigo-500 font-bold';
  } else if (isHovered) {
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

  const getTooltip = () => {
    let lines = [`Coluna: ${col.name}`, `Tipo: ${col.type.toUpperCase()}`];
    if (col.isPrimaryKey) lines.push("Constraint: PRIMARY KEY (PK)");
    if (col.isForeignKey) {
       lines.push("Constraint: FOREIGN KEY (FK)");
       lines.push(`References: ${col.references}`);
    }
    if (col.isPrimaryKey || col.isForeignKey) {
       lines.push(`Index: idx_${tableName}_${col.name}`);
    }
    return lines.join('\n');
  };
  
  return (
    <div 
       className={`flex items-center text-xs py-1.5 px-2 rounded group transition-all duration-75 cursor-pointer
          ${bgClass || `text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 ${col.isForeignKey ? 'hover:bg-amber-50 dark:hover:bg-amber-900/20' : ''}`}
          ${isMatch && !bgClass ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}
       `}
       onMouseEnter={() => onHover(tableId, col.name, col.references)}
       onMouseLeave={onHoverOut}
       onClick={(e) => { e.stopPropagation(); onClick(tableId, col.name, col.references); }}
       title={getTooltip()}
    >
      <div className="w-5 mr-1 flex justify-center shrink-0">
        {col.isPrimaryKey && (
          <Key className="w-3.5 h-3.5 text-amber-500 transform rotate-45" />
        )}
      </div>
      <div className="flex-1 flex items-center min-w-0">
         <div className="flex flex-col truncate flex-1">
            <div className="flex items-center">
              <span className={`font-mono truncate ${
                 isRelTarget ? 'text-amber-800 dark:text-amber-200' :
                 isRelSource ? 'text-emerald-800 dark:text-emerald-200' :
                 col.isForeignKey ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300'
              }`}>
                {col.name}
              </span>
              {col.isForeignKey && (
                <span className="flex items-center shrink-0">
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
  );
});

// --- Sub-component Memoized: SchemaTableItem ---

interface SchemaTableItemProps {
  table: Table;
  visualState: VisualState;
  isExpanded: boolean;
  isSelected: boolean;
  isFavorite: boolean;
  selectionMode: boolean;
  editingTable: string | null;
  tempDesc: string;
  debouncedTerm: string;
  selectedTypeFilter: string;
  sortField: SortField;
  sortDirection: SortDirection;
  hoveredColumnKey: string | null; 
  hoveredColumnRef: string | null; 
  selectedColumnKey: string | null; 
  onToggleExpand: (e: React.MouseEvent, tableId: string) => void;
  onTableClick: (tableId: string) => void;
  onMouseEnter: (tableId: string) => void;
  onStartEditing: (e: React.MouseEvent, table: Table) => void;
  onSaveDescription: (e: React.MouseEvent | React.FormEvent, tableName: string) => void;
  onDescChange: (val: string) => void;
  onSetEditing: (name: string | null) => void;
  onSortChange: (field: SortField) => void;
  onColumnHover: (tableId: string, col: string, ref?: string) => void;
  onColumnHoverOut: () => void;
  onColumnClick: (tableId: string, col: string, ref?: string) => void;
  onPreview?: (tableName: string) => void;
  onToggleFavorite: (tableId: string) => void;
}

const SchemaTableItem = memo(({
  table, visualState, isExpanded, isSelected, isFavorite, selectionMode, editingTable, tempDesc, 
  debouncedTerm, selectedTypeFilter, sortField, sortDirection, hoveredColumnKey, hoveredColumnRef, selectedColumnKey,
  onToggleExpand, onTableClick, onMouseEnter, onStartEditing, onSaveDescription, onDescChange, onSetEditing, onSortChange, onColumnHover, onColumnHoverOut, onColumnClick, onPreview, onToggleFavorite
}: SchemaTableItemProps) => {

  const tableId = getTableId(table);
  let containerClass = 'opacity-100 border-l-4 border-l-transparent border-slate-200 dark:border-slate-700 dark:bg-slate-800';
  let label = null;

  switch (visualState) {
    case 'dimmed':
      containerClass = 'opacity-40 grayscale-[0.5] border-slate-100 dark:border-slate-800 dark:bg-slate-900 transition-opacity duration-300';
      break;
    case 'focused':
      containerClass = 'opacity-100 ring-1 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 border-l-4 border-l-indigo-600 shadow-md z-10';
      label = <span className="absolute top-2 right-2 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 rounded shadow-sm">Foco</span>;
      break;
    case 'target':
       containerClass = 'opacity-100 ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 border-l-4 border-l-amber-500 shadow-lg z-10';
       label = <span className="absolute top-2 right-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm"><Target className="w-3 h-3" /> Alvo do Link</span>;
       break;
    case 'source':
        containerClass = 'opacity-100 ring-1 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 border-l-4 border-l-indigo-600 shadow-md z-10';
        label = <span className="absolute top-2 right-2 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 rounded shadow-sm">Origem</span>;
        break;
    case 'parent':
      containerClass = 'opacity-100 border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 border-l-4 border-l-amber-400 shadow-sm';
      label = <span className="absolute top-2 right-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm"><ArrowUpRight className="w-3 h-3" /> Pai (Referenciado)</span>;
      break;
    case 'child':
      containerClass = 'opacity-100 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 border-l-4 border-l-emerald-400 shadow-sm';
      label = <span className="absolute top-2 right-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm"><ArrowDownLeft className="w-3 h-3" /> Filho (Referencia)</span>;
      break;
    case 'normal':
      if (selectionMode && isSelected) {
        containerClass = 'opacity-100 border-l-4 border-l-indigo-600 border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-800 z-10';
      }
      break;
  }

  const getColumns = () => {
    let cols = [...table.columns];
    if (selectedTypeFilter) cols = cols.filter(c => c.type.toUpperCase().includes(selectedTypeFilter));
    if (sortField) {
        cols.sort((a, b) => {
          let valA: any = '', valB: any = '';
          switch (sortField) {
            case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
            case 'type': valA = a.type.toLowerCase(); valB = b.type.toLowerCase(); break;
            case 'key': 
              valA = (a.isPrimaryKey ? 2 : 0) + (a.isForeignKey ? 1 : 0);
              valB = (b.isPrimaryKey ? 2 : 0) + (b.isForeignKey ? 1 : 0);
              if (sortDirection === 'asc') return valB - valA;
              else return valA - valB;
          }
          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        });
    }
    return cols;
  };

  const isEditing = editingTable === table.name;
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />;
  };

  return (
    <div 
      className={`border rounded-lg transition-all duration-200 relative group/table ${containerClass} ${isExpanded ? 'bg-white dark:bg-slate-800' : ''} ${!isSelected && visualState === 'normal' ? 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700' : ''}`}
      onMouseEnter={() => onMouseEnter(tableId)}
    >
      {label}
      <div 
        className={`flex items-center gap-2 p-3 cursor-pointer ${selectionMode && !isSelected ? 'hover:bg-slate-50 dark:hover:bg-slate-700' : ''}`}
        onClick={() => onTableClick(tableId)}
      >
        {selectionMode && (
          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}`}>
             {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </div>
        )}
        <div onClick={(e) => onToggleExpand(e, tableId)} className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 shrink-0">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
        <TableIcon className={`w-4 h-4 shrink-0 ${isSelected || isExpanded ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
        <div className="flex-1 min-w-0 pr-2">
           <div className="flex items-center gap-2">
              <span className={`font-medium text-sm truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-700 dark:text-slate-200'}`}>{table.name}</span>
              <button 
                 onClick={(e) => { e.stopPropagation(); onToggleFavorite(tableId); }}
                 className={`p-1 rounded opacity-0 group-hover/table:opacity-100 transition-opacity ${isFavorite ? 'opacity-100 text-amber-400 hover:text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                 title={isFavorite ? "Remover dos favoritos" : "Favoritar tabela"}
              >
                 <Star className={`w-3 h-3 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
              {onPreview && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onPreview(table.name); }}
                  className="p-1 text-slate-400 hover:text-emerald-500 hover:bg-emerald-900/20 rounded opacity-0 group-hover/table:opacity-100 transition-opacity"
                  title="Visualizar 10 primeiros registros"
                >
                  <Play className="w-3 h-3 fill-current" />
                </button>
              )}
           </div>
           <div className="flex items-center gap-2 mt-0.5 min-h-[16px]">
              {isEditing ? (
                 <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                   <input 
                     type="text" 
                     value={tempDesc}
                     onChange={(e) => onDescChange(e.target.value)}
                     className="w-full text-xs bg-slate-100 dark:bg-slate-700 border border-indigo-300 dark:border-indigo-500 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                     autoFocus
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') onSaveDescription(e, table.name);
                       if (e.key === 'Escape') onSetEditing(null);
                     }}
                   />
                   <button onClick={(e) => onSaveDescription(e, table.name)} className="p-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-200"><Check className="w-3 h-3" /></button>
                 </div>
              ) : (
                 <div className="flex items-center gap-2 group/desc max-w-full relative">
                    <p 
                      className={`text-[10px] truncate max-w-[180px] cursor-text ${table.description ? 'text-slate-400 dark:text-slate-500' : 'text-indigo-400/70 italic hover:text-indigo-500'}`} 
                      title={table.description || "Adicionar descrição"}
                      onClick={(e) => { if (!table.description) onStartEditing(e, table); }}
                    >
                      {table.description || (<span className="flex items-center gap-1"><PlusCircle className="w-3 h-3" /> Adicionar descrição...</span>)}
                    </p>
                    {table.description && (
                      <button onClick={(e) => onStartEditing(e, table)} className="opacity-0 group-hover/desc:opacity-100 p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-600 transition-all absolute right-0 bg-white dark:bg-slate-800 shadow-sm"><Pencil className="w-2.5 h-2.5" /></button>
                    )}
                 </div>
              )}
           </div>
        </div>
      </div>
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-slate-50 dark:border-slate-700/50">
          <div className="flex gap-2 py-2 mb-1 border-b border-slate-50 dark:border-slate-700/50 justify-end">
             <button onClick={() => onSortChange('name')} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700">Nome <SortIcon field="name" /></button>
             <button onClick={() => onSortChange('type')} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700">Tipo <SortIcon field="type" /></button>
             <button onClick={() => onSortChange('key')} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700">Chave <SortIcon field="key" /></button>
          </div>
          <div className="space-y-0.5">
            {getColumns().map((col) => {
               const colKey = `${tableId}.${col.name}`;
               const isHovered = hoveredColumnKey === colKey;
               const isSelected = selectedColumnKey === colKey;
               const activeRef = selectedColumnKey ? (hoveredColumnRef || null) : hoveredColumnRef;
               const activeKey = selectedColumnKey || hoveredColumnKey;
               let isRelTarget = false;
               if (activeRef) {
                 const refParts = activeRef.split('.');
                 if (refParts.length === 3) isRelTarget = activeRef === colKey;
                 else isRelTarget = activeRef === `${table.name}.${col.name}`;
               }
               let isRelSource = false;
               if (col.references && activeKey) {
                  const refParts = col.references.split('.');
                  if (refParts.length === 3) isRelSource = col.references === activeKey;
                  else {
                     const [targetTable, targetCol] = refParts;
                     const [hSchema, hTable, hCol] = activeKey.split('.');
                     isRelSource = (targetTable === hTable && targetCol === hCol);
                  }
               } else if (activeRef && activeRef === colKey) isRelSource = true;
               return (
                 <SchemaColumnItem 
                   key={col.name} 
                   col={col} 
                   tableId={tableId}
                   tableName={table.name} 
                   isHovered={isHovered} 
                   isSelected={isSelected}
                   isRelTarget={isRelTarget} 
                   isRelSource={isRelSource} 
                   debouncedTerm={debouncedTerm}
                   onHover={onColumnHover}
                   onHoverOut={onColumnHoverOut}
                   onClick={onColumnClick}
                 />
               );
            })}
          </div>
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  return prev.table.name === next.table.name &&
         getTableId(prev.table) === getTableId(next.table) &&
         prev.visualState === next.visualState &&
         prev.isExpanded === next.isExpanded &&
         prev.isSelected === next.isSelected &&
         prev.isFavorite === next.isFavorite &&
         prev.editingTable === next.editingTable &&
         prev.tempDesc === next.tempDesc &&
         prev.hoveredColumnKey === next.hoveredColumnKey &&
         prev.hoveredColumnRef === next.hoveredColumnRef &&
         prev.selectedColumnKey === next.selectedColumnKey &&
         prev.sortField === next.sortField &&
         prev.sortDirection === next.sortDirection &&
         prev.debouncedTerm === next.debouncedTerm &&
         prev.selectedTypeFilter === next.selectedTypeFilter;
});

// --- Main Component ---

const SchemaViewer: React.FC<SchemaViewerProps> = ({ 
  schema, onRegenerateClick, loading = false, onDescriptionChange,
  selectionMode = false, selectedTableIds = [], onToggleTable, onPreviewTable
}) => {
  const [inputValue, setInputValue] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('key');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [expandedTables, setExpandedTables] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`psql-buddy-viewer-tables-${schema.name}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`psql-buddy-viewer-schemas-${schema.name}`);
      return stored ? new Set(JSON.parse(stored)) : new Set(['public']);
    } catch { return new Set(['public']); }
  });

  const [favoriteTables, setFavoriteTables] = useState<Set<string>>(() => {
     try {
        const stored = localStorage.getItem(`psql-buddy-favorites-${schema.name}`);
        return stored ? new Set(JSON.parse(stored)) : new Set();
     } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem(`psql-buddy-viewer-tables-${schema.name}`, JSON.stringify(Array.from(expandedTables)));
  }, [expandedTables, schema.name]);

  useEffect(() => {
    localStorage.setItem(`psql-buddy-viewer-schemas-${schema.name}`, JSON.stringify(Array.from(expandedSchemas)));
  }, [expandedSchemas, schema.name]);

  useEffect(() => {
     localStorage.setItem(`psql-buddy-favorites-${schema.name}`, JSON.stringify(Array.from(favoriteTables)));
  }, [favoriteTables, schema.name]);

  useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
           e.preventDefault();
           inputRef.current?.focus();
        }
     };
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [tempDesc, setTempDesc] = useState('');
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [hoveredColumnKey, setHoveredColumnKey] = useState<string | null>(null);
  const [hoveredColumnRef, setHoveredColumnRef] = useState<string | null>(null);
  const [selectedColumnKey, setSelectedColumnKey] = useState<string | null>(null);

  const deferredHoveredTableId = useDeferredValue(hoveredTableId);
  const deferredHoveredColumnRef = useDeferredValue(hoveredColumnRef);
  const deferredHoveredColumnKey = useDeferredValue(hoveredColumnKey);
  const deferredSelectedColumnKey = useDeferredValue(selectedColumnKey);

  const [renderLimit, setRenderLimit] = useState(40);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const relationshipGraph = useMemo(() => {
    const parents: Record<string, Set<string>> = {};
    const children: Record<string, Set<string>> = {};
    schema.tables.forEach(table => {
      const tableId = getTableId(table);
      if (!parents[tableId]) parents[tableId] = new Set();
      if (!children[tableId]) children[tableId] = new Set();
      table.columns.forEach(col => {
        if (col.isForeignKey && col.references) {
          const refTableId = getRefTableId(col.references, table.schema);
          if (refTableId && refTableId !== tableId) {
             const exists = schema.tables.some(t => getTableId(t) === refTableId);
             if (exists) {
                if (!parents[tableId]) parents[tableId] = new Set();
                parents[tableId].add(refTableId);
                if (!children[refTableId]) children[refTableId] = new Set();
                children[refTableId].add(tableId);
             }
          }
        }
      });
    });
    return { parents, children };
  }, [schema.name]); 

  useEffect(() => {
    const timer = setTimeout(() => {
       setDebouncedTerm(inputValue);
       setRenderLimit(40); 
       if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
       if (inputValue) setExpandedSchemas(new Set(schema.tables.map(t => t.schema || 'public')));
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, schema.tables]);

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 300) {
        setRenderLimit(prev => Math.min(prev + 20, schema.tables.length));
      }
    }
  }, [schema.tables.length]);

  const allColumnTypes = useMemo(() => {
    const types = new Set<string>();
    schema.tables.forEach(t => t.columns.forEach(c => {
      const simpleType = c.type.split('(')[0].toUpperCase();
      types.add(simpleType);
    }));
    return Array.from(types).sort();
  }, [schema.name]);

  const filteredTables = useMemo(() => {
    const term = debouncedTerm.toLowerCase().trim();
    let tables = schema.tables;
    if (term || selectedTypeFilter) {
      tables = tables.filter(table => {
        const nameMatch = !term || table.name.toLowerCase().includes(term);
        const descMatch = !term || (table.description && table.description.toLowerCase().includes(term));
        const colMatch = !term || table.columns.some(col => col.name.toLowerCase().includes(term));
        const matchesSearch = nameMatch || descMatch || colMatch;
        let matchesType = true;
        if (selectedTypeFilter) matchesType = table.columns.some(col => col.type.toUpperCase().includes(selectedTypeFilter));
        return matchesSearch && matchesType;
      });
    }
    const sorted = [...tables];
    sorted.sort((a, b) => {
      if (term) {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA === term && nameB !== term) return -1;
        if (nameB === term && nameA !== term) return 1;
        const startsA = nameA.startsWith(term);
        const startsB = nameB.startsWith(term);
        if (startsA && !startsB) return -1;
        if (!startsA && startsB) return 1;
        const includesA = nameA.includes(term);
        const includesB = nameB.includes(term);
        if (includesA && !includesB) return -1;
        if (!includesA && includesB) return 1;
      }
      const idA = getTableId(a);
      const idB = getTableId(b);
      const isSelA = selectedTableIds.includes(idA);
      const isSelB = selectedTableIds.includes(idB);
      if (!term) {
        if (isSelA && !isSelB) return -1;
        if (!isSelA && isSelB) return 1;
      }
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [schema.tables, debouncedTerm, selectedTypeFilter, selectedTableIds]);

  const groupedTables = useMemo(() => {
    const groups: Record<string, Table[]> = {};
    const visible = filteredTables.slice(0, renderLimit);
    const showFavorites = !debouncedTerm && favoriteTables.size > 0;

    if (showFavorites) groups['__favorites__'] = [];

    visible.forEach(table => {
      const s = table.schema || 'public';
      const tId = getTableId(table);
      
      // Se for favorita, move para a seção de favoritos e remove da seção original
      if (showFavorites && favoriteTables.has(tId)) {
         groups['__favorites__'].push(table);
      } else {
         if (!groups[s]) groups[s] = [];
         groups[s].push(table);
      }
    });
    if (showFavorites && groups['__favorites__'].length === 0) delete groups['__favorites__'];
    return groups;
  }, [filteredTables, renderLimit, debouncedTerm, favoriteTables]);

  const sortedSchemas = useMemo(() => {
     const schemas = Object.keys(groupedTables);
     
     // Sempre prioriza os favoritos acima de tudo
     return schemas.sort((a, b) => {
        if (a === '__favorites__') return -1;
        if (b === '__favorites__') return 1;
        
        if (debouncedTerm) {
            // Se houver busca, mantém a lógica de rank por relevância após os favoritos
            const findRank = (s: string) => {
               const idx = filteredTables.findIndex(t => (t.schema || 'public') === s);
               return idx === -1 ? Infinity : idx;
            };
            return findRank(a) - findRank(b);
        }
        
        return a.localeCompare(b);
     });
  }, [groupedTables, filteredTables, debouncedTerm]);

  const handleToggleExpand = useCallback((e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    setExpandedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableId)) newSet.delete(tableId); else newSet.add(tableId);
      return newSet;
    });
  }, []);

  const handleToggleSchema = useCallback((schemaName: string) => {
    if (schemaName === '__favorites__') {
       // Se clicar no título de favoritos, rola até o topo
       scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
       return; 
    }
    setExpandedSchemas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(schemaName)) newSet.delete(schemaName); else newSet.add(schemaName);
      return newSet;
    });
  }, []);

  const handleTableClick = useCallback((tableId: string) => {
    if (selectionMode && onToggleTable) {
      onToggleTable(tableId);
    } else {
      setExpandedTables(prev => {
        const newSet = new Set(prev);
        if (newSet.has(tableId)) newSet.delete(tableId); else newSet.add(tableId);
        return newSet;
      });
    }
  }, [selectionMode, onToggleTable]);

  const handleMouseEnterTable = useCallback((tableId: string) => {
    setHoveredTableId(tableId);
  }, []);

  const handleColumnHover = useCallback((tableId: string, col: string, ref?: string) => {
     setHoveredColumnKey(`${tableId}.${col}`);
     setHoveredColumnRef(ref || null);
     if (ref) {
       const refTableId = getRefTableId(ref, tableId.split('.')[0]); 
       if (refTableId) setHoveredTableId(refTableId);
     } else setHoveredTableId(tableId);
  }, []);

  const handleColumnHoverOut = useCallback(() => {
     setHoveredColumnKey(null);
     setHoveredColumnRef(null);
  }, []);

  const handleColumnClick = useCallback((tableId: string, col: string, ref?: string) => {
     const colKey = `${tableId}.${col}`;
     if (selectedColumnKey === colKey) setSelectedColumnKey(null);
     else {
        setSelectedColumnKey(colKey);
        setHoveredColumnKey(colKey);
        setHoveredColumnRef(ref || null);
     }
  }, [selectedColumnKey]);

  const handleStartEditing = useCallback((e: React.MouseEvent, table: Table) => {
    e.stopPropagation();
    setEditingTable(table.name);
    setTempDesc(table.description || '');
  }, []);

  const handleSaveDescription = useCallback((e: React.MouseEvent | React.FormEvent, tableName: string) => {
    e.stopPropagation(); e.preventDefault();
    if (onDescriptionChange) onDescriptionChange(tableName, tempDesc);
    setEditingTable(null);
  }, [onDescriptionChange, tempDesc]);

  const handleSortChange = useCallback((field: SortField) => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  }, [sortField]);

  const handleDescChange = useCallback((val: string) => setTempDesc(val), []);
  const handleSetEditing = useCallback((name: string | null) => setEditingTable(name), []);
  
  const handleToggleFavorite = useCallback((tableId: string) => {
     setFavoriteTables(prev => {
        const newSet = new Set(prev);
        if (newSet.has(tableId)) newSet.delete(tableId);
        else newSet.add(tableId);
        return newSet;
     });
  }, []);

  const expandAll = () => {
     setExpandedTables(new Set(filteredTables.map(t => getTableId(t))));
     setExpandedSchemas(new Set(schema.tables.map(t => t.schema || 'public')));
  };
  const collapseAll = () => {
     setExpandedTables(new Set());
     setExpandedSchemas(new Set());
  };

  const visualStateMap = useMemo(() => {
    const map = new Map<string, VisualState>();
    const activeColumnKey = deferredSelectedColumnKey || deferredHoveredColumnKey;
    const activeColumnRef = deferredSelectedColumnKey ? (deferredSelectedColumnKey === deferredHoveredColumnKey ? deferredHoveredColumnRef : null) : deferredHoveredColumnRef;
    const activeTableId = deferredSelectedColumnKey ? (activeColumnKey?.split('.')[0] + '.' + activeColumnKey?.split('.')[1]) : deferredHoveredTableId;
    if (!activeTableId && !activeColumnRef) return map;
    if (activeColumnKey) {
       const [s, t, c] = activeColumnKey.split('.');
       const sourceTableId = `${s}.${t}`;
       schema.tables.forEach(table => {
          const tId = getTableId(table);
          if (activeColumnRef) {
             const parts = activeColumnRef.split('.');
             let isTarget = false;
             if (parts.length === 3) {
                if (parts[0] === table.schema && parts[1] === table.name) isTarget = true;
             } else if (parts[0] === table.name) isTarget = true;
             if (isTarget) map.set(tId, 'target');
          }
          table.columns.forEach(col => {
             if (col.references) {
                const parts = col.references.split('.');
                let pointsToActive = false;
                if (parts.length === 3) {
                   if (`${parts[0]}.${parts[1]}.${parts[2]}` === activeColumnKey) pointsToActive = true;
                } else if (`${parts[0]}.${parts[1]}` === `${t}.${c}`) pointsToActive = true;
                if (pointsToActive) map.set(tId, 'child'); 
             }
          });
       });
       if (activeColumnRef) map.set(sourceTableId, 'source');
       else map.set(sourceTableId, 'focused');
       return map;
    }
    if (activeTableId) {
       map.set(activeTableId, 'focused');
       const parents = relationshipGraph.parents[activeTableId];
       if (parents) parents.forEach(p => map.set(p, 'parent'));
       const children = relationshipGraph.children[activeTableId];
       if (children) children.forEach(c => map.set(c, 'child'));
    }
    return map;
  }, [deferredHoveredTableId, deferredHoveredColumnRef, deferredHoveredColumnKey, deferredSelectedColumnKey, relationshipGraph, schema.tables]);

  const getTableState = (tableId: string): VisualState => {
     if (visualStateMap.size === 0) return 'normal';
     if (visualStateMap.has(tableId)) return visualStateMap.get(tableId)!;
     return 'dimmed';
  };

  return (
    <div id="schema-viewer-container" className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-hidden select-none" onClick={() => setSelectedColumnKey(null)}>
      {!selectionMode && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <span title="Database Schema" className="flex items-center"><Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></span>
            <div className="overflow-hidden">
              <h2 className="font-semibold text-sm uppercase tracking-wider truncate max-w-[120px]" title={schema.name}>{loading ? 'Carregando...' : schema.name}</h2>
              <p className="text-[10px] text-slate-400">{schema.tables.length} tabelas</p>
            </div>
          </div>
          {onRegenerateClick && (
            <button onClick={onRegenerateClick} disabled={loading} className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline disabled:opacity-50">Mudar BD</button>
          )}
        </div>
      )}
      <div className={`p-2 border-b border-slate-100 dark:border-slate-800 shrink-0 space-y-2 ${selectionMode ? 'bg-slate-50 dark:bg-slate-900' : ''}`}>
        <div className="flex gap-2">
           <div className="relative flex-1">
             <Search className={`absolute left-3 top-2.5 w-4 h-4 ${inputValue !== debouncedTerm ? 'text-indigo-400 animate-pulse' : 'text-slate-400'}`} />
             <input
               ref={inputRef}
               type="text" placeholder="Buscar tabelas... (Ctrl+K)" value={inputValue} onChange={(e) => setInputValue(e.target.value)} disabled={loading}
               className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-700 dark:text-slate-200 placeholder-slate-400"
             />
             {inputValue && <button onClick={() => setInputValue('')} className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-3 h-3" /></button>}
           </div>
           <div className="relative">
             <div className="absolute left-2 top-2 pointer-events-none"><Filter className={`w-4 h-4 ${selectedTypeFilter ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} /></div>
             <select value={selectedTypeFilter} onChange={(e) => { setSelectedTypeFilter(e.target.value); setRenderLimit(40); }} className={`w-[100px] h-full pl-8 pr-2 py-2 border rounded text-xs outline-none appearance-none cursor-pointer font-medium ${selectedTypeFilter ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                <option value="">Tipos</option>
                {allColumnTypes.map(t => <option key={t} value={t}>{t}</option>)}
             </select>
           </div>
        </div>
        <div className="flex justify-between items-center px-1">
           <span className="text-[10px] text-slate-400 font-medium">{filteredTables.length} tabelas {filteredTables.length > renderLimit && `(Exibindo ${renderLimit})`}</span>
           <div className="flex gap-2">
             <button onClick={expandAll} className="text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">Expandir</button>
             <button onClick={collapseAll} className="text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">Recolher</button>
           </div>
        </div>
      </div>
      <div 
         ref={scrollContainerRef}
         onScroll={handleScroll}
         className="flex-1 overflow-y-auto p-2 space-y-2 relative scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700" 
         onMouseLeave={() => { setHoveredTableId(null); setHoveredColumnKey(null); setHoveredColumnRef(null); }}
      >
        {loading ? (
          <div className="space-y-4 animate-pulse">{[1, 2, 3, 4].map((i) => <div key={i} className="space-y-2 border border-slate-100 dark:border-slate-700 rounded-lg p-3"><div className="flex items-center gap-2"><div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded"></div><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div></div></div>)}</div>
        ) : filteredTables.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs italic">Nenhuma tabela encontrada.</div>
        ) : (
          <>
            {sortedSchemas.map(schemaName => {
               const tablesInSchema = groupedTables[schemaName];
               if (!tablesInSchema || tablesInSchema.length === 0) return null;
               const isFavoritesGroup = schemaName === '__favorites__';
               const isSchemaExpanded = isFavoritesGroup ? true : expandedSchemas.has(schemaName);
               return (
                  <div key={schemaName} className="mb-2">
                     <div 
                        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded select-none group sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-transparent ${isSchemaExpanded ? 'border-slate-100 dark:border-slate-800' : ''}`}
                        onClick={() => handleToggleSchema(schemaName)}
                     >
                        {isFavoritesGroup ? (
                           <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        ) : (
                           isSchemaExpanded ? 
                              <FolderOpen className="w-4 h-4 text-indigo-500 dark:text-indigo-400 fill-indigo-100 dark:fill-indigo-900/30" /> : 
                              <Folder className="w-4 h-4 text-slate-400 fill-slate-100 dark:fill-slate-800" />
                        )}
                        <span className={`text-xs font-bold ${isFavoritesGroup ? 'text-amber-600 dark:text-amber-400' : isSchemaExpanded ? 'text-indigo-800 dark:text-indigo-200' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`}>
                           {isFavoritesGroup ? '⭐ Favoritas' : schemaName}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-auto bg-slate-50 dark:bg-slate-800 px-1.5 rounded-full border border-slate-100 dark:border-slate-700">
                           {tablesInSchema.length}
                        </span>
                     </div>
                     {isSchemaExpanded && (
                        <div className="pl-3 pr-1 pt-1 space-y-2 border-l border-slate-100 dark:border-slate-800 ml-2">
                           {tablesInSchema.map((table, index) => {
                              const tableId = getTableId(table);
                              const isSelected = selectedTableIds.includes(tableId);
                              const prevTable = index > 0 ? tablesInSchema[index-1] : null;
                              const showSeparator = !debouncedTerm && !isFavoritesGroup && prevTable && selectedTableIds.includes(getTableId(prevTable)) && !isSelected;
                              return (
                                 <React.Fragment key={`${schemaName}-${tableId}`}>
                                    {showSeparator && (
                                       <div className="flex items-center gap-3 py-2 px-1 animate-in fade-in duration-300">
                                          <div className="h-px bg-slate-200 dark:bg-slate-700/50 flex-1"></div>
                                          <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-wider">Outras</span>
                                          <div className="h-px bg-slate-200 dark:bg-slate-700/50 flex-1"></div>
                                       </div>
                                    )}
                                    <SchemaTableItem
                                       table={table}
                                       visualState={getTableState(tableId)}
                                       isExpanded={expandedTables.has(tableId)}
                                       isSelected={isSelected}
                                       isFavorite={favoriteTables.has(tableId)}
                                       selectionMode={selectionMode}
                                       editingTable={editingTable}
                                       tempDesc={tempDesc}
                                       debouncedTerm={debouncedTerm}
                                       selectedTypeFilter={selectedTypeFilter}
                                       sortField={sortField}
                                       sortDirection={sortDirection}
                                       hoveredColumnKey={deferredHoveredColumnKey}
                                       hoveredColumnRef={deferredHoveredColumnRef}
                                       selectedColumnKey={deferredSelectedColumnKey}
                                       onToggleExpand={handleToggleExpand}
                                       onTableClick={handleTableClick}
                                       onMouseEnter={handleMouseEnterTable}
                                       onStartEditing={handleStartEditing}
                                       onSaveDescription={handleSaveDescription}
                                       onDescChange={handleDescChange}
                                       onSetEditing={handleSetEditing}
                                       onSortChange={handleSortChange}
                                       onColumnHover={handleColumnHover}
                                       onColumnHoverOut={handleColumnHoverOut}
                                       onColumnClick={handleColumnClick}
                                       onPreview={onPreviewTable}
                                       onToggleFavorite={handleToggleFavorite}
                                    />
                                 </React.Fragment>
                              );
                           })}
                        </div>
                     )}
                  </div>
               );
            })}
            {/* O indicador de carregamento agora só aparece se houver algo expandido ou busca ativa */}
            {filteredTables.length > renderLimit && (expandedSchemas.size > 0 || debouncedTerm) && (
              <div className="py-4 text-center text-slate-400 flex items-center justify-center gap-2">
                 <Loader2 className="w-4 h-4 animate-spin" />
                 <span className="text-xs">Carregando mais tabelas...</span>
              </div>
            )}
          </>
        )}
      </div>
      <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
        <p className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Sel</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Pai/Alvo</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Filho/Ref</span>
        </p>
        <p className="text-[9px] text-slate-400 mt-1">Clique nas colunas para fixar o destaque de relacionamento.</p>
      </div>
    </div>
  );
};

export default SchemaViewer;
