
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Database, ChevronLeft, ChevronRight, FileSpreadsheet, Search, Copy, Check, BarChart2, MessageSquare, Download, Activity, LayoutGrid, FileText, Pin, AlertCircle, Info, MoreHorizontal, FileJson, FileCode, Hash, Type, Filter, Plus, X, Trash2, SlidersHorizontal, Clock, Maximize2, Minimize2, ExternalLink, Braces, PenTool, Save, Eye, Anchor, Link as LinkIcon, Settings2, Loader2, Folder, Terminal as TerminalIcon, ChevronDown, ChevronUp, Layers, Target, CornerDownRight, AlertTriangle, Undo2, ShieldAlert } from 'lucide-react';
import { AppSettings, DashboardItem, ExplainNode, DatabaseSchema, Table } from '../../types';
import DataVisualizer from '../DataVisualizer';
import DataAnalysisChat from '../DataAnalysisChat';
import CodeSnippetModal from '../CodeSnippetModal';
import JsonViewerModal from '../JsonViewerModal'; 
import DrillDownModal from '../DrillDownModal'; 
import { addToHistory } from '../../services/historyService';
import { executeQueryReal, explainQueryReal } from '../../services/dbService';

interface ManualLink {
  id: string;
  table: string;
  keyCol: string;
  previewCol: string;
}

interface VirtualTableProps {
   data: any[];
   columns: string[];
   highlightMatch: (text: string) => React.ReactNode;
   onRowClick: (row: any) => void;
   onOpenJson: (json: any) => void;
   onDrillDown: (table: string, col: string, val: any, allLinks?: ManualLink[]) => void;
   schema?: DatabaseSchema;
   credentials?: any;
}

const VirtualTable = ({ data, columns, highlightMatch, onOpenJson, onDrillDown, schema, credentials }: VirtualTableProps) => {
   const [currentPage, setCurrentPage] = useState(1);
   const [rowsPerPage, setRowsPerPage] = useState(25);
   const totalRows = data.length;
   const totalPages = Math.ceil(totalRows / Math.max(rowsPerPage, 1));
   const startIndex = (currentPage - 1) * rowsPerPage;
   const currentData = data.slice(startIndex, startIndex + rowsPerPage);

   const formatValue = (col: string, val: any) => {
      if (val === null || val === undefined) return <span className="text-slate-400 italic">null</span>;
      if (typeof val === 'object') return <button onClick={(e) => { e.stopPropagation(); onOpenJson(val); }} className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">JSON</button>;
      return <span className="truncate block w-full">{highlightMatch(String(val))}</span>;
   };

   return (
      <div className="flex flex-col h-full relative">
         <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse table-fixed">
               <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                  <tr>
                     {columns.map((col) => (
                        <th key={col} className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 truncate group relative">
                           {col}
                        </th>
                     ))}
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currentData.map((row, rowIdx) => (
                     <tr key={rowIdx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        {columns.map((col) => (
                           <td key={col} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 truncate">
                              {formatValue(col, row[col])}
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
  const [viewJson, setViewJson] = useState<any | null>(null);
  const [drillDownTarget, setDrillDownTarget] = useState<{table: string, col: string, val: any, allLinks?: ManualLink[]} | null>(null);
  
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  useEffect(() => { if (data) addToHistory({ sql, rowCount: data.length, durationMs: executionDuration || 0, status: 'success', schemaName: 'Database' }); }, []);

  const filteredData = useMemo(() => {
     return data.filter(row => {
        return !localSearch || Object.values(row).some(v => String(v || '').toLowerCase().includes(localSearch.toLowerCase()));
     });
  }, [data, localSearch]);

  return (
    <div className="h-full flex flex-col space-y-4">
      {viewJson && <JsonViewerModal json={viewJson} onClose={() => setViewJson(null)} />}
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
            {executionDuration !== undefined && <span className="text-xs text-slate-500 flex items-center gap-1 bg-slate-800 px-2 py-1 rounded border border-slate-700"><Clock className="w-3 h-3" /> {executionDuration.toFixed(0)}ms</span>}
         </div>
         <button onClick={onBackToBuilder} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      </div>
    </div>
  );
};

export default ResultsStep;
