import React, { useState, useEffect, useRef, useMemo } from 'react';
// Add Terminal to the lucide-react imports to fix 'TerminalIcon' not found error
import { ArrowLeft, ArrowRight, Database, ChevronLeft, ChevronRight, FileSpreadsheet, Search, Copy, Check, BarChart2, MessageSquare, Download, Activity, LayoutGrid, FileText, Info, FileJson, FileCode, Hash, Filter, Plus, X, Trash2, Clock, Maximize2, Minimize2, ExternalLink, Braces, PenTool, Save, Eye, Anchor, Link as LinkIcon, Loader2, Layers, AlertTriangle, Undo2, ShieldAlert, Pencil, ArrowUp, ArrowDown, ArrowUpDown, History, RotateCcw, FileWarning, Gauge, Settings, EyeOff, GripVertical, Terminal } from 'lucide-react';
import { AppSettings, ExplainNode, DatabaseSchema, DbCredentials, ResultTab, FilterRule, TabResultsState } from '../../types';
import DataVisualizer from '../DataVisualizer';
import DataAnalysisChat from '../DataAnalysisChat';
import CodeSnippetModal from '../CodeSnippetModal';
import JsonViewerModal from '../JsonViewerModal'; 
import DrillDownModal from '../DrillDownModal'; 
import ProfilingSnapshotModal from '../ProfilingSnapshotModal';
import AdvancedExportModal from '../AdvancedExportModal';
import ExplainVisualizer from '../ExplainVisualizer';
import { addToHistory } from '../../services/historyService';
import { executeQueryReal, explainQueryReal, fetchDetailedProfiling } from '../../services/dbService';
import BeginnerTip from '../BeginnerTip';
import { toast } from 'react-hot-toast';

const getTableId = (t: any) => `${t.schema || 'public'}.${t.name}`;

const sanitizeAnsi = (str: string): string => {
   if (!str) return '';
   return str.replace(/[\uFFFD\uFFFE\uFFFF]/g, ''); 
};

interface ManualLink {
  id: string;
  table: string;
  keyCol: string;
  previewCol: string;
}

interface ResultsStepProps {
  data: any[];
  sql: string;
  onBackToBuilder: () => void;
  onNewConnection: () => void;
  settings: AppSettings;
  onShowToast: (message: string, type?: string) => void;
  credentials: DbCredentials | null;
  executionDuration?: number;
  schema?: DatabaseSchema;
  resultsState: TabResultsState;
  onResultsStateChange: (partial: Partial<TabResultsState>) => void;
}

