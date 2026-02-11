
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DatabaseObject, DbCredentials } from '../types';
import { fetchDatabaseObjects } from '../services/dbService';
import { Boxes, Search, Code2, Hash, Terminal, Box, ChevronRight, Loader2, Copy, Check, Workflow, Eye, DatabaseZap, FileWarning, AlertTriangle } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { toast } from 'react-hot-toast';

interface ObjectExplorerProps {
  credentials: DbCredentials | null;
}

const LIMIT = 40;

const ObjectExplorer: React.FC<ObjectExplorerProps> = ({ credentials }) => {
  const [objects, setObjects] = useState<DatabaseObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<any>(null);

  // Carrega lote inicial ou nova página
  const loadBatch = useCallback(async (isInitial: boolean = false) => {
    if (!credentials || loading || (loadingMore && !isInitial)) return;
    
    if (isInitial) {
      setLoading(true);
      setOffset(0);
      setHasMore(true);
      setObjects([]);
    } else {
      setLoadingMore(true);
    }

    const currentOffset = isInitial ? 0 : offset;

    try {
      console.log(`[OBJECT_EXPLORER] Buscando lote: offset ${currentOffset}, search: "${searchTerm}"`);
      const data = await fetchDatabaseObjects(credentials, LIMIT, currentOffset, searchTerm, filterType);
      
      if (isInitial) {
        setObjects(data);
      } else {
        setObjects(prev => [...prev, ...data]);
      }

      setHasMore(data.length === LIMIT);
      setOffset(currentOffset + LIMIT);
    } catch (e: any) {
      toast.error(`Falha ao carregar objetos: ${e.message}`);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [credentials, searchTerm, filterType, offset, loading, loadingMore]);

  // Listener para scroll infinito
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || loading || loadingMore || !hasMore) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 300) {
      loadBatch(false);
    }
  }, [loading, loadingMore, hasMore, loadBatch]);

  // Resetar ao mudar filtros ou busca
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      loadBatch(true);
    }, 400);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchTerm, filterType, credentials]);

  const selectedObject = useMemo(() => 
    objects.find(o => o.id === selectedObjectId), 
  [objects, selectedObjectId]);

  const handleCopy = () => {
    if (selectedObject) {
      navigator.clipboard.writeText(selectedObject.definition);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Código DDL copiado!");
    }
  };

  const getObjectIcon = (type: string) => {
    switch (type) {
      case 'function': return <Code2 className="w-4 h-4 text-indigo-500" />;
      case 'procedure': return <Terminal className="w-4 h-4 text-amber-500" />;
      case 'trigger': return <Workflow className="w-4 h-4 text-emerald-500" />;
      case 'view': return <Eye className="w-4 h-4 text-blue-500" />;
      case 'mview': return <DatabaseZap className="w-4 h-4 text-rose-500" />;
      default: return <Box className="w-4 h-4 text-slate-400" />;
    }
  };

  if (credentials?.host === 'simulated') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4 opacity-50">
        <Boxes className="w-16 h-16" />
        <p className="font-bold uppercase tracking-widest text-sm">Objetos indisponíveis em modo simulação.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-6 animate-in fade-in duration-500 overflow-hidden">
      {/* Sidebar de Objetos com Scroll Infinito */}
      <div className="w-80 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm overflow-hidden shrink-0">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
             <Boxes className="w-4 h-4 text-indigo-500" /> Explorador de Objetos
           </h3>
           <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Filtrar por nome..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                 {[
                   {id: 'all', label: 'Tudo'}, 
                   {id: 'function', label: 'Fun'}, 
                   {id: 'trigger', label: 'Tri'}, 
                   {id: 'procedure', label: 'Pro'},
                   {id: 'view', label: 'Vie'},
                   {id: 'mview', label: 'MVi'}
                 ].map(t => (
                    <button 
                      key={t.id}
                      onClick={() => setFilterType(t.id)}
                      className={`flex-1 py-1 rounded-md text-[9px] font-black uppercase transition-all ${filterType === t.id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      title={t.label}
                    >
                      {t.label}
                    </button>
                 ))}
              </div>
           </div>
        </div>

        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1"
        >
           {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                 <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Indexando...</span>
              </div>
           ) : objects.length === 0 ? (
              <div className="text-center py-10 opacity-30">
                 <Search className="w-8 h-8 mx-auto mb-2" />
                 <p className="text-[10px] font-black uppercase">Nenhum objeto encontrado</p>
              </div>
           ) : (
              <>
                {objects.map(obj => (
                  <button
                    key={obj.id}
                    onClick={() => setSelectedObjectId(obj.id)}
                    className={`w-full text-left p-3 rounded-2xl transition-all border flex items-center gap-3 group
                      ${selectedObjectId === obj.id 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' 
                        : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-100 dark:hover:border-slate-700'}
                      ${obj.isSanitized ? 'border-amber-300 dark:border-amber-900/50' : ''}
                    `}
                  >
                    <div className={`p-2 rounded-xl transition-colors ${selectedObjectId === obj.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                       {obj.isSanitized ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : getObjectIcon(obj.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2">
                          <div className="font-bold text-xs truncate">{obj.name}</div>
                          {obj.isSanitized && <span className="text-[7px] bg-amber-500 text-white px-1 rounded-sm font-black">BYTE ERROR</span>}
                       </div>
                       <div className={`text-[9px] font-black uppercase tracking-tighter mt-0.5 ${selectedObjectId === obj.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {obj.schema} • {obj.type}
                       </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${selectedObjectId === obj.id ? 'translate-x-1 opacity-100' : 'opacity-0'}`} />
                  </button>
                ))}
                
                {loadingMore && (
                  <div className="py-4 flex justify-center opacity-50">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                  </div>
                )}
                
                {!hasMore && objects.length > 0 && (
                   <div className="py-4 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">
                      Fim da lista
                   </div>
                )}
              </>
           )}
        </div>
      </div>

      {/* Área de Visualização do DDL */}
      <div className="flex-1 flex flex-col bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden relative group">
         {selectedObject ? (
            <>
               <div className="px-8 py-5 border-b border-white/5 bg-white/5 backdrop-blur-md flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-indigo-500/20 rounded-2xl">
                        {selectedObject.isSanitized ? <FileWarning className="w-6 h-6 text-amber-500" /> : getObjectIcon(selectedObject.type)}
                     </div>
                     <div>
                        <div className="flex items-center gap-2">
                           <h3 className="text-lg font-black text-white tracking-tight leading-none">{selectedObject.name}</h3>
                           <span className="px-2 py-0.5 bg-indigo-500 text-white text-[9px] font-black rounded-full uppercase tracking-widest">{selectedObject.type}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">
                           Definição SQL DDL • Localizado em {selectedObject.schema}
                           {selectedObject.tableName && ` • Referencia tabela ${selectedObject.tableName}`}
                        </p>
                     </div>
                  </div>
                  <div className="flex gap-2">
                     <button 
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/10"
                     >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copiado!' : 'Copiar DDL'}
                     </button>
                  </div>
               </div>

               {selectedObject.isSanitized && (
                  <div className="px-8 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-3">
                     <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                     <p className="text-[11px] text-amber-200 font-medium">
                        <strong>Aviso de Codificação:</strong> Este objeto contém sequências de bytes incompatíveis com UTF-8 (ex: 0xea). 
                        As partes corrompidas foram substituídas pelo símbolo <span className="bg-amber-500/20 px-1 rounded"></span> para permitir a visualização.
                     </p>
                  </div>
               )}

               <div className="flex-1 relative">
                  <Editor 
                    theme="vs-dark"
                    defaultLanguage="sql"
                    value={selectedObject.definition}
                    options={{
                       readOnly: true,
                       fontSize: 14,
                       fontFamily: "'Fira Code', monospace",
                       minimap: { enabled: false },
                       scrollBeyondLastLine: false,
                       automaticLayout: true,
                       padding: { top: 20, bottom: 20 },
                       lineNumbers: 'on',
                       renderLineHighlight: 'all',
                       scrollbar: { verticalScrollbarSize: 10 }
                    }}
                  />
               </div>

               {selectedObject.args && (
                  <div className="px-8 py-4 bg-black/40 border-t border-white/5 shrink-0">
                     <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                        <Hash className="w-3 h-3" /> Assinatura de Argumentos
                     </div>
                     <code className="text-xs font-mono text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 block">
                        ({selectedObject.args})
                        {selectedObject.returnType && <span className="text-white ml-2">RETURNS {selectedObject.returnType}</span>}
                     </code>
                  </div>
               )}
            </>
         ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-6 opacity-30">
               <div className="p-10 bg-white/5 rounded-full border border-white/5">
                  <Boxes className="w-24 h-24" />
               </div>
               <div className="text-center max-w-sm">
                  <h4 className="text-xl font-black uppercase tracking-tight mb-2 text-white">Nenhum objeto selecionado</h4>
                  <p className="text-sm font-bold leading-relaxed">Selecione uma função, trigger ou view na lista lateral para visualizar sua definição SQL completa e metadados de execução.</p>
               </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default ObjectExplorer;
