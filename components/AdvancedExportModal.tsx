import React, { useState, useMemo } from 'react';
import { X, Download, FileText, FileJson, Database, Table, FileType, Check, Copy, Share2, Printer, Loader2, ListChecks, ArrowRight, Settings2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { toast } from 'react-hot-toast';

interface AdvancedExportModalProps {
  data: any[];
  columns: string[];
  tableName: string | null;
  onClose: () => void;
}

type ExportFormat = 'csv' | 'json' | 'sql' | 'markdown' | 'pdf';

const AdvancedExportModal: React.FC<AdvancedExportModalProps> = ({ data, columns, tableName, onClose }) => {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(columns);
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [delimiter, setDelimiter] = useState(',');

  const exportData = useMemo(() => {
    return data.map(row => {
      const newRow: any = {};
      selectedColumns.forEach(col => {
        newRow[col] = row[col];
      });
      return newRow;
    });
  }, [data, selectedColumns]);

  const toggleColumn = (col: string) => {
    setSelectedColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleExport = async () => {
    console.log(`[EXPORT] Iniciando exportação avançada: Formato=${format.toUpperCase()}, Linhas=${exportData.length}`);
    setIsExporting(true);
    
    try {
      const fileName = `export_${tableName || 'results'}_${Date.now()}`;

      switch (format) {
        case 'csv': {
          const headerRow = includeHeaders ? selectedColumns.join(delimiter) + '\n' : '';
          const csvRows = exportData.map(row => 
            selectedColumns.map(col => {
              const val = row[col];
              if (val === null) return '';
              const str = String(val).replace(/"/g, '""');
              return `"${str}"`;
            }).join(delimiter)
          ).join('\n');
          downloadFile(headerRow + csvRows, `${fileName}.csv`, 'text/csv');
          break;
        }
        case 'json': {
          downloadFile(JSON.stringify(exportData, null, 2), `${fileName}.json`, 'application/json');
          break;
        }
        case 'sql': {
          const table = tableName || 'exported_table';
          const sql = exportData.map(row => {
            const keys = selectedColumns.join(', ');
            const values = selectedColumns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              return String(val);
            }).join(', ');
            return `INSERT INTO ${table} (${keys}) VALUES (${values});`;
          }).join('\n');
          downloadFile(sql, `${fileName}.sql`, 'text/plain');
          break;
        }
        case 'markdown': {
          const header = '| ' + selectedColumns.join(' | ') + ' |';
          const separator = '| ' + selectedColumns.map(() => '---').join(' | ') + ' |';
          const rows = exportData.map(row => 
            '| ' + selectedColumns.map(col => String(row[col] ?? 'null')).join(' | ') + ' |'
          ).join('\n');
          downloadFile(`${header}\n${separator}\n${rows}`, `${fileName}.md`, 'text/markdown');
          break;
        }
        case 'pdf': {
          const doc = new jsPDF() as any;
          const tableRows = exportData.map(row => selectedColumns.map(col => String(row[col] ?? 'null')));
          doc.autoTable({
            head: [selectedColumns],
            body: tableRows,
            theme: 'striped',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [79, 70, 229] }
          });
          doc.save(`${fileName}.pdf`);
          break;
        }
      }
      toast.success("Arquivo gerado com sucesso!");
    } catch (error) {
      console.error("[EXPORT_ERROR]", error);
      toast.error("Erro ao gerar arquivo de exportação.");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300 font-sans">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-900/20">
                <Download className="w-6 h-6 text-white" />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">Exportação Avançada</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Personalize a saída de {data.length} registros</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-500 transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Panel: Settings */}
          <div className="w-1/3 border-r border-slate-100 dark:border-slate-800 p-8 flex flex-col gap-8 bg-slate-50/50 dark:bg-slate-950/20 overflow-y-auto custom-scrollbar">
             
             <section>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                   <FileType className="w-4 h-4" /> Formato do Arquivo
                </h4>
                <div className="grid grid-cols-1 gap-2">
                   {[
                      { id: 'csv', label: 'CSV (Planilha)', icon: FileText, color: 'text-emerald-500' },
                      { id: 'json', label: 'JSON Raw', icon: FileJson, color: 'text-amber-500' },
                      { id: 'sql', label: 'SQL Inserts', icon: Database, color: 'text-indigo-500' },
                      { id: 'markdown', label: 'Markdown Table', icon: FileType, color: 'text-slate-500' },
                      { id: 'pdf', label: 'PDF Document', icon: Printer, color: 'text-rose-500' }
                   ].map(item => (
                      <button
                        key={item.id}
                        onClick={() => setFormat(item.id as ExportFormat)}
                        className={`flex items-center gap-3 p-3 rounded-2xl text-sm font-bold transition-all border ${
                          format === item.id 
                            ? 'bg-white dark:bg-slate-800 border-indigo-500 shadow-md text-indigo-600' 
                            : 'bg-transparent border-transparent text-slate-500 hover:bg-white dark:hover:bg-slate-800'
                        }`}
                      >
                         <item.icon className={`w-5 h-5 ${item.color}`} />
                         {item.label}
                         {format === item.id && <Check className="w-4 h-4 ml-auto" />}
                      </button>
                   ))}
                </div>
             </section>

             <section>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                   <Settings2 className="w-4 h-4" /> Opções Específicas
                </h4>
                <div className="space-y-4">
                   <label className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl cursor-pointer hover:shadow-sm transition-all group">
                      <div className="flex flex-col">
                         <span className="text-sm font-black text-slate-700 dark:text-slate-200">Incluir Cabeçalhos</span>
                         <span className="text-[10px] text-slate-400 uppercase font-bold">Nomes das colunas na 1ª linha</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={includeHeaders} 
                        onChange={e => setIncludeHeaders(e.target.checked)} 
                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                      />
                   </label>

                   {format === 'csv' && (
                      <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Delimitador</label>
                         <div className="flex gap-2">
                            {[',', ';', '|', '\\t'].map(d => (
                               <button 
                                 key={d}
                                 onClick={() => setDelimiter(d)}
                                 className={`flex-1 py-1.5 rounded-lg text-xs font-black border transition-all ${delimiter === d ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-700'}`}
                               >
                                  {d === '\\t' ? 'TAB' : d}
                               </button>
                            ))}
                         </div>
                      </div>
                   )}
                </div>
             </section>
          </div>

          {/* Right Panel: Column Selection & Preview */}
          <div className="flex-1 flex flex-col p-8 overflow-hidden bg-white dark:bg-slate-900">
             
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                   <ListChecks className="w-5 h-5 text-indigo-500" />
                   <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Selecionar Colunas ({selectedColumns.length})</h4>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => setSelectedColumns(columns)} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline">Todas</button>
                   <button onClick={() => setSelectedColumns([])} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:underline">Nenhuma</button>
                </div>
             </div>

             <div className="flex flex-wrap gap-2 mb-8 overflow-y-auto max-h-32 custom-scrollbar">
                {columns.map(col => (
                   <button
                     key={col}
                     onClick={() => toggleColumn(col)}
                     className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all border flex items-center gap-2 ${
                        selectedColumns.includes(col)
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300 shadow-sm'
                          : 'bg-slate-50 border-slate-100 text-slate-400 dark:bg-slate-950 dark:border-slate-800'
                     }`}
                   >
                      {selectedColumns.includes(col) ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 border border-current rounded-sm" />}
                      {col}
                   </button>
                ))}
             </div>

             <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3 px-2">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Preview da Estrutura</h4>
                   <span className="text-[9px] font-bold text-slate-300 italic">Visualização limitada às primeiras 5 linhas</span>
                </div>
                <div className="flex-1 bg-slate-950 rounded-[2rem] border border-slate-800 shadow-2xl overflow-hidden flex flex-col p-6">
                   <div className="overflow-auto custom-scrollbar h-full">
                      <table className="w-full text-left font-mono text-[11px] leading-relaxed">
                         <thead>
                            <tr className="text-indigo-400 border-b border-slate-800">
                               {selectedColumns.map(col => <th key={col} className="px-3 py-2 whitespace-nowrap">{col}</th>)}
                            </tr>
                         </thead>
                         <tbody className="text-slate-400">
                            {exportData.slice(0, 5).map((row, i) => (
                               <tr key={i} className="border-b border-slate-900/50 last:border-0">
                                  {selectedColumns.map(col => (
                                     <td key={col} className="px-3 py-2 whitespace-nowrap truncate max-w-[150px]">{String(row[col] ?? 'null')}</td>
                                  ))}
                               </tr>
                            ))}
                         </tbody>
                      </table>
                      {exportData.length > 5 && (
                         <div className="py-4 text-center text-slate-600 italic text-[10px] uppercase tracking-widest border-t border-slate-900">
                            ... e mais {exportData.length - 5} registros
                         </div>
                      )}
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 text-slate-400">
             <Share2 className="w-4 h-4" />
             <span className="text-xs font-bold uppercase tracking-widest">Processamento Client-side Seguro</span>
          </div>
          <div className="flex gap-4">
             <button 
                onClick={onClose} 
                className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
             >
                Cancelar
             </button>
             <button 
                onClick={handleExport}
                disabled={isExporting || selectedColumns.length === 0}
                className="px-12 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-3xl shadow-xl shadow-indigo-900/20 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:grayscale"
             >
               {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
               Gerar & Baixar Arquivo
             </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdvancedExportModal;