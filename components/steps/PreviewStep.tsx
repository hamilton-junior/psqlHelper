
import React, { useState } from 'react';
import { QueryResult } from '../../types';
import { Terminal, Play, ArrowLeft, CheckCircle2, ShieldAlert, Info, Copy, Check, Loader2 } from 'lucide-react';

interface PreviewStepProps {
  queryResult: QueryResult;
  onExecute: () => void;
  onBack: () => void;
  isExecuting: boolean;
  isValidating: boolean;
}

const PreviewStep: React.FC<PreviewStepProps> = ({ queryResult, onExecute, onBack, isExecuting, isValidating }) => {
  const [copied, setCopied] = useState(false);
  
  // If validation is undefined yet, assume valid until proven otherwise, but show loader
  const isValid = queryResult.validation?.isValid ?? true;
  const validationError = queryResult.validation?.error;
  const correctedSql = queryResult.validation?.correctedSql;

  const handleCopy = () => {
    navigator.clipboard.writeText(queryResult.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Terminal className="w-6 h-6 text-indigo-600" />
            Visualização da Query
          </h2>
          <p className="text-slate-500 mt-1">Revisão da query SQL antes da execução</p>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* 1. SQL Code Block (Shown First) */}
        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900">
           <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
             <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">SQL Gerado:</span>
             <button 
               onClick={handleCopy}
               className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
             >
               {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
               {copied ? 'Copiado!' : 'Copiar'}
             </button>
           </div>
           <div className="p-6 overflow-x-auto">
             <pre className="font-mono text-sm text-indigo-100 whitespace-pre-wrap leading-relaxed">{queryResult.sql}</pre>
           </div>
        </div>

        {/* 2. Validation Status (Shown Second) */}
        <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all duration-300 ${
          isValidating 
            ? 'bg-indigo-50 border-indigo-100' 
            : isValid 
              ? 'bg-emerald-50 border-emerald-200' 
              : 'bg-red-50 border-red-200'
        }`}>
          {isValidating ? (
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin mt-0.5" />
          ) : isValid ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5" />
          )}
          
          <div className="flex-1">
            <h4 className={`font-bold text-sm ${
              isValidating ? 'text-indigo-800' : isValid ? 'text-emerald-800' : 'text-red-800'
            }`}>
              {isValidating ? 'Validating Syntax...' : isValid ? 'Syntax Validated' : 'Syntax Error Detected'}
            </h4>
            
            {/* 3. Error Justification (Shown immediately if invalid) */}
            {!isValidating && !isValid && validationError && (
              <div className="mt-2 pt-2 border-t border-red-100/50">
                <p className="text-xs text-red-700 font-medium">{validationError}</p>
                {correctedSql && (
                   <div className="mt-2 p-2 bg-white/60 rounded border border-red-100 text-xs">
                     <span className="font-bold text-red-800 block mb-1">Suggested Correction:</span>
                     <code className="font-mono text-red-600 break-all">{correctedSql}</code>
                   </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 4. Logic Explanation & Tips (Shown Last) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-2 mb-3">
             <Info className="w-4 h-4 text-indigo-500" />
             <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Logic Explanation</h4>
           </div>
           <p className="text-slate-600 leading-relaxed text-sm">{queryResult.explanation}</p>
           
           {queryResult.tips && queryResult.tips.length > 0 && (
             <div className="mt-4 pt-4 border-t border-slate-100">
                <h5 className="text-xs font-bold text-slate-500 mb-2">OPTIMIZATION TIPS</h5>
                <ul className="list-disc pl-4 space-y-1">
                  {queryResult.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-slate-600">{tip}</li>
                  ))}
                </ul>
             </div>
           )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
           <button 
             onClick={onBack}
             className="px-6 py-3 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-2"
           >
             <ArrowLeft className="w-4 h-4" />
             Back to Builder
           </button>

           <button 
             onClick={onExecute}
             disabled={!isValid || isExecuting || isValidating}
             className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
           >
             {isExecuting ? 'Running...' : 'Run Query'}
             <Play className="w-4 h-4 fill-current" />
           </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewStep;
