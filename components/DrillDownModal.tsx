
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Database, ArrowRight, Loader2, AlertCircle, LayoutGrid, Search, Copy, Check, Filter, MousePointer2, ChevronRight, Info, Table2, HelpCircle, Save, Key, AlertTriangle, Maximize2, Minimize2, Layers, DatabaseZap, Target } from 'lucide-react';
import { executeQueryReal } from '../services/dbService';
import { DbCredentials, DatabaseSchema, AppSettings } from '../types';

interface ManualLink {
  id: string;
  table: string;
  keyCol: string;
  previewCol: string;
}

interface DrillDownModalProps {
  targetTable: string; // Tabela inicial que disparou o modal
  filterColumn: string; 
  filterValue: any;
  credentials: DbCredentials | null;
  onClose: () => void;
  schema?: DatabaseSchema;
  allLinks?: ManualLink[]; // Lista completa de destinos para esta coluna
  settings?: AppSettings;
}

type ViewMode = 'table' | 'cards';

interface LinkCache {
   data: any[];
   loading: boolean;
   error: string | null;
   activeSearchCol: string;
}

const DrillDownModal: React.FC<DrillDownModalProps> = ({ targetTable, filterColumn, filterValue, credentials, onClose, schema, allLinks = [], settings }) => {
  const [activeLinkId, setActiveLinkId] = useState<string>(() => {
     const initial = allLinks.find(l => l.table === targetTable);
     return initial ? initial.id : (allLinks[0]?.id || 'manual');
  });

  // Cache para dados dos links (Suporte ao background loading)
  const [linkDataMap, setLinkDataMap] = useState<Record<string, LinkCache>>({});
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

  const activeLink = useMemo(() => allLinks.find(l => l.id === activeLinkId), [activeLinkId, allLinks]);

  const toggleExpandCell = (key: string) => {
    setExpandedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Função genérica de busca para um link
  const fetchSingleLink = async (link: ManualLink) => {
    if (!credentials) return;
    const safeValue = String(filterValue).replace(/'/g, "''");
    try {
      const sql = `SELECT * FROM ${link.table} WHERE "${link.keyCol}"::text = '${safeValue}' LIMIT 100`;
      // Fix: executeQueryReal result is an object { rows, audit }. Accessing .rows and checking .rows.length.
      const results = await executeQueryReal(credentials, sql);
      return {
         data: results.rows,
         loading: false,
         error: results.rows.length === 0 ? `Registro "${filterValue}" não localizado em ${link.table}.` : null,
         activeSearchCol: link.keyCol
      };
    } catch (e: any) {
      return {
         data: [],
         loading: false,
         error: e.message,
         activeSearchCol: link.keyCol
      };
    }
  };

  // Carga inicial e lógica de fundo
  useEffect(() => {
    const startLoad = async () => {
       if (!credentials) return;
       
       // Se background loading ativo, dispara TUDO em paralelo
       if (settings?.backgroundLoadLinks) {
          allLinks.forEach(link => {
             // Iniciar como loading
             setLinkDataMap(prev => ({ ...prev, [link.id]: { data: [], loading: true, error: null, activeSearchCol: link.keyCol } }));
             
             // Disparar busca assíncrona (thread simulada via Promise)
             fetchSingleLink(link).then(result => {
                if (result) {
                   setLinkDataMap(prev => ({ ...prev, [link.id]: result }));
                   // Se for o link atual que acabou de carregar, atualizar loading global
                   if (link.id === activeLinkId) {
                      setLoading(false);
                      if (result.error) setError(result.error);
                      else setViewMode(result.data.length === 1 ? 'cards' : 'table');
                   }
                }
             });
          });
       } else {
          // Apenas o ativo sob demanda
          if (activeLink) {
             setLoading(true);
             const result = await fetchSingleLink(activeLink);
             if (result) {
                setLinkDataMap(prev => ({ ...prev, [activeLinkId]: result }));
                setLoading(false);
                if (result.error) setError(result.error);
                else setViewMode(result.data.length === 1 ? 'cards' : 'table');
             }
          }
       }
    };
    
    startLoad();
  }, [credentials, filterValue]);

  const handleSwitchLink = async (id: string) => {
     setActiveLinkId(id);
     setError(null);
     setSearchTerm('');
     setExpandedCells(new Set());

     const cached = linkDataMap[id];
     if (cached && !cached.loading) {
        if (cached.error) setError(cached.error);
        else setViewMode(cached.data.length === 1 ? 'cards' : 'table');
     } else {
        setLoading(true);
        const link = allLinks.find(l => l.id === id);
        if (link) {
           const result = await fetchSingleLink(link);
           if (result) {
              setLinkDataMap(prev => ({ ...prev, [id]: result }));
              setLoading(false);
              if (result.error) setError(result.error);
              else setViewMode(result.data.length === 1 ? 'cards' : 'table');
           }
        }
     }
  };

  const currentCache = useMemo(() => linkDataMap[activeLinkId], [linkDataMap, activeLinkId]);
  const activeData = useMemo(() => currentCache?.data || [], [currentCache]);
  const columns = useMemo(() => (activeData.length > 0 ? Object.keys(activeData[0]) : []), [activeData]);

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return activeData;
    const term = searchTerm.toLowerCase();
    return activeData.filter(row => 
      Object.entries(row).some(([key, val]) => 
        key.toLowerCase().includes(term) || String(val).toLowerCase().includes(term)
      )
    );
  }, [activeData, searchTerm]);

  const handleCopy = (val: any, fieldKey: string) => {
    navigator.clipboard.writeText(String(val));
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[130] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        
        {/* Header com Switcher */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
           <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                 <Database className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                 <h3 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2 truncate">
                    <span className="text-indigo-600 dark:text-indigo-400 font-mono truncate">{activeLink?.keyCol}: {filterValue}</span>
                 </h3>
                 {allLinks.length > 1 ? (
                    <div className="flex items-center gap-1.5 mt-1.5">
                       <Layers className="w-3 h-3 text-slate-400" />
                       <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Vínculos:</span>
                       <div className="flex gap-1 overflow-x-auto max-w-[400px] scrollbar-none py-0.5 px-1 bg-slate-200/50 dark:bg-slate-800 rounded-lg">
                          {allLinks.map(link => {
                             const cache = linkDataMap[link.id];
                             const hasData = cache?.data && cache.data.length > 0;
                             const isCurrent = activeLinkId === link.id;
                             
                             return (
                                <button
                                   key={link.id}
                                   onClick={() => handleSwitchLink(link.id)}
                                   className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-sm
                                      ${isCurrent 
                                        ? 'bg-indigo-600 text-white' 
                                        : 'bg-white dark:bg-slate-700 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 dark:border-slate-600'
                                      }
                                   `}
                                >
                                   {link.table.split('.').pop()}
                                   {cache?.loading && <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-400" />}
                                   {hasData && !isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                                </button>
                             );
                          })}
                       </div>
                    </div>
                 ) : (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">Origem: {activeLink?.table}</p>
                 )}
              </div>
           </div>

           <div className="flex items-center gap-2 w-full sm:w-auto">
              {!loading && (
                <>
                  <div className="relative flex-1 sm:w-56">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Filtrar campos..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg shrink-0">
                    <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500 opacity-50'}`} title="Tabela"><Table2 className="w-4 h-4" /></button>
                    <button onClick={() => setViewMode('cards')} className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500 opacity-50'}`} title="Cards"><LayoutGrid className="w-4 h-4" /></button>
                  </div>
                </>
              )}
              <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 relative custom-scrollbar">
           {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-white/50 dark:bg-slate-900/50 z-20">
                 <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                 <span className="text-sm font-medium">Buscando detalhes em {activeLink?.table}...</span>
              </div>
           ) : error ? (
              <div className="p-12 text-center text-red-500 flex flex-col items-center">
                 <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                 <p className="font-bold text-lg">Registro não localizado</p>
                 <p className="text-sm opacity-80 mt-2 max-w-md">{error}</p>
                 {allLinks.length > 1 && (
                    <div className="mt-8 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                       <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-3">Tente outros vínculos para o mesmo valor:</p>
                       <div className="flex gap-2 flex-wrap justify-center">
                          {allLinks.filter(l => l.id !== activeLinkId).map(link => (
                             <button key={link.id} onClick={() => handleSwitchLink(link.id)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all border border-slate-200 dark:border-slate-600">
                                {link.table.split('.').pop()}
                             </button>
                          ))}
                       </div>
                    </div>
                 )}
              </div>
           ) : (
              <div className="p-4 sm:p-6 space-y-6">
                 {viewMode === 'table' ? (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto custom-scrollbar">
                       <table className="w-full text-left text-sm border-collapse min-w-max">
                          <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 shadow-sm z-10 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                             <tr>
                                {columns.map(col => <th key={col} className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">{col}</th>)}
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
                             {filteredData.map((row, i) => (
                                <tr key={i} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors group">
                                   {columns.map(col => {
                                      const isPkMatch = col === currentCache?.activeSearchCol;
                                      const cellKey = `table-${i}-${col}`;
                                      const isExpanded = expandedCells.has(cellKey);
                                      const val = row[col];
                                      const valStr = val === null ? 'null' : String(val);
                                      const isLong = valStr.length > 50;

                                      return (
                                        <td key={col} className={`px-4 py-3 border-b border-transparent group-hover:border-slate-100 dark:group-hover:border-slate-800 ${isPkMatch ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/20' : 'text-slate-600 dark:text-slate-400'}`}>
                                           <div className="flex items-start gap-2 max-w-[300px]">
                                              <span className={isExpanded ? 'whitespace-pre-wrap break-all' : 'truncate'}>
                                                 {val === null ? <span className="text-slate-300 italic opacity-50">null</span> : valStr}
                                              </span>
                                              {isLong && (
                                                 <button onClick={() => toggleExpandCell(cellKey)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-indigo-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                                                 </button>
                                              )}
                                           </div>
                                        </td>
                                      );
                                   })}
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 ) : (
                    <div className="space-y-6">
                       {filteredData.map((row, rowIndex) => (
                          <div key={rowIndex} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                             <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                   <Database className="w-3 h-3" /> Destino: {activeLink?.table}
                                </span>
                                <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">{columns.length} colunas</span>
                             </div>
                             <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0.5">
                                {columns.map(col => {
                                   const cellKey = `card-${rowIndex}-${col}`;
                                   const isExpanded = expandedCells.has(cellKey);
                                   const val = row[col];
                                   const valStr = val === null ? 'null' : String(val);
                                   const isLong = valStr.length > 80;
                                   const isMatch = searchTerm && (col.toLowerCase().includes(searchTerm.toLowerCase()) || valStr.toLowerCase().includes(searchTerm.toLowerCase()));
                                   const isPkMatch = col === currentCache?.activeSearchCol;
                                   
                                   return (
                                      <div key={col} className={`group flex items-start justify-between py-1.5 px-2 rounded transition-colors border-b border-slate-50 dark:border-slate-800/40 last:border-0 ${isMatch ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'} ${isExpanded ? 'flex-col md:col-span-2 gap-2' : ''}`}>
                                         <span className={`text-[11px] font-bold uppercase truncate pr-4 shrink-0 mt-0.5 ${isExpanded ? 'w-full' : 'max-w-[140px]'} ${isPkMatch ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} title={col}>
                                            {col}
                                         </span>
                                         <div className={`flex items-start gap-2 min-w-0 flex-1 ${isExpanded ? 'w-full' : 'justify-end'}`}>
                                            <div className={`text-xs font-mono break-all ${isExpanded ? 'whitespace-pre-wrap w-full bg-slate-50 dark:bg-slate-900/80 p-3 rounded-lg border border-slate-100 dark:border-slate-700' : 'truncate text-right'} ${val === null ? 'text-slate-300 italic' : isPkMatch ? 'text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                                               {valStr}
                                            </div>
                                            <div className="flex shrink-0">
                                               {isLong && (
                                                  <button onClick={() => toggleExpandCell(cellKey)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-all">
                                                     {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                                                  </button>
                                               )}
                                               <button onClick={() => handleCopy(val, `${rowIndex}-${col}`)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-all">
                                                  {copiedField === `${rowIndex}-${col}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                               </button>
                                            </div>
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
        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0">
           <div className="flex items-center gap-2 text-xs text-slate-400">
              {settings?.backgroundLoadLinks ? <DatabaseZap className="w-3.5 h-3.5 text-indigo-500" /> : <Target className="w-3.5 h-3.5 text-slate-300" />}
              <span>{settings?.backgroundLoadLinks ? 'Vínculos pré-carregados (Thread-safe)' : `Ativo: ${activeLink?.table}`}</span>
           </div>
           <button onClick={onClose} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg transition-all">Fechar</button>
        </div>
      </div>
    </div>
  );
};

export default DrillDownModal;
