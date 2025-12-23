
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Database, ChevronLeft, ChevronRight, FileSpreadsheet, Search, Copy, Check, BarChart2, MessageSquare, Download, Activity, LayoutGrid, FileText, Pin, AlertCircle, Info, MoreHorizontal, FileJson, FileCode, Hash, Type, Filter, Plus, X, Trash2, SlidersHorizontal, Clock, Maximize2, Minimize2, ExternalLink, Braces, PenTool, Save, Eye, Anchor, Link as LinkIcon, Settings2, Loader2, Folder, Terminal as TerminalIcon, ChevronDown, ChevronUp, Layers, Target, CornerDownRight, AlertTriangle, Undo2, ShieldAlert } from 'lucide-react';
import { AppSettings, DashboardItem, ExplainNode, DatabaseSchema, Table } from '../../types';
import DataVisualizer from '../DataVisualizer';
import DataAnalysisChat from '../DataAnalysisChat';
import CodeSnippetModal from '../CodeSnippetModal';
import JsonViewerModal from '../JsonViewerModal'; 
import DrillDownModal from '../DrillDownModal'; 
import { addToHistory } from '../../services/historyService';
import { executeQueryReal, explainQueryReal } from '../../services/dbService';
import BeginnerTip from '../BeginnerTip';

/**
 * Log centralizado para facilitar debug do componente de resultados
 */
const resultsLogger = (context: string, message: string, data?: any) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`%c[${timestamp}] [RESULTS:${context}] %c${message}`, "color: #6366f1; font-weight: bold", "color: inherit", data || '');
};

const getTableId = (t: any) => `${t.schema || 'public'}.${t.name}`;

// Interface para um vínculo individual
interface ManualLink {
  id: string;
  table: string;
  keyCol: string;
  previewCol: string;
}

