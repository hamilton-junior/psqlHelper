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

const getTableId = (t: any) => `${t.schema || 'public'}.${t.name}`;

const getRefTableId = (ref: string, currentSchema: string) => {
  const parts = ref.split('.');
  if (parts.length === 3) return `${parts[0]}.${parts[1]}`;
  if (parts.length === 2) return `${currentSchema || 'public'}.${parts[0]}`;
  return '';
};

const SchemaColumnItem = memo(({ col, tableId, isHovered, isSelected, isRelTarget, isRelSource, debouncedTerm, onHover, onHoverOut, onClick }: any) => {
  const isMatch = debouncedTerm && col.name.toLowerCase().includes(debouncedTerm.toLowerCase());
  let bgClass = isSelected ? 'bg-indigo-900/40 ring-2 ring-indigo-500 font-bold' : isHovered ? 'bg-slate-700 ring-1 ring-slate-500' : isRelTarget ? 'bg-amber-900/40 ring-1 ring-amber-400 font-bold' : isRelSource ? 'bg-emerald-900/40 ring-1 ring-emerald-400 font-bold' : '';

  return (
    <div className={`flex items-center text-xs py-1.5 px-2 rounded group transition-all duration-75 cursor-pointer ${bgClass || `text-slate-300 hover:bg-slate-700 ${col.isForeignKey ? 'hover:bg-amber-900/20' : ''}`} ${isMatch && !bgClass ? 'bg-yellow-900/20' : ''}`} onMouseEnter={() => onHover(tableId, col.name, col.references)} onMouseLeave={onHoverOut} onClick={e => { e.stopPropagation(); onClick(tableId, col.name, col.references); }}>
      <div className="w-5 flex justify-center shrink-0">{col.isPrimaryKey && <Key className="w-3.5 h-3.5 text-amber-500 transform rotate-45" />}</div>
      <div className="flex-1 flex items-center min-w-0">
         <div className="flex flex-col truncate flex-1">
            <div className="flex items-center"><span className={`font-mono truncate ${isRelTarget ? 'text-amber-200' : isRelSource ? 'text-emerald-200' : col.isForeignKey ? 'text-blue-400 font-medium' : 'text-slate-300'}`}>{col.name}</span>{col.isForeignKey && <Link className="w-3 h-3 ml-1.5 opacity-70" />}</div>
            {col.isForeignKey && !isRelSource && <span className="text-[9px] flex items-center gap-0.5 mt-0.5 truncate text-blue-400 opacity-60"><ArrowRight className="w-2 h-2" /> {col.references}</span>}
         </div>
         <span className="text-[10px] text-slate-500 ml-2 font-mono shrink-0">{col.type.toLowerCase()}</span>
      </div>
    </div>
  );
});

