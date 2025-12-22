
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { X, Calculator, Table2, Check, Braces, Plus, Minus, AlertCircle, Search, Divide, Hash, Type, FunctionSquare } from 'lucide-react';

interface AvailableColumn {
  table: string;
  column: string;
  fullId: string;
  type: string;
}

interface FormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (alias: string, expression: string) => void;
  availableColumns: AvailableColumn[];
}

const FormulaModal: React.FC<FormulaModalProps> = ({ isOpen, onClose, onSave, availableColumns }) => {
  const [alias, setAlias] = useState('');
  const [expression, setExpression] = useState('');
  const [colSearch, setColSearch] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus alias input on open
  useEffect(() => {
    if (isOpen) {
       setAlias('');
       setExpression('');
       setColSearch('');
    }
  }, [isOpen]);

  const insertText = (text: string, cursorOffset = 0) => {
    const textarea = textareaRef.current;
    if (!textarea) {
       setExpression(prev => prev + text);
       return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;
    
    const newVal = currentVal.substring(0, start) + text + currentVal.substring(end);
    setExpression(newVal);
    
    // Restore focus and move cursor
    setTimeout(() => {
       textarea.focus();
       const newPos = start + text.length + cursorOffset;
       textarea.selectionStart = textarea.selectionEnd = newPos;
    }, 0);
  };

  const handleInsertColumn = (colId: string) => {
     insertText(colId);
  };

  const validationError = useMemo(() => {
     if (!alias.trim()) return "Defina um nome (alias) para a coluna.";
     if (!expression.trim()) return "A fórmula não pode estar vazia.";
     
     // Simple Parentheses Check
     const open = (expression.match(/\(/g) || []).length;
     const close = (expression.match(/\)/g) || []).length;
     if (open !== close) return `Parênteses desbalanceados: ( abertos=${open}, ) fechados=${close}`;

     return null;
  }, [alias, expression]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validationError) {
      onSave(alias.trim().replace(/\s+/g, '_').toLowerCase(), expression.trim());
      onClose();
    }
  };

  const groupedColumns = useMemo(() => {
     const groups: Record<string, AvailableColumn[]> = {};
     availableColumns.forEach(col => {
        if (!col.fullId.toLowerCase().includes(colSearch.toLowerCase())) return;
        if (!groups[col.table]) groups[col.table] = [];
        groups[col.table].push(col);
     });
     return groups;
  }, [availableColumns, colSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 font-sans">
      <div className="bg-white dark:bg-slate-800 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Calculator className="w-6 h-6" />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Construtor de Fórmulas</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Crie colunas calculadas (ex: Lucro = Venda - Custo)</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex min-h-0 overflow-hidden">
           
           {/* Left Panel: Editor */}
           <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
              
              {/* Alias */}
              <div>
                 <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Nome da Nova Coluna (Alias) <span className="text-red-500">*</span>
                 </label>
                 <input 
                    type="text" 
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="ex: valor_total"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    autoFocus
                 />
              </div>

              {/* Toolbar */}
              <div>
                 <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Operações
                 </label>
                 <div className="flex flex-wrap gap-2">
                    {/* Math */}
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                       <button type="button" onClick={() => insertText(' + ')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-bold" title="Somar"><Plus className="w-4 h-4" /></button>
                       <button type="button" onClick={() => insertText(' - ')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-bold" title="Subtrair"><Minus className="w-4 h-4" /></button>
                       <button type="button" onClick={() => insertText(' * ')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-bold" title="Multiplicar">×</button>
                       <button type="button" onClick={() => insertText(' / ')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-bold" title="Dividir"><Divide className="w-4 h-4" /></button>
                       <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1 self-center"></div>
                       <button type="button" onClick={() => insertText('(')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-bold" title="Abre Parênteses">(</button>
                       <button type="button" onClick={() => insertText(')')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-bold" title="Fecha Parênteses">)</button>
                    </div>

                    {/* Common Functions */}
                    <div className="flex gap-2">
                       <button type="button" onClick={() => insertText('SUM()', -1)} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition-colors" title="Soma total">SUM</button>
                       <button type="button" onClick={() => insertText('AVG()', -1)} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition-colors" title="Média">AVG</button>
                       <button type="button" onClick={() => insertText('ROUND(, 2)', -4)} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition-colors" title="Arredondar casas decimais">ROUND</button>
                       <button type="button" onClick={() => insertText(' || ')} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition-colors" title="Concatenar Texto">TEXTO</button>
                       <button type="button" onClick={() => insertText('COALESCE(, 0)', -4)} className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold border border-amber-200 dark:border-amber-800 transition-colors" title="Substituir valor nulo por 0">NULOS</button>
                    </div>
                 </div>
              </div>

              {/* Editor */}
              <div className="flex-1 min-h-[150px] relative flex flex-col">
                 <textarea 
                    ref={textareaRef}
                    value={expression}
                    onChange={(e) => setExpression(e.target.value)}
                    placeholder="Selecione colunas à direita e use operadores acima. Ex: (preco * quantidade)"
                    className="flex-1 w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-mono resize-none leading-relaxed"
                 />
                 <div className="absolute right-4 bottom-4 pointer-events-none opacity-50">
                    <Braces className="w-16 h-16 text-slate-200 dark:text-slate-700" />
                 </div>
              </div>

              {/* Validation Status */}
              <div className={`p-3 rounded-lg flex items-center gap-2 text-xs font-medium transition-colors ${validationError ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                 {validationError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
                 {validationError || "Sintaxe aparentemente correta."}
              </div>

           </div>

           {/* Right Panel: Columns */}
           <div className="w-72 border-l border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col">
              <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Colunas Disponíveis</h4>
                 <div className="relative">
                    <Search className="absolute left-2.5 top-1.5 w-3.5 h-3.5 text-slate-400" />
                    <input 
                       type="text" 
                       value={colSearch}
                       onChange={(e) => setColSearch(e.target.value)}
                       placeholder="Buscar campo..."
                       className="w-full pl-8 pr-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-3">
                 {Object.keys(groupedColumns).length === 0 ? (
                    <div className="text-center p-4 text-xs text-slate-400">Nenhuma coluna encontrada.</div>
                 ) : (
                    Object.entries(groupedColumns).map(([table, cols]) => (
                       <div key={table}>
                          <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                             <Table2 className="w-3 h-3 text-indigo-500" />
                             {table}
                          </div>
                          <div className="space-y-1 mt-1">
                             {(cols as AvailableColumn[]).map(col => {
                                const isNum = col.type.includes('int') || col.type.includes('num') || col.type.includes('dec') || col.type.includes('float');
                                return (
                                   <button
                                      key={col.fullId}
                                      onClick={() => handleInsertColumn(col.fullId)}
                                      className="w-full text-left px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md text-[11px] font-mono text-slate-600 dark:text-slate-400 transition-all flex items-center gap-2 group shadow-sm hover:shadow-md"
                                      title={`Tipo: ${col.type}`}
                                   >
                                      {isNum ? <Hash className="w-3 h-3 text-emerald-500 opacity-70" /> : <Type className="w-3 h-3 text-amber-500 opacity-70" />}
                                      <span className="truncate flex-1">{col.column}</span>
                                      <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                                   </button>
                                );
                             })}
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!!validationError}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Check className="w-4 h-4" />
            Adicionar Coluna
          </button>
        </div>

      </div>
    </div>
  );
};

export default FormulaModal;
