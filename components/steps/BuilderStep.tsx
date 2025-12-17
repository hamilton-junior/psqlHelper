
import React, { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { DatabaseSchema, BuilderState, ExplicitJoin, JoinType, Filter, Operator, OrderBy, AppSettings, SavedQuery, AggregateFunction, Column, Table, CalculatedColumn } from '../../types';
import { Layers, ChevronRight, Settings2, RefreshCw, Search, X, CheckSquare, Square, Plus, Trash2, ArrowRightLeft, Filter as FilterIcon, ArrowDownAZ, List, Link2, ChevronDown, Save, FolderOpen, Calendar, Clock, Key, Combine, ArrowRight, ArrowLeft, FastForward, Target, CornerDownRight, Wand2, Loader2, Undo2, Redo2, Calculator, Sparkles, LayoutTemplate, PlayCircle, Eye, Info, ChevronUp, Link as LinkIcon } from 'lucide-react';
import SchemaViewer from '../SchemaViewer';
import { generateBuilderStateFromPrompt } from '../../services/geminiService';
import { generateLocalSql } from '../../services/localSqlService';
import BeginnerTip from '../BeginnerTip';
import FormulaModal from '../FormulaModal';

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

// Helper to ensure consistent ID generation
const getTableId = (t: Table) => `${t.schema || 'public'}.${t.name}`;
const getColId = (tableId: string, colName: string) => `${tableId}.${colName}`;

// --- Helper to find automatic joins ---
const findBestJoin = (schema: DatabaseSchema, tableId1: string, tableId2: string): ExplicitJoin | null => {
  const t1Parts = tableId1.split('.');
  const t2Parts = tableId2.split('.');
  if (t1Parts.length < 2 || t2Parts.length < 2) return null;

  const t1Schema = t1Parts[0]; const t1Name = t1Parts[1];
  const t2Schema = t2Parts[0]; const t2Name = t2Parts[1];

  const table1 = schema.tables.find(t => t.name === t1Name && (t.schema || 'public') === t1Schema);
  const table2 = schema.tables.find(t => t.name === t2Name && (t.schema || 'public') === t2Schema);
  
  if (!table1 || !table2) return null;

  // 1. Check T1 -> T2 (T1 has FK pointing to T2)
  for (const col of table1.columns) {
      if (col.isForeignKey && col.references) {
          // ref is schema.table.col or table.col
          const refParts = col.references.split('.');
          let targetMatch = false;
          let targetColName = '';

          if (refParts.length === 3) {
             // Exact schema match
             if (refParts[0] === t2Schema && refParts[1] === t2Name) {
                targetMatch = true;
                targetColName = refParts[2];
             }
          } else if (refParts.length === 2) {
             // Legacy match (assume matches table name)
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

  // 2. Check T2 -> T1 (T2 has FK pointing to T1)
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
               // We found T2 -> T1. 
               // Conventionally: LEFT JOIN T2 ON T2.fk = T1.pk
               return {
                   id: crypto.randomUUID(),
                   fromTable: tableId2,
                   fromColumn: col.name,
                   type: 'LEFT',
                   toTable: tableId1,
                   toColumn: targetColName
               };
          }
      }
  }

  // 3. Heuristic: Shared Name (e.g. abast.abastecimento vs movto.abastecimento)
  if (t1Name === t2Name && t1Schema !== t2Schema) {
     // Try to find a common ID column or PK
     const commonId = table1.columns.find(c => 
        (c.name.toLowerCase() === 'id' || c.isPrimaryKey) && 
        table2.columns.some(c2 => c2.name === c.name && c2.type === c.type)
     );

     if (commonId) {
        return {
           id: crypto.randomUUID(),
           fromTable: tableId1,
           fromColumn: commonId.name,
           type: 'INNER',
           toTable: tableId2,
           toColumn: commonId.name
        };
     }
  }

  return null;
}


// --- Sub-components Memoized for Performance ---

interface ColumnItemProps {
  col: Column;
  tableId: string;
  tableName: string;
  isSelected: boolean;
  aggregation: AggregateFunction;
  // Relationship Highlight Props
  isHovered: boolean;
  isRelTarget: boolean; // Is this the PK being pointed to?
  isRelSource: boolean; // Is this an FK pointing to the hovered PK?
  onToggle: (tableId: string, colName: string) => void;
  onAggregationChange: (tableId: string, colName: string, func: AggregateFunction) => void;
  onHover: (tableId: string, colName: string, references?: string) => void;
  onHoverOut: () => void;
}

// Memoized Column Item
const ColumnItem = memo(({ col, tableId, tableName, isSelected, aggregation, isHovered, isRelTarget, isRelSource, onToggle, onAggregationChange, onHover, onHoverOut }: ColumnItemProps) => {
  
  // Determine visual style based on relationship state
  let containerClasses = "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 hover:scale-[1.01]";
  let textClasses = "text-slate-700 dark:text-slate-300";
  
  if (isSelected) {
     containerClasses = "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500 shadow-sm z-10";
     textClasses = "text-indigo-900 dark:text-indigo-300";
  }

  // Override / Add styles for Relationship Highlights (takes precedence over simple hover)
  if (isHovered) {
     containerClasses = "bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-500 ring-1 ring-slate-300 dark:ring-slate-500 z-20";
  } else if (isRelTarget) {
     // This is the PK being referenced -> GOLD/AMBER
     containerClasses = "bg-amber-50 dark:bg-amber-900/30 border-amber-400 ring-1 ring-amber-400 shadow-md z-20";
     textClasses = "text-amber-900 dark:text-amber-100 font-medium";
  } else if (isRelSource) {
     // This is an FK referencing the hovered PK -> EMERALD
     containerClasses = "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 ring-1 ring-emerald-400 shadow-md z-20";
     textClasses = "text-emerald-900 dark:text-emerald-100 font-medium";
  }

  return (
    <div 
      onClick={() => onToggle(tableId, col.name)}
      onMouseEnter={() => onHover(tableId, col.name, col.references)}
      onMouseLeave={onHoverOut}
      className={`flex items-center p-2 rounded border cursor-pointer transition-all duration-200 ease-in-out relative group ${containerClasses}`}
      title={`Clique para selecionar ${col.name}`}
    >
      <div className={`w-4 h-4 rounded border flex items-center justify-center mr-2 transition-all shrink-0 ${
          isSelected ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
        }`}>
         {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-[1px]"></div>}
      </div>
      
      <div className="flex-1 min-w-0 pr-8">
         <div className={`text-sm font-medium truncate transition-colors flex items-center gap-1.5 ${textClasses}`}>
            {col.name}
            {/* Icons for Keys */}
            {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-500 shrink-0 transform rotate-45" />}
            {col.isForeignKey && <Link2 className="w-3 h-3 text-blue-500 shrink-0" />}
         </div>
         
         <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-400 font-mono">{col.type}</span>
            
            {/* Relationship Badges */}
            {isRelTarget && (
               <span className="text-[9px] font-extrabold uppercase bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-1.5 py-0 rounded-full flex items-center gap-0.5 shadow-sm">
                 <Target className="w-2.5 h-2.5" /> Alvo
               </span>
            )}
            {isRelSource && (
               <span className="text-[9px] font-extrabold uppercase bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 px-1.5 py-0 rounded-full flex items-center gap-0.5 shadow-sm">
                 <CornerDownRight className="w-2.5 h-2.5" /> Ref
               </span>
            )}
         </div>
      </div>

      {/* Aggregation Selector (Visible when checked) */}
      {isSelected && (
         <div 
           className="absolute right-1 top-1/2 -translate-y-1/2"
           onClick={e => e.stopPropagation()}
           title="Aplicar função de agregação"
         >
            <select
               value={aggregation}
               onChange={(e) => onAggregationChange(tableId, col.name, e.target.value as AggregateFunction)}
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
         prev.isHovered === next.isHovered &&
         prev.isRelTarget === next.isRelTarget &&
         prev.isRelSource === next.isRelSource &&
         prev.col.name === next.col.name &&
         prev.tableId === next.tableId;
});

interface TableCardProps {
  table: Table;
  selectedColumns: string[];
  aggregations: Record<string, AggregateFunction>;
  isCollapsed: boolean;
  colSearchTerm: string;
  // Highlight State
  hoveredColumn: { tableId: string; col: string; references?: string } | null;
  
  onToggleCollapse: (tableId: string) => void;
  onToggleColumn: (tableId: string, colName: string) => void;
  onAggregationChange: (tableId: string, colName: string, func: AggregateFunction) => void;
  onSelectAll: (tableId: string, visibleColumns: string[]) => void;
  onSelectNone: (tableId: string, visibleColumns: string[]) => void;
  onSearchChange: (tableId: string, term: string) => void;
  onClearSearch: (tableId: string) => void;
  onHoverColumn: (tableId: string, colName: string, references?: string) => void;
  onHoverOutColumn: () => void;
}

const TableCard = memo(({ 
  table, selectedColumns, aggregations, isCollapsed, colSearchTerm, hoveredColumn,
  onToggleCollapse, onToggleColumn, onAggregationChange, onSelectAll, onSelectNone, onSearchChange, onClearSearch, onHoverColumn, onHoverOutColumn
}: TableCardProps) => {

  const tableId = getTableId(table);

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
             return col.name.toLowerCase().includes(t.toLowerCase());
          } catch (e) {
             return false;
          }
        });
      });
    });
  }, [table.columns, colSearchTerm]);

  const visibleColNames = useMemo(() => filteredColumns.map(c => c.name), [filteredColumns]);
  const selectedCount = selectedColumns.filter(c => c.startsWith(`${tableId}.`)).length;

  // 1. Target Logic: Am I the table being referenced by the hovered column?
  const isTarget = useMemo(() => {
    if (!hoveredColumn?.references) return false;
    const parts = hoveredColumn.references.split('.');
    
    // Check 3-part schema.table.col
    if (parts.length === 3) {
       const [s, t] = parts;
       return table.name === t && table.schema === s;
    }
    
    // Check 2-part table.col
    return hoveredColumn.references.startsWith(table.name + '.');
  }, [table.name, table.schema, hoveredColumn]);

  // 2. Child Logic: Do I have a column that references the hovered PK (or column)?
  const isChild = useMemo(() => {
    if (!hoveredColumn) return false;
    
    const hoveredTable = hoveredColumn.tableId.split('.')[1]; // get just table name
    const hoveredSchema = hoveredColumn.tableId.split('.')[0]; // get schema
    
    // We want to see if MY columns reference "hoveredSchema.hoveredTable.col"
    return table.columns.some(c => {
       if (!c.references) return false;
       const parts = c.references.split('.');
       
       if (parts.length === 3) {
          return c.references === `${hoveredSchema}.${hoveredTable}.${hoveredColumn.col}`;
       }
       // Fallback for legacy refs
       return c.references === `${hoveredTable}.${hoveredColumn.col}`;
    });
  }, [table.columns, hoveredColumn]);

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg border overflow-hidden shadow-sm transition-all duration-300
      ${isCollapsed ? 'border-slate-200 dark:border-slate-700' : 'border-indigo-100 dark:border-slate-600 ring-1 ring-indigo-50 dark:ring-transparent'}
      ${isTarget ? 'ring-2 ring-amber-400 border-amber-300 dark:border-amber-600 shadow-md scale-[1.01] z-10' : ''}
      ${isChild ? 'ring-2 ring-emerald-400 border-emerald-300 dark:border-emerald-600 shadow-md scale-[1.01] z-10' : ''}
    `}>
       {/* Card Header */}
       <div 
         className={`px-4 py-3 border-b flex justify-between items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors
           ${isTarget ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700' : 
             isChild ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700' : 
             'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700'}
         `}
         onClick={() => onToggleCollapse(tableId)}
         title={isCollapsed ? "Expandir colunas" : "Recolher colunas"}
       >
         <div className="flex items-center gap-2">
            {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            <h4 className={`font-bold ${isTarget ? 'text-amber-800 dark:text-amber-200' : isChild ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-700 dark:text-slate-300'}`}>
               <span className="text-[10px] font-normal text-slate-400 mr-1">{table.schema}.</span>
               {table.name}
               {isTarget && <span className="ml-2 text-[10px] bg-amber-200 dark:bg-amber-700 text-amber-900 dark:text-amber-100 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide">Alvo</span>}
               {isChild && <span className="ml-2 text-[10px] bg-emerald-200 dark:bg-emerald-700 text-emerald-900 dark:text-emerald-100 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide">Filho</span>}
            </h4>
            <span className="text-xs text-slate-400 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full">
              {selectedCount} selecionadas
            </span>
         </div>
         <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => onSelectAll(tableId, visibleColNames)} title="Selecionar todas as colunas visíveis" className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-1 rounded transition-colors">Todas</button>
            <button onClick={() => onSelectNone(tableId, visibleColNames)} title="Desmarcar todas as colunas" className="text-xs font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded transition-colors">Nenhuma</button>
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
                    onChange={(e) => onSearchChange(tableId, e.target.value)}
                    placeholder={`Filtrar colunas em ${table.name}...`}
                    className="w-full pl-8 pr-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-400 text-slate-700 dark:text-slate-300"
                    title="Filtrar colunas desta tabela"
                 />
                 {colSearchTerm && (
                    <button 
                      onClick={() => onClearSearch(tableId)}
                      className="absolute right-2 top-1.5 text-slate-300 hover:text-slate-500"
                      title="Limpar filtro"
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
                  const colFullId = getColId(tableId, col.name);
                  const isChecked = selectedColumns.includes(colFullId);
                  const agg = aggregations[colFullId] || 'NONE';
                  
                  // Highlight Logic
                  const isHovered = hoveredColumn?.tableId === tableId && hoveredColumn?.col === col.name;
                  
                  // Is this the "Target" (PK) of the hovered FK?
                  let isRelTarget = false;
                  if (hoveredColumn?.references) {
                     const parts = hoveredColumn.references.split('.');
                     if (parts.length === 3) {
                        // schema.table.col
                        isRelTarget = hoveredColumn.references === `${table.schema}.${table.name}.${col.name}`;
                     } else {
                        // table.col
                        isRelTarget = hoveredColumn.references === `${table.name}.${col.name}`;
                     }
                  }
                  
                  // Is this an FK that points to the hovered PK?
                  // Source logic: Check if current col references "HoveredTable.HoveredCol"
                  let isRelSource = false;
                  if (col.references && hoveredColumn) {
                     const parts = col.references.split('.');
                     const [hSchema, hTable, hCol] = hoveredColumn.tableId.split('.'); // Hovered PK is schema.table.col
                     
                     if (parts.length === 3) {
                        isRelSource = col.references === `${hSchema}.${hTable}.${hoveredColumn.col}`;
                     } else {
                        isRelSource = col.references === `${hTable}.${hoveredColumn.col}`;
                     }
                  }

                  return (
                    <ColumnItem 
                      key={col.name}
                      col={col}
                      tableId={tableId}
                      tableName={table.name}
                      isSelected={isChecked}
                      aggregation={agg}
                      isHovered={isHovered}
                      isRelTarget={isRelTarget}
                      isRelSource={isRelSource}
                      onToggle={onToggleColumn}
                      onAggregationChange={onAggregationChange}
                      onHover={onHoverColumn}
                      onHoverOut={onHoverOutColumn}
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
   // Optimization: Only re-render if visual state relevant to this table changes
   const tableIdPrev = getTableId(prev.table);
   const tableIdNext = getTableId(next.table);

   const isHoverRelevant = 
      (prev.hoveredColumn?.tableId === tableIdPrev) || 
      (next.hoveredColumn?.tableId === tableIdNext) ||
      (prev.hoveredColumn?.references?.includes(prev.table.name)) ||
      (next.hoveredColumn?.references?.includes(next.table.name)) ||
      // Re-render children tables when hover changes
      (prev.table.columns.some(c => c.references?.includes(prev.hoveredColumn?.tableId.split('.')[1] || '---'))) ||
      (next.table.columns.some(c => c.references?.includes(next.hoveredColumn?.tableId.split('.')[1] || '---')));
      
   return prev.isCollapsed === next.isCollapsed &&
          prev.colSearchTerm === next.colSearchTerm &&
          tableIdPrev === tableIdNext &&
          prev.selectedColumns === next.selectedColumns &&
          prev.aggregations === next.aggregations &&
          !isHoverRelevant; // Only skip render if hover is NOT relevant
});


// --- Main Component ---

const BuilderStep: React.FC<BuilderStepProps> = ({ schema, state, onStateChange, onGenerate, onSkipAi, isGenerating, progressMessage, settings, onDescriptionChange, onPreviewTable }) => {
  // Persistence for Active Tab
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    return (localStorage.getItem(`psql-buddy-tab-${schema.name}`) as TabType) || 'columns';
  });

  useEffect(() => {
    localStorage.setItem(`psql-buddy-tab-${schema.name}`, activeTab);
  }, [activeTab, schema.name]);
  
  // Persistence for Column Search Terms (Keys are Table IDs)
  const [columnSearchTerms, setColumnSearchTerms] = useState<Record<string, string>>(() => {
    try {
        const stored = localStorage.getItem(`psql-buddy-search-${schema.name}`);
        return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem(`psql-buddy-search-${schema.name}`, JSON.stringify(columnSearchTerms));
  }, [columnSearchTerms, schema.name]);
  
  // State for collapsible tables - PERSISTED (Keys are Table IDs)
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`psql-buddy-collapsed-${schema.name}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Persist Collapsed State Effect
  useEffect(() => {
     localStorage.setItem(`psql-buddy-collapsed-${schema.name}`, JSON.stringify(Array.from(collapsedTables)));
  }, [collapsedTables, schema.name]);

  // State for Hover Highlights
  const [hoveredColumn, setHoveredColumn] = useState<{ tableId: string; col: string; references?: string } | null>(null);

  // Suggested Join State (Interactive Feature)
  const [suggestedJoin, setSuggestedJoin] = useState<ExplicitJoin | null>(null);

  // Show skip button if generating for too long
  const [showSkipButton, setShowSkipButton] = useState(false);
  
  // Magic Fill State
  const [magicPrompt, setMagicPrompt] = useState('');
  const [isMagicFilling, setIsMagicFilling] = useState(false);

  // Live Preview State
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [liveSql, setLiveSql] = useState('');
  
  // Formula Modal State
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  // Update live preview whenever state changes
  useEffect(() => {
     if (state.selectedTables.length > 0) {
        try {
           const result = generateLocalSql(schema, state);
           setLiveSql(result.sql);
        } catch (e) {
           setLiveSql('-- Complete a seleção para ver o SQL');
        }
     } else {
        setLiveSql('-- Selecione tabelas para começar');
     }
  }, [state, schema]);

  useEffect(() => {
    let timer: any;
    if (isGenerating) {
       setShowSkipButton(false);
       timer = setTimeout(() => {
          setShowSkipButton(true);
       }, settings.aiGenerationTimeout || 3000); // Configurable timeout
    } else {
       setShowSkipButton(false);
    }
    return () => clearTimeout(timer);
  }, [isGenerating, settings.aiGenerationTimeout]);

  // --- Undo / Redo History State ---
  const [history, setHistory] = useState<BuilderState[]>([]);
  const [future, setFuture] = useState<BuilderState[]>([]);

  // --- Saved Queries State ---
  const [showSavedQueries, setShowSavedQueries] = useState(false);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

  useEffect(() => {
    if (state.limit === 100 && state.limit !== settings.defaultLimit) {
      onStateChange({ ...state, limit: settings.defaultLimit });
    }
  }, [settings.defaultLimit]);

  // --- Smart Starters Calculation (New User Experience) ---
  const smartStarters = useMemo(() => {
     if (state.selectedTables.length > 0) return [];
     
     const suggestions = [];
     
     // 1. Find potential 'users' or 'customers' table
     const usersTable = schema.tables.find(t => ['users', 'user', 'cliente', 'clientes', 'customer', 'customers'].includes(t.name.toLowerCase()));
     if (usersTable) {
        suggestions.push({
           icon: <LayoutTemplate className="w-5 h-5 text-indigo-500" />,
           title: `Listar ${usersTable.name}`,
           desc: "Visualizar os 10 primeiros registros.",
           tables: [getTableId(usersTable)],
           limit: 10
        });
     }

     // 2. Find potential 'orders' or 'sales' to count
     const ordersTable = schema.tables.find(t => ['orders', 'order', 'pedidos', 'vendas', 'sales'].includes(t.name.toLowerCase()));
     if (ordersTable) {
        const pk = ordersTable.columns.find(c => c.isPrimaryKey)?.name || 'id';
        suggestions.push({
           icon: <Calculator className="w-5 h-5 text-emerald-500" />,
           title: `Contar ${ordersTable.name}`,
           desc: "Total de registros na tabela.",
           tables: [getTableId(ordersTable)],
           columns: [getColId(getTableId(ordersTable), pk)],
           aggs: { [getColId(getTableId(ordersTable), pk)]: 'COUNT' }
        });
     }

     // 3. Find any table with 'created_at' for recent data
     const recentTable = schema.tables.find(t => t.columns.some(c => c.name === 'created_at'));
     if (recentTable) {
        suggestions.push({
           icon: <Clock className="w-5 h-5 text-amber-500" />,
           title: `Recentes em ${recentTable.name}`,
           desc: "Últimos 20 registros adicionados.",
           tables: [getTableId(recentTable)],
           orderBy: [{ id: '1', column: getColId(getTableId(recentTable), 'created_at'), direction: 'DESC' }],
           limit: 20
        });
     }

     // Fallback if no specific tables found, pick first 2
     if (suggestions.length === 0) {
        const first = schema.tables[0];
        if (first) {
           suggestions.push({
              icon: <PlayCircle className="w-5 h-5 text-blue-500" />,
              title: `Explorar ${first.name}`,
              desc: "Ver dados desta tabela.",
              tables: [getTableId(first)],
              limit: 10
           });
        }
     }

     return suggestions.slice(0, 3);
  }, [schema.tables, state.selectedTables.length]);

  const applyStarter = (starter: any) => {
     const newState: BuilderState = {
        ...state,
        selectedTables: starter.tables,
        selectedColumns: starter.columns || [],
        aggregations: starter.aggs || {},
        orderBy: starter.orderBy || [],
        limit: starter.limit || 10
     };
     updateStateWithHistory(newState);
  };

  // --- History Management Wrappers ---
  
  const updateStateWithHistory = useCallback((newState: BuilderState) => {
    const currentState = stateRef.current;
    const currentStateCopy = JSON.parse(JSON.stringify(currentState));
    setHistory(prev => [...prev, currentStateCopy]);
    setFuture([]);
    onStateChange(newState);
  }, [onStateChange]);

  const handleUndo = useCallback(() => {
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
      state: JSON.parse(JSON.stringify(stateRef.current))
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

  const relevantSavedQueries = useMemo(() => 
    savedQueries.filter(q => q.schemaName === schema.name), 
  [savedQueries, schema.name]);
  
  // --- Magic Fill Handler ---
  const handleMagicFill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicPrompt.trim() || isMagicFilling) return;
    
    setIsMagicFilling(true);
    try {
       // Save current state first for Undo
       const currentStateCopy = JSON.parse(JSON.stringify(stateRef.current));
       setHistory(prev => [...prev, currentStateCopy]);
       setFuture([]);

       // Call AI Service
       const newStatePartial = await generateBuilderStateFromPrompt(schema, magicPrompt);
       
       if (newStatePartial && newStatePartial.selectedTables) {
          // Merge with defaults
          const newState: BuilderState = {
             ...stateRef.current, // Keep existing limit/order if not provided
             ...newStatePartial as BuilderState
          };
          onStateChange(newState);
          setMagicPrompt("");
          // Auto-switch tabs based on what was filled
          if (newState.joins.length > 0) setActiveTab('joins');
          else setActiveTab('columns');
       }
    } catch (e) {
       alert("Não foi possível preencher automaticamente. Tente reformular.");
    } finally {
       setIsMagicFilling(false);
    }
  };
  
  // --- Calculated Columns Logic (Feature #5) ---
  const handleAddCalculatedColumn = (alias: string, expression: string) => {
    const newCalc: CalculatedColumn = {
      id: crypto.randomUUID(),
      alias,
      expression
    };
    
    const currentState = stateRef.current;
    updateStateWithHistory({
       ...currentState,
       calculatedColumns: [...(currentState.calculatedColumns || []), newCalc]
    });
  };

  const removeCalculatedColumn = (id: string) => {
    const currentState = stateRef.current;
    updateStateWithHistory({
       ...currentState,
       calculatedColumns: (currentState.calculatedColumns || []).filter(c => c.id !== id)
    });
  };


  // --- Helpers ---
  // ... (Existing helpers: getColumnsForTable, etc.) ...
  const getColumnsForTable = useCallback((tableId: string) => {
    const t = schema.tables.find(table => getTableId(table) === tableId);
    return t ? t.columns : [];
  }, [schema.tables]);

  const getAllSelectedTableColumns = () => {
    let cols: {tableId: string, table: string, column: string, fullId: string, type: string}[] = [];
    state.selectedTables.forEach(tId => {
      const t = schema.tables.find(table => getTableId(table) === tId);
      if (t) {
        t.columns.forEach(c => cols.push({ 
           tableId: tId, 
           table: t.name, 
           column: c.name, 
           fullId: `${tId}.${c.name}`,
           type: c.type
        }));
      }
    });
    return cols;
  };
  
  const toggleTableCollapse = useCallback((tableId: string) => {
    setCollapsedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableId)) {
        newSet.delete(tableId);
      } else {
        newSet.add(tableId);
      }
      return newSet;
    });
  }, []);

  const handleHoverColumn = useCallback((tableId: string, colName: string, references?: string) => {
     setHoveredColumn({ tableId, col: colName, references });
  }, []);

  const handleHoverOutColumn = useCallback(() => {
     setHoveredColumn(null);
  }, []);

  // ... (Existing selection logic: toggleTable, clearAllTables, toggleColumn, updateAggregation, etc.) ...
  const toggleTable = useCallback((tableId: string) => {
    const currentState = stateRef.current;
    const isSelected = currentState.selectedTables.includes(tableId);
    let newTables = [];
    
    if (isSelected) {
      newTables = currentState.selectedTables.filter(t => t !== tableId);
      const newColumns = currentState.selectedColumns.filter(c => !c.startsWith(`${tableId}.`));
      const newJoins = currentState.joins.filter(j => j.fromTable !== tableId && j.toTable !== tableId);
      const newFilters = currentState.filters.filter(f => !f.column.startsWith(`${tableId}.`));
      const newAggs = { ...currentState.aggregations };
      Object.keys(newAggs).forEach(key => {
        if (key.startsWith(`${tableId}.`)) delete newAggs[key];
      });

      updateStateWithHistory({ 
        ...currentState, 
        selectedTables: newTables, 
        selectedColumns: newColumns, 
        aggregations: newAggs,
        joins: newJoins, 
        filters: newFilters 
      });
      setColumnSearchTerms(prev => {
         const next = { ...prev };
         delete next[tableId];
         return next;
      });
    } else {
      newTables = [...currentState.selectedTables, tableId];
      
      // AUTO JOIN SUGGESTION LOGIC
      // Check if this new table has relationships with existing selected tables
      let potentialJoin: ExplicitJoin | null = null;
      for (const existingTableId of currentState.selectedTables) {
         // Check Forward: Existing -> New
         const joinForward = findBestJoin(schema, existingTableId, tableId);
         if (joinForward) {
            potentialJoin = joinForward;
            break;
         }
         // Check Backward: New -> Existing
         const joinBackward = findBestJoin(schema, tableId, existingTableId);
         if (joinBackward) {
            potentialJoin = joinBackward;
            break;
         }
      }

      if (potentialJoin) {
         setSuggestedJoin(potentialJoin);
      }

      updateStateWithHistory({ ...currentState, selectedTables: newTables });
    }
  }, [updateStateWithHistory, schema]);

  const acceptSuggestedJoin = () => {
     if (!suggestedJoin) return;
     const currentState = stateRef.current;
     updateStateWithHistory({
        ...currentState,
        joins: [...currentState.joins, suggestedJoin]
     });
     setSuggestedJoin(null);
     setActiveTab('joins'); // Switch to Joins tab to show user
  };

  const clearAllTables = useCallback(() => {
     updateStateWithHistory({ ...stateRef.current, selectedTables: [], selectedColumns: [], aggregations: {}, joins: [], filters: [], calculatedColumns: [] });
  }, [updateStateWithHistory]);

  const toggleColumn = useCallback((tableId: string, colName: string) => {
    const currentState = stateRef.current;
    const fullId = getColId(tableId, colName);
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
    if (!currentState.selectedTables.includes(tableId)) newTables = [...currentState.selectedTables, tableId];

    updateStateWithHistory({ ...currentState, selectedTables: newTables, selectedColumns: newColumns, aggregations: newAggs });
  }, [updateStateWithHistory]);
  
  const updateAggregation = useCallback((tableId: string, colName: string, func: AggregateFunction) => {
    const currentState = stateRef.current;
    const fullId = getColId(tableId, colName);
    const newAggs = { ...currentState.aggregations };
    if (func === 'NONE') {
      delete newAggs[fullId];
    } else {
      newAggs[fullId] = func;
    }
    
    let newColumns = currentState.selectedColumns;
    if (!currentState.selectedColumns.includes(fullId)) {
      newColumns = [...currentState.selectedColumns, fullId];
    }
    
    updateStateWithHistory({ ...currentState, selectedColumns: newColumns, aggregations: newAggs });
  }, [updateStateWithHistory]);

  const selectAllColumns = useCallback((tableId: string, visibleColumns: string[]) => {
    const currentState = stateRef.current;
    const newColsSet = new Set(currentState.selectedColumns);
    visibleColumns.forEach(colName => newColsSet.add(getColId(tableId, colName)));
    const newCols = Array.from(newColsSet);
    let newTables = currentState.selectedTables;
    if (!currentState.selectedTables.includes(tableId)) newTables = [...currentState.selectedTables, tableId];
    updateStateWithHistory({ ...currentState, selectedTables: newTables, selectedColumns: newCols });
  }, [updateStateWithHistory]);

  const selectNoneColumns = useCallback((tableId: string, visibleColumns: string[]) => {
    const currentState = stateRef.current;
    const visibleSet = new Set(visibleColumns.map(c => getColId(tableId, c)));
    const newCols = currentState.selectedColumns.filter(c => !visibleSet.has(c));
    const newAggs = { ...currentState.aggregations };
    visibleSet.forEach(key => delete newAggs[key]);

    updateStateWithHistory({ ...currentState, selectedColumns: newCols, aggregations: newAggs });
  }, [updateStateWithHistory]);

  const handleColumnSearchChange = useCallback((tableId: string, term: string) => {
    setColumnSearchTerms(prev => ({...prev, [tableId]: term}));
  }, []);

  const handleClearColumnSearch = useCallback((tableId: string) => {
    setColumnSearchTerms(prev => ({...prev, [tableId]: ''}));
  }, []);

  // ... (Join, Filter, Sort handlers kept as is) ...
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
    const defaultCol = currentState.selectedColumns[0] || (currentState.selectedTables[0] ? `${currentState.selectedTables[0]}.id` : '');
    
    const newFilter: Filter = {
      id: crypto.randomUUID(),
      column: defaultCol,
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

  const toggleGroupBy = useCallback((colFullId: string) => {
    const currentState = stateRef.current;
    const exists = currentState.groupBy.includes(colFullId);
    const newGroup = exists ? currentState.groupBy.filter(g => g !== colFullId) : [...currentState.groupBy, colFullId];
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

  // UI Renderers
  const renderTabButton = (id: TabType, label: string, icon: React.ReactNode, tooltip: string) => (
    <button
      id={`tab-btn-${id}`}
      onClick={() => setActiveTab(id)}
      title={tooltip}
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
  
  // ... (renderColumnSelect, renderJoinTypeSelector kept as is) ...
  const renderColumnSelect = (tableId: string, value: string, onChange: (val: string) => void, placeholder: string) => {
    const cols = getColumnsForTable(tableId);
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
      { id: 'INNER', label: 'Inner', icon: <Combine className="w-3 h-3" />, desc: "Registros em ambas as tabelas" },
      { id: 'LEFT', label: 'Left', icon: <ArrowLeft className="w-3 h-3" />, desc: "Todos da esquerda, correspondentes da direita" },
      { id: 'RIGHT', label: 'Right', icon: <ArrowRight className="w-3 h-3" />, desc: "Todos da direita, correspondentes da esquerda" },
      { id: 'FULL', label: 'Full', icon: <ArrowRightLeft className="w-3 h-3" />, desc: "Registros em qualquer uma das tabelas" },
    ];

    return (
       <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
          {types.map(t => (
             <button
               key={t.id}
               onClick={() => onChange(t.id)}
               title={t.desc}
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
    <div className="w-full h-full flex flex-col relative">
      
      {/* Formula Modal */}
      <FormulaModal 
         isOpen={showFormulaModal}
         onClose={() => setShowFormulaModal(false)}
         onSave={handleAddCalculatedColumn}
         availableColumns={getAllSelectedTableColumns()}
      />

      <div className="flex justify-between items-end mb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            Query Builder (Construtor)
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Conectado a: <span className="font-mono text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded text-xs">{schema.name}</span>
          </p>
        </div>
        
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
             <button onClick={handleSaveQuery} disabled={state.selectedTables.length === 0} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-all disabled:opacity-30" title="Salvar Consulta Atual"><Save className="w-4 h-4" /></button>
             <button onClick={() => setShowSavedQueries(true)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-all" title="Carregar Consulta Salva"><FolderOpen className="w-4 h-4" /></button>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
             <button onClick={handleUndo} disabled={history.length === 0} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-all disabled:opacity-30 disabled:hover:bg-transparent" title="Desfazer (Undo)"><Undo2 className="w-4 h-4" /></button>
             <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
             <button onClick={handleRedo} disabled={future.length === 0} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-all disabled:opacity-30 disabled:hover:bg-transparent" title="Refazer (Redo)"><Redo2 className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
      
      {/* Magic Fill Bar */}
      {settings.enableAiGeneration && (
        <form id="magic-fill-bar" onSubmit={handleMagicFill} className="mb-4 relative z-20 shrink-0">
          <div className="relative group">
            <div className={`absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-indigo-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 ${isMagicFilling ? 'opacity-75 animate-pulse' : ''}`}></div>
            <div className="relative flex items-center bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
               <div className="pl-3 text-indigo-500">{isMagicFilling ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}</div>
               <input type="text" value={magicPrompt} onChange={(e) => setMagicPrompt(e.target.value)} placeholder="✨ Magic Fill: Digite o que você quer (ex: 'Vendas por país em 2023') e a IA preencherá o builder..." className="w-full p-3 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400" disabled={isMagicFilling} />
               <button type="submit" disabled={!magicPrompt.trim() || isMagicFilling} className="mr-2 p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 transition-colors"><ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        </form>
      )}

      {/* Suggested Join Banner (Toast) */}
      {suggestedJoin && (
         <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-between shadow-sm animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
               <div className="bg-indigo-100 dark:bg-indigo-900/50 p-1.5 rounded-full text-indigo-600 dark:text-indigo-300">
                  <LinkIcon className="w-4 h-4" />
               </div>
               <div>
                  <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Sugestão de Join</p>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300">
                     Detectamos uma conexão entre <strong>{suggestedJoin.fromTable}</strong> e <strong>{suggestedJoin.toTable}</strong>.
                  </p>
               </div>
            </div>
            <div className="flex gap-2">
               <button onClick={() => setSuggestedJoin(null)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium">Ignorar</button>
               <button onClick={acceptSuggestedJoin} className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold shadow-sm transition-colors">Aceitar Join</button>
            </div>
         </div>
      )}

      {/* SAVED QUERIES MODAL */}
      {showSavedQueries && (
        <div className="absolute inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/50 backdrop-blur-sm rounded-xl">
           <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[70vh]">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                 <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><FolderOpen className="w-5 h-5 text-indigo-500" /> Consultas Salvas ({relevantSavedQueries.length})</h3>
                 <button onClick={() => setShowSavedQueries(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="overflow-y-auto p-2 space-y-2 flex-1">
                 {relevantSavedQueries.length === 0 ? <div className="p-8 text-center text-slate-400 text-sm">Nenhuma consulta salva para <strong>{schema.name}</strong>.</div> : relevantSavedQueries.map(q => (
                    <div key={q.id} onClick={() => handleLoadQuery(q)} className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-400 cursor-pointer group transition-all">
                       <div className="flex justify-between items-start">
                          <div>
                             <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">{q.name}</h4>
                             <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1"><span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(q.createdAt).toLocaleDateString()}</span></div>
                          </div>
                          <button onClick={(e) => handleDeleteQuery(q.id, e)} className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex gap-6 min-h-0">
        
        {/* Left: Schema Viewer */}
        <div id="schema-viewer-panel" className="w-1/4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden shadow-sm">
          <SchemaViewer 
            schema={schema} 
            selectionMode={true} 
            selectedTableIds={state.selectedTables} 
            onToggleTable={toggleTable} 
            onDescriptionChange={onDescriptionChange}
            onPreviewTable={onPreviewTable} // Passed down
          />
        </div>

        {/* Right: Tabbed Builder Area */}
        <div id="builder-main-panel" className="flex-1 w-full bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden shadow-sm relative">
           
           <div className="flex border-b border-slate-100 dark:border-slate-700">
             {renderTabButton('columns', 'Colunas', <List className="w-4 h-4" />, "Selecionar colunas e agregações")}
             {renderTabButton('joins', `Joins (${state.joins.length})`, <Link2 className="w-4 h-4" />, "Configurar relacionamentos")}
             {renderTabButton('filters', `Filtros (${state.filters.length})`, <FilterIcon className="w-4 h-4" />, "Adicionar cláusulas WHERE")}
             {renderTabButton('sortgroup', 'Ordenar/Agrupar', <ArrowDownAZ className="w-4 h-4" />, "Configurar GROUP BY e ORDER BY")}
           </div>

           <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 dark:bg-slate-900/50 relative">
             
             {/* --- COLUMNS TAB --- */}
             {activeTab === 'columns' && (
               <div className="space-y-6">
                 
                 <BeginnerTip settings={settings} title="Seleção e Projeção (SELECT)">
                    Para ver os dados, primeiro selecione as tabelas na barra lateral esquerda. As colunas aparecerão abaixo.
                    <br/>
                    Em SQL, isso é a cláusula <code>SELECT</code>. Você também pode criar novas colunas usando fórmulas matemáticas.
                 </BeginnerTip>

                 {/* Calculated Columns Section (Feature #5) */}
                 {state.selectedTables.length > 0 && (
                   <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <Calculator className="w-3.5 h-3.5" /> Colunas Calculadas (Fórmulas)
                        </h3>
                        <button onClick={() => setShowFormulaModal(true)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded transition-colors">
                          <Plus className="w-3 h-3" /> Nova Fórmula
                        </button>
                      </div>
                      
                      {state.calculatedColumns && state.calculatedColumns.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                          {state.calculatedColumns.map(calc => (
                            <div key={calc.id} className="bg-white dark:bg-slate-800 p-2 rounded border border-indigo-100 dark:border-indigo-900/50 shadow-sm flex items-center justify-between group">
                               <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300 truncate flex items-center gap-1">
                                     <Calculator className="w-3 h-3 opacity-50" /> {calc.alias}
                                  </div>
                                  <code className="text-[10px] text-slate-500 dark:text-slate-400 block truncate font-mono bg-slate-50 dark:bg-slate-900 px-1 rounded mt-0.5 border border-slate-100 dark:border-slate-800">{calc.expression}</code>
                               </div>
                               <button onClick={() => removeCalculatedColumn(calc.id)} className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Trash2 className="w-3.5 h-3.5" />
                               </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                         <div className="text-[10px] text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-700 rounded p-2 text-center mb-4">
                            Nenhuma fórmula criada. Clique em "Nova Fórmula" para criar campos personalizados (ex: lucro = venda - custo).
                         </div>
                      )}
                   </div>
                 )}

                 {state.selectedTables.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-full text-slate-400">
                     <Layers className="w-16 h-16 mb-4 opacity-20" />
                     <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">Nenhuma tabela selecionada</h3>
                     <p className="text-sm mb-8 text-center max-w-xs">Selecione tabelas na barra lateral ou use um modelo abaixo para começar.</p>
                     
                     {/* SMART STARTERS */}
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl px-4">
                        {smartStarters.map((starter, idx) => (
                           <button 
                              key={idx} 
                              onClick={() => applyStarter(starter)}
                              className="flex flex-col items-center text-center p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-400 hover:shadow-md transition-all group"
                           >
                              <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-full group-hover:scale-110 transition-transform">
                                 {starter.icon}
                              </div>
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">{starter.title}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">{starter.desc}</span>
                           </button>
                        ))}
                     </div>
                   </div>
                 ) : (
                   state.selectedTables.map(tableId => {
                     const table = schema.tables.find(t => getTableId(t) === tableId);
                     if (!table) return null;
                     return (
                        <TableCard 
                           key={tableId}
                           table={table}
                           selectedColumns={state.selectedColumns}
                           aggregations={state.aggregations}
                           isCollapsed={collapsedTables.has(tableId)}
                           colSearchTerm={columnSearchTerms[tableId] || ''}
                           hoveredColumn={hoveredColumn}
                           onToggleCollapse={toggleTableCollapse}
                           onToggleColumn={toggleColumn}
                           onAggregationChange={updateAggregation}
                           onSelectAll={selectAllColumns}
                           onSelectNone={selectNoneColumns}
                           onSearchChange={handleColumnSearchChange}
                           onClearSearch={handleClearColumnSearch}
                           onHoverColumn={handleHoverColumn}
                           onHoverOutColumn={handleHoverOutColumn}
                        />
                     );
                   })
                 )}
               </div>
             )}

             {/* --- JOINS TAB --- */}
             {activeTab === 'joins' && (
               <div className="max-w-4xl mx-auto pb-10">
                 
                 <BeginnerTip settings={settings} title="Relacionamentos (JOINS)">
                    Joins conectam tabelas para que você possa consultar dados de ambas ao mesmo tempo.
                    <ul className="list-disc ml-4 mt-1">
                       <li><strong>INNER:</strong> Traz apenas linhas que têm correspondência nas duas tabelas.</li>
                       <li><strong>LEFT:</strong> Traz TUDO da tabela da esquerda, e o que combinar da direita (preenche com NULL se não achar).</li>
                    </ul>
                 </BeginnerTip>

                 {/* ... (Existing Joins Tab Content - kept clean for brevity) ... */}
                 <div className="mb-6 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                         Configuração de Relacionamentos
                         <span className="text-slate-400" title="Joins conectam tabelas usando colunas em comum (chaves)."><Info className="w-4 h-4" /></span>
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Defina explicitamente como suas tabelas se conectam (JOIN).</p>
                    </div>
                    <button onClick={addJoin} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"><Plus className="w-4 h-4" /> Novo Join</button>
                 </div>
                 {state.joins.length === 0 ? (
                   <div className="bg-slate-50 dark:bg-slate-800/50 p-10 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-center flex flex-col items-center">
                      <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-sm text-slate-300"><Link2 className="w-8 h-8" /></div>
                      <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">Nenhum JOIN definido manualmente.</p>
                      <p className="text-xs text-slate-400 max-w-sm">O sistema tentará detectar relacionamentos automaticamente via chaves estrangeiras (FK) ou por nomes coincidentes.</p>
                   </div>
                 ) : (
                   <div className="space-y-6">
                     {state.joins.map((join) => (
                       <div key={join.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden relative group">
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => removeJoin(join.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <div className="p-5">
                             <div className="flex flex-col gap-4">
                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                   <div className="flex-1 w-full"><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Tabela A</label><div className="relative"><select value={join.fromTable} onChange={(e) => updateJoin(join.id, 'fromTable', e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"><option value="" disabled>Selecione...</option>{state.selectedTables.map(tId => <option key={tId} value={tId}>{tId}</option>)}</select><ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" /></div></div>
                                   <div className="flex flex-col items-center shrink-0 mt-5">{renderJoinTypeSelector(join.type, (val) => updateJoin(join.id, 'type', val))}</div>
                                   <div className="flex-1 w-full"><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Tabela B</label><div className="relative"><select value={join.toTable} onChange={(e) => updateJoin(join.id, 'toTable', e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"><option value="" disabled>Selecione...</option>{state.selectedTables.map(tId => <option key={tId} value={tId}>{tId}</option>)}</select><ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" /></div></div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row items-center gap-3">
                                   <div className="bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-1 rounded text-[10px] font-mono font-bold">ON</div>
                                   <div className="flex-1 w-full">{renderColumnSelect(join.fromTable, join.fromColumn, (val) => updateJoin(join.id, 'fromColumn', val), "Coluna de Junção (A)")}</div>
                                   <div className="text-slate-400 font-mono font-bold">=</div>
                                   <div className="flex-1 w-full">{renderColumnSelect(join.toTable, join.toColumn, (val) => updateJoin(join.id, 'toColumn', val), "Coluna de Junção (B)")}</div>
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
                 
                 <BeginnerTip settings={settings} title="Filtros (WHERE)">
                    Os filtros funcionam como uma peneira. O banco de dados verifica cada linha e mantém apenas aquelas que atendem à suas condições (ex: preço maior que 100).
                 </BeginnerTip>

                 <div className="mb-4 flex justify-between items-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Adicione condições WHERE. Para variáveis, use :nome_parametro.</p>
                    <button onClick={addFilter} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 transition-colors shadow-sm"><Plus className="w-3.5 h-3.5" /> Adicionar Filtro</button>
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
                             <select value={filter.column} onChange={(e) => updateFilter(filter.id, 'column', e.target.value)} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none max-w-[200px]"><option value="" disabled>Selecione a Coluna</option>{getAllSelectedTableColumns().map(c => (<option key={`${c.tableId}.${c.column}`} value={`${c.tableId}.${c.column}`}>{c.tableId}.{c.column}</option>))}</select>
                             <select value={filter.operator} onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)} className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"><option value="=">=</option><option value="!=">!=</option><option value=">">&gt;</option><option value="<">&lt;</option><option value=">=">&gt;=</option><option value="<=">&lt;=</option><option value="LIKE">LIKE</option><option value="ILIKE">ILIKE</option><option value="IN">IN</option><option value="IS NULL">IS NULL</option><option value="IS NOT NULL">IS NOT NULL</option></select>
                             {!['IS NULL', 'IS NOT NULL'].includes(filter.operator) && (<input type="text" value={filter.value} onChange={(e) => updateFilter(filter.id, 'value', e.target.value)} placeholder="Valor ou :variavel" className="flex-1 min-w-[120px] text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none" />)}
                             <button onClick={() => removeFilter(filter.id)} className="ml-auto text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                          </div>
                       ))}
                    </div>
                 )}
               </div>
             )}

             {/* --- SORT & GROUP TAB --- */}
             {activeTab === 'sortgroup' && (
               <div className="max-w-3xl mx-auto space-y-8">
                 
                 <BeginnerTip settings={settings} title="Agrupamento e Ordenação">
                    O <code>GROUP BY</code> é usado para criar relatórios resumidos. Se você usar funções como <code>SUM</code> ou <code>COUNT</code>, deve agrupar pelas outras colunas (ex: somar Vendas agrupado por País).
                 </BeginnerTip>

                 <div>
                    <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                       <List className="w-4 h-4 text-indigo-600" /> Agrupar Por (Group By)
                       <span className="text-slate-400" title="Combine linhas idênticas (ex: vendas por País). Obrigatório ao usar agregações."><Info className="w-4 h-4" /></span>
                    </h3>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                       <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Selecione colunas para agrupar (útil para agregações).</p>
                       <div className="flex flex-wrap gap-2">
                          {getAllSelectedTableColumns().map(col => {
                             const fullId = `${col.tableId}.${col.column}`;
                             const isGrouped = state.groupBy.includes(fullId);
                             return (<button key={fullId} onClick={() => toggleGroupBy(fullId)} className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${isGrouped ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 hover:border-indigo-300'}`}>{fullId}</button>)
                          })}
                       </div>
                    </div>
                 </div>
                 <div>
                    <div className="mb-2 flex justify-between items-center"><h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><ArrowDownAZ className="w-4 h-4 text-indigo-600" /> Ordenar Por (Order By)</h3><button onClick={addSort} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar Regra</button></div>
                    {state.orderBy.length === 0 ? <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-center"><p className="text-xs text-slate-400">Nenhuma regra de ordenação.</p></div> : <div className="space-y-2">{state.orderBy.map(sort => (<div key={sort.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3"><select value={sort.column} onChange={(e) => updateSort(sort.id, 'column', e.target.value)} className="flex-1 text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none"><option value="" disabled>Selecione a Coluna</option>{getAllSelectedTableColumns().map(c => (<option key={`${c.tableId}.${c.column}`} value={`${c.tableId}.${c.column}`}>{c.tableId}.{c.column}</option>))}</select><div className="flex bg-slate-100 dark:bg-slate-700 rounded p-1"><button onClick={() => updateSort(sort.id, 'direction', 'ASC')} className={`px-2 py-0.5 text-xs rounded ${sort.direction === 'ASC' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>ASC</button><button onClick={() => updateSort(sort.id, 'direction', 'DESC')} className={`px-2 py-0.5 text-xs rounded ${sort.direction === 'DESC' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>DESC</button></div><button onClick={() => removeSort(sort.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div>))}</div>}
                 </div>
               </div>
             )}
           </div>
        </div>
      </div>

      {/* Action Footer & Live Preview Panel */}
      <div className="mt-6 flex flex-col gap-2">
         {/* Live Preview Toggle */}
         <div className="flex justify-end px-4">
            <button 
               onClick={() => setShowLivePreview(!showLivePreview)}
               className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors bg-white dark:bg-slate-800 px-3 py-1.5 rounded-t-lg border border-b-0 border-slate-200 dark:border-slate-700 shadow-sm"
            >
               {showLivePreview ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
               Live SQL Preview
            </button>
         </div>

         {/* Collapsible Preview Panel */}
         {showLivePreview && (
            <div className="bg-slate-900 text-slate-300 p-4 rounded-xl border border-slate-700 shadow-inner mb-2 animate-in slide-in-from-bottom-2">
               <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Preview em Tempo Real</span>
               </div>
               <pre className="text-xs font-mono overflow-x-auto max-h-32 text-emerald-400 whitespace-pre-wrap">{liveSql}</pre>
            </div>
         )}

         {/* Original Footer */}
         <div className="bg-slate-800 text-white p-4 rounded-xl flex items-center justify-between shadow-lg" id="builder-footer-actions">
            <div className="flex items-center gap-6">
               <div className="flex flex-col"><span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-2">Tabelas Selecionadas {state.selectedTables.length > 0 && (<button onClick={clearAllTables} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>)}</span><span className="font-mono text-xl font-bold">{state.selectedTables.length}</span></div>
               <div className="w-px h-8 bg-slate-700"></div>
               <div className="flex flex-col"><span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Colunas Selecionadas</span><span className="font-mono text-xl font-bold">{state.selectedColumns.length === 0 ? (state.selectedTables.length > 0 ? 'TODAS (*)' : '0') : state.selectedColumns.length}</span></div>
            </div>

            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded border border-slate-700" title="Número máximo de linhas a retornar"><Settings2 className="w-4 h-4 text-slate-400" /><span className="text-xs text-slate-400">Limite:</span><input type="number" value={state.limit} onChange={(e) => updateStateWithHistory({...stateRef.current, limit: parseInt(e.target.value) || 10})} className="w-16 bg-transparent text-right font-mono text-sm outline-none focus:text-indigo-400 text-white" /></div>
               {isGenerating && showSkipButton && onSkipAi && settings.enableAiGeneration && (<button onClick={onSkipAi} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-300 hover:text-amber-200 hover:bg-white/10 rounded transition-colors"><FastForward className="w-3.5 h-3.5" /> Demorando? Pular IA</button>)}
               <button id="generate-sql-btn" onClick={onGenerate} disabled={state.selectedTables.length === 0 || isGenerating} className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-indigo-900/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">{isGenerating ? (<><RefreshCw className="w-4 h-4 animate-spin" /><span className="text-xs opacity-90">{progressMessage || "Processando..."}</span></>) : (<>Visualizar & Executar <ChevronRight className="w-4 h-4" /></>)}</button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default BuilderStep;
