
import React, { useState, useEffect } from 'react';
import { Table, ArrowLeft, Database, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface ResultsStepProps {
  data: any[];
  sql: string;
  onBackToBuilder: () => void;
  onNewConnection: () => void;
}

const ResultsStep: React.FC<ResultsStepProps> = ({ data, sql, onBackToBuilder, onNewConnection }) => {
  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Reset page when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  // Calculate Pagination
  const totalRows = data.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
  const currentData = data.slice(startIndex, endIndex);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const downloadCsv = () => {
    if (data.length === 0) return;
    
    const headers = columns.join(',');
    const rows = data.map(row => 
      columns.map(col => {
        const val = row[col];
        // Escape quotes and wrap in quotes if string contains comma
        if (typeof val === 'string' && val.includes(',')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    );
    
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'query_results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex items-end justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Table className="w-6 h-6 text-indigo-600" />
            Resultados da Query
          </h2>
          <div className="flex items-center gap-2 mt-1">
             <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Sucesso</span>
             <span className="text-slate-500 dark:text-slate-400 text-sm">Total: {totalRows} linhas</span>
          </div>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={downloadCsv}
             disabled={data.length === 0}
             className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed" 
             title="Baixar CSV Completo"
           >
             <Download className="w-5 h-5" />
           </button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col shadow-sm">
        {data.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
             Nenhum dado retornado
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto">
               <table className="w-full text-left border-collapse">
                 <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                   <tr>
                     {columns.map(col => (
                       <th key={col} className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap border-b border-slate-200 dark:border-slate-700">
                         {col}
                       </th>
                     ))}
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                   {currentData.map((row, idx) => (
                     <tr key={idx} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                       {columns.map(col => (
                         <td key={col} className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300 font-mono whitespace-nowrap">
                           {row[col] === null ? <span className="text-slate-300 dark:text-slate-600 italic">null</span> : String(row[col])}
                         </td>
                       ))}
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
               <div className="flex items-center gap-4">
                 <span className="hidden sm:inline">
                    Mostrando <span className="font-bold">{startIndex + 1}</span> - <span className="font-bold">{endIndex}</span> de <span className="font-bold">{totalRows}</span>
                 </span>
                 <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-bold text-slate-400">Linhas por pág:</span>
                    <select 
                      value={rowsPerPage} 
                      onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                      className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                 </div>
               </div>

               <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handlePageChange(1)} 
                    disabled={currentPage === 1}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Primeira Página"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handlePageChange(currentPage - 1)} 
                    disabled={currentPage === 1}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <span className="mx-2 font-mono text-xs">
                    Pág {currentPage} / {totalPages}
                  </span>

                  <button 
                    onClick={() => handlePageChange(currentPage + 1)} 
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Próxima"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handlePageChange(totalPages)} 
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Última Página"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
               </div>
            </div>
          </>
        )}
        
        <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-400 truncate px-6">
           Executado: {sql}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between shrink-0">
         <button 
           onClick={onNewConnection}
           className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-medium flex items-center gap-2"
         >
           <Database className="w-4 h-4" />
           Nova Conexão
         </button>

         <button 
           onClick={onBackToBuilder}
           className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2"
         >
           <ArrowLeft className="w-4 h-4" />
           Modificar Query
         </button>
      </div>
    </div>
  );
};

export default ResultsStep;