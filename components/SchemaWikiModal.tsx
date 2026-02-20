
import React, { useState, useEffect } from 'react';
import { X, Book, Download, Loader2, RefreshCw, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
import { DatabaseSchema } from '../types';
import { generateDatabaseWiki } from '../services/geminiService';
import { toast } from 'react-hot-toast';

interface SchemaWikiModalProps {
  schema: DatabaseSchema;
  onClose: () => void;
}

const SchemaWikiModal: React.FC<SchemaWikiModalProps> = ({ schema, onClose }) => {
  const [wikiContent, setWikiContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchWiki = async () => {
    setIsLoading(true);
    try {
      const content = await generateDatabaseWiki(schema);
      setWikiContent(content);
    } catch (error) {
      toast.error("Falha ao gerar a Wiki do Banco.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWiki();
  }, [schema]);

  const handleDownload = () => {
    const blob = new Blob([wikiContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wiki-${schema.name.toLowerCase().replace(/\s+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Wiki baixada com sucesso!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Book size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Wiki do Banco de Dados</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Documentação técnica gerada por IA para {schema.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && (
              <>
                <button 
                  onClick={fetchWiki}
                  className="p-2 text-slate-500 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                  title="Regerar Wiki"
                >
                  <RefreshCw size={18} />
                </button>
                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-indigo-500/20"
                >
                  <Download size={14} />
                  <span>Baixar .md</span>
                </button>
              </>
            )}
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4 py-20">
              <div className="relative">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                <Book className="absolute inset-0 m-auto w-5 h-5 text-indigo-400 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Analisando Schema e Gerando Documentação...</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Isso pode levar alguns segundos dependendo da complexidade do banco.</p>
              </div>
            </div>
          ) : (
            <div className="prose prose-slate dark:prose-invert max-w-none markdown-body">
              <Markdown>{wikiContent}</Markdown>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-black tracking-widest">
            <FileText size={12} />
            <span>Powered by Gemini 3.1 Pro</span>
          </div>
          <p className="text-[10px] text-slate-400 italic">
            Esta documentação é gerada dinamicamente e deve ser revisada por um humano.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SchemaWikiModal;