const SchemaTableItem = memo(({ table, visualState, isExpanded, isSelected, isFavorite, selectionMode, editingTable, tempDesc, debouncedTerm, selectedTypeFilter, sortField, sortDirection, hoveredColumnKey, hoveredColumnRef, selectedColumnKey, onToggleExpand, onTableClick, onMouseEnter, onStartEditing, onSaveDescription, onDescChange, onSetEditing, onSortChange, onColumnHover, onColumnHoverOut, onColumnClick, onPreview, onToggleFavorite }: any) => {
  const tableId = getTableId(table);
  let containerClass = visualState === 'dimmed' ? 'opacity-40 grayscale-[0.5] border-slate-800 bg-slate-900' : visualState === 'focused' || visualState === 'source' ? 'ring-1 ring-indigo-500 bg-indigo-900/20 border-l-4 border-l-indigo-600 shadow-md' : visualState === 'target' ? 'ring-2 ring-amber-400 bg-amber-900/20 border-l-4 border-l-amber-500 shadow-lg' : visualState === 'parent' ? 'border-amber-800 bg-amber-900/10 border-l-4 border-l-amber-400' : visualState === 'child' ? 'border-emerald-800 bg-emerald-900/10 border-l-4 border-l-emerald-400' : (selectionMode && isSelected) ? 'border-l-4 border-l-indigo-600 border-indigo-700 bg-indigo-900/30' : 'border-l-4 border-l-transparent border-slate-700 bg-slate-800';

  const isEditing = editingTable === table.name;
  return (
    <div className={`border rounded-lg transition-all duration-200 relative group/table ${containerClass} ${!isSelected && visualState === 'normal' ? 'hover:bg-slate-700' : ''}`} onMouseEnter={() => onMouseEnter(tableId)}>
      <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => onTableClick(tableId)}>
        {selectionMode && <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600 bg-slate-800'}`}>{isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}</div>}
        <div onClick={e => { e.stopPropagation(); onToggleExpand(e, tableId); }} className="p-0.5 hover:bg-slate-700 rounded text-slate-500 shrink-0">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</div>
        <TableIcon className={`w-4 h-4 shrink-0 ${isSelected || isExpanded ? 'text-indigo-400' : 'text-slate-500'}`} />
        <div className="flex-1 min-w-0 pr-2">
           <div className="flex items-center gap-2">
              <span className={`font-medium text-sm truncate ${isSelected ? 'text-indigo-300 font-bold' : 'text-slate-200'}`}>{table.name}</span>
              <button onClick={e => { e.stopPropagation(); onToggleFavorite(tableId); }} className={`p-1 rounded transition-opacity ${isFavorite ? 'opacity-100 text-amber-400' : 'opacity-0 group-hover/table:opacity-100 text-slate-600 hover:text-amber-400'}`}><Star className={`w-3 h-3 ${isFavorite ? 'fill-current' : ''}`} /></button>
              {onPreview && <button onClick={e => { e.stopPropagation(); onPreview(table.name); }} className="p-1 text-slate-500 hover:text-emerald-400 opacity-0 group-hover/table:opacity-100"><Play className="w-3 h-3 fill-current" /></button>}
           </div>
           {!isEditing && <p className="text-[10px] truncate text-slate-500 cursor-text" onClick={e => { e.stopPropagation(); onStartEditing(e, table); }}>{table.description || 'Adicionar descrição...'}</p>}
           {isEditing && <input type="text" value={tempDesc} onChange={e => onDescChange(e.target.value)} className="w-full text-xs bg-slate-700 rounded px-1 text-slate-200 outline-none" autoFocus onBlur={e => onSaveDescription(e, table.name)} onKeyDown={e => e.key === 'Enter' && onSaveDescription(e, table.name)} />}
        </div>
      </div>
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-slate-700/50 space-y-0.5">
          {table.columns.map((col: any) => {
             const colKey = `${tableId}.${col.name}`;
             return <SchemaColumnItem key={col.name} col={col} tableId={tableId} isHovered={hoveredColumnKey === colKey} isSelected={selectedColumnKey === colKey} isRelTarget={hoveredColumnRef === colKey || hoveredColumnRef === `${table.name}.${col.name}`} isRelSource={col.references && (selectedColumnKey || hoveredColumnKey) && (col.references === (selectedColumnKey || hoveredColumnKey))} debouncedTerm={debouncedTerm} onHover={onColumnHover} onHoverOut={onColumnHoverOut} onClick={onColumnClick} />;
          })}
        </div>
      )}
    </div>
  );
});

