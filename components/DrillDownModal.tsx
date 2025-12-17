
import React, { useState, useEffect, useMemo } from 'react';
import { X, Database, ArrowRight, Loader2, AlertCircle, LayoutGrid, List, Search, Copy, Check, Filter, MousePointer2, ChevronRight, Info, Table2, HelpCircle, Save, Key } from 'lucide-react';
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

const DrillDownModal: React.FC<DrillDownModalProps> = ({ targetTable, filterColumn, filterValue, credentials, onClose, schema }) => {
  const [data, setData] = useState<any[]>([]);
  const [ambiguousRows, setAmbiguousRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeSearchCol, setActiveSearchCol] = useState(filterColumn);
  const [columnFilterTerm, setColumnFilterTerm] = useState('');

  // Carrega mapeamentos salvos pelo usuário (Tabela -> Coluna Preferencial)
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

  // Todas as colunas da tabela alvo (para o modo de mapeamento)
  const targetTableColumns = useMemo(() => {
    if (!schema) return [];
    const [sName, tName] = targetTable.includes('.') ? targetTable.split('.') : ['public', targetTable];
    const table = schema.tables.find(t => t.name === tName && (t.schema || 'public') === sName);
    return table ? table.columns : [];
  }, [schema, targetTable]);

  // Colunas candidatas para o fallback automático
  const getIdentifierColumns = () => {
    if (targetTableColumns.length > 0) {
      return targetTableColumns
        .filter(c => c.isPrimaryKey || c.name.toLowerCase().includes('id') || c.name.toLowerCase().includes('cod') || c.isForeignKey)
        .map(c => c.name);
    }
    return ['id', 'codigo', 'cod', 'grid'];
  };

  const fetchData = async (column: string, value: any, isManualMapping = false) => {
    if (!credentials) return;
    setLoading(true);
    setError(null);
    
    try {
      const safeValue = String(value).replace(/'/g, "''");
      const sql = `SELECT * FROM ${targetTable} WHERE ${column}::text = '${safeValue}' LIMIT 50`;
      const res = await executeQueryReal(credentials, sql);
      
      if (res.length === 1) {
        setData(res);
        setViewMode('cards');
        setActiveSearchCol(column);
        if (isManualMapping) saveUserMapping(targetTable, column);
      } else if (res.length > 1) {
        setAmbiguousRows(res);
        setViewMode('select');
        if (isManualMapping) saveUserMapping(targetTable, column);
      } else if (!isManualMapping) {
        // 0 resultados na primeira tentativa: Tentar Fallback Automático
        await performFallbackSearch(value);
      } else {
        // Mapeamento manual não retornou nada
        setError(`O valor "${value}" não foi encontrado na coluna "${column}".`);
        setViewMode('map_column');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const performFallbackSearch = async (value: any) => {
    if (!credentials) return;
    const fallbackCols = getIdentifierColumns().filter(c => c !== filterColumn);
    const safeValue = String(value).replace(/'/g, "''");
    
    // Se não houver colunas candidatas conhecidas, pula para o mapeamento manual
    if (fallbackCols.length === 0) {
      setViewMode('map_column');
      return;
    }

    const conditions = fallbackCols.map(col => `${col}::text = '${safeValue}'`).join(' OR ');
    const sql = `SELECT * FROM ${targetTable} WHERE ${conditions} LIMIT 50`;
    
    try {
      const res = await executeQueryReal(credentials, sql);
      if (res.length === 0) {
        // Fallback falhou: Perguntar ao usuário qual coluna usar
        setViewMode('map_column');
      } else if (res.length === 1) {
        setData(res);
        const matchedCol = fallbackCols.find(c => String(res[0][c]) === String(value)) || fallbackCols[0];
        setActiveSearchCol(matchedCol);
        setViewMode('cards');
      } else {
        setAmbiguousRows(res);
        setViewMode('select');
      }
    } catch (e) {
      setViewMode('map_column');
    }
  };

  useEffect(() => {
    // Verifica se já existe um mapeamento salvo para esta tabela
    const mappings = getUserMappings();
    if (mappings[targetTable]) {
      fetchData(mappings[targetTable], filterValue, true);
    } else {
      fetchData(filterColumn, filterValue);
    }
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

  const filteredTargetColumns = useMemo(() => {
    if (!columnFilterTerm.trim()) return targetTableColumns;
    return targetTableColumns.filter(c => c.name.toLowerCase().includes(columnFilterTerm.toLowerCase()));
  }, [targetTableColumns, columnFilterTerm]);

  const handleCopy = (val: any, fieldKey: string) => {
    navigator.clipboard.writeText(String(val));
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const selectRow = (row: any) => {
    setData([row]);
    setViewMode('cards');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
           <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                 <Database className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                 <h3 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2 truncate">
                    <span className="opacity-60">{targetTable}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-indigo-600 dark:text-indigo-400 font-mono truncate">{activeSearchCol}: {filterValue}</span>
                 </h3>
                 <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">Detalhamento Avançado</p>
              </div>
           </div>

           <div className="flex items-center gap-2 w-full sm:w-auto">
              {['cards', 'table'].includes(viewMode) && (
                <div className="relative flex-1 sm:w-56">
                   <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                   <input 
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Filtrar dados..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                   />
                </div>
              )}

              <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg shrink-0">
                 <button 
                    onClick={() => setViewMode('cards')} 
                    disabled={data.length === 0}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500 opacity-50'}`}
                    title="Modo Cards"
                 >
                    <List className="w-4 h-4" />
                 </button>
                 <button 
                    onClick={() => setViewMode('table')} 
                    disabled={data.length === 0}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500 opacity-50'}`}
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

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 relative custom-scrollbar">
           {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-white/50 dark:bg-slate-900/50 z-20">
                 <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                 <span className="text-sm font-medium">Consultando banco...</span>
              </div>
           ) : viewMode === 'map_column' ? (
              /* MAPEAMENTO MANUAL: Perguntar ao usuário qual coluna usar */
              <div className="p-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 mb-8 flex items-start gap-5">
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm text-amber-500 shrink-0">
                       <HelpCircle className="w-8 h-8" />
                    </div>
                    <div>
                       <h4 className="font-bold text-amber-900 dark:text-amber-100 text-xl">Onde devemos buscar este valor?</h4>
                       <p className="text-amber-700 dark:text-amber-300 text-sm mt-1 leading-relaxed">
                          Não encontramos o valor <strong>"{filterValue}"</strong> nas colunas padrão (ID, Código, Grid) da tabela <strong>{targetTable}</strong>. 
                          Por favor, selecione qual campo da tabela abaixo corresponde a este valor:
                       </p>
                    </div>
                 </div>

                 <div className="mb-4 relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input 
                       type="text"
                       placeholder="Buscar campo na tabela..."
                       value={columnFilterTerm}
                       onChange={e => setColumnFilterTerm(e.target.value)}
                       className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                    />
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredTargetColumns.map((col) => (
                       <button 
                          key={col.name}
                          onClick={() => fetchData(col.name, filterValue, true)}
                          className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all group text-left"
                       >
                          <div className="w-8 h-8 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                             {/* Fix: Added missing Key icon import */}
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
           ) : viewMode === 'select' ? (
              /* DESAMBIGUAÇÃO: Múltiplos registros */
              <div className="p-8 max-w-3xl mx-auto">
                 <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-6 mb-6 flex items-start gap-4">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-indigo-600">
                       <MousePointer2 className="w-6 h-6" />
                    </div>
                    <div>
                       <h4 className="font-bold text-indigo-900 dark:text-indigo-100 text-lg">Múltiplos registros encontrados</h4>
                       <p className="text-indigo-700 dark:text-indigo-300 text-sm mt-1">
                          A busca por <strong>"{filterValue}"</strong> retornou {ambiguousRows.length} resultados. Selecione o correto:
                       </p>
                    </div>
                 </div>

                 <div className="space-y-3">
                    {ambiguousRows.map((row, idx) => {
                       const descCol = columns.find(c => c.toLowerCase().includes('nome') || c.toLowerCase().includes('desc')) || columns[1] || columns[0];
                       return (
                          <button 
                             key={idx}
                             onClick={() => selectRow(row)}
                             className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all group text-left"
                          >
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 font-bold text-xs group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                   #{idx + 1}
                                </div>
                                <div>
                                   <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                      {String(row[descCol] || 'Registro s/ desc.')}
                                   </div>
                                   <div className="flex gap-2 mt-1">
                                      {getIdentifierColumns().filter(c => row[c] !== undefined).slice(0, 2).map(c => (
                                         <span key={c} className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                                            {c}: {row[c]}
                                         </span>
                                      ))}
                                   </div>
                                </div>
                             </div>
                             <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                          </button>
                       );
                    })}
                 </div>
              </div>
           ) : error ? (
              <div className="p-12 text-center text-red-500 flex flex-col items-center">
                 <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                 <p className="font-bold text-lg">Erro na consulta</p>
                 <p className="text-sm opacity-80 mt-2 max-w-md">{error}</p>
                 <button onClick={() => setViewMode('map_column')} className="mt-6 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200">Tentar outra coluna</button>
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
                                <tr key={i} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                                   {columns.map(col => <td key={col} className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs font-mono">{row[col] === null ? 'null' : String(row[col])}</td>)}
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
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resultado do Drilldown</span>
                                <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">{columns.length} colunas</span>
                             </div>
                             <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0.5">
                                {columns.map(col => {
                                   const val = row[col];
                                   const valStr = val === null ? 'null' : String(val);
                                   const isMatch = searchTerm && (col.toLowerCase().includes(searchTerm.toLowerCase()) || valStr.toLowerCase().includes(searchTerm.toLowerCase()));
                                   return (
                                      <div key={col} className={`group flex items-center justify-between py-1.5 px-2 rounded transition-colors border-b border-slate-50 dark:border-slate-800/40 last:border-0 ${isMatch ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}>
                                         <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate pr-4 max-w-[140px]" title={col}>{col}</span>
                                         <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                                            <div className={`text-xs font-mono truncate text-right ${val === null ? 'text-slate-300 italic' : 'text-slate-700 dark:text-slate-300'}`}>{valStr}</div>
                                            <button onClick={() => handleCopy(val, `${rowIndex}-${col}`)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-all shrink-0">
                                               {/* Fix: Added missing Key icon import usage */}
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
        
        {/* Footer */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
           <div className="flex items-center gap-2 text-xs text-slate-400">
              <Save className="w-3.5 h-3.5" />
              <span>Memória ativa para <strong>{targetTable}</strong></span>
           </div>
           <button onClick={onClose} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg transition-all">Fechar Detalhes</button>
        </div>
      </div>
    </div>
  );
};

export default DrillDownModal;