const SmartFilterBar: React.FC<{
  columns: string[];
  filters: FilterRule[];
  onChange: (filters: FilterRule[]) => void;
  onClear: () => void;
}> = ({ columns, filters, onChange, onClear }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newCol, setNewCol] = useState(columns[0] || '');
  const [newOp, setNewOp] = useState<FilterRule['operator']>('contains');
  const [newVal, setNewVal] = useState('');

  const addFilter = () => {
    if (!newCol) return;
    onChange([...filters, { column: newCol, operator: newOp, value: newVal }]);
    setNewVal('');
    setShowAdd(false);
  };

  return (
    <div className="flex items-center gap-2">
      {filters.length > 0 && (
        <div className="flex gap-1 overflow-x-auto max-w-[300px] scrollbar-none">
          {filters.map((f, i) => (
            <div key={i} className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-lg text-[10px] font-bold border border-indigo-100 dark:border-indigo-800 whitespace-nowrap">
              <span>{f.column} {f.operator} {f.value}</span>
              <button onClick={() => onChange(filters.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></button>
            </div>
          ))}
          <button onClick={onClear} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      )}
      
      <div className="relative">
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${showAdd ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}
        >
          <Plus className="w-3.5 h-3.5" /> Filtros
        </button>
        
        {showAdd && (
          <div className="absolute top-full mt-2 right-0 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3 z-[100] animate-in fade-in zoom-in-95 origin-top-right">
            <div className="space-y-3">
              <select value={newCol} onChange={e => setNewCol(e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500">
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={newOp} onChange={e => setNewOp(e.target.value as any)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="contains">Contém</option>
                <option value="equals">Igual</option>
                <option value="starts">Começa com</option>
                <option value="ends">Termina com</option>
                <option value="gt">Maior que</option>
                <option value="lt">Menor que</option>
              </select>
              <input type="text" value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="Valor..." className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500" />
              <button onClick={addFilter} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">Aplicar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AnsiTerminal: React.FC<{ text: string }> = ({ text }) => {
  const parts: string[] = text.split(/(\x1b\[\d+m)/);
  let currentColor = "";
  return (
    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-2xl overflow-auto custom-scrollbar font-mono text-[11px] font-bold leading-tight min-h-[400px]">
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
               case "31": currentColor = "text-rose-500"; break;
               case "32": currentColor = "text-emerald-400"; break;
               case "33": currentColor = "text-amber-400"; break;
               case "34": currentColor = "text-blue-400"; break;
               case "36": currentColor = "text-cyan-400"; break;
               case "0": currentColor = ""; break;
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
          const tableObj = schema.tables.find(t => t.name.toLowerCase() === tName.toLowerCase() && (t.schema || 'public').toLowerCase() === sName.toLowerCase());
          if (!tableObj) { if (isMounted) setPreviews(prev => ({ ...prev, [link.id]: { data: 'Tabela não mapeada', loading: false, error: true } })); return; }
          const valStr = String(value).replace(/'/g, "''");
          const sql = `SELECT "${link.previewCol.replace(/"/g, '')}" FROM "${sName}"."${tName}" WHERE "${link.keyCol}"::text = '${valStr}' LIMIT 1;`;
          const results = await executeQueryReal(credentials, sql);
          if (isMounted) { if (results && results.length > 0) { const val = results[0][link.previewCol]; setPreviews(prev => ({ ...prev, [link.id]: { data: val === null ? 'NULL' : String(val), loading: false, error: false } })); } else { setPreviews(prev => ({ ...prev, [link.id]: { data: 'Não encontrado', loading: false, error: false } })); } }
        } catch (e) { if (isMounted) setPreviews(prev => ({ ...prev, [link.id]: { data: 'Erro', loading: false, error: true } })); }
      });
    };
    fetchAllPreviews();
    return () => { isMounted = false; };
  }, [links, value, credentials, schema]);
  const visibleLinks = links.slice(0, 3);
  const hiddenCount = links.length - 3;
  return (
    <div className={`fixed z-[120] bg-slate-900 text-white p-3 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-3 min-w-[220px] max-w-[320px] ${isPersistent ? 'pointer-events-auto ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900' : 'pointer-events-none'}`} style={{ left: Math.min(x + 15, window.innerWidth - 340), top: Math.max(10, y - 10) }} onClick={e => e.stopPropagation()}>
      {isPersistent && (
         <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Escolher Destino</span>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded"><X className="w-3.5 h-3.5 text-slate-50" /></button>
         </div>
      )}
      {visibleLinks.map((link, idx) => {
        const state = previews[link.id];
        return (
          <button key={link.id} disabled={!isPersistent} onClick={() => isPersistent && onSelect?.(link.table, link.keyCol, links)} className={`text-left group/item flex flex-col w-full rounded-lg transition-colors ${idx > 0 ? 'pt-2 border-t border-slate-800' : ''} ${isPersistent ? 'hover:bg-slate-800 p-1.5 -m-1.5' : ''}`}>
            <div className="flex items-center justify-between mb-1 w-full">
               <div className="flex items-center gap-1.5 overflow-hidden">
                  <Database className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className={`text-[9px] font-extrabold uppercase tracking-widest truncate ${isPersistent ? 'group-hover:text-indigo-300' : 'text-slate-50'}`}>{link.table.split('.').pop()}</span>
               </div>
               <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-1 rounded">{link.previewCol}</span>
                  {isPersistent && <ArrowRight className="w-2.5 h-2.5 text-slate-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />}
               </div>
            </div>
            {state?.loading ? (<div className="flex items-center gap-2 text-xs opacity-50"><Loader2 className="w-3 h-3 animate-spin" /> <span>Carregando...</span></div>) : state?.error ? (<span className="text-xs text-red-400 italic">Erro na consulta</span>) : (<span className={`text-sm font-bold whitespace-pre-wrap block transition-colors ${isPersistent ? 'text-indigo-100 group-hover:text-white' : 'text-indigo-100'}`}>{state?.data || '---'}</span>)}
          </button>
        );
      })}
      {hiddenCount > 0 && (<div className="pt-2 border-t border-slate-800 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500 uppercase italic"><Plus className="w-3 h-3" /> {hiddenCount} outros destinos</div>)}
      <div className="absolute top-3 -left-1 w-2 h-2 bg-slate-900 border-l border-b border-slate-700 transform rotate-45"></div>
    </div>
  );
};

const ManualMappingPopover: React.FC<{ column: string, schema: DatabaseSchema, onSave: (links: ManualLink[]) => void, onClose: () => void, currentLinks: ManualLink[] }> = ({ column, schema, onSave, onClose, currentLinks }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [keyCol, setKeyCol] = useState('');
  const [previewCol, setPreviewCol] = useState('');
  const [isAdding, setIsAdding] = useState(currentLinks.length === 0);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const schemasPresent = useMemo(() => Array.from(new Set(schema.tables.map(t => t.schema || 'public'))).sort(), [schema.tables]);
  const hasMultipleSchemas = schemasPresent.length > 1;
  const filteredAndSortedTables = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    let list = schema.tables.filter(t => !term || t.name.toLowerCase().includes(term) || (t.schema || 'public').toLowerCase().includes(term));
    if (term) { list.sort((a, b) => { const nameA = a.name.toLowerCase(); const nameB = b.name.toLowerCase(); if (nameA === term && nameB !== term) return -1; if (nameB === term && nameA !== term) return 1; const startsA = nameA.startsWith(term); const startsB = nameB.startsWith(term); if (startsA && !startsB) return -1; if (!startsA && startsB) return 1; return nameA.localeCompare(nameB); }); } else { list.sort((a, b) => a.name.localeCompare(b.name)); }
    return list;
  }, [schema.tables, searchTerm]);
  const targetColumns = useMemo(() => { if (!selectedTable) return []; const parts = selectedTable.split('.'); const s = parts.length > 1 ? parts[0] : 'public'; const t = parts.length > 1 ? parts[1] : parts[0]; const tbl = schema.tables.find(table => table.name === t && (table.schema || 'public') === s); return tbl ? tbl.columns.map(c => c.name).sort() : []; }, [selectedTable, schema]);
  const handleAddLink = () => { if (editingLinkId) { const updated = currentLinks.map(l => l.id === editingLinkId ? { ...l, table: selectedTable, keyCol, previewCol } : l); onSave(updated); } else { const newLink: ManualLink = { id: crypto.randomUUID(), table: selectedTable, keyCol, previewCol }; const updated = [...currentLinks, newLink]; onSave(updated); } setSelectedTable(''); setKeyCol(''); setPreviewCol(''); setIsAdding(false); setEditingLinkId(null); setSearchTerm(''); };
  const handleEditLink = (link: ManualLink) => { setEditingLinkId(link.id); setSelectedTable(link.table); setKeyCol(link.keyCol); setPreviewCol(link.previewCol); setIsAdding(true); };
  const handleRemoveLink = (id: string) => onSave(currentLinks.filter(l => l.id !== id));
  const handleKeyDownSearch = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && filteredAndSortedTables.length > 0) { e.preventDefault(); setSelectedTable(getTableId(filteredAndSortedTables[0])); } };
  return (
    <div className="absolute z-[100] top-full mt-2 right-0 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right flex flex-col" onClick={e => e.stopPropagation()}>
       <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center"><span className="text-[10px] font-bold uppercase text-slate-500 truncate mr-2">{editingLinkId ? 'Editando Vínculo' : `Vínculos: ${column}`}</span><button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded transition-colors"><X className="w-4 h-4" /></button></div>
       <div className="p-3 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {currentLinks.length > 0 && !editingLinkId && (<div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Vínculos Ativos ({currentLinks.length})</label>{currentLinks.map(link => (<div key={link.id} className="flex items-center justify-between p-2 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800 rounded-lg group"><div className="min-w-0"><div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 truncate">{link.table}</div><div className="text-[9px] text-indigo-400 flex items-center gap-1"><Hash className="w-2.5 h-2.5" /> {link.keyCol} <ArrowRight className="w-2 h-2" /> <Eye className="w-2.5 h-2.5" /> {link.previewCol}</div></div><div className="flex gap-1 opacity-0 group-hover:opacity-100"><button onClick={() => handleEditLink(link)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors" title="Editar vínculo"><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => handleRemoveLink(link.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Remover vínculo"><Trash2 className="w-3.5 h-3.5" /></button></div></div>))}</div>)}
          {isAdding ? (<div className="space-y-4 pt-2 animate-in slide-in-from-top-2"><div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Tabela de Destino</label><div className="relative"><Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" /><input autoFocus type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={handleKeyDownSearch} placeholder="Filtrar tabelas..." className="w-full pl-7 pr-2 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500" /></div><select size={5} value={selectedTable} onChange={e => setSelectedTable(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none custom-scrollbar">{filteredAndSortedTables.map(t => { const tableId = getTableId(t); const label = hasMultipleSchemas ? `${t.schema}.${t.name}` : t.name; return <option key={tableId} value={tableId}>{label}</option>; })}</select></div>{selectedTable && (<><div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Chave no Destino</label><select value={keyCol} onChange={e => setKeyCol(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none font-medium"><option value="">-- Selecione a Chave --</option>{targetColumns.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Preview no Hover</label><select value={previewCol} onChange={e => setPreviewCol(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none font-medium"><option value="">-- Selecione a Coluna --</option>{targetColumns.map(c => <option key={c} value={c}>{c}</option>)}</select></div><button onClick={handleAddLink} disabled={!selectedTable || !keyCol || !previewCol} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-sm">{editingLinkId ? 'Salvar Alterações' : 'Confirmar Alvo'}</button></>)}<button onClick={() => { setIsAdding(false); setEditingLinkId(null); }} className="w-full py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-bold">Cancelar</button></div>) : (<button onClick={() => setIsAdding(true)} className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 text-xs font-bold"><Plus className="w-4 h-4" /> Adicionar Outro Vínculo</button>)}
       </div>
    </div>
  );
};

const RowInspector: React.FC<{ row: any, onClose: () => void }> = ({ row, onClose }) => {
   const [searchTerm] = useState('');
   const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
   const entries = Object.entries(row || {});
   const filteredEntries = entries.filter(([key, val]) => key.toLowerCase().includes(searchTerm.toLowerCase()) || String(val || '').toLowerCase().includes(searchTerm.toLowerCase()));
   return (
      <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200" onClick={onClose}>
         <div className="bg-white dark:bg-slate-800 w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50"><div className="flex items-center gap-3"><div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded text-indigo-600 dark:text-indigo-400"><FileText className="w-4 h-4" /></div><h3 className="font-bold text-slate-800 dark:text-white">Detalhes do Registro</h3></div><div className="flex items-center gap-2"><div className="flex bg-slate-200 dark:bg-slate-700 rounded p-0.5"><button onClick={() => setViewMode('table')} className={`p-1.5 rounded text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-50'}`} title="Tabela"><LayoutGrid className="w-3.5 h-3.5" /></button><button onClick={() => setViewMode('json')} className={`p-1.5 rounded text-xs font-bold transition-all ${viewMode === 'json' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-50'}`} title="JSON"><Braces className="w-3.5 h-3.5" /></button></div><button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"><X className="w-5 h-5" /></button></div></div>
            <div className="flex-1 overflow-y-auto p-0 bg-slate-50 dark:bg-slate-900 custom-scrollbar">
               {viewMode === 'table' ? (
                  <table className="w-full text-left border-collapse">
                     <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredEntries.map(([key, val]) => (
                           <tr key={key} className="group hover:bg-white dark:hover:bg-slate-800 transition-colors">
                              <td className="px-4 py-3 w-1/3 bg-slate-100/50 dark:bg-slate-900/50 text-xs font-bold text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 font-mono break-all">{key}</td>
                              <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200 relative break-all whitespace-pre-wrap">
                                 {val === null ? <span className="text-slate-400 italic text-xs">null</span> : (typeof val === 'object' ? JSON.stringify(val, null, 2) : sanitizeAnsi(String(val)))}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               ) : (
                  <div className="p-4"><pre className="text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-all p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">{JSON.stringify(row || {}, null, 2)}</pre></div>
               )}
            </div>
         </div>
      </div>
   );
};

interface ColumnProfilerProps {
    data: any[];
    column: string;
    onClose: () => void;
}

const ColumnProfiler: React.FC<ColumnProfilerProps> = ({ data, column, onClose }) => {
   const stats = useMemo(() => { const values = data.map(r => r[column]); const nonNulls = values.filter(v => v !== null && v !== undefined && v !== ''); const distinct = new Set(nonNulls).size; const nulls = values.length - nonNulls.length; return { count: values.length, distinct, nulls }; }, [data, column]);
   return (<div className="w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 animate-in fade-in zoom-in-95 origin-top-left" onMouseLeave={onClose}><div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100 dark:border-slate-700"><h4 className="font-bold text-xs text-slate-800 dark:text-white truncate">{column}</h4></div><div className="grid grid-cols-2 gap-2 text-[10px]"><div className="bg-slate-50 dark:bg-slate-900 p-2 rounded"><span className="block text-slate-400 mb-0.5">Únicos</span><span className="font-mono font-bold text-slate-700 dark:text-slate-300">{stats.distinct}</span></div><div className="bg-slate-50 dark:bg-slate-900 p-2 rounded"><span className="block text-slate-400 mb-0.5">Nulos</span><span className={`font-mono font-bold ${stats.nulls > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{stats.nulls}</span></div></div></div>);
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
   pendingEdits?: Record<string, string>;
   settings?: AppSettings;
}

const VirtualTable = ({ data, columns, highlightMatch, onRowClick, isAdvancedMode, onUpdateCell, onOpenJson, onDrillDown, schema, credentials, pendingEdits = {}, settings }: VirtualTableProps) => {
   const [currentPage, setCurrentPage] = useState(1);
   const [rowsPerPage, setRowsPerPage] = useState(25);
   const [activeProfileCol, setActiveProfileCol] = useState<string | null>(null);
   const [activeMappingCol, setActiveMappingCol] = useState<string | null>(null);
   const [editingCell, setEditingCell] = useState<{rowIdx: number, col: string} | null>(null);
   const [unmaskedCells, setUnmaskedCells] = useState<Set<string>>(new Set());
   const editInputRef = useRef<HTMLInputElement>(null);
   const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: '', direction: null });
   const [hoverPreview, setHoverPreview] = useState<{links: ManualLink[], val: any, x: number, y: number, persistent: boolean} | null>(null);
   const hoverTimeoutRef = useRef<any>(null);
   const [manualMappings, setManualMappings] = useState<Record<string, ManualLink[]>>(() => { try { const stored = localStorage.getItem('psql-buddy-manual-drilldown-links-v2'); return stored ? JSON.parse(stored) : {}; } catch { return {}; } });

   const [orderedColumns, setOrderedColumns] = useState<string[]>(columns);
   const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
   const [draggedColIndex, setDraggedColIndex] = useState<number | null>(null);
   const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
   const resizingRef = useRef<{ col: string, startX: number, startWidth: number } | null>(null);

   useEffect(() => {
      const sortedNew = [...columns].sort().join(',');
      const sortedOld = [...orderedColumns].sort().join(',');
      if (sortedNew !== sortedOld) {
         setOrderedColumns(columns);
         const initialWidths: Record<string, number> = {};
         columns.forEach(c => initialWidths[c] = 180);
         setColumnWidths(initialWidths);
      }
   }, [columns]);

   useEffect(() => { if (editingCell && editInputRef.current) { editInputRef.current.focus(); editInputRef.current.select(); } }, [editingCell]);

   const handleResizeStart = (e: React.MouseEvent, col: string) => {
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = { col, startX: e.pageX, startWidth: columnWidths[col] || 180 };
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeStop);
      document.body.style.cursor = 'col-resize';
   };

   const handleResizeMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const { col, startX, startWidth } = resizingRef.current;
      const delta = e.pageX - startX;
      const newWidth = Math.max(80, startWidth + delta);
      setColumnWidths(prev => ({ ...prev, [col]: newWidth }));
   };

   const handleResizeStop = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeStop);
      document.body.style.cursor = '';
   };

   const handleAutoResize = (e: React.MouseEvent, col: string) => {
      e.preventDefault();
      e.stopPropagation();
      
      const headerTextWidth = col.length * 9;
      const headerIconsBuffer = 90;
      let maxWidth = headerTextWidth + headerIconsBuffer;

      data.forEach(row => {
         const val = row[col];
         const valStr = val === null ? 'NULL' : (typeof val === 'object' ? JSON.stringify(val) : String(val));
         const estimatedDataWidth = valStr.length * 7.5 + 32; 
         if (estimatedDataWidth > maxWidth) maxWidth = estimatedDataWidth;
      });

      const finalWidth = Math.min(Math.max(maxWidth, 100), 600);
      setColumnWidths(prev => ({ ...prev, [col]: finalWidth }));
      toast.success(`Auto-ajuste: ${col}`, { id: 'auto-resize', duration: 800 });
   };

   const handleSaveManualLinks = (colName: string, links: ManualLink[]) => { const newMappings = { ...manualMappings }; if (links.length === 0) { delete newMappings[colName]; } else { newMappings[colName] = links; } setManualMappings(newMappings); localStorage.setItem('psql-buddy-manual-drilldown-links-v2', JSON.stringify(newMappings)); };
   const handleSort = (col: string) => { setSortConfig(prev => { if (prev.key === col) { if (prev.direction === 'asc') return { key: col, direction: 'desc' }; return { key: '', direction: null }; } return { key: col, direction: 'asc' }; }); setCurrentPage(1); };
   const sortedData = useMemo(() => { if (!sortConfig.key || !sortConfig.direction) return data; return [...data].sort((a, b) => { const aVal = a[sortConfig.key]; const bVal = b[sortConfig.key]; if (aVal === bVal) return 0; if (aVal === null || aVal === undefined) return 1; if (bVal === null || bVal === undefined) return -1; let comparison = 0; if (typeof aVal === 'number' && typeof bVal === 'number') { comparison = aVal - bVal; } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') { comparison = aVal === bVal ? 0 : aVal ? 1 : -1; } else { comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' }); } return sortConfig.direction === 'asc' ? comparison : -comparison; }); }, [data, sortConfig]);
   const totalRows = sortedData.length;
   const totalPages = Math.ceil(totalRows / Math.max(rowsPerPage, 1));
   const startIndex = (currentPage - 1) * rowsPerPage;
   const currentData = sortedData.slice(startIndex, startIndex + rowsPerPage);
   
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

   const SENSITIVE_REGEX = /pass|pwd|token|key|email|cpf|cnpj|fone|phone|cel|card|ccv|secret|document|auth/i;

   const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedColIndex(index);
      e.dataTransfer.effectAllowed = 'move';
   };

   const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedColIndex === index) return;
      setDragOverIndex(index);
   };

   const handleDrop = (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (draggedColIndex === null || draggedColIndex === targetIndex) {
         setDraggedColIndex(null);
         setDragOverIndex(null);
         return;
      }
      const newOrder = [...orderedColumns];
      const [removed] = newOrder.splice(draggedColIndex, 1);
      newOrder.splice(targetIndex, 0, removed);
      setOrderedColumns(newOrder);
      setDraggedColIndex(null);
      setDragOverIndex(null);
      toast.success("Ordem das colunas atualizada.", { id: 'col-reorder', duration: 1000 });
   };

   const formatValue = (col: string, val: any, rowIdx: number) => {
      const absoluteRowIdx = startIndex + rowIdx;
      const cellKey = `${absoluteRowIdx}-${col}`;
      const isPending = pendingEdits[cellKey] !== undefined;
      const displayVal = isPending ? pendingEdits[cellKey] : val;
      const isSensitive = settings?.enableDataMasking && SENSITIVE_REGEX.test(col);
      const isRevealed = unmaskedCells.has(cellKey);

      if (isAdvancedMode && editingCell?.rowIdx === absoluteRowIdx && editingCell?.col === col) {
         return (
            <input ref={editInputRef} type="text" defaultValue={String(displayVal ?? '')} className="w-full bg-white dark:bg-slate-700 border-2 border-orange-500 rounded px-1 py-0.5 outline-none font-mono text-sm" onBlur={(e) => { if (onUpdateCell && e.target.value !== String(val ?? '')) { onUpdateCell(absoluteRowIdx, col, e.target.value); } setEditingCell(null); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingCell(null); }} />
         );
      }
      if (displayVal === null || displayVal === undefined) { return <span className={`text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-tight border ${isPending ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-slate-200 dark:border-slate-700'}`}>NULL</span>; }
      if (typeof displayVal === 'boolean') { return (<span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${displayVal ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'} ${isPending ? 'ring-1 ring-orange-500' : ''}`}>{String(displayVal)}</span>); }
      
      if (typeof displayVal === 'object') {
         const keys = Object.keys(displayVal);
         if (keys.length > 0) {
            return <button onClick={(e) => { e.stopPropagation(); onOpenJson(displayVal); }} className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-indigo-100 transition-colors"><Braces className="w-3 h-3" /> JSON</button>;
         }
         return <span className="text-slate-400 italic text-[11px]">{JSON.stringify(displayVal)}</span>;
      }
      
      const links = getLinksForColumn(col);

      const renderContent = () => {
         const sanitizedVal = sanitizeAnsi(String(displayVal));
         if (isSensitive && !isRevealed) {
            return (
               <div className="flex items-center gap-2">
                  <span className="blur-sm select-none opacity-40 font-mono grayscale">{sanitizedVal.replace(/./g, '*').substring(0, 15)}</span>
                  <button onClick={(e) => { e.stopPropagation(); setUnmaskedCells(new Set(unmaskedCells).add(cellKey)); }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 transition-all"><Eye className="w-3.5 h-3.5" /></button>
               </div>
            );
         }

         const revealToggle = isSensitive && isRevealed && (
            <button onClick={(e) => { e.stopPropagation(); const n = new Set(unmaskedCells); n.delete(cellKey); setUnmaskedCells(n); }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-indigo-500 transition-all"><EyeOff className="w-3.5 h-3.5" /></button>
         );

         if (links.length > 0 && sanitizedVal !== '') {
            return (
               <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); if (links.length === 1) { setHoverPreview(null); onDrillDown(links[0].table, links[0].keyCol, sanitizedVal, links); } else { setHoverPreview({ links, val: sanitizedVal, x: e.clientX, y: e.clientY, persistent: true }); } }} onMouseEnter={(e) => { const x = e.clientX; const y = e.clientY; if (!hoverPreview?.persistent && links.some(l => l.previewCol)) { hoverTimeoutRef.current = setTimeout(() => { setHoverPreview({ links, val: sanitizedVal, x, y, persistent: false }); }, 350); } }} onMouseLeave={() => { if (!hoverPreview?.persistent) { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); setHoverPreview(null); } }} className={`hover:underline flex items-center gap-1 group/link text-left min-w-0 ${links.length > 1 ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-600 dark:text-indigo-400'} ${isPending ? 'bg-orange-50 dark:bg-orange-900/20 px-1 rounded border border-orange-200' : ''}`}><span className="truncate">{highlightMatch(sanitizedVal)}</span>{links.length > 1 ? <Layers className="w-3 h-3 shrink-0" /> : <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 shrink-0" />}</button>
                  {revealToggle}
               </div>
            );
         }
         return (
            <div className="flex items-center gap-2 overflow-hidden">
               <span className={`truncate block ${isPending ? 'text-orange-600 dark:text-orange-400 font-bold' : ''}`}>{highlightMatch(sanitizedVal)}</span>
               {isPending && <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" title="Alteração pendente" />}
               {revealToggle}
            </div>
         );
      };

      return renderContent();
   };

   return (
      <div className="flex flex-col h-full relative" onClick={() => setHoverPreview(prev => prev?.persistent ? null : prev)}>
         {hoverPreview && credentials && schema && (<HoverPreviewTooltip links={hoverPreview.links.filter(l => !!l.previewCol || hoverPreview.persistent)} value={hoverPreview.val} credentials={credentials} schema={schema} x={hoverPreview.x} y={hoverPreview.y} isPersistent={hoverPreview.persistent} onClose={() => setHoverPreview(null)} onSelect={(tbl, key, all) => { setHoverPreview(null); onDrillDown(tbl, key, hoverPreview.val, all); }} />)}
         <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse table-fixed">
               <thead className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
                  <tr>
                     {orderedColumns.map((col, idx) => { 
                        const links = manualMappings[col] || []; 
                        const hasManualMapping = links.length > 0; 
                        const isSorted = sortConfig.key === col; 
                        const isDragging = draggedColIndex === idx;
                        const isDragOver = dragOverIndex === idx;
                        const width = columnWidths[col] || 180;

                        return (
                           <th 
                              key={col} 
                              draggable={!isAdvancedMode}
                              onDragStart={(e) => handleDragStart(e, idx)}
                              onDragOver={(e) => handleDragOver(e, idx)}
                              onDrop={(e) => handleDrop(e, idx)}
                              onDragEnd={() => { setDraggedColIndex(null); setDragOverIndex(null); }}
                              style={{ width: `${width}px` }}
                              className={`px-4 py-3 text-xs font-bold uppercase border-b border-slate-200 dark:border-slate-700 group relative select-none transition-all
                                 ${isDragging ? 'opacity-30 bg-slate-100 dark:bg-slate-800' : 'opacity-100'}
                                 ${isDragOver ? 'border-r-4 border-r-indigo-500' : ''}
                                 ${isSorted ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'} 
                                 ${idx === 0 ? 'pl-6' : ''}
                                 ${!isAdvancedMode ? 'cursor-default' : ''}
                              `}
                           >
                              <div className="flex items-center justify-between min-w-0">
                                 <div className="flex items-center gap-1.5 truncate flex-1">
                                    {!isAdvancedMode && (
                                       <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-400 p-0.5 -ml-1 transition-colors">
                                          <GripVertical className="w-3 h-3" />
                                       </div>
                                    )}
                                    <span 
                                       className="truncate cursor-pointer hover:underline flex-1" 
                                       title={col}
                                       onClick={() => handleSort(col)}
                                    >
                                       {col.replace(/_/g, ' ')}
                                    </span>
                                    <div className="shrink-0 w-4">
                                       {isSorted ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : (
                                          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                                       )}
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-1 shrink-0 ml-1">
                                    {schema && (
                                       <button onClick={(e) => { e.stopPropagation(); setActiveMappingCol(activeMappingCol === col ? null : col); setActiveProfileCol(null); }} className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-all ${hasManualMapping ? 'text-purple-500 opacity-100' : 'opacity-0 group-hover:opacity-100 text-slate-300'}`} title={hasManualMapping ? `${links.length} vínculos ativos` : "Vincular colunas manualmente"}>
                                          {hasManualMapping ? <LinkIcon className="w-3.5 h-3.5" /> : <Anchor className="w-3.5 h-3.5" />}
                                       </button>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); setActiveProfileCol(activeProfileCol === col ? null : col); setActiveMappingCol(null); }} className="p-1 rounded opacity-0 group-hover:opacity-100 text-slate-300 hover:text-indigo-500">
                                       <Info className="w-3.5 h-3.5" />
                                    </button>
                                 </div>
                              </div>
                              
                              <div 
                                 onMouseDown={(e) => handleResizeStart(e, col)}
                                 onDoubleClick={(e) => handleAutoResize(e, col)}
                                 className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/30 active:bg-indigo-500 transition-colors z-20"
                                 title="Arraste para redimensionar ou clique duplo para auto-ajuste"
                              />

                              {activeMappingCol === col && schema && (
                                 <ManualMappingPopover column={col} schema={schema} currentLinks={links} onSave={(newLinks) => handleSaveManualLinks(col, newLinks)} onClose={() => setActiveMappingCol(null)} />
                              )}
                              {activeProfileCol === col && (
                                 <div onClick={e => e.stopPropagation()} className="absolute top-full left-0 z-50 mt-1">
                                    <ColumnProfiler data={data} column={col} onClose={() => setActiveProfileCol(null)} />
                                 </div>
                              )}
                           </th>
                        ); 
                     })}
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {currentData.map((row, rowIdx) => { 
                     const absRowIdx = startIndex + rowIdx; 
                     return (
                        <tr 
                           key={rowIdx} 
                           onClick={() => !isAdvancedMode && onRowClick(row)} 
                           className={`group hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors h-[40px] ${isAdvancedMode ? '' : 'cursor-pointer'} opacity-0 animate-row-entry`}
                           style={{ animationDelay: `${Math.min(rowIdx * 30, 600)}ms` }}
                        >
                           {orderedColumns.map((col, cIdx) => (
                              <td 
                                 key={col} 
                                 style={{ width: `${columnWidths[col] || 180}px` }}
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
         <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 flex items-center justify-between text-xs text-slate-500 shrink-0"><div className="flex items-center gap-4 pl-4"><span>{startIndex + 1}-{Math.min(startIndex + rowsPerPage, totalRows)} de {totalRows}</span><select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="bg-transparent border border-slate-200 dark:border-slate-700 rounded py-0.5 px-1 font-bold outline-none cursor-pointer"><option value={10}>10</option><option value={25}>25</option><option value={100}>100</option></select></div><div className="flex gap-1 pr-2"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button><span className="px-2 py-1 font-mono">{currentPage}/{Math.max(totalPages, 1)}</span><button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button></div></div>
      </div>
   );
};

const ResultsStep: React.FC<ResultsStepProps> = ({ data, sql, onBackToBuilder, onNewConnection, settings, onShowToast, credentials, executionDuration, schema, resultsState, onResultsStateChange }) => {
  const [localData] = useState(data); 
  const columns = useMemo(() => (localData.length > 0 ? Object.keys(localData[0]) : []), [localData]);
  
  const { activeTab, filters, search: localSearch } = resultsState;

  const [explainPlan, setExplainPlan] = useState<ExplainNode | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAdvancedExport, setShowAdvancedExport] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [viewJson, setViewJson] = useState<any | null>(null);
  const [drillDownTarget, setDrillDownTarget] = useState<{table: string, col: string, val: any, allLinks?: ManualLink[]} | null>(null);
  const [showProfilingHistory, setShowProfilingHistory] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Record<string, string>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userSelectedPk, setUserSelectedPk] = useState<string>('');
  const [reviewTab, setReviewTab] = useState<'audit' | 'script' | 'rollback'>('audit');
  
  const mainTableName = useMemo(() => { const fromMatch = sql.match(/FROM\s+([a-zA-Z0-9_."]+)/i); if (fromMatch) return fromMatch[1].replace(/"/g, ''); return null; }, [sql]);
  const bestPkColumn = useMemo(() => { if (!columns || columns.length === 0) return ''; if (mainTableName && schema) { const tableParts = mainTableName.split('.'); const sName = tableParts.length > 1 ? tableParts[0] : 'public'; const tName = tableParts.length > 1 ? tableParts[1] : tableParts[0]; const tableObj = schema.tables.find(t => t.name.toLowerCase() === tName.toLowerCase() && (t.schema || 'public').toLowerCase() === sName.toLowerCase()); const schemaPk = tableObj?.columns.find(c => c.isPrimaryKey)?.name; if (schemaPk && columns.includes(schemaPk)) return schemaPk; } const priorities = ['grid', 'gfid', 'id']; for (const p of priorities) { if (columns.includes(p)) return p; } return ''; }, [mainTableName, schema, columns]);
  const finalPkColumn = userSelectedPk || bestPkColumn;
  
  useEffect(() => { if (data) addToHistory({ sql, rowCount: data.length, durationMs: executionDuration || 0, status: 'success', schemaName: 'Database' }); }, []);
  
  const filteredData = React.useMemo(() => { let res = localData || []; if (filters.length > 0) { res = res.filter(row => filters.every(f => { const val = row[f.column]; const strVal = String(val || '').toLowerCase(); const filterVal = (f.value || '').toLowerCase(); if (f.value === '') return true; switch(f.operator) { case 'contains': return strVal.includes(filterVal); case 'equals': return strVal === filterVal; case 'starts': return strVal.startsWith(filterVal); case 'ends': return strVal.endsWith(filterVal); case 'gt': return Number(val) > Number(f.value); case 'lt': return Number(val) < Number(f.value); default: return true; } })); } if (localSearch) res = res.filter(row => Object.values(row).some(val => String(val || '').toLowerCase().includes(localSearch.toLowerCase()))); return res; }, [localData, filters, localSearch]);
  
  const ansiTableString = useMemo(() => { 
     if (filteredData.length === 0) return "Nenhum dado retornado para os filtros atuais."; 
     const cols = Object.keys(filteredData[0]); 
     const colWidths = cols.map(col => Math.max(col.length, ...filteredData.map(row => { const v = row[col]; return v === null ? 4 : sanitizeAnsi(String(v)).length; }))); 
     const reset = "\x1b[0m"; const green = "\x1b[32m"; const blue = "\x1b[34m"; const yellow = "\x1b[33m"; const red = "\x1b[31m"; const cyan = "\x1b[36m"; 
     let out = ""; 
     out += "┌" + colWidths.map(w => "─".repeat(w + 2)).join("┬") + "┐\n"; 
     out += "│ " + cols.map((col, i) => `${blue}${col.padEnd(colWidths[i])}${reset}`).join(" │ ") + " │\n"; 
     out += "├" + colWidths.map(w => "─".repeat(w + 2)).join("┼") + "┤\n"; 
     filteredData.forEach(row => { 
        out += "│ " + cols.map((col, i) => { 
           const val = row[col]; 
           let str = val === null ? 'NULL' : sanitizeAnsi(String(val)); 
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

  const highlightMatch = (text: string) => { const term = localSearch || filters.find(f => f.operator === 'contains')?.value || ''; if (!term) return text; const escapedSearch = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const parts = text.split(new RegExp(`(${escapedSearch})`, 'gi')); return <>{parts.map((part, i) => part.toLowerCase() === term.toLowerCase() ? <span key={i} className="bg-yellow-200/20 text-slate-900 dark:white font-semibold rounded px-0.5">{part}</span> : part)}</>; };
  const handleUpdateCell = (rowIdx: number, colKey: string, newValue: string) => { if (!settings.advancedMode) return; const editKey = `${rowIdx}-${colKey}`; setPendingEdits(prev => ({ ...prev, [editKey]: newValue })); };
  
  const auditLog = useMemo(() => { 
     const logs: Array<{ rowIdx: number, col: string, oldVal: any, newVal: string, pkVal: any }> = []; 
     (Object.entries(pendingEdits) as Array<[string, string]>).forEach(([key, val]) => { 
        const [rowIdx] = key.split('-').map(Number); 
        const col = key.split('-').slice(1).join('-'); 
        const row = localData[rowIdx]; 
        logs.push({ rowIdx, col, oldVal: row[col], newVal: val, pkVal: row[finalPkColumn] }); 
     }); 
     return logs; 
  }, [pendingEdits, localData, finalPkColumn]);

  const sqlStatementsPreview = useMemo(() => { 
     if (Object.keys(pendingEdits).length === 0 || !finalPkColumn) return ""; 
     const tableName = mainTableName || "table_name"; 
     let lines = ["BEGIN; -- Início da transação de auditoria"]; 
     const editsByRow: Record<number, Record<string, string>> = {}; 
     (Object.entries(pendingEdits) as Array<[string, string]>).forEach(([key, val]) => { 
        const [rowIdx] = key.split('-').map(Number); 
        const col = key.split('-').slice(1).join('-'); 
        if (!editsByRow[rowIdx]) editsByRow[rowIdx] = {}; 
        editsByRow[rowIdx][col] = val; 
     }); 
     for (const [rowIdxStr, cols] of Object.entries(editsByRow)) { 
        const rowIdx = Number(rowIdxStr); 
        const row = localData[rowIdx]; 
        const pkVal = row[finalPkColumn]; 
        if (pkVal === undefined || pkVal === null) continue; 
        const setClause = (Object.entries(cols) as Array<[string, string]>).map(([col, val]) => `"${col}" = '${val.replace(/'/g, "''")}'`).join(', '); 
        const formattedPkVal = typeof pkVal === 'string' ? `'${pkVal.replace(/'/g, "''")}'` : pkVal; 
        lines.push(`UPDATE ${tableName} SET ${setClause} WHERE "${finalPkColumn}" = ${formattedPkVal};`); 
     } 
     lines.push("COMMIT; -- Persistência definitiva"); 
     return lines.join('\n'); 
  }, [pendingEdits, localData, mainTableName, finalPkColumn]);

  const rollbackStatements = useMemo(() => { 
     if (Object.keys(pendingEdits).length === 0 || !finalPkColumn) return ""; 
     const tableName = mainTableName || "table_name"; 
     let lines = ["BEGIN; -- Script de Reversão Automático"]; 
     const editsByRow: Record<number, Record<string, string>> = {}; 
     (Object.entries(pendingEdits) as Array<[string, string]>).forEach(([key, val]) => { 
        const [rowIdx] = key.split('-').map(Number); 
        const col = key.split('-').slice(1).join('-'); 
        if (!editsByRow[rowIdx]) editsByRow[rowIdx] = {}; 
        editsByRow[rowIdx][col] = val; 
     }); 
     for (const [rowIdxStr, cols] of Object.entries(editsByRow)) { 
        const rowIdx = Number(rowIdxStr); 
        const row = localData[rowIdx]; 
        const pkVal = row[finalPkColumn]; 
        if (pkVal === undefined || pkVal === null) continue; 
        const rollbackClauses = Object.keys(cols).map(col => { 
           const originalVal = row[col]; 
           const formattedVal = originalVal === null ? 'NULL' : `'${String(originalVal).replace(/'/g, "''")}'`; 
           return `"${col}" = ${formattedVal}`; 
        }).join(', '); 
        const formattedPkVal = typeof pkVal === 'string' ? `'${pkVal.replace(/'/g, "''")}'` : pkVal; 
        lines.push(`UPDATE ${tableName} SET ${rollbackClauses} WHERE "${finalPkColumn}" = ${formattedPkVal};`); 
     } 
     lines.push("COMMIT;"); 
     return lines.join('\n'); 
  }, [pendingEdits, localData, mainTableName, finalPkColumn]);

  const handleSaveChanges = async () => { if (!credentials || !sqlStatementsPreview) return; setIsSaving(true); try { await executeQueryReal(credentials, sqlStatementsPreview); onShowToast("Transação concluída e alterações salvas.", "success"); setPendingEdits({}); } catch (e: any) { onShowToast(`Erro ao salvar: ${e.message}`, "error"); } finally { setIsSaving(false); setShowConfirmation(false); } };
  const handleChartDrillDown = (col: string, val: any) => { if (mainTableName) setDrillDownTarget({ table: mainTableName, col, val }); }; 
  const handleExportInsert = () => { if (filteredData.length === 0) return; const tableName = mainTableName || "exported_data"; const cols = columns.join(', '); const statements: string = filteredData.map((row: any): string => { const values = columns.map((col: string): string => { const val = row[col]; if (val === null) return 'NULL'; if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`; return String(val); }).join(', '); return `INSERT INTO ${tableName} (${cols}) VALUES (${values});`; }).join('\n'); navigator.clipboard.writeText(statements); setShowExportMenu(false); onShowToast("SQL INSERTs copiados!", "success"); }; 
  const handleExportCSV = () => { if (filteredData.length === 0) return; const headers = columns.join(','); const rows: string = filteredData.map((row: any): string => columns.map((col: string): string => { let val = row[col]; if (val === null) return ''; val = String(val).replace(/"/g, '""'); return `"${val}"`; }).join(',')).join('\n'); const csvContent = `${headers}\n${rows}`; const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.setAttribute("href", url); link.setAttribute("download", `results_${new Date().getTime()}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); setShowExportMenu(false); onShowToast("CSV exportado!", "success"); };
  const handleExplain = async () => { onResultsStateChange({ activeTab: 'explain' }); setExplainError(null); if (!explainPlan && credentials) { setLoadingExplain(true); try { const plan = await explainQueryReal(credentials, sql); setExplainPlan(plan); } catch (e: any) { setExplainError(e.message || "Erro ao analisar performance."); } finally { setTimeout(() => setLoadingExplain(false), 500); } } }; 
  const handleCaptureProfiling = async () => { if (!credentials) return; const loadId = toast.loading("Gerando Query Profiling Snapshot..."); try { const snapshot = await fetchDetailedProfiling(credentials, sql); const existing = JSON.parse(localStorage.getItem('psqlbuddy-profiling-snapshots') || '[]'); localStorage.setItem('psqlbuddy-profiling-snapshots', JSON.stringify([snapshot, ...existing].slice(0, 30))); toast.success("Profiling Snapshot capturado com sucesso!", { id: loadId }); setShowProfilingHistory(true); } catch (e: any) { toast.error(`Falha no profiling: ${e.message}`, { id: loadId }); } };
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);
  const hasPendingEdits = Object.keys(pendingEdits).length > 0;

  return (
    <div className={`h-full flex flex-col space-y-4 ${isFullscreen ? 'fixed inset-0 z-[100] bg-white dark:bg-slate-900 p-6' : ''}`}>
      {selectedRow && <RowInspector row={selectedRow} onClose={() => setSelectedRow(null)} />}
      {viewJson && <JsonViewerModal json={viewJson} onClose={() => setViewJson(null)} />}
      {drillDownTarget && (<DrillDownModal targetTable={drillDownTarget.table} filterColumn={drillDownTarget.col} filterValue={drillDownTarget.val} credentials={credentials || null} onClose={() => setDrillDownTarget(null)} schema={schema} allLinks={drillDownTarget.allLinks} settings={settings} />)}
      {showCodeModal && <CodeSnippetModal sql={sql} onClose={() => setShowCodeModal(false)} />}
      {showProfilingHistory && <ProfilingSnapshotModal onClose={() => setShowProfilingHistory(false)} />}
      {showAdvancedExport && (<AdvancedExportModal data={filteredData} columns={columns} tableName={mainTableName} onClose={() => setShowAdvancedExport(false)} />)}
      {showConfirmation && (<div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white dark:bg-slate-800 w-full max-w-4xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]"><div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30"><div className="flex items-start gap-3"><div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-2xl"><ShieldAlert className="w-8 h-8 text-red-600" /></div><div><h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Revisão de Auditoria DML</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{Object.keys(pendingEdits).length} campos alterados em {mainTableName}</p></div></div><button onClick={() => setShowConfirmation(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"><X className="w-6 h-6 text-slate-400" /></button></div><div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 mx-6 mt-6 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0"><button onClick={() => setReviewTab('audit')} className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${reviewTab === 'audit' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-50'}`}>Log de Alterações</button><button onClick={() => setReviewTab('script')} className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${reviewTab === 'script' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-50'}`}>Script SQL (Update)</button><button onClick={() => setReviewTab('rollback')} className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${reviewTab === 'rollback' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-sm' : 'text-slate-50'}`}>Rollback (Desfazer)</button></div><div className="flex-1 overflow-y-auto p-6 custom-scrollbar">{reviewTab === 'audit' && (<div className="space-y-4">{!finalPkColumn && (<div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-100 dark:border-amber-800 animate-in zoom-in-95"><AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" /><div><h4 className="font-black text-sm text-amber-800 dark:text-amber-200 uppercase tracking-tight mb-1">Selecione o Identificador Único</h4><p className="text-xs text-amber-700 dark:text-amber-300 mb-3">Não detectamos uma chave primária nos resultados. Escolha uma coluna para garantir que o UPDATE altere o registro correto.</p><select value={userSelectedPk} onChange={e => setUserSelectedPk(e.target.value)} className="w-full p-2.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 font-bold"><option value="">-- Escolher Coluna ID --</option>{columns.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div>)}<div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"><table className="w-full text-left border-collapse"><thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800"><tr><th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">Campo ({finalPkColumn})</th><th className="px-4 py-3">Original</th><th className="px-4 py-3 w-8 text-center"><ArrowRight className="w-3 h-3 mx-auto" /></th><th className="px-4 py-3">Novo Valor</th></tr></thead><tbody className="text-xs font-mono">{auditLog.map((log, i) => (<tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-slate-50 last:border-0 dark:border-slate-800"><td className="px-4 py-3 border-r border-slate-100 dark:border-slate-800"><div className="flex flex-col"><span className="font-black text-slate-800 dark:text-slate-200">{log.col}</span><span className="text-[9px] text-slate-400">ID: {log.pkVal ?? '???'}</span></div></td><td className="px-4 py-3 text-rose-500 bg-rose-50/20 dark:bg-rose-900/5 line-through italic opacity-70">{String(log.oldVal ?? 'null')}</td><td className="px-4 py-3 text-center text-slate-300">→</td><td className="px-4 py-3 text-emerald-600 bg-emerald-50/20 dark:bg-emerald-900/10 font-bold">{log.newVal}</td></tr>))}</tbody></table></div></div>)}{reviewTab === 'script' && (<div className="h-full flex flex-col gap-4"><div className="flex-1 bg-slate-950 rounded-2xl p-4 border border-slate-800 shadow-inner relative group"><div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { navigator.clipboard.writeText(sqlStatementsPreview); toast.success("Script copiado!"); }} className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg"><Copy className="w-4 h-4" /></button></div><pre className="font-mono text-[11px] text-emerald-400 whitespace-pre-wrap h-full overflow-auto custom-scrollbar leading-relaxed">{sqlStatementsPreview}</pre></div><div className="flex items-center gap-2 text-[10px] text-slate-400 italic"><Info className="w-3 h-3" /> Este script será executado em uma única transação atômica.</div></div>)}{reviewTab === 'rollback' && (<div className="h-full flex flex-col gap-4"><div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-100 dark:border-amber-800 animate-in zoom-in-95"><RotateCcw className="w-6 h-6 text-amber-600 shrink-0" /><div><h4 className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-widest">Plano de Desastre</h4><p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Copie este script antes de confirmar o commit para ter uma saída de emergência caso os novos dados causem problemas na aplicação.</p></div></div><div className="flex-1 bg-slate-950 rounded-2xl p-4 border border-slate-800 shadow-inner relative group"><div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { navigator.clipboard.writeText(rollbackStatements); toast.success("Rollback copiado!"); }} className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg"><Copy className="w-4 h-4" /></button></div><pre className="font-mono text-[11px] text-emerald-400 whitespace-pre-wrap h-full overflow-auto custom-scrollbar leading-relaxed">{rollbackStatements}</pre></div></div>)}</div><div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center gap-4 shrink-0"><div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-4 py-2 rounded-xl border border-rose-100 dark:border-rose-900 shadow-sm max-w-md"><FileWarning className="w-5 h-5 shrink-0" /><p className="text-[10px] font-black uppercase leading-tight tracking-tighter">Atenção: A gravação é imediata no banco de dados após o clique em confirmar.</p></div><div className="flex gap-3"><button onClick={() => setShowConfirmation(false)} className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-sm">Cancelar</button><button onClick={handleSaveChanges} disabled={isSaving || !finalPkColumn} className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-red-900/20 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Sim, Efetivar Alterações</button></div></div></div></div>)}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0"><div className="flex items-center gap-4">{isFullscreen && <button onClick={toggleFullscreen} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"><Minimize2 className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button>}<div><h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">Resultados<span className="text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">{filteredData.length} registros</span>{settings?.advancedMode && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold border border-orange-200 flex items-center gap-1"><PenTool className="w-3 h-3" /> Modo Edição</span>}</h2></div></div><div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">{[{ id: 'table', icon: <FileSpreadsheet className="w-4 h-4" />, label: 'Tabela' }, { id: 'terminal', icon: <Terminal className="w-4 h-4" />, label: 'Terminal (ANSI)' }, { id: 'chart', icon: <BarChart2 className="w-4 h-4" />, label: 'Gráficos' }, { id: 'analysis', icon: <MessageSquare className="w-4 h-4" />, label: 'AI Analyst' }, { id: 'explain', icon: <Activity className="w-4 h-4" />, label: 'Performance' }].map(tab => (<button key={tab.id} onClick={() => { if(tab.id === 'explain') handleExplain(); else onResultsStateChange({ activeTab: tab.id as ResultTab }); }} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{tab.icon} {tab.label}</button>))}</div><div className="flex items-center gap-2">{activeTab === 'explain' && (<button onClick={() => setShowProfilingHistory(true)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-400 transition-all shadow-sm"><History className="w-3.5 h-3.5" /> Ver Snapshots</button>)}{hasPendingEdits && (<div className="flex items-center gap-2 animate-in slide-in-from-right-2"><button onClick={() => setPendingEdits({})} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-200 transition-all"><Undo2 className="w-4 h-4" /> Descartar</button><button onClick={() => { setReviewTab('audit'); setShowConfirmation(true); }} className="flex items-center gap-2 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-orange-200 dark:shadow-none transition-all"><Save className="w-4 h-4" /> Revisar & Salvar</button></div>)}{activeTab === 'table' && !hasPendingEdits && (<div className="flex items-center gap-2"><SmartFilterBar columns={columns} filters={filters} onChange={(f) => onResultsStateChange({ filters: f })} onClear={() => onResultsStateChange({ filters: [] })} />{filters.length === 0 && (<div className="relative group"><Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" /><input type="text" placeholder="Busca rápida..." value={localSearch} onChange={(e) => onResultsStateChange({ search: e.target.value })} className="pl-8 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-48" /></div>)}</div>)}<div className="relative"><button onClick={() => setShowExportMenu(!showExportMenu)} className={`flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors text-slate-700 dark:text-slate-300 ${showExportMenu ? 'ring-2 ring-indigo-500' : ''}`}><Download className="w-4 h-4" /> Exportar</button>{showExportMenu && (<div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-[90] overflow-hidden animate-in fade-in zoom-in-95" onClick={() => setShowExportMenu(false)}><div className="p-2 border-b border-slate-100 dark:border-slate-700"><button onClick={() => setShowAdvancedExport(true)} className="w-full text-left px-2 py-1.5 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded flex items-center gap-2 text-indigo-600 font-black uppercase tracking-wider"><Settings className="w-3.5 h-3.5" /> Exportação Avançada</button></div><div className="p-2 border-b border-slate-100 dark:border-slate-700"><button onClick={() => { setShowCodeModal(true); setShowExportMenu(false); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 rounded flex items-center gap-2 text-slate-600 dark:text-slate-300"><FileCode className="w-3.5 h-3.5" /> Exportar Código</button><button onClick={handleExportInsert} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 rounded flex items-center gap-2 text-slate-600 dark:text-slate-300"><Database className="w-3.5 h-3.5" /> Copy as SQL INSERT</button><button onClick={handleExportCSV} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 rounded flex items-center gap-2 text-slate-600 dark:text-slate-300"><FileSpreadsheet className="w-3.5 h-3.5" /> Export as CSV</button></div><div className="p-2"><button onClick={() => { navigator.clipboard.writeText(JSON.stringify(filteredData)); onShowToast("JSON copiado!", "success"); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 rounded flex items-center gap-2 text-slate-600 dark:text-slate-300"><FileJson className="w-3.5 h-3.5" /> Copy JSON Raw</button></div></div>)}</div>{!isFullscreen && <button onClick={toggleFullscreen} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title="Tela Cheia"><Maximize2 className="w-5 h-5" /></button>}</div></div>
      <div id="results-content" className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col relative">{filteredData.length === 0 && data.length > 0 ? (<div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8"><Filter className="w-12 h-12 opacity-30 mb-4" /> <p>Nenhum resultado corresponde aos filtros atuais.</p></div>) : data.length === 0 ? (<div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8"><Database className="w-12 h-12 opacity-30 mb-4" /><p>Nenhum resultado retornado</p></div>) : (<>{activeTab === 'table' && (<VirtualTable data={filteredData} columns={columns} highlightMatch={highlightMatch} onRowClick={(row: any) => !settings?.advancedMode && setSelectedRow(row)} isAdvancedMode={settings?.advancedMode} onUpdateCell={handleUpdateCell} onOpenJson={setViewJson} onDrillDown={(table: string, col: string, val: any, allLinks?: ManualLink[]) => setDrillDownTarget({ table, col, val, allLinks })} schema={schema} credentials={credentials} pendingEdits={pendingEdits} settings={settings} />)}{activeTab === 'terminal' && <AnsiTerminal text={ansiTableString} />}{activeTab === 'chart' && <div className="p-6 h-full w-full relative"><DataVisualizer data={filteredData} chartConfig={resultsState.chartConfig} onConfigChange={(cfg) => onResultsStateChange({ chartConfig: cfg })} onDrillDown={handleChartDrillDown} /> </div>}{activeTab === 'analysis' && <div className="flex-1 h-full"><DataAnalysisChat data={filteredData} sql={sql} messages={resultsState.chatMessages} chatInput={resultsState.chatInput} onMessagesChange={(m) => onResultsStateChange({ chatMessages: m })} onChatInputChange={(v) => onResultsStateChange({ chatInput: v })} /></div>}{activeTab === 'explain' && <ExplainVisualizer plan={explainPlan} loading={loadingExplain} error={explainError} onCaptureProfiling={handleCaptureProfiling} sql={sql} />}</>)}</div>
      {!isFullscreen && (<div className="flex items-center justify-between shrink-0"><div className="flex items-center gap-4"><button onClick={onNewConnection} className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2 px-2 py-1"><Database className="w-4 h-4" /> Nova Conexão</button>{executionDuration !== undefined && executionDuration > 0 && (<span className="text-xs text-slate-400 flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700"><Clock className="w-3 h-3" /> Executado em {executionDuration.toFixed(0)}ms</span>)}</div><button onClick={onBackToBuilder} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</button></div>)}
    </div>
  );
};

export default ResultsStep;