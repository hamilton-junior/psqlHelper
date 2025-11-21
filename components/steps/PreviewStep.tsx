
import React, { useState } from 'react';
import { QueryResult } from '../../types';
import { Terminal, Play, ArrowLeft, CheckCircle2, ShieldAlert, Info, Copy, Check } from 'lucide-react';

interface PreviewStepProps {
  queryResult: QueryResult;
  onExecute: () => void;
  onBack: () => void;
  isExecuting: boolean;
}

const PreviewStep: React.FC<PreviewStepProps> = ({ queryResult, onExecute, onBack, isExecuting }) => {
  const [copied, setCopied] = useState(false);
  const isValid = queryResult.validation?.isValid ?? true;

  const handleCopy = () => {
    navigator.clipboard.writeText(queryResult.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Terminal className="w-6 h-6 text-indigo-600" />
            Query Preview
          </h2>
          <p className="text-slate-500 mt-1">Review generated SQL before execution</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Validation Status */}
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${isValid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          {isValid ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5" />
          )}
          <div>
            <h4 className={`font-bold text-sm ${isValid ? 'text-emerald-800' : 'text-red-800'}`}>
              {isValid ? 'Syntax Validated' : 'Syntax Error Detected'}
            </h4>
            {!isValid && (
              <p className="text-xs text-red-700 mt-1">{queryResult.validation?.error}</p>
            )}
          </div>
        </div>

        {/* SQL Code */}
        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900">
           <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
             <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Generated SQL</span>
             <button 
               onClick={handleCopy}
               className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
             >
               {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
               {copied ? 'Copied!' : 'Copy'}
             </button>
           </div>
           <div className="p-6 overflow-x-auto">
             <pre className="font-mono text-sm text-indigo-100 whitespace-pre-wrap">{queryResult.sql}</pre>
           </div>
        </div>

        {/* Explanation */}
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
             disabled={!isValid || isExecuting}
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
