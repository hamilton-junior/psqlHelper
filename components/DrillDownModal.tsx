
import React, { useState, useEffect, useMemo } from 'react';
import { X, Database, ArrowRight, Loader2, AlertCircle, LayoutGrid, Search, Copy, Check, Filter, MousePointer2, ChevronRight, Info, Table2, HelpCircle, Save, Key, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';
import { executeQueryReal } from '../services/dbService';
import { DbCredentials, DatabaseSchema } from '../types';

interface DrillDownModalProps {
  targetTable: string; // "schema.table"
  filterColumn: string; 
  filterValue: any;
  credentials: DbCredentials | null;
  onClose: () => void;
  schema?: DatabaseSchema;
}

type ViewMode = 'table' | 'cards' | 'select' | 'map_column';

interface AmbiguousMatch {
  row: any;
  matchedColumn: string;
}

const DrillDownModal: React.FC<DrillDownModalProps> = ({ targetTable, filterColumn, filterValue, credentials, onClose, schema }) => {
  const [data, setData] = useState<any[]>([]);
  const [ambiguousMatches, setAmbiguousMatches] = useState<AmbiguousMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeSearchCol, setActiveSearchCol] = useState(filterColumn);
  const [columnFilterTerm, setColumnFilterTerm] = useState('');
  
  // Estado para controlar campos expandidos (Texto longo)
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

  const toggleExpandCell = (key: string) => {
    setExpandedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getUserMappings = () => {
    try {
      const stored = localStorage.getItem('psql-buddy-drilldown-mappings');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  };

  const saveUserMapping = (targetTable: string, column: string) => {
    const mappings = getUserMappings();
    mappings[targetTable] = column;
    localStorage.setItem('psql-buddy-drilldown-mappings', JSON.stringify(mappings));
  };

  const targetTableColumns = useMemo(() => {
    if (!schema) return [];
    const parts = targetTable.split('.');
    const sName = parts.length > 1 ? parts[0] : 'public';
    const tName = parts.length > 1 ? parts[1] : parts[0];
    
    const table = schema.tables.find(t => 
      t.name.toLowerCase() === tName.toLowerCase() && 
      (t.schema || 'public').toLowerCase() === sName.toLowerCase()
    );
    return table ? table.columns : [];
  }, [schema, targetTable]);

  const getIdentifierColumns = () => {
    if (targetTableColumns.length > 0) {
      return targetTableColumns
        .filter(c => c.isPrimaryKey || c.name.toLowerCase().includes('id') || c.name.toLowerCase().includes('cod') || c.isForeignKey || c.name.toLowerCase() === 'grid')
        .map(c => c.name);
    }
    return ['grid', 'id', 'codigo', 'cod'];
  };

  const fetchData = async (column?: string, value?: any, isManual = false) => {
    if (!credentials) return;
    setLoading(true);
    setError(null);
    
    const val = value !== undefined ? value : filterValue;
    const safeValue = String(val).replace(/'/g, "''");
    const idCols = isManual && column ? [column] : getIdentifierColumns();

    try {
      const conditions = idCols.map(col => `${col}::text = '${safeValue}'`).join(' OR ');
      const sql = `SELECT * FROM ${targetTable} WHERE ${conditions} LIMIT 100`;
      
      const results = await executeQueryReal(credentials, sql);
      
      if (results.length === 0) {
        if (isManual) {
          setError(`O valor "${val}" não foi encontrado na coluna "${column}".`);
        } else {
          setViewMode('map_column');
        }
        setLoading(false);
        return;
      }

      const matches: AmbiguousMatch[] = results.map(row => {
        const matchedCol = idCols.find(c => String(row[c]) === String(val)) || idCols[0];
        return { row, matchedColumn: matchedCol };
      });

      const matchedColumnsSet = new Set(matches.map(m => m.matchedColumn));

      if (matchedColumnsSet.size > 1 && !isManual) {
        setAmbiguousMatches(matches);
        setViewMode('select');
      } else {
        setData(results);
        setActiveSearchCol(matches[0].matchedColumn);
        
        // Lógica de visualização padrão: 1 registro = Card, >1 = Tabela
        if (results.length === 1) {
          setViewMode('cards');
        } else {
          setViewMode('table');
        }

        if (isManual && column) saveUserMapping(targetTable, column);
      }
    } catch (e: any) {
      setError(e.message);
      setViewMode('map_column');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const mappings = getUserMappings();
    if (mappings[targetTable]) {
      fetchData(mappings[targetTable], filterValue, true);
    } else {
      fetchData();
    }
  }, [targetTable, filterValue, credentials]);

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

  const filteredTargetColumns = useMemo(() => {
    if (!columnFilterTerm.trim()) return targetTableColumns;
    return targetTableColumns.filter(c => c.name.toLowerCase().includes(columnFilterTerm.toLowerCase()));
  }, [targetTableColumns, columnFilterTerm]);

  const handleCopy = (val: any, fieldKey: string) => {
    navigator.clipboard.writeText(String(val));
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
           <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                 <Database className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                 <h3 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2 truncate">
                    <span className="opacity-60">{targetTable}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-indigo-600 dark:text-indigo-400 font-mono truncate">{viewMode === 'select' ? 'Conflito de Identificadores' : `${activeSearchCol}: ${filterValue}`}</span>
                 </h3>
                 <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">Detalhamento Avançado</p>
              </div>
           </div>

           <div className="flex items-center gap-2 w-full sm:w-auto">
              {['cards', 'table'].includes(viewMode) && (
                <>
                  <div className="relative flex-1 sm:w-56">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Filtrar nesta lista..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg shrink-0">
                    <button 
                        onClick={() => setViewMode('table')} 
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500 opacity-50'}`}
                        title="Modo Lista"
                    >
                        <Table2 className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setViewMode('cards')} 
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500 opacity-50'}`}
                        title="Modo Cards"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
              <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors">
                 <X className="w-5 h-5" />
              </button>
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 relative custom-scrollbar">
           {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-white/50 dark:bg-slate-900/50 z-20">
                 <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                 <span className="text-sm font-medium">Processando resultados...</span>
              </div>
           ) : viewMode === 'select' ? (
              <div className="p-8 max-w-4xl mx-auto">
                 <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl p-6 mb-8 flex items-start gap-4 shadow-sm">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-amber-500">
                       <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                       <h4 className="font-bold text-amber-900 dark:text-amber-100 text-lg">Múltiplas correspondências em campos diferentes</h4>
                       <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
                          O valor <strong>"{filterValue}"</strong> foi encontrado em diferentes colunas identificadoras da tabela. Selecione qual registro você deseja detalhar:
                       </p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 gap-3">
                    {ambiguousMatches.map((match, idx) => {
                       const row = match.row;
                       const descCol = columns.find(c => ['nome', 'descricao', 'desc', 'full_name', 'name'].includes(c.toLowerCase())) || columns[1] || columns[0];
                       return (
                          <button 
                             key={idx}
                             onClick={() => { setData([row]); setActiveSearchCol(match.matchedColumn); setViewMode('cards'); }}
                             className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-indigo-500 hover:shadow-lg transition-all group text-left"
                          >
                             <div className="flex items-center gap-5">
                                <div className="flex flex-col items-center gap-1 shrink-0">
                                  <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                     <MousePointer2 className="w-5 h-5" />
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Opção {idx + 1}</span>
                                </div>
                                <div className="min-w-0">
                                   <div className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded w-fit mb-1 border border-indigo-100 dark:border-indigo-800">
                                      Encontrado via coluna: <strong>{match.matchedColumn}</strong>
                                   </div>
                                   <div className="font-bold text-slate-800 dark:text-slate-100 text-base truncate">
                                      {String(row[descCol] || 'Registro sem descrição disponível')}
                                   </div>
                                   <div className="flex flex-wrap gap-2 mt-2">
                                      {getIdentifierColumns().filter(c => row[c] !== undefined).map(c => (
                                         <span key={c} className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${c === match.matchedColumn ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 border-amber-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200'}`}>
                                            {c}: {row[c]}
                                         </span>
                                      ))}
                                   </div>
                                </div>
                             </div>
                             <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                          </button>
                       );
                    })}
                 </div>
              </div>
           ) : viewMode === 'map_column' ? (
              <div className="p-8 max-w-4xl mx-auto">
                 <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl p-6 mb-8 flex items-start gap-5 shadow-sm">
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm text-amber-500 shrink-0">
                       <HelpCircle className="w-8 h-8" />
                    </div>
                    <div>
                       <h4 className="font-bold text-amber-900 dark:text-amber-100 text-xl">Não encontramos resultados</h4>
                       <p className="text-amber-700 dark:text-amber-300 text-sm mt-1 leading-relaxed">
                          O valor <strong>"{filterValue}"</strong> não foi localizado nos campos padrão. 
                          Deseja realizar a busca em qual coluna específica desta tabela?
                       </p>
                    </div>
                 </div>

                 <div className="mb-6 relative">
                    <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                    <input 
                       type="text"
                       placeholder="Buscar coluna específica..."
                       value={columnFilterTerm}
                       onChange={e => setColumnFilterTerm(e.target.value)}
                       className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                    />
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredTargetColumns.map((col) => (
                       <button 
                          key={col.name}
                          onClick={() => fetchData(col.name, filterValue, true)}
                          className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all group text-left"
                       >
                          <div className="w-9 h-9 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                             {col.isPrimaryKey ? <Key className="w-4 h-4 text-amber-500" /> : <Table2 className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                             <div className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{col.name}</div>
                             <div className="text-[10px] text-slate-400 font-mono uppercase">{col.type}</div>
                          </div>
                       </button>
                    ))}
                 </div>
              </div>
           ) : error ? (
              <div className="p-12 text-center text-red-500 flex flex-col items-center">
                 <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                 <p className="font-bold text-lg">Erro na consulta</p>
                 <p className="text-sm opacity-80 mt-2 max-w-md">{error}</p>
                 <button onClick={() => setViewMode('map_column')} className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors">Tentar outra coluna</button>
              </div>
           ) : (
              <div className="p-4 sm:p-6 space-y-6">
                 {viewMode === 'table' ? (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto custom-scrollbar">
                       <table className="w-full text-left text-sm border-collapse min-w-max">
                          <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 shadow-sm z-10 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                             <tr>
                                {columns.map(col => <th key={col} className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">{col}</th>)}
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                             {filteredData.map((row, i) => (
                                <tr key={i} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors group">
                                   {columns.map(col => {
                                      const isPkMatch = col === activeSearchCol;
                                      const cellKey = `table-${i}-${col}`;
                                      const isExpanded = expandedCells.has(cellKey);
                                      const val = row[col];
                                      const valStr = val === null ? 'null' : String(val);
                                      const isLong = valStr.length > 50;

                                      return (
                                        <td key={col} className={`px-4 py-3 text-xs font-mono border-b border-transparent group-hover:border-slate-100 dark:group-hover:border-slate-800 ${isPkMatch ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/20' : 'text-slate-600 dark:text-slate-400'}`}>
                                           <div className="flex items-start gap-2 max-w-[300px]">
                                              <span className={isExpanded ? 'whitespace-pre-wrap break-all' : 'truncate'}>
                                                 {val === null ? <span className="text-slate-300 italic opacity-50">null</span> : valStr}
                                              </span>
                                              {isLong && (
                                                 <button 
                                                    onClick={() => toggleExpandCell(cellKey)}
                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-indigo-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                 >
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
                                   <Database className="w-3 h-3" /> Registro #{rowIndex + 1}
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
                                   const isPkMatch = col === activeSearchCol;
                                   
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
                                                  <button 
                                                     onClick={() => toggleExpandCell(cellKey)}
                                                     className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-all"
                                                     title={isExpanded ? "Recolher campo" : "Ver valor completo"}
                                                  >
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
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
           <div className="flex items-center gap-2 text-xs text-slate-400">
              <Save className="w-3.5 h-3.5" />
              <span>Memória ativa para <strong>{targetTable}</strong> ({activeSearchCol})</span>
           </div>
           <button onClick={onClose} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg transition-all">Fechar Detalhes</button>
        </div>
      </div>
    </div>
  );
};

export default DrillDownModal;
