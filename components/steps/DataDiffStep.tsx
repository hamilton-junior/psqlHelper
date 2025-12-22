
import React, { useState, useMemo } from 'react';
import { DatabaseSchema, DbCredentials, DiffRow, BuilderState } from '../../types';
import { executeQueryReal } from '../../services/dbService';
import { executeOfflineQuery } from '../../services/simulationService';
import { GitCompare, ArrowRightLeft, AlertCircle, Loader2, Play, Table2, Key, Info, ChevronRight, CheckCircle2, XCircle, AlertTriangle, HelpCircle, Filter, Eye } from 'lucide-react';

interface DataDiffStepProps {
  schema: DatabaseSchema;
  credentials: DbCredentials | null;
  simulationData: any;
}

type FilterStatus = 'all' | 'added' | 'removed' | 'modified';

const DataDiffStep: React.FC<DataDiffStepProps> = ({ schema, credentials, simulationData }) => {
  // Configuration State
  const [tableA, setTableA] = useState<string>('');
  const [tableB, setTableB] = useState<string>('');
  const [primaryKey, setPrimaryKey] = useState<string>('id');
  const [limit, setLimit] = useState(500);
  const [showHelp, setShowHelp] = useState(true);
  
  // Execution State
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffResults, setDiffResults] = useState<DiffRow[] | null>(null);
  const [commonColumns, setCommonColumns] = useState<string[]>([]);
  
  // View State
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Helpers to get full table name
  const getTableOptions = () => {
     return schema.tables.map(t => ({
        label: `${t.schema}.${t.name}`,
        value: `${t.schema}.${t.name}`
     }));
  };

  const getCommonColumns = (tA: string, tB: string) => {
     if (!tA || !tB) return [];
     const tableObjA = schema.tables.find(t => `${t.schema}.${t.name}` === tA);
     const tableObjB = schema.tables.find(t => `${t.schema}.${t.name}` === tB);
     if (!tableObjA || !tableObjB) return [];
     
     const colsA = tableObjA.columns.map(c => c.name);
     const colsB = tableObjB.columns.map(c => c.name);
     
     return colsA.filter(c => colsB.includes(c));
  };

  // Auto-detect PK when tables change
  useMemo(() => {
     const common = getCommonColumns(tableA, tableB);
     setCommonColumns(common);
     
     if (common.includes('id')) setPrimaryKey('id');
     else if (common.includes('grid')) setPrimaryKey('grid');
     else if (common.length > 0) setPrimaryKey(common[0]);
  }, [tableA, tableB]);

  const fetchData = async (tableName: string): Promise<any[]> => {
     const sql = `SELECT * FROM ${tableName} LIMIT ${limit}`;
     if (credentials?.host === 'simulated') {
        const fakeState: BuilderState = {
           selectedTables: [tableName],
           selectedColumns: [],
           aggregations: {},
           joins: [],
           filters: [],
           groupBy: [],
           orderBy: [],
           limit: limit
        };
        return executeOfflineQuery(schema, simulationData, fakeState);
     } else if (credentials) {
        return await executeQueryReal(credentials, sql);
     }
     return [];
  };

  const handleCompare = async () => {
     if (!tableA || !tableB || !primaryKey) return;
     setIsRunning(true);
     setError(null);
     setDiffResults(null);
     setFilterStatus('all'); // Reset filter on new run

     try {
        const [dataA, dataB] = await Promise.all([
           fetchData(tableA),
           fetchData(tableB)
        ]);

        // Diff Logic
        const mapA = new Map();
        const mapB = new Map();

        dataA.forEach(row => mapA.set(String(row[primaryKey]), row));
        dataB.forEach(row => mapB.set(String(row[primaryKey]), row));

        const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
        const results: DiffRow[] = [];

        allKeys.forEach(key => {
           const rowA = mapA.get(key);
           const rowB = mapB.get(key);

           if (rowA && !rowB) {
              results.push({ key, status: 'removed', dataA: rowA, diffColumns: [] });
           } else if (!rowA && rowB) {
              results.push({ key, status: 'added', dataB: rowB, diffColumns: [] });
           } else {
              // Compare fields
              const diffs: string[] = [];
              commonColumns.forEach(col => {
                 if (String(rowA[col]) !== String(rowB[col])) {
                    diffs.push(col);
                 }
              });

              if (diffs.length > 0) {
                 results.push({ key, status: 'modified', dataA: rowA, dataB: rowB, diffColumns: diffs });
              }
           }
        });

        setDiffResults(results);
        setShowHelp(false); // Auto hide help on success

     } catch (e: any) {
        console.error(e);
        setError(e.message || "Erro ao comparar dados.");
     } finally {
        setIsRunning(false);
     }
  };

  const summary = useMemo(() => {
     if (!diffResults) return null;
     return {
        added: diffResults.filter(r => r.status === 'added').length,
        removed: diffResults.filter(r => r.status === 'removed').length,
        modified: diffResults.filter(r => r.status === 'modified').length,
     };
  }, [diffResults]);

  const filteredResults = useMemo(() => {
     if (!diffResults) return [];
     if (filterStatus === 'all') return diffResults;
     return diffResults.filter(r => r.status === filterStatus);
  }, [diffResults, filterStatus]);

  return (
    <div className="flex flex-col h-full space-y-4">
       <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <GitCompare className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Comparador de Dados</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Encontre diferenças entre tabelas.</p>
             </div>
          </div>
          <button 
             onClick={() => setShowHelp(!showHelp)}
             className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${showHelp ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
             <HelpCircle className="w-4 h-4" /> {showHelp ? 'Ocultar Ajuda' : 'Como funciona?'}
          </button>
       </div>

       {showHelp && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
             <h4 className="font-bold text-blue-800 dark:text-blue-200 text-sm mb-2 flex items-center gap-2"><Info className="w-4 h-4" /> Guia Rápido</h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-blue-700 dark:text-blue-300">
                <div className="bg-white/50 dark:bg-slate-800/50 p-3 rounded-lg">
                   <strong>1. Selecione as Tabelas:</strong> Escolha a tabela de origem ("Tabela A") e a tabela que deseja comparar ("Tabela B"). Elas devem ter colunas parecidas.
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 p-3 rounded-lg">
                   <strong>2. Chave de Ligação (ID):</strong> O sistema precisa saber como identificar a mesma linha nas duas tabelas (geralmente a coluna 'id').
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 p-3 rounded-lg">
                   <strong>3. Resultado:</strong> Veremos o que foi adicionado (novo em B), removido (sumiu de A) ou modificado (valores diferentes).
                </div>
             </div>
          </div>
       )}

       {/* Configuration Panel */}
       <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
             
             <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-2">
                   <Table2 className="w-3.5 h-3.5" /> Tabela A (Base/Antiga)
                </label>
                <select 
                   value={tableA} 
                   onChange={(e) => setTableA(e.target.value)}
                   className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                >
                   <option value="">Selecione...</option>
                   {getTableOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
             </div>

             <div className="md:col-span-1 flex justify-center pb-2 text-slate-300 dark:text-slate-600">
                <ArrowRightLeft className="w-6 h-6" />
             </div>

             <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-2">
                   <Table2 className="w-3.5 h-3.5" /> Tabela B (Nova/Comparar)
                </label>
                <select 
                   value={tableB} 
                   onChange={(e) => setTableB(e.target.value)}
                   className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                >
                   <option value="">Selecione...</option>
                   {getTableOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
             </div>

             <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-2" title="A coluna usada para casar as linhas">
                   <Key className="w-3.5 h-3.5" /> Chave (ID)
                </label>
                <select 
                   value={primaryKey} 
                   onChange={(e) => setPrimaryKey(e.target.value)}
                   className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                >
                   {commonColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
             </div>

             <div className="md:col-span-1">
                <button 
                   onClick={handleCompare}
                   disabled={isRunning || !tableA || !tableB}
                   className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                   {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                   Comparar
                </button>
             </div>
          </div>
       </div>

       {/* Results Area */}
       <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden relative">
          
          {error && (
             <div className="absolute inset-0 z-10 bg-white/90 dark:bg-slate-900/90 flex flex-col items-center justify-center text-red-500">
                <AlertCircle className="w-12 h-12 mb-2 opacity-50" />
                <p className="font-bold">{error}</p>
             </div>
          )}

          {!diffResults && !isRunning && !error && (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                   <GitCompare className="w-10 h-10 opacity-30" />
                </div>
                <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-2">Aguardando Comparação</h3>
                <p className="text-sm max-w-sm text-center">Selecione as tabelas acima e clique em comparar para ver as diferenças linha a linha.</p>
             </div>
          )}

          {diffResults && (
             <>
                {/* Summary Header with Filters */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                   
                   <div className="flex gap-2">
                      <button onClick={() => setFilterStatus('all')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${filterStatus === 'all' ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 shadow-sm' : 'border-transparent text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}>
                         <Eye className="w-3.5 h-3.5" /> Tudo ({diffResults.length})
                      </button>
                      
                      <button onClick={() => setFilterStatus('added')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${filterStatus === 'added' ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 text-emerald-800 dark:text-emerald-200' : 'border-transparent text-slate-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10'}`}>
                         <CheckCircle2 className="w-3.5 h-3.5" /> Novos ({summary?.added})
                      </button>

                      <button onClick={() => setFilterStatus('removed')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${filterStatus === 'removed' ? 'bg-red-100 dark:bg-red-900/30 border-red-200 text-red-800 dark:text-red-200' : 'border-transparent text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/10'}`}>
                         <XCircle className="w-3.5 h-3.5" /> Removidos ({summary?.removed})
                      </button>

                      <button onClick={() => setFilterStatus('modified')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${filterStatus === 'modified' ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 text-amber-800 dark:text-amber-200' : 'border-transparent text-slate-500 hover:bg-amber-50 dark:hover:bg-amber-900/10'}`}>
                         <AlertTriangle className="w-3.5 h-3.5" /> Diferenças ({summary?.modified})
                      </button>
                   </div>
                </div>

                {/* Diff Table */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                   {filteredResults.length === 0 ? (
                      <div className="p-10 text-center text-slate-400 font-medium flex flex-col items-center justify-center h-full">
                         <Filter className="w-10 h-10 mb-3 opacity-20" />
                         Nenhum registro encontrado para este filtro.
                      </div>
                   ) : (
                      <table className="w-full text-left border-collapse relative">
                         <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 shadow-sm text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <tr>
                               <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 w-24">Status</th>
                               <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 w-32 border-r border-slate-100 dark:border-slate-800">Chave ({primaryKey})</th>
                               {commonColumns.filter(c => c !== primaryKey).map(col => (
                                  <th key={col} className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 min-w-[150px]">{col}</th>
                               ))}
                            </tr>
                         </thead>
                         <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredResults.map((row) => (
                               <tr key={row.key} className={`
                                  ${row.status === 'added' ? 'bg-emerald-50/30 dark:bg-emerald-900/10 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 
                                    row.status === 'removed' ? 'bg-red-50/30 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20' : 
                                    'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50'}
                               `}>
                                  <td className="px-4 py-3 align-top">
                                     {row.status === 'added' && <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-1 rounded shadow-sm border border-emerald-200 dark:border-emerald-800">NOVO</span>}
                                     {row.status === 'removed' && <span className="text-[10px] font-extrabold text-red-600 bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded shadow-sm border border-red-200 dark:border-red-800">REMOVIDO</span>}
                                     {row.status === 'modified' && <span className="text-[10px] font-extrabold text-amber-600 bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded shadow-sm border border-amber-200 dark:border-amber-800">ALTERADO</span>}
                                  </td>
                                  <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800 align-top bg-slate-50/50 dark:bg-slate-900/20">{row.key}</td>
                                  {commonColumns.filter(c => c !== primaryKey).map(col => {
                                     const valA = row.dataA?.[col];
                                     const valB = row.dataB?.[col];
                                     const isDiff = row.diffColumns.includes(col);
                                     
                                     return (
                                        <td key={col} className={`px-4 py-3 border-l border-slate-100 dark:border-slate-800 align-top ${isDiff ? 'bg-amber-50/50 dark:bg-amber-900/20' : ''}`}>
                                           {row.status === 'modified' && isDiff ? (
                                              <div className="flex flex-col gap-1.5 text-xs">
                                                 <div className="text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-900/50 w-fit" title="Valor Anterior (A)">
                                                    <span className="opacity-50 text-[9px] uppercase font-bold mr-1">Antigo:</span>
                                                    <span className="line-through opacity-70">{String(valA)}</span>
                                                 </div>
                                                 <div className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/50 w-fit font-bold" title="Valor Novo (B)">
                                                    <span className="opacity-50 text-[9px] uppercase font-bold mr-1">Novo:</span>
                                                    {String(valB)}
                                                 </div>
                                              </div>
                                           ) : (
                                              <span className="text-slate-600 dark:text-slate-400">{String(row.status === 'removed' ? valA : valB)}</span>
                                           )}
                                        </td>
                                     );
                                  })}
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   )}
                </div>
             </>
          )}
       </div>
    </div>
  );
};

export default DataDiffStep;
