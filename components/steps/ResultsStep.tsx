
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Database, ChevronLeft, ChevronRight, FileSpreadsheet, Search, Copy, Check, BarChart2, MessageSquare, Download, Activity, LayoutGrid, FileText, Pin, AlertCircle, Info, MoreHorizontal, FileJson, FileCode, Hash, Type, Filter, Plus, X, Trash2, SlidersHorizontal, Clock, Maximize2, Minimize2, ExternalLink, Braces, PenTool, Save, Eye, Anchor, Link as LinkIcon, Settings2, Loader2, Folder } from 'lucide-react';
import { AppSettings, DashboardItem, ExplainNode, DatabaseSchema, Table } from '../../types';
import DataVisualizer from '../DataVisualizer';
import DataAnalysisChat from '../DataAnalysisChat';
import CodeSnippetModal from '../CodeSnippetModal';
import JsonViewerModal from '../JsonViewerModal'; 
import DrillDownModal from '../DrillDownModal'; 
import { addToHistory } from '../../services/historyService';
import { executeQueryReal, explainQueryReal } from '../../services/dbService';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';
import BeginnerTip from '../BeginnerTip';

// --- Sub-componente de Preview no Hover ---
const HoverPreviewTooltip: React.FC<{
  targetTable: string;
  pkColumn: string;
  value: any;
  displayColumn: string;
  credentials: any;
  schema: DatabaseSchema;
  x: number;
  y: number;
}> = ({ targetTable, pkColumn, value, displayColumn, credentials, schema, x, y }) => {
  const [data, setData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchPreview = async () => {
      if (!credentials || !targetTable || !displayColumn || !schema) return;
      setLoading(true);
      try {
        const tableParts = targetTable.split('.');
        const sName = tableParts.length > 1 ? tableParts[0] : 'public';
        const tName = tableParts.length > 1 ? tableParts[1] : tableParts[0];
        
        const tableObj = schema.tables.find(t => 
           t.name.toLowerCase() === tName.toLowerCase() && 
           (t.schema || 'public').toLowerCase() === sName.toLowerCase()
        );

        if (!tableObj) {
           if (isMounted) setData("Tabela não mapeada");
           setLoading(false);
           return;
        }

        const existingColNames = new Set(tableObj.columns.map(c => c.name.toLowerCase()));
        const candidates = [pkColumn, 'grid', 'id', 'codigo', 'cod', 'mlid'].filter(Boolean);
        const validIdCols = candidates.filter(c => existingColNames.has(c.toLowerCase()));

        if (validIdCols.length === 0) {
           validIdCols.push(tableObj.columns[0].name);
        }

        const formattedTable = `"${sName}"."${tName}"`;
        const valStr = String(value).replace(/'/g, "''");
        const conditions = validIdCols.map(col => `"${col}"::text = '${valStr}'`).join(' OR ');
        
        const sql = `SELECT "${displayColumn.replace(/"/g, '')}" FROM ${formattedTable} WHERE ${conditions} LIMIT 1;`;
        
        const results = await executeQueryReal(credentials, sql);
        if (isMounted) {
          if (results && results.length > 0) {
            const val = results[0][displayColumn];
            setData(val === null ? 'NULL' : String(val));
          } else {
            setData("Não encontrado");
          }
        }
      } catch (e) {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPreview();
    return () => { isMounted = false; };
  }, [targetTable, pkColumn, value, displayColumn, credentials, schema]);

  return (
    <div 
      className="fixed z-[110] pointer-events-none bg-slate-900 text-white p-2.5 rounded-lg shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150"
      style={{ left: Math.min(x + 15, window.innerWidth - 250), top: Math.max(10, y - 10) }}
    >
      <div className="flex flex-col gap-1 min-w-[120px]">
        <div className="flex items-center gap-2 border-b border-slate-700 pb-1.5 mb-1">
          <Database className="w-3 h-3 text-indigo-400" />
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">{displayColumn}</span>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-xs opacity-70">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Buscando...</span>
          </div>
        ) : error ? (
          <span className="text-xs text-red-400">Erro na consulta</span>
        ) : (
          <span className="text-sm font-bold text-indigo-100 whitespace-pre-wrap">{data}</span>
        )}
      </div>
      <div className="absolute top-3 -left-1 w-2 h-2 bg-slate-900 border-l border-b border-slate-700 transform rotate-45"></div>
    </div>
  );
};

