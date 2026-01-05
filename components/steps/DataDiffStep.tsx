
import React, { useState, useMemo, useEffect } from 'react';
import { DatabaseSchema, DbCredentials, DiffRow, BuilderState, AppSettings } from '../../types';
import { executeQueryReal } from '../../services/dbService';
import { executeOfflineQuery } from '../../services/simulationService';
import { GitCompare, ArrowRightLeft, AlertCircle, Loader2, Play, Table2, Key, Info, ChevronRight, CheckCircle2, XCircle, AlertTriangle, HelpCircle, Filter, Eye, UserPlus, UserMinus, UserCheck, Search, Database, Copy, Check, DatabaseZap, Tag, Settings2 } from 'lucide-react';

interface DataDiffStepProps {
  schema: DatabaseSchema;
  credentials: DbCredentials | null;
  simulationData: any;
  settings: AppSettings;
}

type ComparisonMode = 'tables' | 'records';
type FilterStatus = 'all' | 'added' | 'removed' | 'modified';

interface RecordDiffItem {
  column: string;
  valA: any;
  valB: any;
}

const DataDiffStep: React.FC<DataDiffStepProps> = ({ schema, credentials, simulationData, settings }) => {
  const [mode, setMode] = useState<ComparisonMode>('tables');
  
  // Table Mode Params
  const [tableA, setTableA] = useState<string>('');
  const [tableB, setTableB] = useState<string>('');
  const [primaryKey, setPrimaryKey] = useState<string>('id');
  const [limit, setLimit] = useState(settings.defaultDiffLimit || 500);
  
  // Table Data Cache (Para evitar re-fetch ao mudar a PK)
  const [rawA, setRawA] = useState<any[] | null>(null);
  const [rawB, setRawB] = useState<any[] | null>(null);

  // Record Mode State
  const [singleTable, setSingleTable] = useState<string>('');
  const [recordPkCol, setRecordPkCol] = useState<string>('');
  const [idA, setIdA] = useState<string>('');
  const [idB, setIdB] = useState<string>('');
  const [recordDiffs, setRecordDiffs] = useState<RecordDiffItem[] | null>(null);

  const [showHelp, setShowHelp] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commonColumns, setCommonColumns] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const tableOptions = useMemo(() => schema.tables.map(t => ({
    label: `${t.schema}.${t.name}`,
    value: `${t.schema}.${t.name}`
  })), [schema.tables]);

  // Sync with settings limit when they change
  useEffect(() => {
    setLimit(settings.defaultDiffLimit);
  }, [settings.defaultDiffLimit]);

  // Sync columns & Clear cache when tables change
  useEffect(() => {
    if (mode === 'tables') {
      // Limpar resultados antigos ao mudar as tabelas selecionadas
      setRawA(null);
      setRawB(null);
      setError(null);

      const tableObjA = schema.tables.find(t => `${t.schema}.${t.name}` === tableA);
      const tableObjB = schema.tables.find(t => `${t.schema}.${t.name}` === tableB);
      
      if (tableObjA && tableObjB) {
        const colsA = tableObjA.columns.map(c => c.name);
        const colsB = tableObjB.columns.map(c => c.name);
        const common = colsA.filter(c => colsB.includes(c));
        setCommonColumns(common);
        
        // Auto-select PK prioritizando nomes comuns
        if (common.includes('grid')) setPrimaryKey('grid');
        else if (common.includes('id')) setPrimaryKey('id');
        else if (common.length > 0) setPrimaryKey(common[0]);
      }
    }
  }, [tableA, tableB, mode, schema.tables]);

  // Record Mode Auto-PK
  useEffect(() => {
    if (mode === 'records') {
      const tableObj = schema.tables.find(t => `${t.schema}.${t.name}` === singleTable);
      if (tableObj) {
        const pk = tableObj.columns.find(c => c.isPrimaryKey)?.name || 
                   tableObj.columns.find(c => c.name === 'grid')?.name || 
                   tableObj.columns.find(c => c.name === 'id')?.name || 
                   tableObj.columns[0]?.name || '';
        setRecordPkCol(pk);
      }
    }
  }, [singleTable, mode, schema.tables]);

  // Busca de dados (Apenas fetch)
  const handleTableFetch = async () => {
    if (!tableA || !tableB || !primaryKey) return;
    setIsRunning(true);
    setError(null);
    setRawA(null);
    setRawB(null);

    try {
      const fetchData = async (tableName: string) => {
        const sql = `SELECT * FROM ${tableName} LIMIT ${limit}`;
        if (credentials?.host === 'simulated') {
          const fakeState: BuilderState = { selectedTables: [tableName], selectedColumns: [], aggregations: {}, joins: [], filters: [], groupBy: [], orderBy: [], limit };
          return executeOfflineQuery(schema, simulationData, fakeState);
        }
        return await executeQueryReal(credentials!, sql);
      };

      const [dataA, dataB] = await Promise.all([fetchData(tableA), fetchData(tableB)]);
      setRawA(dataA);
      setRawB(dataB);
      setShowHelp(false);
    } catch (e: any) {
      setError(e.message || "Erro ao buscar dados das tabelas.");
    } finally {
      setIsRunning(false);
    }
  };

  // CÁLCULO DE DIFERENÇAS (MEMOIZADO)
  // Reage instantaneamente a mudanças na PK ou nos dados carregados
  const diffResults = useMemo(() => {
    if (!rawA || !rawB || !primaryKey) return null;

    const mapA = new Map();
    const mapB = new Map();
    
    rawA.forEach(row => mapA.set(String(row[primaryKey] ?? ''), row));
    rawB.forEach(row => mapB.set(String(row[primaryKey] ?? ''), row));

    const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
    const results: DiffRow[] = [];

    allKeys.forEach(key => {
      if (key === 'undefined' || key === 'null') return;
      
      const rowA = mapA.get(key);
      const rowB = mapB.get(key);

      if (rowA && !rowB) {
        results.push({ key, status: 'removed', dataA: rowA, diffColumns: [] });
      } else if (!rowA && rowB) {
        results.push({ key, status: 'added', dataB: rowB, diffColumns: [] });
      } else {
        // Registro existe em ambos, comparar colunas comuns
        const diffs: string[] = commonColumns.filter(col => {
          const valA = rowA[col];
          const valB = rowB[col];
          return String(valA ?? '') !== String(valB ?? '');
        });

        if (diffs.length > 0) {
          results.push({ key, status: 'modified', dataA: rowA, dataB: rowB, diffColumns: diffs });
        } else {
          results.push({ key, status: 'unchanged', dataA: rowA, dataB: rowB, diffColumns: [] });
        }
      }
    });

    return results;
  }, [rawA, rawB, primaryKey, commonColumns]);

  const handleRecordCompare = async () => {
    if (!singleTable || !recordPkCol || !idA || !idB) return;
    setIsRunning(true);
    setError(null);
    setRecordDiffs(null);

    try {
      if (credentials?.host === 'simulated') {
        const fetchRow = async (id: string) => {
          const fakeState: BuilderState = { 
            selectedTables: [singleTable], selectedColumns: [], aggregations: {}, joins: [], 
            filters: [{ id: 'f', column: `${singleTable}.${recordPkCol}`, operator: '=', value: id }], 
            groupBy: [], orderBy: [], limit: 1 
          };
          const res = executeOfflineQuery(schema, simulationData, fakeState);
          return res[0] || null;
        };
        const [rowA, rowB] = await Promise.all([fetchRow(idA), fetchRow(idB)]);
        if (!rowA || !rowB) throw new Error("Um ou ambos os registros não foram encontrados.");
        
        const diffs: RecordDiffItem[] = [];
        Object.keys(rowA).forEach(col => {
          if (String(rowA[col]) !== String(rowB[col])) {
             diffs.push({ column: col, valA: rowA[col], valB: rowB[col] });
          }
        });
        setRecordDiffs(diffs);
      } else if (credentials) {
        const sql = `
          SELECT
            a.key AS column_name,
            a.val AS val_a,
            b.val AS val_b
          FROM (
            SELECT (jsonb_each_text(to_jsonb(t))).* FROM ${singleTable} t WHERE "${recordPkCol}"::text = '${idA.replace(/'/g, "''")}'
          ) a
          FULL OUTER JOIN (
            SELECT (jsonb_each_text(to_jsonb(t))).* FROM ${singleTable} t WHERE "${recordPkCol}"::text = '${idB.replace(/'/g, "''")}'
          ) b ON a.key = b.key
          WHERE a.val IS DISTINCT FROM b.val;
        `;
        const res = await executeQueryReal(credentials, sql);
        setRecordDiffs(res.map(r => ({ column: r.column_name, valA: r.val_a, valB: r.val_b })));
      }
      setShowHelp(false);
    } catch (e: any) {
      setError(e.message || "Erro ao comparar registros.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = (val: any, fieldKey: string) => {
    navigator.clipboard.writeText(String(val));
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <GitCompare className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Comparador de Dados</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Auditoria e conferência de registros.</p>
          </div>
        </div>

        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
           <button 
              onClick={() => { setMode('tables'); setError(null); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${mode === 'tables' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
           >
              <Table2 className="w-4 h-4" /> Comparar Tabelas
           </button>
           <button 
              onClick={() => { setMode('records'); setError(null); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${mode === 'records' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
           >
              <DatabaseZap className="w-4 h-4" /> Comparar Registros
           </button>
        </div>
      </div>

      {showHelp && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
          <h4 className="font-bold text-blue-800 dark:text-blue-200 text-sm mb-2 flex items-center gap-2"><Info className="w-4 h-4" /> Auditoria Reativa</h4>
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            {mode === 'tables' 
              ? 'Dica: Ao alterar a PK após o carregamento, o sistema recalculará as diferenças localmente de forma instantânea, sem nova consulta ao banco.' 
              : 'Selecione dois IDs de uma mesma tabela para ver exatamente quais campos foram alterados entre eles.'}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        {mode === 'tables' ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end animate-in fade-in duration-300">
            <div className="md:col-span-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Tabela A (Base)</label>
              <select value={tableA} onChange={e => setTableA(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Selecione...</option>
                {tableOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Tabela B (Alvo)</label>
              <select value={tableB} onChange={e => setTableB(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Selecione...</option>
                {tableOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Coluna PK</label>
              <select value={primaryKey} onChange={e => setPrimaryKey(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-600">
                {commonColumns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
               <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1 flex items-center gap-1.5">
                  <Settings2 className="w-3 h-3" /> Amostragem
               </label>
               <div className="relative group">
                  <input 
                    type="number" 
                    value={limit} 
                    onChange={e => setLimit(parseInt(e.target.value) || 1)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-right pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400 pointer-events-none">REG</span>
               </div>
            </div>
            <div className="md:col-span-2">
              <button onClick={handleTableFetch} disabled={isRunning || !tableA || !tableB} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Carregar
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-10 gap-4 items-end animate-in fade-in duration-300">
            <div className="md:col-span-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Selecione a Tabela</label>
              <select value={singleTable} onChange={e => setSingleTable(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold">
                <option value="">Selecione Tabela...</option>
                {tableOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Campo Chave (PK)</label>
              <select value={recordPkCol} onChange={e => setRecordPkCol(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                {(schema.tables.find(t => `${t.schema}.${t.name}` === singleTable)?.columns || []).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Valor A</label>
              <input type="text" value={idA} onChange={e => setIdA(e.target.value)} placeholder="Ex: 732" className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Valor B</label>
              <input type="text" value={idB} onChange={e => setIdB(e.target.value)} placeholder="Ex: 1102" className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
            </div>
            <div className="md:col-span-1">
              <button onClick={handleRecordCompare} disabled={isRunning || !singleTable || !idA || !idB} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Comparar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col relative">
        {error && (
          <div className="absolute inset-0 z-10 bg-white/90 dark:bg-slate-900/90 flex flex-col items-center justify-center text-red-500 p-6 text-center">
            <AlertCircle className="w-12 h-12 mb-2 opacity-50" />
            <p className="font-bold text-lg">Erro na Auditoria</p>
            <p className="text-sm opacity-80 mt-1 max-w-md">{error}</p>
          </div>
        )}

        {mode === 'tables' && diffResults && (
           <>
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                 <div className="flex gap-2">
                    <button onClick={() => setFilterStatus('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filterStatus === 'all' ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 shadow-sm' : 'border-transparent text-slate-500 hover:bg-slate-200/50'}`}>Tudo ({diffResults.length})</button>
                    <button onClick={() => setFilterStatus('added')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filterStatus === 'added' ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 text-emerald-800 dark:text-emerald-200 shadow-sm' : 'border-transparent text-slate-500 hover:bg-emerald-50'}`}>Novos</button>
                    <button onClick={() => setFilterStatus('removed')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filterStatus === 'removed' ? 'bg-red-100 dark:bg-red-900/30 border-red-200 text-red-800 dark:text-red-200 shadow-sm' : 'border-transparent text-slate-500 hover:bg-red-50'}`}>Removidos</button>
                    <button onClick={() => setFilterStatus('modified')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filterStatus === 'modified' ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 text-amber-800 dark:text-amber-200 shadow-sm' : 'border-transparent text-slate-500 hover:bg-amber-50'}`}>Divergências</button>
                 </div>
                 <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                    <Settings2 className="w-3 h-3" /> Mostrando até {limit} registros carregados.
                 </div>
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar">
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 shadow-sm text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       <tr>
                          <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 w-24">Status</th>
                          <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 w-32 border-r border-slate-100 dark:border-slate-800 text-indigo-500 bg-indigo-50/20">Chave ({primaryKey})</th>
                          {commonColumns.filter(c => c !== primaryKey).map(col => <th key={col} className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 min-w-[150px]">{col}</th>)}
                       </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                       {diffResults.filter(r => filterStatus === 'all' || r.status === filterStatus).map((row) => (
                          <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                             <td className="px-4 py-3 align-top">
                                {row.status === 'added' && <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200">NOVO</span>}
                                {row.status === 'removed' && <span className="text-[9px] font-black text-red-600 bg-red-100 dark:bg-red-950 px-2 py-0.5 rounded border border-red-200">REMOVIDO</span>}
                                {row.status === 'modified' && <span className="text-[9px] font-black text-amber-600 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded border border-amber-200">DIFERENTE</span>}
                                {row.status === 'unchanged' && <span className="text-[9px] font-black text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200">IGUAL</span>}
                             </td>
                             <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800 align-top bg-indigo-50/5 dark:bg-indigo-900/5">{row.key}</td>
                             {commonColumns.filter(c => c !== primaryKey).map(col => {
                                const valA = row.dataA?.[col];
                                const valB = row.dataB?.[col];
                                const isDiff = row.diffColumns.includes(col);
                                return (
                                   <td key={col} className={`px-4 py-3 align-top ${isDiff ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                                      {row.status === 'modified' && isDiff ? (
                                         <div className="flex flex-col gap-1 text-[11px]">
                                            <div className="text-rose-500 opacity-60">A: <span className="line-through">{String(valA ?? 'null')}</span></div>
                                            <div className="text-emerald-600 dark:text-emerald-400 font-bold">B: {String(valB ?? 'null')}</div>
                                         </div>
                                      ) : <span className="text-slate-500 text-[11px]">{String((row.status === 'removed' ? valA : valB) ?? 'null')}</span>}
                                   </td>
                                );
                             })}
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </>
        )}

        {mode === 'records' && recordDiffs && (
           <div className="flex-1 flex flex-col animate-in slide-in-from-bottom-2">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                 <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <DatabaseZap className="w-4 h-4 text-indigo-500" /> 
                    Diferenças entre {idA} e {idB} 
                    <span className="text-xs font-normal text-slate-400 ml-2">({recordDiffs.length} campos distintos)</span>
                 </h3>
              </div>
              {recordDiffs.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12">
                    <CheckCircle2 className="w-16 h-16 mb-4 text-emerald-500/50" />
                    <p className="font-bold text-slate-600 dark:text-slate-300">Nenhuma diferença encontrada</p>
                    <p className="text-sm">Os registros são idênticos em todos os campos.</p>
                 </div>
              ) : (
                 <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                       <thead className="bg-white dark:bg-slate-800 sticky top-0 z-10 shadow-sm">
                          <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                             <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 w-1/4">Coluna</th>
                             <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 w-3/8 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-900/10">Registro A ({idA})</th>
                             <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 w-3/8 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10">Registro B ({idB})</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {recordDiffs.map((diff, i) => (
                             <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 group transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-900/10 align-top">
                                   <div className="flex items-center gap-2">
                                      <Tag className="w-3.5 h-3.5 text-indigo-400" />
                                      {diff.column}
                                   </div>
                                </td>
                                <td className="px-6 py-4 align-top group">
                                   <div className="flex flex-col gap-1">
                                      <div className="text-sm font-mono text-slate-600 dark:text-slate-400 break-all">{String(diff.valA ?? 'null')}</div>
                                      <button onClick={() => handleCopy(diff.valA, `a-${i}`)} className="opacity-0 group-hover:opacity-100 self-start text-[10px] text-indigo-500 hover:underline transition-all">{copiedField === `a-${i}` ? 'Copiado!' : 'Copiar A'}</button>
                                   </div>
                                </td>
                                <td className="px-6 py-4 align-top group">
                                   <div className="flex flex-col gap-1">
                                      <div className="text-sm font-mono text-slate-800 dark:text-slate-200 font-bold break-all">{String(diff.valB ?? 'null')}</div>
                                      <button onClick={() => handleCopy(diff.valB, `b-${i}`)} className="opacity-0 group-hover:opacity-100 self-start text-[10px] text-emerald-500 hover:underline transition-all">{copiedField === `b-${i}` ? 'Copiado!' : 'Copiar B'}</button>
                                   </div>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              )}
           </div>
        )}

        {!isRunning && !rawA && !recordDiffs && !error && (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12">
              <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-200 dark:border-slate-700">
                 <GitCompare className="w-12 h-12 opacity-20" />
              </div>
              <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300 mb-2">Pronto para Auditar</h3>
              <p className="text-sm max-w-sm text-center">Selecione as tabelas acima e clique em "Carregar" para buscar os dados e processar a comparação.</p>
           </div>
        )}

        {isRunning && (
           <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
              <p className="font-bold text-indigo-900 dark:text-indigo-200">Buscando dados no servidor...</p>
              <p className="text-xs text-slate-500 mt-1">Isso pode levar alguns segundos dependendo do volume.</p>
           </div>
        )}
      </div>
    </div>
  );
};

export default DataDiffStep;
