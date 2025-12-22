
import React, { useState } from 'react';
import { X, Copy, Braces, Search } from 'lucide-react';

interface JsonViewerModalProps {
  json: any;
  onClose: () => void;
}

const JsonViewerModal: React.FC<JsonViewerModalProps> = ({ json, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(json, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const jsonString = JSON.stringify(json, null, 2);
  
  // Basic highlighting logic
  const highlightedJson = jsonString.split('\n').map((line, idx) => {
     if (searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase())) {
        return <div key={idx} className="bg-yellow-200/20 text-yellow-200">{line}</div>;
     }
     return <div key={idx}>{line}</div>;
  });

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-3xl h-[80vh] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Braces className="w-5 h-5" />
             </div>
             <h3 className="font-bold text-slate-800 dark:text-white">Visualizador JSON</h3>
          </div>
          <div className="flex items-center gap-2">
             <div className="relative">
                <Search className="absolute left-2.5 top-1.5 w-3.5 h-3.5 text-slate-400" />
                <input 
                   type="text" 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   placeholder="Buscar chave/valor..." 
                   className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
                />
             </div>
             <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-[#1e1e1e] font-mono text-xs text-slate-300 custom-scrollbar">
           <pre>{highlightedJson}</pre>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 flex justify-end">
           <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors">
              <Copy className="w-3.5 h-3.5" /> {copied ? 'Copiado!' : 'Copiar JSON'}
           </button>
        </div>
      </div>
    </div>
  );
};

export default JsonViewerModal;