// --- Sub-componente para Configurar Vínculo Manual ---
const ManualMappingPopover: React.FC<{ 
  column: string, 
  schema: DatabaseSchema, 
  onSave: (table: string, previewCol: string) => void, 
  onClose: () => void,
  currentValue?: string,
  currentPreviewCol?: string
}> = ({ column, schema, onSave, onClose, currentValue, currentPreviewCol }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState(currentValue || '');
  const [previewCol, setPreviewCol] = useState(currentPreviewCol || '');
  
  // Verifica se existem múltiplos schemas para decidir a formatação da lista
  const schemasPresent = useMemo(() => {
    return Array.from(new Set(schema.tables.map(t => t.schema || 'public'))).sort();
  }, [schema.tables]);

  const hasMultipleSchemas = schemasPresent.length > 1;

  // Lista de tabelas filtrada e ORDENADA
  const tablesBySchema = useMemo(() => {
    const list = schema.tables.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (t.schema || 'public').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Ordena por schema e depois por nome
    list.sort((a, b) => {
       const sA = (a.schema || 'public').toLowerCase();
       const sB = (b.schema || 'public').toLowerCase();
       if (sA !== sB) return sA.localeCompare(sB);
       return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    // Agrupa por schema para renderizar "pastas"
    const grouped: Record<string, Table[]> = {};
    list.forEach(t => {
      const s = t.schema || 'public';
      if (!grouped[s]) grouped[s] = [];
      grouped[s].push(t);
    });
    return grouped;
  }, [schema.tables, searchTerm]);

  // Lista de colunas da tabela selecionada ORDENADA alfabeticamente
  const targetColumns = useMemo(() => {
    if (!selectedTable) return [];
    const parts = selectedTable.split('.');
    const s = parts.length > 1 ? parts[0] : 'public';
    const t = parts.length > 1 ? parts[1] : parts[0];
    const tbl = schema.tables.find(table => table.name === t && (table.schema || 'public') === s);
    if (!tbl) return [];
    return tbl.columns
      .map(c => c.name)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [selectedTable, schema]);

  return (
    <div className="absolute z-[70] top-full mt-2 right-0 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right" onClick={e => e.stopPropagation()}>
       <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase text-slate-500 truncate mr-2">Vínculo: {column}</span>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded shrink-0"><X className="w-3 h-3" /></button>
       </div>
       
       <div className="p-3 space-y-4">
          {/* Busca de Tabela */}
          <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-slate-400 uppercase">Tabela de Destino</label>
             <div className="relative">
                <Search className="absolute left-2 top-2.5 w-3 h-3 text-slate-400" />
                <input 
                   autoFocus
                   type="text" 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   placeholder="Buscar tabela..."
                   className="w-full pl-7 pr-2 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                />
             </div>
             <div className="max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-700 rounded-lg mt-1 custom-scrollbar bg-white dark:bg-slate-900">
                {Object.entries(tablesBySchema).length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-[10px]">Nenhuma tabela encontrada.</div>
                ) : (
                  Object.entries(tablesBySchema).map(([schemaName, tables]) => (
                    <div key={schemaName} className="mb-1">
                      {hasMultipleSchemas && (
                        <div className="px-2 py-1 bg-slate-50 dark:bg-slate-800/50 border-y border-slate-100 dark:border-slate-700 flex items-center gap-1.5">
                           <Folder className="w-3 h-3 text-indigo-400 fill-indigo-400/20" />
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{schemaName}</span>
                        </div>
                      )}
                      <div className="py-0.5">
                        {tables.map(t => {
                           const fullId = `${t.schema || 'public'}.${t.name}`;
                           const isSelected = selectedTable === fullId;
                           // Se for schema único public, remove o prefixo public.
                           const displayName = !hasMultipleSchemas && t.schema === 'public' ? t.name : t.name;

                           return (
                              <button 
                                key={fullId}
                                onClick={() => { setSelectedTable(fullId); setPreviewCol(''); }}
                                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-700 font-bold dark:bg-indigo-900/40' : 'text-slate-600 dark:text-slate-300'}`}
                              >
                                 <span className="truncate">{displayName}</span>
                                 {isSelected && <Check className="w-3 h-3" />}
                              </button>
                           );
                        })}
                      </div>
                    </div>
                  ))
                )}
             </div>
          </div>

          {/* Seleção de Coluna de Preview */}
          {selectedTable && (
            <div className="space-y-1.5 animate-in slide-in-from-top-1">
               <label className="text-[10px] font-bold text-slate-400 uppercase">Mostrar no Hover (Preview)</label>
               <select 
                  value={previewCol}
                  onChange={e => setPreviewCol(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
               >
                  <option value="">-- Selecione uma coluna --</option>
                  {targetColumns.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
               <p className="text-[9px] text-slate-400 italic">Esta coluna será mostrada ao passar o mouse no link.</p>
            </div>
          )}
       </div>

       <div className="p-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/20 flex gap-2">
          <button 
             onClick={() => onSave(selectedTable, previewCol)}
             disabled={!selectedTable}
             className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
          >
             Salvar Vínculo
          </button>
          {currentValue && (
             <button 
                onClick={() => onSave('', '')}
                className="px-2 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
             >
                Remover
             </button>
          )}
       </div>
    </div>
  );
};

interface RowInspectorProps {
   row: any;
   onClose: () => void;
}

const RowInspector: React.FC<RowInspectorProps> = ({ row, onClose }) => {
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
   onDrillDown: (table: string, col: string, val: any) => void;
   schema?: DatabaseSchema;
   defaultTableName?: string | null;
   credentials?: any;
}

const VirtualTable: React.FC<VirtualTableProps> = ({ data, columns, highlightMatch, onRowClick, isAdvancedMode, onUpdateCell, onOpenJson, onDrillDown, schema, defaultTableName, credentials }) => {
   const [currentPage, setCurrentPage] = useState(1);
   const [rowsPerPage, setRowsPerPage] = useState(25);
   const [activeProfileCol, setActiveProfileCol] = useState<string | null>(null);
   const [activeMappingCol, setActiveMappingCol] = useState<string | null>(null);
   
   // Preview Hover State
   const [hoverPreview, setHoverPreview] = useState<{table: string, pk: string, val: any, displayCol: string, x: number, y: number} | null>(null);
   const hoverTimeoutRef = useRef<any>(null);

   // Mapeamentos Manuais Locais (Links de tabelas e colunas de preview)
   const [manualMappings, setManualMappings] = useState<Record<string, { table: string, previewCol?: string }>>(() => {
      try {
         const stored = localStorage.getItem('psql-buddy-manual-drilldown-links');
         return stored ? JSON.parse(stored) : {};
      } catch { return {}; }
   });

   const handleSaveManualMapping = (colName: string, targetTable: string, previewCol: string) => {
      const newMappings = { ...manualMappings };
      if (!targetTable) delete newMappings[colName];
      else newMappings[colName] = { table: targetTable, previewCol };
      
      setManualMappings(newMappings);
      localStorage.setItem('psql-buddy-manual-drilldown-links', JSON.stringify(newMappings));
      setActiveMappingCol(null);
   };

   const totalRows = data.length;
   const totalPages = Math.ceil(totalRows / Math.max(rowsPerPage, 1));
   const startIndex = (currentPage - 1) * rowsPerPage;
   const currentData = data.slice(startIndex, startIndex + rowsPerPage);

   // Função centralizada para detectar o alvo de um link (manual ou automático)
   const getLinkTarget = (colName: string): { table: string, pk: string, previewCol?: string } | null => {
      // 1. Prioridade: Mapeamento Manual do Usuário
      if (manualMappings[colName]) {
         return { table: manualMappings[colName].table, pk: 'grid', previewCol: manualMappings[colName].previewCol };
      }

      if (!schema || !colName) return null;
      const lowerCol = colName.toLowerCase();
      const leafName = lowerCol.split('.').pop() || '';

      // Heurística de colunas globais (grid/mlid)
      if (leafName === 'grid' || leafName === 'mlid') {
         const parts = lowerCol.split('.');
         let targetTableObj = null;
         if (parts.length >= 2) {
            const potentialTableName = parts[parts.length - 2];
            targetTableObj = schema.tables.find(t => t.name.toLowerCase() === potentialTableName.toLowerCase());
         }
         if (!targetTableObj && defaultTableName) {
             const tName = defaultTableName.includes('.') ? defaultTableName.split('.')[1] : defaultTableName;
             targetTableObj = schema.tables.find(t => t.name.toLowerCase() === tName.toLowerCase());
         }
         if (targetTableObj) return { table: `${targetTableObj.schema || 'public'}.${targetTableObj.name}`, pk: leafName };
      }

      // Detecção via Schema (Foreign Keys Reais)
      for (const t of schema.tables) {
         const col = t.columns.find(c => c.name === colName);
         if (col && col.isForeignKey && col.references) {
            const parts = col.references.split('.');
            if (parts.length === 3) return { table: `${parts[0]}.${parts[1]}`, pk: parts[2] };
            if (parts.length === 2) return { table: `public.${parts[0]}`, pk: parts[1] };
         }
      }

      // Heurística por Sufixo (_id, _grid, etc)
      const suffixes = ['_id', '_grid', '_mlid'];
      for (const suffix of suffixes) {
         if (lowerCol.endsWith(suffix) && lowerCol !== suffix) {
            const baseName = lowerCol.substring(0, lowerCol.length - suffix.length);
            const target = schema.tables.find(t => t.name.toLowerCase() === baseName || t.name.toLowerCase() === baseName + 's');
            if (target) return { table: `${target.schema || 'public'}.${target.name}`, pk: 'grid' };
         }
      }

      return null;
   };

   const formatValue = (col: string, val: any) => {
      // Caso Nulo
      if (val === null || val === undefined) {
         return <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-tight border border-slate-200 dark:border-slate-700">NULL</span>;
      }

      // Caso Booleano
      if (typeof val === 'boolean') {
         return (
            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
               val ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' 
                   : 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
            }`}>
               {String(val)}
            </span>
         );
      }

      // Caso Objeto JSON
      if (typeof val === 'object') {
         return <button onClick={(e) => { e.stopPropagation(); onOpenJson(val); }} className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-indigo-100 transition-colors"><Braces className="w-3 h-3" /> JSON</button>;
      }
      
      // Caso Link (Drilldown)
      const target = getLinkTarget(col);
      if (target && val !== '') {
         return (
            <button 
               onClick={(e) => { e.stopPropagation(); onDrillDown(target.table, target.pk, val); }} 
               onMouseEnter={(e) => {
                  const x = e.clientX;
                  const y = e.clientY;
                  if (target.previewCol) {
                     hoverTimeoutRef.current = setTimeout(() => {
                        setHoverPreview({ table: target.table, pk: target.pk, val: val, displayCol: target.previewCol!, x, y });
                     }, 350); 
                  }
               }}
               onMouseLeave={() => {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                  setHoverPreview(null);
               }}
               className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 group/link"
            >
               {highlightMatch(String(val))}
               <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100" />
            </button>
         );
      }
      return highlightMatch(String(val));
   };

   return (
      <div className="flex flex-col h-full relative">
         {/* Hover Preview Dynamic Component */}
         {hoverPreview && credentials && schema && (
            <HoverPreviewTooltip 
               {...hoverPreview}
               targetTable={hoverPreview.table}
               pkColumn={hoverPreview.pk}
               value={hoverPreview.val}
               displayColumn={hoverPreview.displayCol}
               credentials={credentials}
               schema={schema}
            />
         )}

         <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
            <table className="w-full text-left border-collapse table-fixed">
               <thead className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
                  <tr>
                     {columns.map((col, idx) => {
                        const mapping = manualMappings[col];
                        const hasManualMapping = !!mapping;
                        const autoTarget = getLinkTarget(col);

                        return (
                           <th key={col} className={`px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 w-[160px] group relative ${idx === 0 ? 'pl-6' : ''}`}>
                              <div className="flex items-center justify-between">
                                 <span className="truncate" title={col}>{col.replace(/_/g, ' ')}</span>
                                 <div className="flex items-center gap-1 shrink-0">
                                    {schema && (
                                       <button 
                                          onClick={(e) => { e.stopPropagation(); setActiveMappingCol(activeMappingCol === col ? null : col); setActiveProfileCol(null); }} 
                                          className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-all ${hasManualMapping ? 'text-indigo-500 opacity-100' : 'opacity-0 group-hover:opacity-100 text-slate-300'}`}
                                          title={hasManualMapping ? `Vínculo ativo para ${mapping.table}` : "Vincular coluna manualmente"}
                                       >
                                          {hasManualMapping ? <LinkIcon className="w-3.5 h-3.5" /> : <Anchor className="w-3.5 h-3.5" />}
                                       </button>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); setActiveProfileCol(activeProfileCol === col ? null : col); setActiveMappingCol(null); }} className="p-1 rounded opacity-0 group-hover:opacity-100 text-slate-300 hover:text-indigo-500"><Info className="w-3.5 h-3.5" /></button>
                                 </div>
                              </div>

                              {/* Popover de Mapeamento Manual */}
                              {activeMappingCol === col && schema && (
                                 <ManualMappingPopover 
                                    column={col} 
                                    schema={schema} 
                                    // Pré-seleciona a tabela caso já tenha sido detectada automaticamente (heurística/fk)
                                    currentValue={mapping?.table || autoTarget?.table}
                                    currentPreviewCol={mapping?.previewCol}
                                    onSave={(tbl, previewCol) => handleSaveManualMapping(col, tbl, previewCol)} 
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
                  {currentData.map((row, idx) => (
                     <tr key={idx} onClick={() => onRowClick(row)} className="group hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors h-[40px] cursor-pointer">
                        {columns.map((col, cIdx) => (
                           <td key={col} className={`px-4 py-2 text-sm text-slate-600 dark:text-slate-300 truncate ${cIdx === 0 ? 'pl-6 font-medium' : ''}`}>
                              {formatValue(col, row[col])}
                           </td>
                        ))}
                     </tr>
                  ))}
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

const ExplainVisualizer: React.FC<{ plan: ExplainNode | null, loading: boolean, error: string | null }> = ({ plan, loading, error }) => {
   if (loading) return <div className="p-10 text-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div><p className="text-slate-500">Analisando performance...</p></div>;
   if (error) return <div className="p-10 text-center flex flex-col items-center justify-center text-slate-400"><div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="w-8 h-8 text-red-500" /></div><h3 className="text-slate-700 dark:text-slate-200 font-bold mb-1">Falha na Análise</h3><p className="text-sm max-w-md">{error}</p></div>;
   if (!plan) return <div className="p-10 text-center text-slate-400">Nenhum plano disponível.</div>;
   const renderNode = (node: ExplainNode, depth: number = 0) => (
      <div key={Math.random()} style={{ marginLeft: depth * 20 }} className="mb-2 group">
         <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 shadow-sm inline-block min-w-[300px] hover:border-indigo-400 transition-colors">
            <div className="flex justify-between font-bold text-xs text-slate-700 dark:text-slate-200"><span className="text-indigo-600 dark:text-indigo-400">{node.type}</span><span className="text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 rounded-full">{(node.cost?.total || 0).toFixed(2)} cost</span></div>
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

type ResultTab = 'table' | 'chart' | 'analysis' | 'explain';

const ResultsStep: React.FC<ResultsStepProps> = ({ data, sql, onBackToBuilder, onNewConnection, settings, onAddToDashboard, onShowToast, credentials, executionDuration, schema }) => {
  const [activeTab, setActiveTab] = useState<ResultTab>('table');
  const [localData, setLocalData] = useState(data); 
  const columns = localData.length > 0 ? Object.keys(localData[0]) : [];
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [localSearch, setLocalSearch] = useState(''); 
  const [sqlCopied, setSqlCopied] = useState(false);
  const [explainPlan, setExplainPlan] = useState<ExplainNode | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [viewJson, setViewJson] = useState<any | null>(null);
  const [drillDownTarget, setDrillDownTarget] = useState<{table: string, col: string, val: any} | null>(null);

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
              const filterVal = (f.value || '').toLowerCase();
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

  const highlightMatch = (text: string) => {
    const term = localSearch || filters.find(f => f.operator === 'contains')?.value || '';
    if (!term) return text;
    const escapedSearch = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedSearch})`, 'gi'));
    return <>{parts.map((part, i) => part.toLowerCase() === term.toLowerCase() ? <span key={i} className="bg-yellow-200 dark:bg-yellow-600/50 text-slate-900 dark:white font-semibold rounded px-0.5">{part}</span> : part)}</>;
  };

  const handleUpdateCell = (rowIdx: number, colKey: string, newValue: string) => {
     if (!settings?.advancedMode) return;
     const tableName = mainTableName || "table_name";
     const row = localData[rowIdx];
     let pkCol = 'id';
     let pkVal = row['id'];
     if (!pkVal) {
        if (row['grid']) { pkCol = 'grid'; pkVal = row['grid']; }
        else if (schema) {
           const t = schema.tables.find(tbl => tableName.includes(tbl.name));
           if (t) {
              const pk = t.columns.find(c => c.isPrimaryKey);
              if (pk) { pkCol = pk.name; pkVal = row[pkCol]; }
           }
        }
     }
     if (!pkVal) { onShowToast("Não foi possível identificar a Chave Primária (ID) para atualizar esta linha.", "error"); return; }
     const updateSql = `UPDATE ${tableName} SET ${colKey} = '${newValue.replace(/'/g, "''")}' WHERE ${pkCol} = ${pkVal};`;
     const newData = [...localData];
     newData[rowIdx] = { ...newData[rowIdx], [colKey]: newValue };
     setLocalData(newData);
     onShowToast(`UPDATE Gerado: ${updateSql}`, "info");
  };

  const handleChartDrillDown = (col: string, val: any) => { if (mainTableName) setDrillDownTarget({ table: mainTableName, col, val }); };
  const handleExportInsert = () => { if (filteredData.length === 0) return; const tableName = "exported_data"; const cols = columns.join(', '); const statements = filteredData.map(row => { const values = columns.map(col => { const val = row[col]; if (val === null) return 'NULL'; if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`; return val; }).join(', '); return `INSERT INTO ${tableName} (${cols}) VALUES (${values});`; }).join('\n'); navigator.clipboard.writeText(statements); setShowExportMenu(false); onShowToast("SQL INSERTs copiados!", "success"); };
  const handleExplain = async () => { setActiveTab('explain'); setExplainError(null); if (!explainPlan && credentials) { setLoadingExplain(true); try { const plan = await explainQueryReal(credentials, sql); setExplainPlan(plan); } catch (e: any) { setExplainError(e.message || "Erro ao analisar performance."); } finally { setLoadingExplain(false); } } };
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  return (
    <div className={`h-full flex flex-col space-y-4 ${isFullscreen ? 'fixed inset-0 z-[100] bg-white dark:bg-slate-900 p-6' : ''}`}>
      {selectedRow && <RowInspector row={selectedRow} onClose={() => setSelectedRow(null)} />}
      {viewJson && <JsonViewerModal json={viewJson} onClose={() => setViewJson(null)} />}
      {drillDownTarget && <DrillDownModal targetTable={drillDownTarget.table} filterColumn={drillDownTarget.col} filterValue={drillDownTarget.val} credentials={credentials || null} onClose={() => setDrillDownTarget(null)} schema={schema} />}
      {showCodeModal && <CodeSnippetModal sql={sql} onClose={() => setShowCodeModal(false)} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
           {isFullscreen && <button onClick={toggleFullscreen} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"><Minimize2 className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button>}
           <div><h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">Resultados<span className="text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">{filteredData.length} registros</span>{settings?.advancedMode && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold border border-orange-200 flex items-center gap-1"><PenTool className="w-3 h-3" /> Modo Edição</span>}</h2></div>
        </div>
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
           {[{ id: 'table', icon: <FileSpreadsheet className="w-4 h-4" />, label: 'Tabela' },{ id: 'chart', icon: <BarChart2 className="w-4 h-4" />, label: 'Gráficos' },{ id: 'analysis', icon: <MessageSquare className="w-4 h-4" />, label: 'AI Analyst' },{ id: 'explain', icon: <Activity className="w-4 h-4" />, label: 'Performance' }].map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id as ResultTab); if(tab.id === 'explain') handleExplain(); }} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{tab.icon} {tab.label}</button>
           ))}
        </div>
        <div className="flex items-center gap-2">
           {activeTab === 'table' && (<div className="flex items-center gap-2"><SmartFilterBar columns={columns} filters={filters} onChange={setFilters} onClear={() => setFilters([])} />{filters.length === 0 && (<div className="relative group"><Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" /><input type="text" placeholder="Busca rápida..." value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} className="pl-8 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-48" /></div>)}</div>)}
           <div className="relative">
              <button onClick={() => setShowExportMenu(!showExportMenu)} className={`flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors text-slate-700 dark:text-slate-300 ${showExportMenu ? 'ring-2 ring-indigo-500' : ''}`}><Download className="w-4 h-4" /> Exportar</button>
              {showExportMenu && (<div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-[90] overflow-hidden animate-in fade-in zoom-in-95" onClick={() => setShowExportMenu(false)}><div className="p-2 border-b border-slate-100 dark:border-slate-700"><button onClick={() => { setShowCodeModal(true); setShowExportMenu(false); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 rounded flex items-center gap-2 text-indigo-600 font-medium"><FileCode className="w-3.5 h-3.5" /> Exportar Código</button><button onClick={handleExportInsert} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 rounded flex items-center gap-2"><Database className="w-3.5 h-3.5" /> Copy as SQL INSERT</button></div><div className="p-2"><button onClick={() => { navigator.clipboard.writeText(JSON.stringify(filteredData)); onShowToast("JSON copiado!", "success"); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 rounded flex items-center gap-2"><FileJson className="w-3.5 h-3.5" /> Copy JSON Raw</button></div></div>)}
           </div>
           {!isFullscreen && <button onClick={toggleFullscreen} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title="Tela Cheia"><Maximize2 className="w-5 h-5" /></button>}
        </div>
      </div>

      <div id="results-content" className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col relative">
        {filteredData.length === 0 && data.length > 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8"><Filter className="w-12 h-12 opacity-30 mb-4" /><p>Nenhum resultado corresponde aos filtros atuais.</p></div>
        ) : data.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8"><Database className="w-12 h-12 opacity-30 mb-4" /><p>Nenhum resultado retornado</p></div>
        ) : (
          <>
            {activeTab === 'table' && <VirtualTable data={filteredData} columns={columns} highlightMatch={highlightMatch} onRowClick={(row) => !settings?.advancedMode && setSelectedRow(row)} isAdvancedMode={settings?.advancedMode} onUpdateCell={handleUpdateCell} onOpenJson={setViewJson} onDrillDown={(table, col, val) => setDrillDownTarget({ table, col, val })} schema={schema} defaultTableName={mainTableName} credentials={credentials} />}
            {activeTab === 'chart' && <div className="p-6 h-full w-full relative"><DataVisualizer data={filteredData} onDrillDown={handleChartDrillDown} /> </div>}
            {activeTab === 'analysis' && <div className="flex-1 h-full"><DataAnalysisChat data={filteredData} sql={sql} /></div>}
            {activeTab === 'explain' && <ExplainVisualizer plan={explainPlan} loading={loadingExplain} error={explainError} />}
          </>
        )}
      </div>

      {!isFullscreen && (
         <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
               <button onClick={onNewConnection} className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2 px-2 py-1"><Database className="w-4 h-4" /> Nova Conexão</button>
               {executionDuration !== undefined && executionDuration > 0 && (<span className="text-xs text-slate-400 flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700"><Clock className="w-3 h-3" /> Executado em {executionDuration.toFixed(0)}ms</span>)}
            </div>
            <button onClick={onBackToBuilder} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</button>
         </div>
      )}
    </div>
  );
};

export default ResultsStep;