const SchemaViewer: React.FC<SchemaViewerProps> = ({ schema, onRegenerateClick, loading = false, onDescriptionChange, selectionMode = false, selectedTableIds = [], onToggleTable, onPreviewTable }) => {
  const [inputValue, setInputValue] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('key');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set(['public']));
  const [favoriteTables, setFavoriteTables] = useState<Set<string>>(() => {
     try {
        const stored = localStorage.getItem(`psql-buddy-favorites-${schema.name}`);
        return stored ? new Set(JSON.parse(stored)) : new Set();
     } catch { return new Set(); }
  });

  useEffect(() => { localStorage.setItem(`psql-buddy-favorites-${schema.name}`, JSON.stringify(Array.from(favoriteTables))); }, [favoriteTables, schema.name]);

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

  const relationshipGraph = useMemo(() => {
    const parents: Record<string, Set<string>> = {};
    const children: Record<string, Set<string>> = {};
    schema.tables.forEach(table => {
      const tId = getTableId(table);
      if (!parents[tId]) parents[tId] = new Set();
      if (!children[tId]) children[tId] = new Set();
      table.columns.forEach(col => {
        if (col.isForeignKey && col.references) {
          const refTableId = getRefTableId(col.references, table.schema);
          if (refTableId && refTableId !== tId && schema.tables.some(t => getTableId(t) === refTableId)) {
             parents[tId].add(refTableId);
             if (!children[refTableId]) children[refTableId] = new Set();
             children[refTableId].add(tId);
          }
        }
      });
    });
    return { parents, children };
  }, [schema.tables]);

  useEffect(() => {
    const timer = setTimeout(() => {
       setDebouncedTerm(inputValue);
       if (inputValue) setExpandedSchemas(new Set(schema.tables.map(t => t.schema || 'public')));
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, schema.tables]);

  const allColumnTypes = useMemo(() => {
    const types = new Set<string>();
    schema.tables.forEach(t => t.columns.forEach(c => types.add(c.type.split('(')[0].toUpperCase())));
    return Array.from(types).sort();
  }, [schema.tables]);

  const filteredTables = useMemo(() => {
    const term = debouncedTerm.toLowerCase().trim();
    let tables = schema.tables;
    if (term || selectedTypeFilter) {
      tables = tables.filter(table => {
        const matchesSearch = !term || table.name.toLowerCase().includes(term) || table.columns.some(col => col.name.toLowerCase().includes(term));
        const matchesType = !selectedTypeFilter || table.columns.some(col => col.type.toUpperCase().includes(selectedTypeFilter));
        return matchesSearch && matchesType;
      });
    }
    return [...tables].sort((a, b) => a.name.localeCompare(b.name));
  }, [schema.tables, debouncedTerm, selectedTypeFilter]);

  const groupedTables = useMemo(() => {
    const groups: Record<string, Table[]> = {};
    
    if (favoriteTables.size > 0) groups['__favorites__'] = [];

    filteredTables.forEach(table => {
      const tId = getTableId(table);
      if (favoriteTables.has(tId)) {
         groups['__favorites__'].push(table);
      } else {
         const s = table.schema || 'public';
         if (!groups[s]) groups[s] = [];
         groups[s].push(table);
      }
    });

    if (groups['__favorites__'] && groups['__favorites__'].length === 0) delete groups['__favorites__'];
    return groups;
  }, [filteredTables, favoriteTables]);

  const sortedSchemas = useMemo(() => {
     return Object.keys(groupedTables).sort((a, b) => {
        if (a === '__favorites__') return -1;
        if (b === '__favorites__') return 1;
        return a.localeCompare(b);
     });
  }, [groupedTables]);

  const handleToggleFavorite = useCallback((tableId: string) => {
    setFavoriteTables(prev => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  }, []);

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
             if (parts.length === 3 ? (parts[0] === table.schema && parts[1] === table.name) : (parts[0] === table.name)) map.set(tId, 'target');
          }
          table.columns.forEach(col => {
             if (col.references) {
                const parts = col.references.split('.');
                if (parts.length === 3 ? (`${parts[0]}.${parts[1]}.${parts[2]}` === activeColumnKey) : (`${parts[0]}.${parts[1]}` === `${t}.${c}`)) map.set(tId, 'child'); 
             }
          });
       });
       map.set(sourceTableId, activeColumnRef ? 'source' : 'focused');
       return map;
    }
    if (activeTableId) {
       map.set(activeTableId, 'focused');
       relationshipGraph.parents[activeTableId]?.forEach(p => map.set(p, 'parent'));
       relationshipGraph.children[activeTableId]?.forEach(c => map.set(c, 'child'));
    }
    return map;
  }, [deferredHoveredTableId, deferredHoveredColumnRef, deferredHoveredColumnKey, deferredSelectedColumnKey, relationshipGraph, schema.tables]);

  return (
    <div id="schema-viewer-container" className="h-full flex flex-col bg-slate-900 border-r border-slate-800 overflow-hidden select-none" onClick={() => setSelectedColumnKey(null)}>
      {!selectionMode && (
        <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-slate-200">
            <Database className="w-5 h-5 text-indigo-400" />
            <div className="overflow-hidden">
              <h2 className="font-semibold text-sm uppercase tracking-wider truncate max-w-[120px]">{loading ? 'Carregando...' : schema.name}</h2>
              <p className="text-[10px] text-slate-500">{schema.tables.length} tabelas</p>
            </div>
          </div>
          {onRegenerateClick && <button onClick={onRegenerateClick} disabled={loading} className="text-xs text-indigo-400 hover:underline">Mudar BD</button>}
        </div>
      )}
      <div className="p-2 border-b border-slate-800 shrink-0 space-y-2 bg-slate-900">
        <div className="flex gap-2">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
             <input type="text" placeholder="Buscar tabelas..." value={inputValue} onChange={e => setInputValue(e.target.value)} disabled={loading} className="w-full pl-9 pr-8 py-2 bg-slate-800 border border-slate-700 rounded text-xs outline-none text-slate-200" />
           </div>
           <select value={selectedTypeFilter} onChange={e => setSelectedTypeFilter(e.target.value)} className="w-[100px] h-full p-2 bg-slate-800 border border-slate-700 rounded text-xs outline-none text-slate-400">
              <option value="">Tipos</option>
              {allColumnTypes.map(t => <option key={t} value={t}>{t}</option>)}
           </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 relative custom-scrollbar" onMouseLeave={() => { setHoveredTableId(null); setHoveredColumnKey(null); setHoveredColumnRef(null); }}>
        {sortedSchemas.map(schemaName => {
           const tablesInSchema = groupedTables[schemaName];
           if (!tablesInSchema || tablesInSchema.length === 0) return null;
           const isFavoritesGroup = schemaName === '__favorites__';
           const isExpanded = isFavoritesGroup ? true : expandedSchemas.has(schemaName);
           return (
              <div key={schemaName} className="mb-2">
                 <div className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-800 rounded select-none group sticky top-0 z-10 bg-slate-900/95 backdrop-blur ${isExpanded ? 'border-b border-slate-800' : ''}`} onClick={() => !isFavoritesGroup && setExpandedSchemas(prev => { const n = new Set(prev); if (n.has(schemaName)) n.delete(schemaName); else n.add(schemaName); return n; })}>
                    {isFavoritesGroup ? <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> : isExpanded ? <FolderOpen className="w-4 h-4 text-indigo-400 fill-indigo-900/30" /> : <Folder className="w-4 h-4 text-slate-600" />}
                    <span className={`text-xs font-bold ${isFavoritesGroup ? 'text-amber-400' : 'text-slate-400'}`}>{isFavoritesGroup ? 'Favoritos' : schemaName}</span>
                    <span className="text-[10px] text-slate-500 ml-auto">{tablesInSchema.length}</span>
                 </div>
                 {isExpanded && (
                    <div className="pl-3 pt-1 space-y-2 border-l border-slate-800 ml-2">
                       {tablesInSchema.map((table) => (
                          <SchemaTableItem
                             key={getTableId(table)} table={table} visualState={visualStateMap.has(getTableId(table)) ? visualStateMap.get(getTableId(table)) : (visualStateMap.size > 0 ? 'dimmed' : 'normal')}
                             isExpanded={expandedTables.has(getTableId(table))} isSelected={selectedTableIds.includes(getTableId(table))} isFavorite={favoriteTables.has(getTableId(table))}
                             selectionMode={selectionMode} editingTable={editingTable} tempDesc={tempDesc} debouncedTerm={debouncedTerm} selectedTypeFilter={selectedTypeFilter}
                             sortField={sortField} sortDirection={sortDirection} hoveredColumnKey={deferredHoveredColumnKey} hoveredColumnRef={deferredHoveredColumnRef} selectedColumnKey={deferredSelectedColumnKey}
                             onToggleExpand={(e: any, id: string) => { setExpandedTables(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }}
                             onTableClick={id => selectionMode && onToggleTable?.(id)} onMouseEnter={setHoveredTableId} onStartEditing={(e: any, t: any) => { setEditingTable(t.name); setTempDesc(t.description || ''); }}
                             onSaveDescription={(e: any, name: string) => { onDescriptionChange?.(name, tempDesc); setEditingTable(null); }} onDescChange={setTempDesc} onSetEditing={setEditingTable}
                             onSortChange={setSortField} onColumnHover={(tid: string, col: string, ref?: string) => { setHoveredColumnKey(`${tid}.${col}`); setHoveredColumnRef(ref || null); }}
                             onColumnHoverOut={() => { setHoveredColumnKey(null); setHoveredColumnRef(null); }} onColumnClick={(tid: string, col: string) => setSelectedColumnKey(`${tid}.${col}`)}
                             onPreview={onPreviewTable} onToggleFavorite={handleToggleFavorite}
                          />
                       ))}
                    </div>
                 )}
              </div>
           );
        })}
      </div>
      <div className="p-3 bg-slate-900 border-t border-slate-800 text-[10px] text-slate-500 shrink-0">
        <p className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Sel</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Alvo</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Ref</span>
        </p>
      </div>
    </div>
  );
};

export default SchemaViewer;