// --- Sub-componente de Renderização ANSI ---
const AnsiTerminal: React.FC<{ text: string }> = ({ text }) => {
  const parts: string[] = text.split(/(\x1b\[\d+m)/);
  let currentColor = "";
  
  return (
    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-2xl overflow-auto custom-scrollbar font-mono text-[11px] leading-tight min-h-[400px]">
      <div className="flex gap-1.5 mb-4 opacity-50 shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
        <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">Database Output Console</span>
      </div>
      <pre className="inline-block min-w-full">
        {parts.map((part, i) => {
          if (part.startsWith("\x1b[")) {
            const code = part.match(/\d+/)?.[0];
            switch(code) {
               case "31": currentColor = "text-rose-500"; break;   // Red
               case "32": currentColor = "text-emerald-400"; break; // Green
               case "33": currentColor = "text-amber-400"; break;   // Yellow
               case "34": currentColor = "text-blue-400"; break;    // Blue
               case "36": currentColor = "text-cyan-400"; break;    // Cyan
               case "0": currentColor = ""; break;                  // Reset
            }
            return null;
          }
          return <span key={i} className={`${currentColor} transition-colors`}>{part}</span>;
        })}
      </pre>
    </div>
  );
};

// --- Sub-componente de Preview no Hover (Multi-vínculo + Interativo) ---
const HoverPreviewTooltip: React.FC<{
  links: ManualLink[];
  value: any;
  credentials: any;
  schema: DatabaseSchema;
  x: number;
  y: number;
  isPersistent?: boolean;
  onSelect?: (table: string, key: string, links: ManualLink[]) => void;
  onClose?: () => void;
}> = ({ links, value, credentials, schema, x, y, isPersistent, onSelect, onClose }) => {
  const [previews, setPreviews] = useState<Record<string, { data: string, loading: boolean, error: boolean }>>({});

  useEffect(() => {
    let isMounted = true;
    if (value === undefined || value === null || value === '') return;

    const fetchAllPreviews = async () => {
      const initial: Record<string, any> = {};
      links.forEach(l => initial[l.id] = { data: '', loading: true, error: false });
      setPreviews(initial);

      links.forEach(async (link) => {
        try {
          const tableParts = link.table.split('.');
          const sName = tableParts.length > 1 ? tableParts[0] : 'public';
          const tName = tableParts.length > 1 ? tableParts[1] : tableParts[0];
          
          const tableObj = schema.tables.find(t => 
             t.name.toLowerCase() === tName.toLowerCase() && 
             (t.schema || 'public').toLowerCase() === sName.toLowerCase()
          );

          if (!tableObj) {
            if (isMounted) setPreviews(prev => ({ ...prev, [link.id]: { data: 'Tabela não mapeada', loading: false, error: true } }));
            return;
          }

          const valStr = String(value).replace(/'/g, "''");
          const sql = `SELECT "${link.previewCol.replace(/"/g, '')}" FROM "${sName}"."${tName}" WHERE "${link.keyCol}"::text = '${valStr}' LIMIT 1;`;
          
          const results = await executeQueryReal(credentials, sql);
          if (isMounted) {
            if (results && results.length > 0) {
              const val = results[0][link.previewCol];
              setPreviews(prev => ({ ...prev, [link.id]: { data: val === null ? 'NULL' : String(val), loading: false, error: false } }));
            } else {
              setPreviews(prev => ({ ...prev, [link.id]: { data: 'Não encontrado', loading: false, error: false } }));
            }
          }
        } catch (e) {
          if (isMounted) setPreviews(prev => ({ ...prev, [link.id]: { data: 'Erro', loading: false, error: true } }));
        }
      });
    };

    fetchAllPreviews();
    return () => { isMounted = false; };
  }, [links, value, credentials, schema]);

  const visibleLinks = links.slice(0, 3);
  const hiddenCount = links.length - 3;

  return (
    <div 
      className={`fixed z-[120] bg-slate-900 text-white p-3 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-3 min-w-[220px] max-w-[320px] ${isPersistent ? 'pointer-events-auto ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900' : 'pointer-events-none'}`}
      style={{ left: Math.min(x + 15, window.innerWidth - 340), top: Math.max(10, y - 10) }}
      onClick={e => e.stopPropagation()}
    >
      {isPersistent && (
         <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Escolher Destino</span>
            <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded"><X className="w-3.5 h-3.5 text-slate-50" /></button>
         </div>
      )}

      {visibleLinks.map((link, idx) => {
        const state = previews[link.id];
        return (
          <button 
            key={link.id} 
            disabled={!isPersistent}
            onClick={() => isPersistent && onSelect?.(link.table, link.keyCol, links)}
            className={`text-left group/item flex flex-col w-full rounded-lg transition-colors ${idx > 0 ? 'pt-2 border-t border-slate-800' : ''} ${isPersistent ? 'hover:bg-slate-800 p-1.5 -m-1.5' : ''}`}
          >
            <div className="flex items-center justify-between mb-1 w-full">
               <div className="flex items-center gap-1.5 overflow-hidden">
                  <Database className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className={`text-[9px] font-extrabold uppercase tracking-widest truncate ${isPersistent ? 'group-hover/item:text-indigo-300' : 'text-slate-500'}`}>{link.table.split('.').pop()}</span>
               </div>
               <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-1 rounded">{link.previewCol}</span>
                  {isPersistent && <ArrowRight className="w-2.5 h-2.5 text-slate-600 opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0.5 transition-all" />}
               </div>
            </div>
            {state?.loading ? (
              <div className="flex items-center gap-2 text-xs opacity-50"><Loader2 className="w-3 h-3 animate-spin" /> <span>Carregando...</span></div>
            ) : state?.error ? (
              <span className="text-xs text-red-400 italic">Erro na consulta</span>
            ) : (
              <span className={`text-sm font-bold whitespace-pre-wrap block transition-colors ${isPersistent ? 'text-indigo-100 group-hover/item:text-white' : 'text-indigo-100'}`}>{state?.data || '---'}</span>
            )}
          </button>
        );
      })}
      
      {hiddenCount > 0 && (
         <div className="pt-2 border-t border-slate-800 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500 uppercase italic">
            <Plus className="w-3 h-3" /> {hiddenCount} outros destinos
         </div>
      )}

      <div className="absolute top-3 -left-1 w-2 h-2 bg-slate-900 border-l border-b border-slate-700 transform rotate-45"></div>
    </div>
  );
};

// --- Sub-componente para Configurar Vínculos Manuais (Múltiplos) ---
const ManualMappingPopover: React.FC<{ 
  column: string, 
  schema: DatabaseSchema, 
  onSave: (links: ManualLink[]) => void, 
  onClose: () => void,
  currentLinks: ManualLink[]
}> = ({ column, schema, onSave, onClose, currentLinks }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [keyCol, setKeyCol] = useState('');
  const [previewCol, setPreviewCol] = useState('');
  const [isAdding, setIsAdding] = useState(currentLinks.length === 0);

  const schemasPresent = useMemo(() => {
    return Array.from(new Set(schema.tables.map(t => t.schema || 'public'))).sort();
  }, [schema.tables]);

  const hasMultipleSchemas = schemasPresent.length > 1;

  const filteredAndSortedTables = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    let list = schema.tables.filter(t => 
      !term || 
      t.name.toLowerCase().includes(term) || 
      (t.schema || 'public').toLowerCase().includes(term)
    );

    if (term) {
      list.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA === term && nameB !== term) return -1;
        if (nameB === term && nameA !== term) return 1;
        const startsA = nameA.startsWith(term);
        const startsB = nameB.startsWith(term);
        if (startsA && !startsB) return -1;
        if (!startsA && startsB) return 1;
        return nameA.localeCompare(nameB);
      });
    } else {
       list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [schema.tables, searchTerm]);

  const targetColumns = useMemo(() => {
    if (!selectedTable) return [];
    const parts = selectedTable.split('.');
    const s = parts.length > 1 ? parts[0] : 'public';
    const t = parts.length > 1 ? parts[1] : parts[0];
    const tbl = schema.tables.find(table => table.name === t && (table.schema || 'public') === s);
    return tbl ? tbl.columns.map(c => c.name).sort() : [];
  }, [selectedTable, schema]);

  const handleAddLink = () => {
    const newLink: ManualLink = {
      id: crypto.randomUUID(),
      table: selectedTable,
      keyCol,
      previewCol
    };
    const updated = [...currentLinks, newLink];
    onSave(updated);
    setSelectedTable('');
    setKeyCol('');
    setPreviewCol('');
    setIsAdding(false);
  };

  const handleRemoveLink = (id: string) => {
    onSave(currentLinks.filter(l => l.id !== id));
  };

  return (
    <div className="absolute z-[100] top-full mt-2 right-0 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right flex flex-col" onClick={e => e.stopPropagation()}>
       <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase text-slate-500 truncate mr-2">Vínculos: {column}</span>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded transition-colors"><X className="w-4 h-4" /></button>
       </div>
       
       <div className="p-3 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {currentLinks.length > 0 && (
             <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Vínculos Ativos ({currentLinks.length})</label>
                {currentLinks.map(link => (
                   <div key={link.id} className="flex items-center justify-between p-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg group">
                      <div className="min-w-0">
                         <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 truncate">{link.table}</div>
                         <div className="text-[9px] text-indigo-400 flex items-center gap-1">
                            <Hash className="w-2.5 h-2.5" /> {link.keyCol} <ArrowRight className="w-2 h-2" /> <Eye className="w-2.5 h-2.5" /> {link.previewCol}
                         </div>
                      </div>
                      <button onClick={() => handleRemoveLink(link.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                         <Trash2 className="w-3.5 h-3.5" />
                      </button>
                   </div>
                ))}
             </div>
          )}

          {isAdding ? (
             <div className="space-y-4 pt-2 animate-in slide-in-from-top-2">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Novo Alvo</label>
                   <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                      <input 
                         autoFocus
                         type="text" 
                         value={searchTerm}
                         onChange={e => setSearchTerm(e.target.value)}
                         placeholder="Filtrar tabelas..."
                         className="w-full pl-7 pr-2 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                   </div>
                   <select 
                      size={5}
                      value={selectedTable}
                      onChange={e => setSelectedTable(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none custom-scrollbar"
                   >
                      {filteredAndSortedTables.map(t => {
                         const tableId = getTableId(t);
                         const label = hasMultipleSchemas ? `${t.schema}.${t.name}` : t.name;
                         return <option key={tableId} value={tableId}>{label}</option>;
                      })}
                   </select>
                </div>

                {selectedTable && (
                   <>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Chave no Destino</label>
                         <select value={keyCol} onChange={e => setKeyCol(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none font-medium">
                            <option value="">-- Selecione a Chave --</option>
                            {targetColumns.map(c => <option key={c} value={c}>{c}</option>)}
                         </select>
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Preview no Hover</label>
                         <select value={previewCol} onChange={e => setPreviewCol(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none font-medium">
                            <option value="">-- Selecione a Coluna --</option>
                            {targetColumns.map(c => <option key={c} value={c}>{c}</option>)}
                         </select>
                      </div>
                      <button 
                         onClick={handleAddLink}
                         disabled={!selectedTable || !keyCol || !previewCol}
                         className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                      >
                         Confirmar Alvo
                      </button>
                   </>
                )}
                <button onClick={() => setIsAdding(false)} className="w-full py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-bold">Cancelar</button>
             </div>
          ) : (
             <button onClick={() => setIsAdding(true)} className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 text-xs font-bold">
                <Plus className="w-4 h-4" /> Adicionar Outro Vínculo
             </button>
          )}
       </div>
    </div>
  );
};

const RowInspector: React.FC<{ row: any, onClose: () => void }> = ({ row, onClose }) => {
   const [searchTerm, setSearchTerm] = useState('');
   const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
   
   const entries = Object.entries(row || {});
   const filteredEntries = entries.filter(([key, val]) => 
      key.toLowerCase().includes(searchTerm.toLowerCase()) || 
      String(val || '').toLowerCase().includes(searchTerm.toLowerCase())
   );

   return (
      <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200" onClick={onClose}>
         <div className="bg-white dark:bg-slate-800 w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
               <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded text-indigo-600 dark:text-indigo-400"><FileText className="w-4 h-4" /></div>
                  <h3 className="font-bold text-slate-800 dark:text-white">Detalhes do Registro</h3>
               </div>
               <div className="flex items-center gap-2">
                  <div className="flex bg-slate-200 dark:bg-slate-700 rounded p-0.5">
                     <button onClick={() => setViewMode('table')} className={`p-1.5 rounded text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}`} title="Tabela"><LayoutGrid className="w-3.5 h-3.5" /></button>
                     <button onClick={() => setViewMode('json')} className={`p-1.5 rounded text-xs font-bold transition-all ${viewMode === 'json' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}`} title="JSON"><Braces className="w-3.5 h-3.5" /></button>
                  </div>
                  <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"><X className="w-5 h-5" /></button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-0 bg-slate-50 dark:bg-slate-900 custom-scrollbar">
               {viewMode === 'table' ? (
                  <table className="w-full text-left border-collapse">
                     <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredEntries.map(([key, val]) => (
                           <tr key={key} className="group hover:bg-white dark:hover:bg-slate-800 transition-colors">
                              <td className="px-4 py-3 w-1/3 bg-slate-100/50 dark:bg-slate-900/50 text-xs font-bold text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 font-mono break-all">
                                 {key}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200 relative break-all whitespace-pre-wrap">
                                 {val === null ? <span className="text-slate-400 italic text-xs">null</span> : String(val)}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               ) : (
                  <div className="p-4">
                     <pre className="text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-all p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        {JSON.stringify(row || {}, null, 2)}
                     </pre>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
};

interface VirtualTableProps {
   data: any[];
   columns: string[];
   highlightMatch: (text: string) => React.ReactNode;
   onRowClick: (row: any) => void;
   isAdvancedMode?: boolean;
   onUpdateCell?: (rowIdx: number, colKey: string, newValue: string) => void;
   onOpenJson: (json: any) => void;
   onDrillDown: (table: string, col: string, val: any, allLinks?: ManualLink[]) => void;
   schema?: DatabaseSchema;
   defaultTableName?: string | null;
   credentials?: any;
   pendingEdits?: Record<string, string>; // rowIdx-colKey -> newValue
}

const VirtualTable = ({ 
  data, 
  columns, 
  highlightMatch, 
  onRowClick, 
  isAdvancedMode, 
  onUpdateCell, 
  onOpenJson, 
  onDrillDown, 
  schema, 
  defaultTableName, 
  credentials,
  pendingEdits = {}
}: VirtualTableProps) => {
   const [currentPage, setCurrentPage] = useState(1);
   const [rowsPerPage, setRowsPerPage] = useState(25);
   const [activeProfileCol, setActiveProfileCol] = useState<string | null>(null);
   const [activeMappingCol, setActiveMappingCol] = useState<string | null>(null);
   const [editingCell, setEditingCell] = useState<{rowIdx: number, col: string} | null>(null);
   const editInputRef = useRef<HTMLInputElement>(null);
   
   const [hoverPreview, setHoverPreview] = useState<{links: ManualLink[], val: any, x: number, y: number, persistent: boolean} | null>(null);
   const hoverTimeoutRef = useRef<any>(null);

   const [manualMappings, setManualMappings] = useState<Record<string, ManualLink[]>>(() => {
      try {
         const stored = localStorage.getItem('psql-buddy-manual-drilldown-links-v2');
         return stored ? JSON.parse(stored) : {};
      } catch { return {}; }
   });

   useEffect(() => {
      if (editingCell && editInputRef.current) {
         editInputRef.current.focus();
         editInputRef.current.select();
      }
   }, [editingCell]);

   const handleSaveManualLinks = (colName: string, links: ManualLink[]) => {
      const newMappings = { ...manualMappings };
      if (links.length === 0) {
        delete newMappings[colName];
      } else {
        newMappings[colName] = links;
      }
      setManualMappings(newMappings);
      localStorage.setItem('psql-buddy-manual-drilldown-links-v2', JSON.stringify(newMappings));
   };

   const totalRows = data.length;
   const totalPages = Math.ceil(totalRows / Math.max(rowsPerPage, 1));
   const startIndex = (currentPage - 1) * rowsPerPage;
   const currentData = data.slice(startIndex, startIndex + rowsPerPage);

   const getLinksForColumn = (colName: string): ManualLink[] => {
      let links: ManualLink[] = [...(manualMappings[colName] || [])];

      if (links.length === 0 && schema && colName) {
         const lowerCol = colName.toLowerCase();
         const leafName = lowerCol.split('.').pop() || '';

         if (leafName === 'grid' || leafName === 'mlid') {
            const parts = lowerCol.split('.');
            let targetTableObj = null;
            if (parts.length >= 2) {
               const potentialTableName = parts[parts.length - 2];
               targetTableObj = schema.tables.find(t => t.name.toLowerCase() === potentialTableName.toLowerCase());
            }
            if (targetTableObj) {
               links.push({ id: 'auto', table: `${targetTableObj.schema || 'public'}.${targetTableObj.name}`, keyCol: leafName, previewCol: '' });
            }
         }
      }

      return links;
   };

   const formatValue = (col: string, val: any, rowIdx: number) => {
      const absoluteRowIdx = startIndex + rowIdx;
      const editKey = `${absoluteRowIdx}-${col}`;
      const isPending = pendingEdits[editKey] !== undefined;
      const displayVal = isPending ? pendingEdits[editKey] : val;

      if (isAdvancedMode && editingCell?.rowIdx === absoluteRowIdx && editingCell?.col === col) {
         return (
            <input 
               ref={editInputRef}
               type="text"
               defaultValue={String(displayVal ?? '')}
               className="w-full bg-white dark:bg-slate-700 border-2 border-orange-500 rounded px-1 py-0.5 outline-none font-mono text-sm"
               onBlur={(e) => {
                  if (onUpdateCell && e.target.value !== String(val ?? '')) {
                     onUpdateCell(absoluteRowIdx, col, e.target.value);
                  }
                  setEditingCell(null);
               }}
               onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setEditingCell(null);
               }}
            />
         );
      }

      if (displayVal === null || displayVal === undefined) {
         return <span className={`text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-tight border ${isPending ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-slate-200 dark:border-slate-700'}`}>NULL</span>;
      }

      if (typeof displayVal === 'boolean') {
         return (
            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
               displayVal ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' 
                   : 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
            } ${isPending ? 'ring-1 ring-orange-500' : ''}`}>
               {String(displayVal)}
            </span>
         );
      }

      if (typeof displayVal === 'object') {
         return <button onClick={(e) => { e.stopPropagation(); onOpenJson(displayVal); }} className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-indigo-100 transition-colors"><Braces className="w-3 h-3" /> JSON</button>;
      }
      
      const links = getLinksForColumn(col);
      if (links.length > 0 && displayVal !== '') {
         return (
            <button 
               onClick={(e) => { 
                  e.stopPropagation(); 
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

                  if (links.length === 1) {
                     setHoverPreview(null);
                     onDrillDown(links[0].table, links[0].keyCol, displayVal, links);
                  } else {
                     setHoverPreview({ links, val: displayVal, x: e.clientX, y: e.clientY, persistent: true });
                  }
               }} 
               onMouseEnter={(e) => {
                  const x = e.clientX;
                  const y = e.clientY;
                  if (!hoverPreview?.persistent && links.some(l => l.previewCol)) {
                     hoverTimeoutRef.current = setTimeout(() => {
                        setHoverPreview({ links, val: displayVal, x, y, persistent: false });
                     }, 350); 
                  }
               }}
               onMouseLeave={() => {
                  if (!hoverPreview?.persistent) {
                     if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                     setHoverPreview(null);
                  }
               }}
               className={`hover:underline flex items-center gap-1 group/link text-left min-w-0 ${links.length > 1 ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-600 dark:text-indigo-400'} ${isPending ? 'bg-orange-50 dark:bg-orange-900/20 px-1 rounded border border-orange-200' : ''}`}
            >
               <span className="truncate">{highlightMatch(String(displayVal))}</span>
               {links.length > 1 ? <Layers className="w-3 h-3 shrink-0" /> : <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 shrink-0" />}
            </button>
         );
      }
      return <span className={`truncate block ${isPending ? 'text-orange-600 dark:text-orange-400 font-bold' : ''}`}>{highlightMatch(String(displayVal))}</span>;
   };

   return (
      <div className="flex flex-col h-full relative" onClick={() => setHoverPreview(prev => prev?.persistent ? null : prev)}>
         {hoverPreview && credentials && schema && (
            <HoverPreviewTooltip 
               links={hoverPreview.links.filter(l => !!l.previewCol || hoverPreview.persistent)}
               value={hoverPreview.val}
               credentials={credentials}
               schema={schema}
               x={hoverPreview.x}
               y={hoverPreview.y}
               isPersistent={hoverPreview.persistent}
               onClose={() => setHoverPreview(null)}
               onSelect={(tbl, key, all) => {
                  setHoverPreview(null);
                  onDrillDown(tbl, key, hoverPreview.val, all);
               }}
            />
         )}

         <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse table-fixed">
               <thead className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
                  <tr>
                     {columns.map((col, idx) => {
                        const links = manualMappings[col] || [];
                        const hasManualMapping = links.length > 0;

                        return (
                           <th key={col} className={`px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 w-[180px] group relative ${idx === 0 ? 'pl-6' : ''}`}>
                              <div className="flex items-center justify-between min-w-0">
                                 <span className="truncate" title={col}>{col.replace(/_/g, ' ')}</span>
                                 <div className="flex items-center gap-1 shrink-0 ml-1">
                                    {schema && (
                                       <button 
                                          onClick={(e) => { e.stopPropagation(); setActiveMappingCol(activeMappingCol === col ? null : col); setActiveProfileCol(null); }} 
                                          className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-all ${hasManualMapping ? 'text-purple-500 opacity-100' : 'opacity-0 group-hover:opacity-100 text-slate-300'}`}
                                          title={hasManualMapping ? `${links.length} vínculos ativos` : "Vincular colunas manualmente"}
                                       >
                                          {hasManualMapping ? <LinkIcon className="w-3.5 h-3.5" /> : <Anchor className="w-3.5 h-3.5" />}
                                       </button>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); setActiveProfileCol(activeProfileCol === col ? null : col); setActiveMappingCol(null); }} className="p-1 rounded opacity-0 group-hover:opacity-100 text-slate-300 hover:text-indigo-500"><Info className="w-3.5 h-3.5" /></button>
                                 </div>
                              </div>

                              {activeMappingCol === col && schema && (
                                 <ManualMappingPopover 
                                    column={col} 
                                    schema={schema} 
                                    currentLinks={links}
                                    onSave={(newLinks) => handleSaveManualLinks(col, newLinks)} 
                                    onClose={() => setActiveMappingCol(null)} 
                                 />
                              )}

                              {activeProfileCol === col && <div onClick={e => e.stopPropagation()} className="absolute top-full left-0 z-50 mt-1"><ColumnProfiler data={data} column={col} onClose={() => setActiveProfileCol(null)} /></div>}
                           </th>
                        );
                     })}
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {currentData.map((row, rowIdx) => {
                     const absRowIdx = startIndex + rowIdx;
                     return (
                        <tr key={rowIdx} onClick={() => !isAdvancedMode && onRowClick(row)} className={`group hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors h-[40px] ${isAdvancedMode ? '' : 'cursor-pointer'}`}>
                           {columns.map((col, cIdx) => (
                              <td 
                                 key={col} 
                                 className={`px-4 py-2 text-sm text-slate-600 dark:text-slate-300 truncate ${cIdx === 0 ? 'pl-6 font-medium' : ''} ${isAdvancedMode ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : ''}`}
                                 onClick={(e) => {
                                    if (isAdvancedMode) {
                                       e.stopPropagation();
                                       setEditingCell({rowIdx: absRowIdx, col});
                                    }
                                 }}
                              >
                                 {formatValue(col, row[col], rowIdx)}
                              </td>
                           ))}
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
         <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <div className="flex items-center gap-4 pl-4">
               <span>{startIndex + 1}-{Math.min(startIndex + rowsPerPage, totalRows)} de {totalRows}</span>
               <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="bg-transparent border border-slate-200 dark:border-slate-700 rounded py-0.5 px-1 font-bold outline-none cursor-pointer">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={100}>100</option>
               </select>
            </div>
            <div className="flex gap-1 pr-2">
               <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
               <span className="px-2 py-1 font-mono">{currentPage}/{Math.max(totalPages, 1)}</span>
               <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
         </div>
      </div>
   );
};

const ColumnProfiler: React.FC<{ data: any[], column: string, onClose: () => void }> = ({ data, column, onClose }) => {
   const stats = useMemo(() => {
      const values = data.map(r => r[column]);
      const nonNulls = values.filter(v => v !== null && v !== undefined && v !== '');
      const distinct = new Set(nonNulls).size;
      const nulls = values.length - nonNulls.length;
      return { count: values.length, distinct, nulls };
   }, [data, column]);

   return (
      <div className="w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 animate-in fade-in zoom-in-95 origin-top-left" onMouseLeave={onClose}>
         <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100 dark:border-slate-700">
            <h4 className="font-bold text-xs text-slate-800 dark:text-white truncate">{column}</h4>
         </div>
         <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
               <span className="block text-slate-400 mb-0.5">Únicos</span>
               <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{stats.distinct}</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
               <span className="block text-slate-400 mb-0.5">Nulos</span>
               <span className={`font-mono font-bold ${stats.nulls > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{stats.nulls}</span>
            </div>
         </div>
      </div>
   );
};

const ExplainVisualizer = ({ plan, loading, error }: { plan: ExplainNode | null, loading: boolean, error: string | null }) => {
   if (loading) return <div className="p-10 text-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div><p className="text-slate-500">Analisando performance...</p></div>;
   if (error) return <div className="p-10 text-center flex flex-col items-center justify-center text-slate-400"><div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="w-8 h-8 text-red-500" /></div><h3 className="text-slate-700 dark:text-slate-200 font-bold mb-1">Falha na Análise</h3><p className="text-sm max-w-md">{error}</p></div>;
   if (!plan) return <div className="p-10 text-center text-slate-400">Nenhum plano disponível.</div>;
   
   const renderNode = (node: ExplainNode, depth: number = 0) => (
      <div key={Math.random()} style={{ marginLeft: depth * 20 }} className="mb-2 group">
         <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 shadow-sm inline-block min-w-[300px] hover:border-indigo-400 transition-colors">
            <div className="flex justify-between font-bold text-xs text-slate-700 dark:text-slate-200"><span className="text-indigo-600 dark:text-indigo-400">{node.type}</span><span className="text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 rounded-full">{(node.cost.total || 0).toFixed(2)} cost</span></div>
            {node.relation && <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 font-mono font-bold">{node.relation}</div>}
            <div className="text-[10px] text-slate-500 mt-2 flex gap-4 pt-2 border-t border-slate-100 dark:border-slate-700"><span className="flex items-center gap-1"><Hash className="w-3 h-3" /> Rows: {node.rows}</span><span className="flex items-center gap-1"><Database className="w-3 h-3" /> Width: {node.width}</span></div>
         </div>
         {node.children && node.children.map(child => renderNode(child, depth + 1))}
      </div>
   );
   return <div className="p-6 overflow-auto bg-slate-50 dark:bg-slate-900 h-full">{renderNode(plan)}</div>;
};

interface FilterRule {
   id: string;
   column: string;
   operator: 'contains' | 'equals' | 'starts' | 'ends' | 'gt' | 'lt';
   value: string;
}

const SmartFilterBar: React.FC<{ columns: string[], filters: FilterRule[], onChange: (filters: FilterRule[]) => void, onClear: () => void }> = ({ columns, filters, onChange, onClear }) => {
   const [isOpen, setIsOpen] = useState(filters.length > 0);
   const addFilter = () => { onChange([...filters, { id: crypto.randomUUID(), column: columns[0] || '', operator: 'contains', value: '' }]); setIsOpen(true); };
   const updateFilter = (id: string, field: keyof FilterRule, value: string) => { onChange(filters.map(f => f.id === id ? { ...f, [field]: value } : f)); };
   const removeFilter = (id: string) => { const newFilters = filters.filter(f => f.id !== id); onChange(newFilters); if (newFilters.length === 0) setIsOpen(false); };
   if (!isOpen && filters.length === 0) return <button onClick={addFilter} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-300 transition-colors"><SlidersHorizontal className="w-3.5 h-3.5" /> Filtros</button>;
   return <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2"><div className="flex items-center justify-between mb-2 px-1"><span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Filtros Locais</span><button onClick={() => { onClear(); setIsOpen(false); }} className="text-[10px] text-red-500 hover:underline">Limpar</button></div><div className="space-y-2">{filters.map(f => (<div key={f.id} className="flex items-center gap-2"><select value={f.column} onChange={(e) => updateFilter(f.id, 'column', e.target.value)} className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none focus:border-indigo-500 max-w-[120px]">{columns.map(c => <option key={c} value={c}>{c}</option>)}</select><select value={f.operator} onChange={(e) => updateFilter(f.id, 'operator', e.target.value as any)} className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none focus:border-indigo-500"><option value="contains">Contém</option><option value="equals">Igual</option><option value="starts">Começa com</option><option value="gt">Maior que (&gt;)</option><option value="lt">Menor que (&lt;)</option></select><input type="text" value={f.value} onChange={(e) => updateFilter(f.id, 'value', e.target.value)} placeholder="Valor..." className="text-xs flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none focus:border-indigo-500 min-w-[80px]" /><button onClick={() => removeFilter(f.id)} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button></div>))}<button onClick={addFilter} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline px-1"><Plus className="w-3 h-3" /> Adicionar Regra</button></div></div>;
};

interface ResultsStepProps {
  data: any[];
  sql: string;
  onBackToBuilder: () => void;
  onNewConnection: () => void;
  settings?: AppSettings;
  onAddToDashboard?: (item: Omit<DashboardItem, 'id' | 'createdAt'>) => void; 
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  credentials?: any; 
  executionDuration?: number;
  schema?: DatabaseSchema;
}

type ResultTab = 'table' | 'chart' | 'terminal' | 'analysis' | 'explain';

const ResultsStep: React.FC<ResultsStepProps> = ({ data, sql, onBackToBuilder, onNewConnection, settings, onAddToDashboard, onShowToast, credentials, executionDuration, schema }) => {
  const [activeTab, setActiveTab] = useState<ResultTab>('table');
  const [localData, setLocalData] = useState(data); 
  const columns = localData.length > 0 ? Object.keys(localData[0]) : [];
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [localSearch, setLocalSearch] = useState(''); 
  const [explainPlan, setExplainPlan] = useState<ExplainNode | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [viewJson, setViewJson] = useState<any | null>(null);
  const [drillDownTarget, setDrillDownTarget] = useState<{table: string, col: string, val: any, allLinks?: ManualLink[]} | null>(null);
  
  const [pendingEdits, setPendingEdits] = useState<Record<string, string>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const mainTableName = useMemo(() => {
     const fromMatch = sql.match(/FROM\s+([a-zA-Z0-9_."]+)/i);
     if (fromMatch) return fromMatch[1].replace(/"/g, '');
     return null;
  }, [sql]);

  useEffect(() => { if (data) addToHistory({ sql, rowCount: data.length, durationMs: executionDuration || 0, status: 'success', schemaName: 'Database' }); }, []);

  const filteredData = React.useMemo(() => {
     let res = localData || [];
     if (filters.length > 0) {
        res = res.filter(row => filters.every(f => {
              const val = row[f.column];
              const strVal = String(val || '').toLowerCase();
              /* Fixed: explicitly use String() to ensure f.value is handled as a string by the TS compiler */
              const filterVal = String(f.value || '').toLowerCase();
              if (f.value === '') return true;
              switch(f.operator) {
                 case 'contains': return strVal.includes(filterVal);
                 case 'equals': return strVal === filterVal;
                 case 'starts': return strVal.startsWith(filterVal);
                 case 'ends': return strVal.endsWith(filterVal);
                 case 'gt': return Number(val) > Number(f.value);
                 case 'lt': return Number(val) < Number(f.value);
                 default: return true;
              }
           }));
     }
     if (localSearch) res = res.filter(row => Object.values(row).some(val => String(val || '').toLowerCase().includes(localSearch.toLowerCase())));
     return res;
  }, [localData, filters, localSearch]);

  const ansiTableString = useMemo(() => {
    if (filteredData.length === 0) return "Nenhum dado retornado para os filtros atuais.";
    
    const cols = Object.keys(filteredData[0]);
    const colWidths = cols.map(col => {
      return Math.max(col.length, ...filteredData.map(row => {
        const v = row[col];
        return v === null ? 4 : String(v).length;
      }));
    });

    const reset = "\x1b[0m";
    const green = "\x1b[32m";
    const blue = "\x1b[34m";
    const yellow = "\x1b[33m";
    const red = "\x1b[31m";
    const cyan = "\x1b[36m";

    let out = "";
    out += "┌" + colWidths.map(w => "─".repeat(w + 2)).join("┬") + "┐\n";
    out += "│ " + cols.map((col, i) => `${blue}${col.padEnd(colWidths[i])}${reset}`).join(" │ ") + " │\n";
    out += "├" + colWidths.map(w => "─".repeat(w + 2)).join("┼") + "┤\n";
    filteredData.forEach(row => {
      out += "│ " + cols.map((col, i) => {
        const val = row[col];
        let str = val === null ? 'NULL' : String(val);
        let color = "";
        if (val === null) color = red;
        else if (typeof val === 'boolean') color = val ? green : red;
        else if (typeof val === 'number') color = yellow;
        else if (col.toLowerCase().includes('id') || col.toLowerCase() === 'grid') color = cyan;
        return `${color}${str.padEnd(colWidths[i])}${reset}`;
      }).join(" │ ") + " │\n";
    });
    out += "└" + colWidths.map(w => "─".repeat(w + 2)).join("┴") + "┘";
    return out;
  }, [filteredData]);

  const highlightMatch = (text: string) => {
    const term = localSearch || filters.find(f => f.operator === 'contains')?.value || '';
    if (!term) return text;
    const escapedSearch = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedSearch})`, 'gi'));
    return <>{parts.map((part, i) => part.toLowerCase() === term.toLowerCase() ? <span key={i} className="bg-yellow-200 dark:bg-yellow-600/50 text-slate-900 dark:white font-semibold rounded px-0.5">{part}</span> : part)}</>;
  };

  const handleUpdateCell = (rowIdx: number, colKey: string, newValue: string) => {
     if (!settings?.advancedMode) return;
     const editKey = `${rowIdx}-${colKey}`;
     setPendingEdits(prev => ({ ...prev, [editKey]: newValue }));
  };

  const sqlStatementsPreview = useMemo(() => {
    if (Object.keys(pendingEdits).length === 0) return "";
    const tableName = mainTableName || "table_name";
    let lines = ["BEGIN;"];
    const editsByRow: Record<number, Record<string, string>> = {};
    Object.entries(pendingEdits).forEach(([key, val]) => {
       const [rowIdx] = key.split('-').map(Number);
       const col = key.split('-').slice(1).join('-');
       if (!editsByRow[rowIdx]) editsByRow[rowIdx] = {};
       editsByRow[rowIdx][col] = val;
    });

    for (const [rowIdxStr, cols] of Object.entries(editsByRow)) {
       const rowIdx = Number(rowIdxStr);
       const row = localData[rowIdx];
       let pkCol = 'id';
       let pkVal = row['id'] ?? row['grid'];
       if (!pkVal && schema) {
          const t = schema.tables.find(tbl => tableName.includes(tbl.name));
          const pk = t?.columns.find(c => c.isPrimaryKey);
          if (pk) {
             pkCol = pk.name;
             pkVal = row[pk.name];
          }
       }
       if (pkVal === undefined) continue;
       const setClause = Object.entries(cols).map(([col, val]) => `"${col}" = '${val.replace(/'/g, "''")}'`).join(', ');
       lines.push(`UPDATE ${tableName} SET ${setClause} WHERE "${pkCol}" = ${pkVal};`);
    }
    lines.push("COMMIT;");
    return lines.join('\n');
  }, [pendingEdits, localData, mainTableName, schema]);

  const handleSaveChanges = async () => {
    if (!credentials || !sqlStatementsPreview) return;
    setIsSaving(true);
    try {
       await executeQueryReal(credentials, sqlStatementsPreview);
       const newData = [...localData];
       Object.entries(pendingEdits).forEach(([key, val]) => {
          const [rowIdx] = key.split('-').map(Number);
          const col = key.split('-').slice(1).join('-');
          newData[rowIdx] = { ...newData[rowIdx], [col]: val };
       });
       setLocalData(newData);
       setPendingEdits({});
       onShowToast("Transação concluída e alterações salvas.", "success");
    } catch (e: any) {
       onShowToast(`Erro ao salvar: ${e.message}`, "error");
    } finally {
       setIsSaving(false);
       setShowConfirmation(false);
    }
  };

  const handleChartDrillDown = (col: string, val: any) => { 
    if (mainTableName) setDrillDownTarget({ table: mainTableName, col, val }); 
  }; 
  
  const handleExportInsert = () => { 
    if (filteredData.length === 0) return; 
    const tableName = "exported_data"; 
    const cols = columns.join(', '); 
    const statements = (filteredData as any[]).map((row: any) => { 
      const values = columns.map(col => { 
        const val: any = row[col]; 
        if (val === null) return 'NULL'; 
        if (typeof val === 'string') return `'${(val as string).replace(/'/g, "''")}'`; 
        return String(val); 
      }).join(', '); 
      return `INSERT INTO ${tableName} (${cols}) VALUES (${values});`; 
    }).join('\n'); 
    navigator.clipboard.writeText(statements); 
    setShowExportMenu(false); 
    onShowToast("SQL INSERTs copiados!", "success"); 
  }; 
  
  const handleExplain = async () => { 
    setActiveTab('explain'); 
    setExplainError(null); 
    if (!explainPlan && credentials) { 
      setLoadingExplain(true); 
      try { 
        const plan = await explainQueryReal(credentials, sql); 
        setExplainPlan(plan); 
      } catch (e: any) { 
        setExplainError(e.message || "Erro ao analisar performance."); 
      } finally { 
        setLoadingExplain(false); 
      } 
    } 
  }; 
  
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  const hasPendingEdits = Object.keys(pendingEdits).length > 0;

  return (
    <div className={`h-full flex flex-col space-y-4 ${isFullscreen ? 'fixed inset-0 z-[100] bg-[#0f172a] p-6' : ''}`}>
      {selectedRow && <RowInspector row={selectedRow} onClose={() => setSelectedRow(null)} />}
      {viewJson && <JsonViewerModal json={viewJson} onClose={() => setViewJson(null)} />}
      {drillDownTarget && (
        <DrillDownModal 
           targetTable={drillDownTarget.table} 
           filterColumn={drillDownTarget.col} 
           filterValue={drillDownTarget.val} 
           credentials={credentials || null} 
           onClose={() => setDrillDownTarget(null)} 
           schema={schema}
           allLinks={drillDownTarget.allLinks}
           settings={settings}
        />
      )}
      {showCodeModal && <CodeSnippetModal sql={sql} onClose={() => setShowCodeModal(false)} />}
      
      {showConfirmation && (
         <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
               <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-red-900/30 text-red-600 mx-auto rounded-full flex items-center justify-center mb-4">
                     <ShieldAlert className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-red-400 mb-2 uppercase tracking-tight">Certeza Absoluta?</h3>
                  <p className="text-sm text-slate-400 mb-6 px-4">
                     Você está prestes a gravar <strong>{Object.keys(pendingEdits).length}</strong> alteração(ões) diretamente no banco de dados. <br/>
                     O script SQL abaixo será executado dentro de um bloco de transação.
                  </p>
                  <div className="bg-slate-900 rounded-xl p-3 mb-6 text-left border border-slate-700 shadow-inner">
                     <p className="text-[9px] text-slate-500 font-mono mb-2 uppercase tracking-widest border-b border-slate-800 pb-1">Script para Execução:</p>
                     <pre className="text-[10px] text-emerald-500 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar leading-tight">
                        {sqlStatementsPreview}
                     </pre>
                  </div>
                  <div className="flex gap-3 px-2">
                     <button onClick={() => setShowConfirmation(false)} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-bold transition-all">Cancelar</button>
                     <button onClick={handleSaveChanges} disabled={isSaving} className="flex-[2] px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Sim, Confirmar COMMIT
                     </button>
                  </div>
               </div>
            </div>
         </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
           {isFullscreen && <button onClick={toggleFullscreen} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"><Minimize2 className="w-5 h-5 text-slate-300" /></button>}
           <div><h2 className="text-xl font-bold text-white flex items-center gap-3">Resultados<span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-1 rounded-full border border-slate-700 shadow-sm">{filteredData.length} registros</span>{settings?.advancedMode && <span className="text-[10px] bg-orange-900/40 text-orange-400 px-2 py-0.5 rounded font-bold border border-orange-500/50 flex items-center gap-1"><PenTool className="w-3 h-3" /> Modo Edição</span>}</h2></div>
        </div>
        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 shadow-sm overflow-x-auto">
           {[
             { id: 'table', icon: <FileSpreadsheet className="w-4 h-4" />, label: 'Tabela' },
             { id: 'terminal', icon: <TerminalIcon className="w-4 h-4" />, label: 'Terminal (ANSI)' },
             { id: 'chart', icon: <BarChart2 className="w-4 h-4" />, label: 'Gráficos' },
             { id: 'analysis', icon: <MessageSquare className="w-4 h-4" />, label: 'AI Analyst' },
             { id: 'explain', icon: <Activity className="w-4 h-4" />, label: 'Performance' }
           ].map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id as ResultTab); if(tab.id === 'explain') handleExplain(); }} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-900/50 text-indigo-300' : 'text-slate-500 hover:text-slate-300'}`}>{tab.icon} {tab.label}</button>
           ))}
        </div>
        <div className="flex items-center gap-2">
           {hasPendingEdits && (
              <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                 <button onClick={() => setPendingEdits({})} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-700 transition-all"><Undo2 className="w-4 h-4" /> Descartar</button>
                 <button onClick={() => setShowConfirmation(true)} className="flex items-center gap-2 px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-bold shadow-lg transition-all"><Save className="w-4 h-4" /> Gravar Alterações</button>
              </div>
           )}

           {activeTab === 'table' && !hasPendingEdits && (<div className="flex items-center gap-2"><SmartFilterBar columns={columns} filters={filters} onChange={setFilters} onClear={() => setFilters([])} />{filters.length === 0 && (<div className="relative group"><Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" /><input type="text" placeholder="Busca rápida..." value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} className="pl-8 pr-4 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-48 text-slate-200" /></div>)}</div>)}
           <div className="relative">
              <button onClick={() => setShowExportMenu(!showExportMenu)} className={`flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-700 shadow-sm transition-colors text-slate-300 ${showExportMenu ? 'ring-2 ring-indigo-500' : ''}`}><Download className="w-4 h-4" /> Exportar</button>
              {showExportMenu && (<div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 rounded-xl shadow-xl border border-slate-700 z-[90] overflow-hidden animate-in fade-in zoom-in-95" onClick={() => setShowExportMenu(false)}><div className="p-2 border-b border-slate-700"><button onClick={() => { setShowCodeModal(true); setShowExportMenu(false); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-700 rounded flex items-center gap-2 text-indigo-400 font-medium"><FileCode className="w-3.5 h-3.5" /> Exportar Código</button><button onClick={handleExportInsert} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-700 rounded flex items-center gap-2"><Database className="w-3.5 h-3.5" /> Copy as SQL INSERT</button></div><div className="p-2"><button onClick={() => { navigator.clipboard.writeText(JSON.stringify(filteredData)); onShowToast("JSON copiado!", "success"); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-700 rounded flex items-center gap-2"><FileJson className="w-3.5 h-3.5" /> Copy JSON Raw</button></div></div>)}
           </div>
           {!isFullscreen && <button onClick={toggleFullscreen} className="p-2 text-slate-500 hover:text-slate-200 transition-colors" title="Tela Cheia"><Maximize2 className="w-5 h-5" /></button>}
        </div>
      </div>

      <div id="results-content" className="flex-1 bg-slate-800 rounded-2xl border border-slate-700 shadow-sm overflow-hidden flex flex-col relative">
        {filteredData.length === 0 && data.length > 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8"><Filter className="w-12 h-12 opacity-30 mb-4" /><p>Nenhum resultado corresponde aos filtros atuais.</p></div>
        ) : data.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8"><Database className="w-12 h-12 opacity-30 mb-4" /><p>Nenhum resultado retornado</p></div>
        ) : (
          <>
            {activeTab === 'table' && (
              <VirtualTable 
                 data={filteredData} 
                 columns={columns} 
                 highlightMatch={highlightMatch} 
                 onRowClick={(row) => !settings?.advancedMode && setSelectedRow(row)} 
                 isAdvancedMode={settings?.advancedMode} 
                 onUpdateCell={handleUpdateCell} 
                 onOpenJson={setViewJson} 
                 onDrillDown={(table, col, val, allLinks) => setDrillDownTarget({ table, col, val, allLinks })} 
                 schema={schema} 
                 defaultTableName={mainTableName} 
                 credentials={credentials} 
                 pendingEdits={pendingEdits}
              />
            )}
            {activeTab === 'terminal' && <AnsiTerminal text={ansiTableString} />}
            {activeTab === 'chart' && <div className="p-6 h-full w-full relative"><DataVisualizer data={filteredData} onDrillDown={handleChartDrillDown} /> </div>}
            {activeTab === 'analysis' && <div className="flex-1 h-full"><DataAnalysisChat data={filteredData} sql={sql} /></div>}
            {activeTab === 'explain' && <ExplainVisualizer plan={explainPlan} loading={loadingExplain} error={explainError} />}
          </>
        )}
      </div>

      {!isFullscreen && (
         <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
               <button onClick={onNewConnection} className="text-slate-500 hover:text-slate-300 text-sm flex items-center gap-2 px-2 py-1"><Database className="w-4 h-4" /> Nova Conexão</button>
               {executionDuration !== undefined && executionDuration > 0 && (<span className="text-xs text-slate-500 flex items-center gap-1 bg-slate-800 px-2 py-1 rounded border border-slate-700"><Clock className="w-3 h-3" /> Executado em {executionDuration.toFixed(0)}ms</span>)}
            </div>
            <button onClick={onBackToBuilder} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</button>
         </div>
      )}
    </div>
  );
};

export default ResultsStep;
