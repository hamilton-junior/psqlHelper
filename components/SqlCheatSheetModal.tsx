
import React from 'react';
import { X, Search, Database, Filter, ArrowDownAZ, Combine, ArrowRight, ArrowLeft, ArrowRightLeft } from 'lucide-react';

interface SqlCheatSheetModalProps {
  onClose: () => void;
}

const SqlCheatSheetModal: React.FC<SqlCheatSheetModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Database className="w-6 h-6" />
             </div>
             <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Guia de Referência SQL</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Entenda os conceitos fundamentais para construir suas queries.</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/50">
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* SELECT & FROM */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                 <div className="flex items-center gap-2 mb-3 text-indigo-600 dark:text-indigo-400">
                    <Search className="w-5 h-5" />
                    <h4 className="font-bold uppercase tracking-wider text-sm">O Básico</h4>
                 </div>
                 <div className="space-y-4">
                    <div>
                       <code className="text-sm font-bold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded text-indigo-700 dark:text-indigo-300">SELECT</code>
                       <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Define <strong>quais colunas</strong> você quer ver. É como escolher quais colunas de uma planilha do Excel você quer exibir.</p>
                    </div>
                    <div>
                       <code className="text-sm font-bold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded text-indigo-700 dark:text-indigo-300">FROM</code>
                       <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Define <strong>de qual tabela</strong> os dados virão.</p>
                    </div>
                 </div>
              </div>

              {/* WHERE */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                 <div className="flex items-center gap-2 mb-3 text-emerald-600 dark:text-emerald-400">
                    <Filter className="w-5 h-5" />
                    <h4 className="font-bold uppercase tracking-wider text-sm">Filtros (Where)</h4>
                 </div>
                 <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Funciona como um filtro de funil. Apenas as linhas que atendem à condição passam.</p>
                 <ul className="text-xs space-y-2 text-slate-500 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                    <li><span className="text-emerald-600 font-bold">=</span> Igual a (ex: id = 5)</li>
                    <li><span className="text-emerald-600 font-bold">&gt;</span> Maior que (ex: preço &gt; 100)</li>
                    <li><span className="text-emerald-600 font-bold">LIKE</span> Texto contém (ex: nome LIKE '%Maria%')</li>
                    <li><span className="text-emerald-600 font-bold">IN</span> Lista de valores (ex: status IN ('Ativo', 'Novo'))</li>
                 </ul>
              </div>

              {/* JOINS */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm md:col-span-2">
                 <div className="flex items-center gap-2 mb-4 text-amber-600 dark:text-amber-400">
                    <Combine className="w-5 h-5" />
                    <h4 className="font-bold uppercase tracking-wider text-sm">Joins (Relacionamentos)</h4>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* INNER JOIN */}
                    <div className="flex flex-col items-center text-center">
                       <div className="relative w-20 h-14 mb-2">
                          <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-amber-200/50 border-2 border-amber-400 mix-blend-multiply dark:mix-blend-normal"></div>
                          <div className="absolute right-0 top-0 w-10 h-10 rounded-full bg-amber-200/50 border-2 border-amber-400 mix-blend-multiply dark:mix-blend-normal"></div>
                          <div className="absolute left-5 top-0 w-5 h-10 overflow-hidden">
                             <div className="w-10 h-10 -ml-5 rounded-full bg-amber-500"></div>
                          </div>
                       </div>
                       <span className="font-bold text-xs text-slate-700 dark:text-slate-200">INNER JOIN</span>
                       <p className="text-[10px] text-slate-500 mt-1">Apenas registros que existem nas <strong>duas</strong> tabelas.</p>
                    </div>

                    {/* LEFT JOIN */}
                    <div className="flex flex-col items-center text-center">
                       <div className="relative w-20 h-14 mb-2">
                          <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-amber-500 border-2 border-amber-400 z-10"></div>
                          <div className="absolute right-0 top-0 w-10 h-10 rounded-full bg-amber-200/50 border-2 border-amber-400 mix-blend-multiply dark:mix-blend-normal"></div>
                       </div>
                       <span className="font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> LEFT JOIN</span>
                       <p className="text-[10px] text-slate-500 mt-1">Tudo da tabela da <strong>Esquerda</strong>, e o que combinar da Direita (se houver).</p>
                    </div>

                    {/* RIGHT JOIN */}
                    <div className="flex flex-col items-center text-center">
                       <div className="relative w-20 h-14 mb-2">
                          <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-amber-200/50 border-2 border-amber-400 mix-blend-multiply dark:mix-blend-normal"></div>
                          <div className="absolute right-0 top-0 w-10 h-10 rounded-full bg-amber-500 border-2 border-amber-400 z-10"></div>
                       </div>
                       <span className="font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1">RIGHT JOIN <ArrowRight className="w-3 h-3" /></span>
                       <p className="text-[10px] text-slate-500 mt-1">Tudo da tabela da <strong>Direita</strong>, e o que combinar da Esquerda.</p>
                    </div>

                    {/* FULL JOIN */}
                    <div className="flex flex-col items-center text-center">
                       <div className="relative w-20 h-14 mb-2">
                          <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-amber-500 border-2 border-amber-400 opacity-80"></div>
                          <div className="absolute right-0 top-0 w-10 h-10 rounded-full bg-amber-500 border-2 border-amber-400 opacity-80 -ml-4"></div>
                       </div>
                       <span className="font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" /> FULL JOIN</span>
                       <p className="text-[10px] text-slate-500 mt-1">Tudo de <strong>ambas</strong> as tabelas, combinando onde possível.</p>
                    </div>

                 </div>
              </div>

              {/* GROUP BY & AGGREGATION */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                 <div className="flex items-center gap-2 mb-3 text-purple-600 dark:text-purple-400">
                    <Database className="w-5 h-5" />
                    <h4 className="font-bold uppercase tracking-wider text-sm">Agregação (Group By)</h4>
                 </div>
                 <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Usado para relatórios. "Achata" várias linhas em uma só.</p>
                 <div className="bg-slate-50 dark:bg-slate-900 rounded p-3 text-xs space-y-2">
                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                       <span className="font-bold">Função</span>
                       <span>O que faz</span>
                    </div>
                    <div className="flex justify-between"><span className="font-mono text-purple-600 font-bold">COUNT</span> <span>Conta registros</span></div>
                    <div className="flex justify-between"><span className="font-mono text-purple-600 font-bold">SUM</span> <span>Soma valores</span></div>
                    <div className="flex justify-between"><span className="font-mono text-purple-600 font-bold">AVG</span> <span>Média</span></div>
                 </div>
              </div>

              {/* ORDER BY & LIMIT */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                 <div className="flex items-center gap-2 mb-3 text-blue-600 dark:text-blue-400">
                    <ArrowDownAZ className="w-5 h-5" />
                    <h4 className="font-bold uppercase tracking-wider text-sm">Organização</h4>
                 </div>
                 <div className="space-y-4">
                    <div>
                       <code className="text-sm font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded text-blue-700 dark:text-blue-300">ORDER BY</code>
                       <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Classifica os resultados. <span className="font-mono text-xs">ASC</span> (Crescente A-Z) ou <span className="font-mono text-xs">DESC</span> (Decrescente Z-A).</p>
                    </div>
                    <div>
                       <code className="text-sm font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded text-blue-700 dark:text-blue-300">LIMIT</code>
                       <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Corta os resultados após X linhas. Útil para "Top 10" ou para não travar o banco.</p>
                    </div>
                 </div>
              </div>

           </div>
        </div>
        
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 text-center">
           <button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2 rounded-lg font-bold shadow transition-colors">Entendi!</button>
        </div>
      </div>
    </div>
  );
};

export default SqlCheatSheetModal;
