import React, { useState } from 'react';
import { QueryResult } from '../../types';
import { Terminal, Play, ArrowLeft, CheckCircle2, ShieldAlert, Info, Copy, Check, Loader2, Lightbulb, ShieldOff } from 'lucide-react';

interface PreviewStepProps {
  queryResult: QueryResult;
  onExecute: () => void;
  onBack: () => void;
  isExecuting: boolean;
  isValidating: boolean;
  validationDisabled?: boolean;
}

const PreviewStep: React.FC<PreviewStepProps> = ({ queryResult, onExecute, onBack, isExecuting, isValidating, validationDisabled }) => {
  const [copied, setCopied] = useState(false);
  
  // If validation is undefined yet, assume valid until proven otherwise, but show loader
  const isValid = queryResult.validation?.isValid ?? true;
  const validationError = queryResult.validation?.error;
  const detailedError = queryResult.validation?.detailedError;
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
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Terminal className="w-6 h-6 text-indigo-600" />
            Visualização da Query
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Revise o SQL gerado antes da execução</p>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* 1. SQL Code Block (Shown First) */}
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-slate-900">
           <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
             <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">SQL Gerado</span>
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
        {validationDisabled ? (
           <div className="p-4 rounded-xl border flex items-start gap-3 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700">
             <ShieldOff className="w-5 h-5 text-slate-400 mt-0.5" />
             <div>
               <h4 className="font-bold text-sm text-slate-600 dark:text-slate-300">Validação Desativada</h4>
               <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">A verificação de sintaxe por IA está desligada nas configurações.</p>
             </div>
           </div>
        ) : (
          <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all duration-300 ${
            isValidating 
              ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800' 
              : isValid 
                ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' 
                : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
          }`}>
            {isValidating ? (
              <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin mt-0.5" />
            ) : isValid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            )}
            
            <div className="flex-1">
              <h4 className={`font-bold text-sm ${
                isValidating ? 'text-indigo-800 dark:text-indigo-200' : isValid ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'
              }`}>
                {isValidating ? 'Validando Sintaxe...' : isValid ? 'Sintaxe Validada' : 'Erro de Sintaxe Detectado'}
              </h4>
              
              {/* 3. Error Justification (Shown immediately if invalid) */}
              {!isValidating && !isValid && (validationError || detailedError) && (
                <div className="mt-3 pt-3 border-t border-red-100/50 dark:border-red-800/30 space-y-3">
                  {/* Short Technical Error */}
                  {validationError && (
                    <p className="text-xs font-mono bg-red-100/50 dark:bg-red-900/30 text-red-900 dark:text-red-100 p-2 rounded border border-red-100 dark:border-red-800">
                      {validationError}
                    </p>
                  )}

                  {/* Detailed Education */}
                  {detailedError && (
                    <div className="text-xs text-slate-700 dark:text-slate-300 flex gap-2">
                      <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="leading-relaxed">{detailedError}</span>
                    </div>
                  )}

                  {/* Suggested Fix */}
                  {correctedSql && (
                     <div className="p-3 bg-white/60 dark:bg-slate-800/60 rounded border border-indigo-100 dark:border-slate-700 text-xs shadow-sm">
                       <div className="flex items-center gap-1.5 mb-1.5 text-indigo-600 dark:text-indigo-400">
                          <Lightbulb className="w-3.5 h-3.5" />
                          <span className="font-bold uppercase tracking-wide">Sugestão de Correção</span>
                       </div>
                       <code className="block font-mono text-slate-700 dark:text-slate-200 break-all bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded">{correctedSql}</code>
                     </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Logic Explanation & Tips (Shown Last) */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
           <div className="flex items-center gap-2 mb-3">
             <Info className="w-4 h-4 text-indigo-500" />
             <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">Explicação da Lógica</h4>
           </div>
           <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">{queryResult.explanation}</p>
           
           {queryResult.tips && queryResult.tips.length > 0 && (
             <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">DICAS DE OTIMIZAÇÃO</h5>
                <ul className="list-disc pl-4 space-y-1">
                  {queryResult.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-slate-600 dark:text-slate-400">{tip}</li>
                  ))}
                </ul>
             </div>
           )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
           <button 
             onClick={onBack}
             className="px-6 py-3 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2"
           >
             <ArrowLeft className="w-4 h-4" />
             Voltar ao Construtor
           </button>

           <button 
             onClick={onExecute}
             disabled={(!isValid && !validationDisabled) || isExecuting || isValidating}
             className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-red-200 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
           >
             {isExecuting ? 'Executando...' : 'Executar Query'}
             <Play className="w-4 h-4 fill-current" />
           </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewStep;