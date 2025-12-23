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

const getTableId = (t: any) => `${t.schema || 'public'}.${t.name}`;

interface ManualLink {
  id: string;
  table: string;
  keyCol: string;
  previewCol: string;
}

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

  return (
    <div 
      className={`fixed z-[120] bg-slate-900 text-white p-3 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-3 min-w-[220px] max-w-[320px] ${isPersistent ? 'pointer-events-auto ring-2 ring-indigo-500' : 'pointer-events-none'}`}
      style={{ left: Math.min(x + 15, window.innerWidth - 340), top: Math.max(10, y - 10) }}
    >
      {isPersistent && (
         <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Escolher Destino</span>
            <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded"><X className="w-3.5 h-3.5 text-slate-50" /></button>
         </div>
      )}

      {links.map((link) => {
        const state = previews[link.id];
        return (
          <button 
            key={link.id} 
            disabled={!isPersistent}
            onClick={() => isPersistent && onSelect?.(link.table, link.keyCol, links)}
            className={`text-left flex flex-col w-full p-1.5 rounded-lg transition-colors ${isPersistent ? 'hover:bg-slate-800' : ''}`}
          >
            <div className="flex items-center justify-between mb-1 w-full">
               <div className="flex items-center gap-1.5">
                  <Database className="w-3 h-3 text-indigo-400" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase truncate">{link.table.split('.').pop()}</span>
               </div>
            </div>
            {state?.loading ? (
              <div className="flex items-center gap-2 text-xs opacity-50"><Loader2 className="w-3 h-3 animate-spin" /> <span>Carregando...</span></div>
            ) : state?.error ? (
              <span className="text-xs text-red-400 italic">Erro</span>
            ) : (
              <span className="text-sm font-bold text-indigo-100 truncate w-full">{state?.data || '---'}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

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

  const filteredTables = schema.tables.filter(t => 
    !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    onSave([...currentLinks, newLink]);
    setSelectedTable('');
    setKeyCol('');
    setPreviewCol('');
    setIsAdding(false);
  };

  return (
    <div className="absolute z-[100] top-full mt-2 right-0 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden" onClick={e => e.stopPropagation()}>
       <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase text-slate-500">Vínculos: {column}</span>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded"><X className="w-4 h-4" /></button>
       </div>
       <div className="p-3 space-y-4 max-h-[60vh] overflow-y-auto">
          {currentLinks.map(link => (
             <div key={link.id} className="flex items-center justify-between p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg group">
                <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 truncate">{link.table}</div>
                <button onClick={() => onSave(currentLinks.filter(l => l.id !== link.id))} className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Trash2 className="w-3.5 h-3.5" />
                </button>
             </div>
          ))}

          {isAdding ? (
             <div className="space-y-3 pt-2">
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Filtrar tabelas..." className="w-full p-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none" />
                <select value={selectedTable} onChange={e => setSelectedTable(e.target.value)} className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none">
                   <option value="">Selecione Tabela...</option>
                   {filteredTables.map(t => <option key={getTableId(t)} value={getTableId(t)}>{t.name}</option>)}
                </select>
                <select value={keyCol} onChange={e => setKeyCol(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none">
                   <option value="">Chave no Destino...</option>
                   {targetColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={previewCol} onChange={e => setPreviewCol(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none">
                   <option value="">Preview no Hover...</option>
                   {targetColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={handleAddLink} disabled={!selectedTable || !keyCol || !previewCol} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">Adicionar</button>
             </div>
          ) : (
             <button onClick={() => setIsAdding(true)} className="w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 text-xs font-bold hover:border-indigo-500 transition-colors flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Adicionar Vínculo</button>
          )}
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
   credentials?: any;
   pendingEdits?: Record<string, string>;
}

const VirtualTable = ({ data, columns, highlightMatch, onRowClick, isAdvancedMode, onUpdateCell, onOpenJson, onDrillDown, schema, credentials, pendingEdits = {} }: VirtualTableProps) => {
   const [currentPage, setCurrentPage] = useState(1);
   const [rowsPerPage, setRowsPerPage] = useState(25);
   const [activeMappingCol, setActiveMappingCol] = useState<string | null>(null);
   const [hoverPreview, setHoverPreview] = useState<{links: ManualLink[], val: any, x: number, y: number, persistent: boolean} | null>(null);

   const [manualMappings, setManualMappings] = useState<Record<string, ManualLink[]>>(() => {
      try {
         const stored = localStorage.getItem('psql-buddy-manual-drilldown-links-v2');
         return stored ? JSON.parse(stored) : {};
      } catch { return {}; }
   });

   const handleSaveManualLinks = (colName: string, links: ManualLink[]) => {
      const newMappings = { ...manualMappings };
      if (links.length === 0) delete newMappings[colName];
      else newMappings[colName] = links;
      setManualMappings(newMappings);
      localStorage.setItem('psql-buddy-manual-drilldown-links-v2', JSON.stringify(newMappings));
   };

   const totalRows = data.length;
   const totalPages = Math.ceil(totalRows / Math.max(rowsPerPage, 1));
   const startIndex = (currentPage - 1) * rowsPerPage;
   const currentData = data.slice(startIndex, startIndex + rowsPerPage);

   const formatValue = (col: string, val: any, rowIdx: number) => {
      const editKey = `${startIndex + rowIdx}-${col}`;
      const isPending = pendingEdits[editKey] !== undefined;
      const displayVal = isPending ? pendingEdits[editKey] : val;

      if (displayVal === null || displayVal === undefined) return <span className="text-slate-400 italic">null</span>;
      if (typeof displayVal === 'object') return <button onClick={(e) => { e.stopPropagation(); onOpenJson(displayVal); }} className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">JSON</button>;
      
      const links = manualMappings[col] || [];
      if (links.length > 0 && displayVal !== '') {
         return (
            <button 
               onClick={(e) => { 
                  e.stopPropagation(); 
                  if (links.length === 1) onDrillDown(links[0].table, links[0].keyCol, displayVal, links);
                  else setHoverPreview({ links, val: displayVal, x: e.clientX, y: e.clientY, persistent: true });
               }} 
               className="text-indigo-600 dark:text-indigo-400 hover:underline text-left truncate block w-full"
            >
               {highlightMatch(String(displayVal))}
            </button>
         );
      }
      return <span className="truncate block w-full">{highlightMatch(String(displayVal))}</span>;
   };

   return (
      <div className="flex flex-col h-full relative">
         {hoverPreview && credentials && schema && (
            <HoverPreviewTooltip 
               links={hoverPreview.links} value={hoverPreview.val} credentials={credentials} schema={schema} 
               x={hoverPreview.x} y={hoverPreview.y} isPersistent={hoverPreview.persistent} 
               onClose={() => setHoverPreview(null)} onSelect={(tbl, key, all) => { setHoverPreview(null); onDrillDown(tbl, key, hoverPreview.val, all); }} 
            />
         )}
         <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse table-fixed">
               <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                  <tr>
                     {columns.map((col) => (
                        <th key={col} className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 group relative">
                           <div className="flex items-center justify-between">
                              <span className="truncate">{col}</span>
                              <button onClick={() => setActiveMappingCol(activeMappingCol === col ? null : col)} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-200 text-slate-400"><Anchor className="w-3.5 h-3.5" /></button>
                           </div>
                           {activeMappingCol === col && schema && (
                              <ManualMappingPopover column={col} schema={schema} currentLinks={manualMappings[col] || []} onSave={(newLinks) => handleSaveManualLinks(col, newLinks)} onClose={() => setActiveMappingCol(null)} />
                           )}
                        </th>
                     ))}
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currentData.map((row, rowIdx) => (
                     <tr key={rowIdx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        {columns.map((col) => (
                           <td key={col} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 truncate">
                              {formatValue(col, row[col], rowIdx)}
                           </td>
                        ))}
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
         <div className="p-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs text-slate-500 shrink-0">
            <span>{startIndex + 1}-{Math.min(startIndex + rowsPerPage, totalRows)} de {totalRows}</span>
            <div className="flex gap-2">
               <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
               <span className="px-2">{currentPage}/{totalPages}</span>
               <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
         </div>
      </div>
   );
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
   const removeFilter = (id: string) => { const n = filters.filter(f => f.id !== id); onChange(n); if (n.length === 0) setIsOpen(false); };
   const updateFilter = (id: string, field: keyof FilterRule, val: string) => onChange(filters.map(f => f.id === id ? { ...f, [field]: val } : f));

   if (!isOpen && filters.length === 0) return <button onClick={addFilter} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"><SlidersHorizontal className="w-3.5 h-3.5" /> Filtros</button>;
   return (
      <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
         <div className="flex justify-between items-center mb-2 px-1"><span className="text-[10px] font-bold uppercase text-slate-400">Filtros</span><button onClick={onClear} className="text-[10px] text-red-500">Limpar</button></div>
         <div className="space-y-2">{filters.map(f => (
            <div key={f.id} className="flex gap-2">
               <select value={f.column} onChange={e => updateFilter(f.id, 'column', e.target.value)} className="text-xs p-1 bg-white dark:bg-slate-800 border rounded">{columns.map(c => <option key={c} value={c}>{c}</option>)}</select>
               <select value={f.operator} onChange={e => updateFilter(f.id, 'operator', e.target.value as any)} className="text-xs p-1 bg-white dark:bg-slate-800 border rounded"><option value="contains">Contém</option><option value="equals">Igual</option></select>
               <input value={f.value} onChange={e => updateFilter(f.id, 'value', e.target.value)} className="text-xs p-1 bg-white dark:bg-slate-800 border rounded flex-1" />
               <button onClick={() => removeFilter(f.id)}><X className="w-3.5 h-3.5 text-slate-400" /></button>
            </div>
         ))}<button onClick={addFilter} className="text-[10px] text-indigo-500 mt-2 font-bold">+ Filtro</button></div>
      </div>
   );
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

type ResultTab = 'table' | 'chart' | 'analysis';

const ResultsStep: React.FC<ResultsStepProps> = ({ data, sql, onBackToBuilder, onNewConnection, settings, onShowToast, credentials, executionDuration, schema }) => {
  const [activeTab, setActiveTab] = useState<ResultTab>('table');
  const [localSearch, setLocalSearch] = useState(''); 
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [viewJson, setViewJson] = useState<any | null>(null);
  const [drillDownTarget, setDrillDownTarget] = useState<{table: string, col: string, val: any, allLinks?: ManualLink[]} | null>(null);
  
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  useEffect(() => { if (data) addToHistory({ sql, rowCount: data.length, durationMs: executionDuration || 0, status: 'success', schemaName: 'Database' }); }, []);

  const filteredData = useMemo(() => {
     return data.filter(row => {
        const matchesSearch = !localSearch || Object.values(row).some(v => String(v || '').toLowerCase().includes(localSearch.toLowerCase()));
        const matchesFilters = filters.every(f => {
           const val = (row as any)[f.column];
           const strVal = String(val || '').toLowerCase();
           const filterVal = String(f.value || '').toLowerCase();
           if (!f.value) return true;
           return f.operator === 'contains' ? strVal.includes(filterVal) : strVal === filterVal;
        });
        return matchesSearch && matchesFilters;
     });
  }, [data, localSearch, filters]);

  return (
    <div className="h-full flex flex-col space-y-4">
      {viewJson && <JsonViewerModal json={viewJson} onClose={() => setViewJson(null)} />}
      {drillDownTarget && <DrillDownModal targetTable={drillDownTarget.table} filterColumn={drillDownTarget.col} filterValue={drillDownTarget.val} credentials={credentials} onClose={() => setDrillDownTarget(null)} schema={schema} allLinks={drillDownTarget.allLinks} settings={settings} />}

      <div className="flex justify-between items-center shrink-0">
        <h2 className="text-xl font-bold text-white flex items-center gap-3">Resultados<span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-1 rounded-full border border-slate-700">{filteredData.length} registros</span></h2>
        <div className="flex gap-2">
           <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button onClick={() => setActiveTab('table')} className={`px-4 py-1.5 rounded-md text-sm transition-all ${activeTab === 'table' ? 'bg-indigo-900/50 text-indigo-300' : 'text-slate-500'}`}>Tabela</button>
              <button onClick={() => setActiveTab('chart')} className={`px-4 py-1.5 rounded-md text-sm transition-all ${activeTab === 'chart' ? 'bg-indigo-900/50 text-indigo-300' : 'text-slate-500'}`}>Gráficos</button>
              <button onClick={() => setActiveTab('analysis')} className={`px-4 py-1.5 rounded-md text-sm transition-all ${activeTab === 'analysis' ? 'bg-indigo-900/50 text-indigo-300' : 'text-slate-500'}`}>AI Analyst</button>
           </div>
           <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input type="text" placeholder="Busca rápida..." value={localSearch} onChange={e => setLocalSearch(e.target.value)} className="pl-8 pr-4 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm outline-none text-slate-200 w-48" />
           </div>
        </div>
      </div>

      <div className="flex-1 bg-slate-800 rounded-2xl border border-slate-700 shadow-sm overflow-hidden flex flex-col relative">
         {activeTab === 'table' && <VirtualTable data={filteredData} columns={columns} highlightMatch={t => t} onRowClick={() => {}} onOpenJson={setViewJson} onDrillDown={(table, col, val, allLinks) => setDrillDownTarget({ table, col, val, allLinks })} schema={schema} credentials={credentials} />}
         {activeTab === 'chart' && <div className="p-6 h-full"><DataVisualizer data={filteredData} /></div>}
         {activeTab === 'analysis' && <div className="flex-1 h-full"><DataAnalysisChat data={filteredData} sql={sql} /></div>}
      </div>

      <div className="flex justify-between items-center shrink-0">
         <div className="flex gap-4">
            <button onClick={onNewConnection} className="text-slate-500 hover:text-slate-300 text-sm flex items-center gap-2 px-2 py-1"><Database className="w-4 h-4" /> Nova Conexão</button>
            {executionDuration && <span className="text-xs text-slate-500 flex items-center gap-1 bg-slate-800 px-2 py-1 rounded border border-slate-700"><Clock className="w-3 h-3" /> {executionDuration.toFixed(0)}ms</span>}
         </div>
         <button onClick={onBackToBuilder} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      </div>
    </div>
  );
};

export default ResultsStep;