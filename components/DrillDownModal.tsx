
import React, { useState, useEffect, useMemo } from 'react';
import { X, Database, ArrowRight, Loader2, AlertCircle, LayoutGrid, List, Search, Copy, Check, Filter } from 'lucide-react';
import { executeQueryReal } from '../services/dbService';
import { DbCredentials } from '../types';

interface DrillDownModalProps {
  targetTable: string; // "schema.table"
  filterColumn: string; // "id" usually
  filterValue: any;
  credentials: DbCredentials | null;
  onClose: () => void;
}

type ViewMode = 'table' | 'cards';

const DrillDownModal: React.FC<DrillDownModalProps> = ({ targetTable, filterColumn, filterValue, credentials, onClose }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
       if (!credentials) return;
       setLoading(true);
       try {
          const sql = `SELECT * FROM ${targetTable} WHERE ${filterColumn} = '${String(filterValue).replace(/'/g, "''")}' LIMIT 50`;
          const res = await executeQueryReal(credentials, sql);
          setData(res);
       } catch (e: any) {
          setError(e.message);
       } finally {
          setLoading(false);
       }
    };
    fetchData();
  }, [targetTable, filterColumn, filterValue, credentials]);

  const columns = useMemo(() => (data.length > 0 ? Object.keys(data[0]) : []), [data]);

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(row => 
      Object.entries(row).some(([key, val]) => 
        key.toLowerCase().includes(term) || String(val).toLowerCase().includes(term)
      )
    );
  }, [data, searchTerm]);

  const handleCopy = (val: any, fieldKey: string) => {
    navigator.clipboard.writeText(String(val));
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header - Sticky */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                 <Database className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                 <h3 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2 truncate">
                    <span className="opacity-60">{targetTable.split('.')[0]}.</span>{targetTable.split('.')[1]}
                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-indigo-600 dark:text-indigo-400 font-mono truncate">{filterColumn}: {filterValue}</span>
                 </h3>
                 <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">Detalhamento de Registro</p>
              </div>
           </div>

           <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                 <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                 <input 
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Filtrar campos ou valores..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                 />
              </div>

              <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg shrink-0">
                 <button 
                    onClick={() => setViewMode('cards')} 
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}`}
                    title="Modo Cards Compacto"
                 >
                    <List className="w-4 h-4" />
                 </button>
                 <button 
                    onClick={() => setViewMode('table')} 
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}`}
                    title="Modo Tabela"
                 >
                    <LayoutGrid className="w-4 h-4" />
                 </button>
              </div>

              <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors">
                 <X className="w-5 h-5" />
              </button>
           </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 relative custom-scrollbar">
           {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                 <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                 <span className="text-sm font-medium">Carregando dados...</span>
              </div>
           ) : error ? (
              <div className="p-12 text-center text-red-500 flex flex-col items-center">
                 <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                 <p className="font-bold text-lg">Erro na consulta</p>
                 <p className="text-sm opacity-80 mt-2 max-w-md">{error}</p>
              </div>
           ) : filteredData.length === 0 ? (
              <div className="p-20 text-center text-slate-400 flex flex-col items-center">
                 <Filter className="w-16 h-16 mb-4 opacity-20" />
                 <p className="text-lg font-medium">Nenhum dado corresponde ao filtro</p>
              </div>
           ) : (
              <div className="p-4 sm:p-6 space-y-6">
                 {viewMode === 'table' ? (
                    /* Table View - Scrollable Horizontal & Vertical */
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto custom-scrollbar">
                       <table className="w-full text-left text-sm border-collapse min-w-max">
                          <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 shadow-sm z-10">
                             <tr>
                                {columns.map(col => (
                                   <th key={col} className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 text-[10px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                      {col}
                                   </th>
                                ))}
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                             {filteredData.map((row, i) => (
                                <tr key={i} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                                   {columns.map(col => (
                                      <td key={col} className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs font-mono">
                                         {row[col] === null ? <span className="text-slate-300 italic">null</span> : String(row[col])}
                                      </td>
                                   ))}
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 ) : (
                    /* Cards View - COMPACT & TWO COLUMNS GRID */
                    <div className="space-y-6">
                       {filteredData.map((row, rowIndex) => (
                          <div key={rowIndex} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                             <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                   Registro {rowIndex + 1}
                                </span>
                                <div className="flex gap-2">
                                   <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
                                      {columns.length} campos
                                   </span>
                                </div>
                             </div>
                             
                             <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0.5">
                                {columns.map(col => {
                                   const val = row[col];
                                   const valStr = val === null ? 'null' : String(val);
                                   const isMatch = searchTerm && (col.toLowerCase().includes(searchTerm.toLowerCase()) || valStr.toLowerCase().includes(searchTerm.toLowerCase()));
                                   
                                   return (
                                      <div key={col} className={`group flex items-center justify-between py-1.5 px-2 rounded transition-colors border-b border-slate-50 dark:border-slate-800/40 last:border-0 ${isMatch ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}>
                                         <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate pr-4 max-w-[140px]" title={col}>
                                            {col}
                                         </span>
                                         <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                                            <div className={`text-xs font-mono truncate text-right ${val === null ? 'text-slate-300 italic' : 'text-slate-700 dark:text-slate-300'}`}>
                                               {typeof val === 'boolean' ? (
                                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${val ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                     {valStr.toUpperCase()}
                                                  </span>
                                               ) : valStr}
                                            </div>
                                            <button 
                                               onClick={() => handleCopy(val, `${rowIndex}-${col}`)}
                                               className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shrink-0"
                                               title="Copiar valor"
                                            >
                                               {copiedField === `${rowIndex}-${col}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                            </button>
                                         </div>
                                      </div>
                                   );
                                })}
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
           )}
        </div>
        
        {/* Footer - Sticky */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
           <div className="text-xs text-slate-400">
              {data.length > 0 && <span>Total de <strong>{columns.length}</strong> colunas analisadas</span>}
           </div>
           <button 
              onClick={onClose}
              className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
           >
              Fechar Detalhes
           </button>
        </div>
      </div>
    </div>
  );
};

export default DrillDownModal;
