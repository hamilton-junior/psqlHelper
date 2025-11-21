
import React from 'react';
import { Table, ArrowLeft, Database, Download } from 'lucide-react';

interface ResultsStepProps {
  data: any[];
  sql: string;
  onBackToBuilder: () => void;
  onNewConnection: () => void;
}

const ResultsStep: React.FC<ResultsStepProps> = ({ data, sql, onBackToBuilder, onNewConnection }) => {
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

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
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Table className="w-6 h-6 text-indigo-600" />
            Query Results
          </h2>
          <div className="flex items-center gap-2 mt-1">
             <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Success</span>
             <span className="text-slate-500 text-sm">Returned {data.length} rows</span>
          </div>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={downloadCsv}
             disabled={data.length === 0}
             className="p-2 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed" 
             title="Download CSV"
           >
             <Download className="w-5 h-5" />
           </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
        {data.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
             No data returned
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
             <table className="w-full text-left border-collapse">
               <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                 <tr>
                   {columns.map(col => (
                     <th key={col} className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap border-b border-slate-200">
                       {col}
                     </th>
                   ))}
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {data.map((row, idx) => (
                   <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                     {columns.map(col => (
                       <td key={col} className="px-6 py-3 text-sm text-slate-600 font-mono whitespace-nowrap">
                         {row[col] === null ? <span className="text-slate-300 italic">null</span> : String(row[col])}
                       </td>
                     ))}
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        )}
        
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-[10px] font-mono text-slate-400 truncate px-6">
           Executed: {sql}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between shrink-0">
         <button 
           onClick={onNewConnection}
           className="text-slate-400 hover:text-slate-600 text-sm font-medium flex items-center gap-2"
         >
           <Database className="w-4 h-4" />
           New Connection
         </button>

         <button 
           onClick={onBackToBuilder}
           className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
         >
           <ArrowLeft className="w-4 h-4" />
           Modify Query
         </button>
      </div>
    </div>
  );
};

export default ResultsStep;
