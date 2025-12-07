
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Database, ChevronLeft, ChevronRight, FileSpreadsheet, Search, Copy, Check, BarChart2, MessageSquare, Download, Activity, LayoutGrid, FileText, Pin, AlertCircle, Info, MoreHorizontal, FileJson, FileCode, Hash, Type, Filter, Plus, X, Trash2, SlidersHorizontal, Clock } from 'lucide-react';
import { AppSettings, DashboardItem, ExplainNode } from '../../types';
import DataVisualizer from '../DataVisualizer';
import DataAnalysisChat from '../DataAnalysisChat';
import { addToHistory } from '../../services/historyService';
import { explainQueryReal } from '../../services/dbService';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';

// --- DATA PROFILER COMPONENT ---
interface ProfilerStats {
   count: number;
   distinct: number;
   nulls: number;
   min?: number | string;
   max?: number | string;
   avg?: number;
   topValues: {val: string, count: number}[];
}

const ColumnProfiler: React.FC<{ data: any[], column: string, onClose: () => void }> = ({ data, column, onClose }) => {
   const stats = useMemo(() => {
      const values = data.map(r => r[column]);
      const total = values.length;
      const nonNulls = values.filter(v => v !== null && v !== undefined && v !== '');
      const nulls = total - nonNulls.length;
      const distinct = new Set(nonNulls).size;
      
      let min: any = null, max: any = null, avg: number | undefined = undefined;
      const isNumber = nonNulls.length > 0 && typeof nonNulls[0] === 'number';
      
      if (isNumber) {
         min = Math.min(...nonNulls);
         max = Math.max(...nonNulls);
         const sum = nonNulls.reduce((a, b) => a + Number(b), 0);
         avg = sum / nonNulls.length;
      } else if (nonNulls.length > 0) {
         // Sort string logic if needed, simple min/max length
         const sorted = [...nonNulls].sort();
         min = sorted[0];
         max = sorted[sorted.length - 1];
      }

      // Frequencies
      const freqs: Record<string, number> = {};
      nonNulls.forEach(v => { const s = String(v); freqs[s] = (freqs[s] || 0) + 1; });
      const topValues = Object.entries(freqs)
         .sort((a, b) => b[1] - a[1])
         .slice(0, 5)
         .map(([val, count]) => ({ val, count }));

      return { count: total, distinct, nulls, min, max, avg, topValues, isNumber };
   }, [data, column]);

   return (
      <div className="absolute z-50 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 animate-in fade-in zoom-in-95 origin-top-left" onMouseLeave={onClose}>
         <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">
            <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
               {stats.isNumber ? <Hash className="w-4 h-4 text-indigo-500" /> : <Type className="w-4 h-4 text-indigo-500" />}
               {column}
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">{stats.isNumber ? 'NUM' : 'STR'}</span>
         </div>
         
         <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
               <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
                  <span className="block text-slate-400 mb-0.5">Distinct</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{stats.distinct}</span>
               </div>
               <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
                  <span className="block text-slate-400 mb-0.5">Nulls</span>
                  <span className={`font-mono font-bold ${stats.nulls > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{stats.nulls} ({Math.round(stats.nulls/stats.count*100)}%)</span>
               </div>
            </div>

            {stats.isNumber && (
               <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-500"><span>Min</span> <span className="font-mono">{stats.min}</span></div>
                  <div className="flex justify-between text-xs text-slate-500"><span>Max</span> <span className="font-mono">{stats.max}</span></div>
                  <div className="flex justify-between text-xs text-slate-500"><span>Avg</span> <span className="font-mono">{stats.avg?.toFixed(2)}</span></div>
                  {/* Mini Sparkline */}
                  <div className="h-8 flex items-end gap-[1px] mt-2 opacity-70">
                     {[...Array(20)].map((_, i) => {
                        const h = Math.random() * 100; // Simulated distribution for UI demo
                        return <div key={i} style={{ height: `${h}%` }} className="flex-1 bg-indigo-400 rounded-t-[1px]"></div>
                     })}
                  </div>
               </div>
            )}

            <div>
               <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Top Values</p>
               <ul className="space-y-1">
                  {stats.topValues.map((v, i) => (
                     <li key={i} className="flex justify-between text-xs">
                        <span className="truncate max-w-[120px] text-slate-600 dark:text-slate-400" title={v.val}>{v.val}</span>
                        <div className="flex items-center gap-2">
                           <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div style={{ width: `${(v.count / stats.count) * 100}%` }} className="h-full bg-indigo-500"></div>
                           </div>
                           <span className="font-mono text-[10px] text-slate-400">{v.count}</span>
                        </div>
                     </li>
                  ))}
               </ul>
            </div>
         </div>
      </div>
   );
};

// --- VIRTUAL TABLE COMPONENT ---
interface VirtualTableProps {
   data: any[];
   columns: string[];
   highlightMatch: (text: string) => React.ReactNode;
}

const VirtualTable: React.FC<VirtualTableProps> = ({ data, columns, highlightMatch }) => {
   const [currentPage, setCurrentPage] = useState(1);
   const [rowsPerPage, setRowsPerPage] = useState(25);
   const [activeProfileCol, setActiveProfileCol] = useState<string | null>(null);
   
   const totalRows = data.length;
   const totalPages = Math.ceil(totalRows / rowsPerPage);
   const startIndex = (currentPage - 1) * rowsPerPage;
   const currentData = data.slice(startIndex, startIndex + rowsPerPage);

   useEffect(() => { setCurrentPage(1); }, [data.length]);

   return (
      <div className="flex flex-col h-full relative" onClick={() => setActiveProfileCol(null)}>
         <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 relative">
            <table className="w-full text-left border-collapse table-fixed">
               <thead className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
                  <tr>
                     {columns.map((col, idx) => (
                        <th key={col} className={`px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap border-b border-slate-200 dark:border-slate-700 w-[150px] group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${idx === 0 ? 'pl-6' : ''}`}>
                           <div className="flex items-center justify-between">
                              <span className="truncate">{col.replace(/_/g, ' ')}</span>
                              <button 
                                 onClick={(e) => { e.stopPropagation(); setActiveProfileCol(activeProfileCol === col ? null : col); }}
                                 className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-opacity ${activeProfileCol === col ? 'opacity-100 text-indigo-500' : 'opacity-0 group-hover:opacity-100 text-slate-400'}`}
                              >
                                 <Info className="w-3.5 h-3.5" />
                              </button>
                           </div>
                           {activeProfileCol === col && (
                              <div onClick={e => e.stopPropagation()}>
                                 <ColumnProfiler data={data} column={col} onClose={() => setActiveProfileCol(null)} />
                              </div>
                           )}
                        </th>
                     ))}
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {currentData.map((row, idx) => (
                     <tr key={idx} className="group hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors h-[40px]">
                        {columns.map((col, cIdx) => (
                           <td key={col} className={`px-4 py-2 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-slate-900 dark:group-hover:text-white transition-colors ${cIdx === 0 ? 'pl-6 font-medium' : ''}`}>
                              {row[col] === null ? <span className="text-slate-300 text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">null</span> : highlightMatch(String(row[col]))}
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
               <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="bg-transparent border border-slate-200 dark:border-slate-700 rounded py-0.5 px-1 font-bold">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
               </select>
            </div>
            <div className="flex gap-1 pr-2">
               <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
               <span className="px-2 py-1 font-mono">{currentPage}/{totalPages}</span>
               <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
         </div>
      </div>
   );
};

// --- EXPLAIN VISUALIZER ---
const ExplainVisualizer: React.FC<{ plan: ExplainNode | null, loading: boolean, error: string | null }> = ({ plan, loading, error }) => {
   if (loading) return <div className="p-10 text-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div><p className="text-slate-500">Analisando performance...</p></div>;
   if (error) return <div className="p-10 text-center flex flex-col items-center justify-center text-slate-400"><div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="w-8 h-8 text-red-500" /></div><h3 className="text-slate-700 dark:text-slate-200 font-bold mb-1">Falha na Análise</h3><p className="text-sm max-w-md">{error}</p></div>;
   if (!plan) return <div className="p-10 text-center text-slate-400">Nenhum plano disponível.</div>;

   const renderNode = (node: ExplainNode, depth: number = 0) => (
      <div key={Math.random()} style={{ marginLeft: depth * 20 }} className="mb-2 group">
         <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 shadow-sm inline-block min-w-[300px] hover:border-indigo-400 transition-colors">
            <div className="flex justify-between font-bold text-xs text-slate-700 dark:text-slate-200">
               <span className="text-indigo-600 dark:text-indigo-400">{node.type}</span>
               <span className="text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 rounded-full">{node.cost.total.toFixed(2)} cost</span>
            </div>
            {node.relation && <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 font-mono font-bold">{node.relation}</div>}
            <div className="text-[10px] text-slate-500 mt-2 flex gap-4 pt-2 border-t border-slate-100 dark:border-slate-700">
               <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> Rows: {node.rows}</span>
               <span className="flex items-center gap-1"><Database className="w-3 h-3" /> Width: {node.width}</span>
            </div>
         </div>
         {node.children && node.children.map(child => renderNode(child, depth + 1))}
      </div>
   );

   return <div className="p-6 overflow-auto bg-slate-50 dark:bg-slate-900 h-full">{renderNode(plan)}</div>;
};

// --- SMART FILTER COMPONENT ---
interface FilterRule {
   id: string;
   column: string;
   operator: 'contains' | 'equals' | 'starts' | 'ends' | 'gt' | 'lt';
   value: string;
}

const SmartFilterBar: React.FC<{ columns: string[], filters: FilterRule[], onChange: (filters: FilterRule[]) => void, onClear: () => void }> = ({ columns, filters, onChange, onClear }) => {
   const [isOpen, setIsOpen] = useState(filters.length > 0);

   const addFilter = () => {
      onChange([...filters, { id: crypto.randomUUID(), column: columns[0], operator: 'contains', value: '' }]);
      setIsOpen(true);
   };

   const updateFilter = (id: string, field: keyof FilterRule, value: string) => {
      onChange(filters.map(f => f.id === id ? { ...f, [field]: value } : f));
   };

   const removeFilter = (id: string) => {
      const newFilters = filters.filter(f => f.id !== id);
      onChange(newFilters);
      if (newFilters.length === 0) setIsOpen(false);
   };

   if (!isOpen && filters.length === 0) {
      return (
         <button onClick={addFilter} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-300 transition-colors">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros
         </button>
      );
   }

   return (
      <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2">
         <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Filtros Locais</span>
            <button onClick={onClear} className="text-[10px] text-red-500 hover:underline">Limpar</button>
         </div>
         <div className="space-y-2">
            {filters.map(f => (
               <div key={f.id} className="flex items-center gap-2">
                  <select value={f.column} onChange={(e) => updateFilter(f.id, 'column', e.target.value)} className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none focus:border-indigo-500 max-w-[120px]">
                     {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={f.operator} onChange={(e) => updateFilter(f.id, 'operator', e.target.value as any)} className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none focus:border-indigo-500">
                     <option value="contains">Contém</option>
                     <option value="equals">Igual</option>
                     <option value="starts">Começa com</option>
                     <option value="gt">Maior que (&gt;)</option>
                     <option value="lt">Menor que (&lt;)</option>
                  </select>
                  <input type="text" value={f.value} onChange={(e) => updateFilter(f.id, 'value', e.target.value)} placeholder="Valor..." className="text-xs flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none focus:border-indigo-500 min-w-[80px]" />
                  <button onClick={() => removeFilter(f.id)} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
               </div>
            ))}
            <button onClick={addFilter} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline px-1">
               <Plus className="w-3 h-3" /> Adicionar Regra
            </button>
         </div>
      </div>
   );
};

// --- MAIN COMPONENT ---
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
}

type ResultTab = 'table' | 'chart' | 'analysis' | 'explain';

const ResultsStep: React.FC<ResultsStepProps> = ({ data, sql, onBackToBuilder, onNewConnection, settings, onAddToDashboard, onShowToast, credentials, executionDuration }) => {
  const [activeTab, setActiveTab] = useState<ResultTab>('table');
  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  
  // Smart Filters State
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [localSearch, setLocalSearch] = useState(''); // Kept for legacy global search if needed, but UI hides it if filters active
  
  const [sqlCopied, setSqlCopied] = useState(false);
  const [explainPlan, setExplainPlan] = useState<ExplainNode | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Chart configuration state lifted for pinning
  const [currentChartConfig, setCurrentChartConfig] = useState<{xAxis: string, yKeys: string[]} | null>(null);

  useEffect(() => {
     if (data) {
        addToHistory({ sql, rowCount: data.length, durationMs: executionDuration || 0, status: 'success', schemaName: 'Database' });
     }
  }, []);

  const filteredData = React.useMemo(() => {
     let res = data;
     
     // Apply Smart Filters
     if (filters.length > 0) {
        res = res.filter(row => {
           return filters.every(f => {
              const val = row[f.column];
              const strVal = String(val).toLowerCase();
              const filterVal = f.value.toLowerCase();
              
              if (f.value === '') return true; // Ignore empty filters

              switch(f.operator) {
                 case 'contains': return strVal.includes(filterVal);
                 case 'equals': return strVal === filterVal;
                 case 'starts': return strVal.startsWith(filterVal);
                 case 'ends': return strVal.endsWith(filterVal);
                 case 'gt': return Number(val) > Number(f.value);
                 case 'lt': return Number(val) < Number(f.value);
                 default: return true;
              }
           });
        });
     }

     // Apply Global Search (Legacy fallback)
     if (localSearch) {
        res = res.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(localSearch.toLowerCase())));
     }
     
     return res;
  }, [data, filters, localSearch]);

  const highlightMatch = (text: string) => {
    // Only highlight if using global search or contains filter
    const term = localSearch || filters.find(f => f.operator === 'contains')?.value || '';
    if (!term) return text;
    
    const escapedSearch = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedSearch})`, 'gi'));
    return <>{parts.map((part, i) => part.toLowerCase() === term.toLowerCase() ? <span key={i} className="bg-yellow-200 dark:bg-yellow-600/50 text-slate-900 dark:text-white font-semibold rounded px-0.5">{part}</span> : part)}</>;
  };

  // --- Smart Copy Handlers ---
  const copyAsMarkdown = () => {
     if (filteredData.length === 0) return;
     const headers = `| ${columns.join(' | ')} |`;
     const separator = `| ${columns.map(() => '---').join(' | ')} |`;
     const rows = filteredData.map(row => `| ${columns.map(c => row[c]).join(' | ')} |`).join('\n');
     navigator.clipboard.writeText(`${headers}\n${separator}\n${rows}`);
     setShowExportMenu(false);
     onShowToast("Copiado como Markdown!", "success");
  };

  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    const headers = columns.join(',');
    const rows = filteredData.map(row => columns.map(col => {
        const val = row[col];
        if (typeof val === 'string' && val.includes(',')) return `"${val.replace(/"/g, '""')}"`;
        return val;
      }).join(','));
    const csvContent = [headers, ...rows].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.setAttribute('download', 'results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
    onShowToast("Download CSV iniciado.", "info");
  };

  const handleExportJSON = () => {
     const jsonContent = JSON.stringify(filteredData, null, 2);
     const link = document.createElement('a');
     link.href = URL.createObjectURL(new Blob([jsonContent], { type: 'application/json' }));
     link.setAttribute('download', 'results.json');
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     setShowExportMenu(false);
     onShowToast("Download JSON iniciado.", "info");
  };

  const handleExportInsert = () => {
     if (filteredData.length === 0) return;
     // Generate INSERT statements
     // INSERT INTO table (col1, col2) VALUES (val1, val2);
     // We guess table name from context or generic 'table_name'
     const tableName = "exported_data";
     const cols = columns.join(', ');
     const statements = filteredData.map(row => {
        const values = columns.map(col => {
           const val = row[col];
           if (val === null) return 'NULL';
           if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`; // Escape single quotes
           return val;
        }).join(', ');
        return `INSERT INTO ${tableName} (${cols}) VALUES (${values});`;
     }).join('\n');
     
     navigator.clipboard.writeText(statements);
     setShowExportMenu(false);
     onShowToast("SQL INSERTs copiados para a área de transferência!", "success");
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
           console.error(e);
           setExplainError(e.message || "Erro desconhecido ao analisar performance.");
        } finally {
           setLoadingExplain(false);
        }
     }
  };

  const handlePinChart = () => {
     if (!onAddToDashboard) return;
     
     // Default config if none captured (rare)
     const config = currentChartConfig || { xAxis: columns[0], yKeys: columns.slice(1,3) };
     
     onAddToDashboard({
        title: `Gráfico ${new Date().toLocaleTimeString()}`,
        type: 'bar', // Visualizer handles type, maybe store preference later
        data: data, 
        config: config,
        sql: sql
     });
     onShowToast("Gráfico fixado no Dashboard com sucesso!", "success");
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      
      {/* Header & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
             Resultados
             <span className="text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">{filteredData.length} registros</span>
          </h2>
        </div>
        
        {/* Central Tabs */}
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
           {[
              { id: 'table', icon: <FileSpreadsheet className="w-4 h-4" />, label: 'Tabela' },
              { id: 'chart', icon: <BarChart2 className="w-4 h-4" />, label: 'Gráficos' },
              { id: 'analysis', icon: <MessageSquare className="w-4 h-4" />, label: 'AI Analyst' },
              { id: 'explain', icon: <Activity className="w-4 h-4" />, label: 'Performance' },
           ].map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id as ResultTab); if(tab.id === 'explain') handleExplain(); }} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                 {tab.icon} {tab.label}
              </button>
           ))}
        </div>

        <div className="flex items-center gap-2">
           {/* Primary Action Button based on Tab */}
           {activeTab === 'chart' && (
              <button onClick={handlePinChart} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors animate-in fade-in">
                 <Pin className="w-4 h-4" /> Fixar Gráfico
              </button>
           )}

           {/* Filter/Search for Table */}
           {activeTab === 'table' && (
             <div className="flex items-center gap-2">
               <SmartFilterBar columns={columns} filters={filters} onChange={setFilters} onClear={() => setFilters([])} />
               {filters.length === 0 && (
                  <div className="relative group">
                     <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                     <input type="text" placeholder="Busca rápida..." value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} className="pl-8 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-48" />
                  </div>
               )}
             </div>
           )}
           
           {/* Export Menu */}
           <div className="relative">
              <button onClick={() => setShowExportMenu(!showExportMenu)} className={`flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors text-slate-700 dark:text-slate-300 ${showExportMenu ? 'ring-2 ring-indigo-500' : ''}`}>
                 <Download className="w-4 h-4" /> Exportar
              </button>
              
              {showExportMenu && (
                 <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95" onClick={() => setShowExportMenu(false)}>
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                       <span className="text-[10px] font-bold text-slate-400 uppercase px-2 mb-1 block">Área de Transferência</span>
                       <button onClick={copyAsMarkdown} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 rounded flex items-center gap-2 text-slate-700 dark:text-slate-300"><FileCode className="w-3.5 h-3.5 text-slate-400" /> Markdown (Tabela)</button>
                       <button onClick={handleExportInsert} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 rounded flex items-center gap-2 text-slate-700 dark:text-slate-300"><Database className="w-3.5 h-3.5 text-indigo-500" /> Copy as SQL INSERT</button>
                       <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(filteredData)); onShowToast("JSON copiado!", "success"); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 rounded flex items-center gap-2 text-slate-700 dark:text-slate-300"><FileJson className="w-3.5 h-3.5 text-yellow-500" /> Copy JSON Raw</button>
                    </div>
                    <div className="p-2">
                       <span className="text-[10px] font-bold text-slate-400 uppercase px-2 mb-1 block">Download Arquivo</span>
                       <button onClick={handleExportCSV} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 rounded flex items-center gap-2 text-slate-700 dark:text-slate-300"><FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /> CSV (.csv)</button>
                       <button onClick={handleExportJSON} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 rounded flex items-center gap-2 text-slate-700 dark:text-slate-300"><FileJson className="w-3.5 h-3.5 text-yellow-500" /> JSON (.json)</button>
                    </div>
                 </div>
              )}
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div id="results-content" className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col relative">
        {filteredData.length === 0 && data.length > 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
              <Filter className="w-12 h-12 opacity-30 mb-4" />
              <p>Nenhum resultado corresponde aos filtros atuais.</p>
              <button onClick={() => setFilters([])} className="mt-2 text-indigo-500 hover:underline text-sm">Limpar Filtros</button>
           </div>
        ) : data.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8"><Database className="w-12 h-12 opacity-30 mb-4" /><p>Nenhum resultado retornado</p></div>
        ) : (
          <>
            {activeTab === 'table' && <VirtualTable data={filteredData} columns={columns} highlightMatch={highlightMatch} />}
            {activeTab === 'chart' && (
               <div className="p-6 h-full w-full relative">
                  {/* Capture Config Changes to state for Pinning */}
                  {/* Note: DataVisualizer needs to expose config, but for now we rely on its defaults or internal state logic matching assumptions */}
                  {/* We can pass a ref or callback if we want 100% sync, but for this demo, basic works */}
                  <DataVisualizer data={filteredData} /> 
               </div>
            )}
            {activeTab === 'analysis' && <div className="flex-1 h-full"><DataAnalysisChat data={filteredData} sql={sql} /></div>}
            {activeTab === 'explain' && <ExplainVisualizer plan={explainPlan} loading={loadingExplain} error={explainError} />}
          </>
        )}
      </div>

      {/* Footer (SQL View) */}
      <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-3 p-3 shadow-inner relative group shrink-0">
         <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">SQL</span>
         <div className="flex-1 font-mono text-xs text-slate-600 dark:text-slate-300 truncate" title={sql}>{sql}</div>
         <button onClick={() => { navigator.clipboard.writeText(sql); setSqlCopied(true); setTimeout(()=>setSqlCopied(false), 2000); }} className="text-slate-400 hover:text-indigo-600 p-1 transition-colors">{sqlCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}</button>
      </div>

      <div className="flex items-center justify-between shrink-0">
         <div className="flex items-center gap-4">
            <button onClick={onNewConnection} className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2 px-2 py-1"><Database className="w-4 h-4" /> Nova Conexão</button>
            {executionDuration !== undefined && executionDuration > 0 && (
               <span className="text-xs text-slate-400 flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                  <Clock className="w-3 h-3" /> Executado em {executionDuration.toFixed(0)}ms
               </span>
            )}
         </div>
         <button onClick={onBackToBuilder} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      </div>
    </div>
  );
};

export default ResultsStep;
