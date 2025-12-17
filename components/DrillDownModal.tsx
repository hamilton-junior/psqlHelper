
import React, { useState, useEffect, useMemo } from 'react';
import { X, Database, ArrowRight, Loader2, AlertCircle, LayoutGrid, List, Search, Copy, Check, ExternalLink, Filter } from 'lucide-react';
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
          // Buscamos os dados da tabela alvo filtrando pelo valor clicado
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
    return data.map(row => {
      const filteredRow: any = {};
      let hasMatch = false;
      Object.entries(row).forEach(([key, val]) => {
        if (key.toLowerCase().includes(term) || String(val).toLowerCase().includes(term)) {
          filteredRow[key] = val;
          hasMatch = true;
        }
      });
      return hasMatch ? row : null;
    }).filter(Boolean) as any[];
  }, [data, searchTerm]);

  const handleCopy = (val: any, fieldKey: string) => {
    navigator.clipboard.writeText(String(val));
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                 <Database className="w-5 h-5" />
              </div>
              <div>
                 <h3 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                    {targetTable}
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="text-indigo-600 dark:text-indigo-400 font-mono">{filterColumn}: {filterValue}</span>
                 </h3>
                 <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">Detalhamento de Registro</p>
              </div>
           </div>

           <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                 <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                 <input 
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Filtrar campos ou valores..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                 />
              </div>

              <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
                 <button 
                    onClick={() => setViewMode('cards')} 
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}`}
                    title="Visualização em Lista/Cards"
                 >
                    <List className="w-4 h-4" />
                 </button>
                 <button 
                    onClick={() => setViewMode('table')} 
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}`}
                    title="Visualização em Tabela"
                 >
                    <LayoutGrid className="w-4 h-4" />
                 </button>
              </div>

              <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors">
                 <X className="w-5 h-5" />
              </button>
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 relative min-h-[300px] custom-scrollbar">
           {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                 <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                 <span className="text-sm font-medium">Buscando informações detalhadas...</span>
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
                 <p className="text-lg font-medium">Nenhum dado encontrado</p>
                 <p className="text-sm opacity-60">Tente ajustar sua busca ou verifique se o registro ainda existe.</p>
              </div>
           ) : (
              <div className="p-6">
                 {viewMode === 'table' ? (
                    /* Table View - classic but with better styling */
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                       <table className="w-full text-left text-sm border-collapse">
                          <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 shadow-sm z-10">
                             <tr>
                                {columns.map(col => (
                                   <th key={col} className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 text-[10px] uppercase tracking-wider whitespace-nowrap border-b border-slate-200 dark:border-slate-700">
                                      {col.replace(/_/g, ' ')}
                                   </th>
                                ))}
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                             {filteredData.map((row, i) => (
                                <tr key={i} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                                   {columns.map(col => (
                                      <td key={col} className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs font-mono">
                                         {row[col] === null ? <span className="text-slate-300 italic">null</span> : String(row[col])}
                                      </td>
                                   ))}
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 ) : (
                    /* Cards/List View - BETTER FOR MANY COLUMNS */
                    <div className="space-y-8">
                       {filteredData.map((row, rowIndex) => (
                          <div key={rowIndex} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                             <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                   <Database className="w-3 h-3" /> Registro #{rowIndex + 1}
                                </span>
                                <span className="text-[10px] font-mono text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                                   {targetTable}
                                </span>
                             </div>
                             
                             <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-4 gap-x-8">
                                {columns.map(col => {
                                   const val = row[col];
                                   const isMatch = searchTerm && (col.toLowerCase().includes(searchTerm.toLowerCase()) || String(val).toLowerCase().includes(searchTerm.toLowerCase()));
                                   
                                   return (
                                      <div key={col} className={`group relative p-2 rounded-lg transition-all ${isMatch ? 'bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-200 dark:ring-yellow-800/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                         <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate pr-4" title={col}>
                                               {col.replace(/_/g, ' ')}
                                            </span>
                                            <button 
                                               onClick={() => handleCopy(val, `${rowIndex}-${col}`)}
                                               className="opacity-0 group-hover:opacity-100 p-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                                               title="Copiar valor"
                                            >
                                               {copiedField === `${rowIndex}-${col}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                            </button>
                                         </div>
                                         <div className={`text-sm font-mono break-all ${val === null ? 'text-slate-300 italic italic' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {val === null ? 'null' : typeof val === 'boolean' ? (
                                               <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${val ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                  {String(val).toUpperCase()}
                                               </span>
                                            ) : String(val)}
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
        
        {/* Footer */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
           <div className="text-xs text-slate-500">
              {data.length > 0 && <span>Exibindo <strong>{filteredData.length}</strong> campos correspondentes</span>}
           </div>
           <button 
              onClick={onClose}
              className="px-6 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold transition-all border border-slate-200 dark:border-slate-700"
           >
              Fechar Detalhes
           </button>
        </div>
      </div>
    </div>
  );
};

export default DrillDownModal;
