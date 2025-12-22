
import React from 'react';
import { X, Database, Loader2, AlertCircle } from 'lucide-react';

interface TablePreviewModalProps {
  tableName: string;
  data: any[];
  isLoading: boolean;
  error?: string | null;
  onClose: () => void;
}

const TablePreviewModal: React.FC<TablePreviewModalProps> = ({ tableName, data, isLoading, error, onClose }) => {
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[80vh] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">{tableName}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Visualização rápida (Top 10)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-0 bg-white dark:bg-slate-900 relative min-h-[200px]">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm font-medium">Carregando dados...</p>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 p-8 text-center">
              <AlertCircle className="w-10 h-10 mb-2 opacity-50" />
              <p className="font-bold">Erro ao buscar dados</p>
              <p className="text-sm opacity-80 mt-1">{error}</p>
            </div>
          ) : data.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <Database className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">A tabela está vazia.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 shadow-sm z-10">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider whitespace-nowrap border-b border-slate-200 dark:border-slate-700">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    {columns.map(col => (
                      <td key={`${i}-${col}`} className="px-6 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {row[col] === null ? (
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-mono">NULL</span>
                        ) : typeof row[col] === 'boolean' ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${row[col] ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {String(row[col])}
                          </span>
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center">
           <span>Mostrando {data.length} registros</span>
           <button onClick={onClose} className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Fechar</button>
        </div>
      </div>
    </div>
  );
};

export default TablePreviewModal;
