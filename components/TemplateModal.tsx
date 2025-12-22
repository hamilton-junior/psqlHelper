
import React, { useState, useEffect } from 'react';
import { X, FileText, Plus, Play, Trash2, Save, Code, Pencil } from 'lucide-react';
import { QueryTemplate } from '../types';

interface TemplateModalProps {
  onClose: () => void;
  onRunTemplate: (sql: string) => void;
}

const TemplateModal: React.FC<TemplateModalProps> = ({ onClose, onRunTemplate }) => {
  const [templates, setTemplates] = useState<QueryTemplate[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'run'>('list');
  const [newTemplate, setNewTemplate] = useState<{id?: string, name: string, sql: string, description: string}>({ name: '', sql: 'SELECT * FROM users WHERE id = :id', description: '' });
  const [selectedTemplate, setSelectedTemplate] = useState<QueryTemplate | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});

  useEffect(() => {
     const stored = localStorage.getItem('psql-buddy-templates');
     if (stored) setTemplates(JSON.parse(stored));
  }, []);

  const saveTemplates = (list: QueryTemplate[]) => {
     setTemplates(list);
     localStorage.setItem('psql-buddy-templates', JSON.stringify(list));
  };

  const extractParams = (sql: string) => {
     const matches = sql.match(/:[a-zA-Z0-9_]+/g);
     return matches ? Array.from(new Set(matches.map(m => m.substring(1)))) : [];
  };

  const handleSave = () => {
     if (!newTemplate.name || !newTemplate.sql) return;
     
     const params = extractParams(newTemplate.sql);
     
     if (newTemplate.id) {
        // Edit Mode
        const updatedList = templates.map(t => t.id === newTemplate.id ? { ...t, name: newTemplate.name, sql: newTemplate.sql, description: newTemplate.description, parameters: params } : t);
        saveTemplates(updatedList);
     } else {
        // Create Mode
        const template: QueryTemplate = {
           id: crypto.randomUUID(),
           name: newTemplate.name,
           sql: newTemplate.sql,
           description: newTemplate.description,
           parameters: params
        };
        saveTemplates([...templates, template]);
     }
     
     setView('list');
  };

  const handleEdit = (t: QueryTemplate, e: React.MouseEvent) => {
     e.stopPropagation();
     setNewTemplate({ id: t.id, name: t.name, sql: t.sql, description: t.description || '' });
     setView('create');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
     e.stopPropagation();
     if(confirm("Excluir template?")) {
        saveTemplates(templates.filter(t => t.id !== id));
     }
  };

  const handlePrepareRun = (t: QueryTemplate) => {
     setSelectedTemplate(t);
     const initialParams: Record<string, string> = {};
     t.parameters.forEach(p => initialParams[p] = '');
     setParams(initialParams);
     setView('run');
  };

  const handleRun = () => {
     if (!selectedTemplate) return;
     let finalSql = selectedTemplate.sql;
     Object.entries(params).forEach(([key, val]) => {
        // Simple sanitization for client-side replacement
        const safeVal = String(val).replace(/'/g, "''"); 
        finalSql = finalSql.replace(new RegExp(`:${key}\\b`, 'g'), `'${safeVal}'`);
     });
     onRunTemplate(finalSql);
     onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden max-h-[80vh]" onClick={e => e.stopPropagation()}>
         
         <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg">
                  <FileText className="w-5 h-5" />
               </div>
               <h3 className="font-bold text-slate-800 dark:text-white">Templates SQL</h3>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"><X className="w-5 h-5" /></button>
         </div>

         <div className="flex-1 overflow-auto p-4 custom-scrollbar">
            
            {view === 'list' && (
               <div className="space-y-3">
                  <button onClick={() => { setNewTemplate({ name: '', sql: 'SELECT * FROM users WHERE id = :id', description: '' }); setView('create'); }} className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:border-cyan-500 hover:text-cyan-600 transition-colors flex items-center justify-center gap-2 text-sm font-bold">
                     <Plus className="w-4 h-4" /> Novo Template
                  </button>
                  {templates.length === 0 ? <p className="text-center text-slate-400 text-xs py-4">Nenhum template salvo.</p> : (
                     templates.map(t => (
                        <div key={t.id} onClick={() => handlePrepareRun(t)} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:border-cyan-400 transition-all group relative">
                           <div className="flex justify-between items-start">
                              <div>
                                 <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">{t.name}</h4>
                                 <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.description || 'Sem descrição'}</p>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button onClick={(e) => handleEdit(t, e)} className="p-1.5 text-slate-400 hover:text-indigo-500"><Pencil className="w-4 h-4" /></button>
                                 <button onClick={(e) => handleDelete(t.id, e)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                              </div>
                           </div>
                           <div className="mt-3 flex gap-2">
                              {t.parameters.map(p => <span key={p} className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono">:{p}</span>)}
                           </div>
                        </div>
                     ))
                  )}
               </div>
            )}

            {view === 'create' && (
               <div className="space-y-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label>
                     <input type="text" value={newTemplate.name} onChange={e => setNewTemplate({...newTemplate, name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-500" placeholder="Ex: Busca Usuário por Email" />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">SQL (Use :param para variáveis)</label>
                     <textarea value={newTemplate.sql} onChange={e => setNewTemplate({...newTemplate, sql: e.target.value})} className="w-full h-32 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-cyan-500 resize-none" placeholder="SELECT * FROM users WHERE email = :email" />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                     <input type="text" value={newTemplate.description} onChange={e => setNewTemplate({...newTemplate, description: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-500" />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                     <button onClick={() => setView('list')} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm">Cancelar</button>
                     <button onClick={handleSave} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-bold flex items-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
                  </div>
               </div>
            )}

            {view === 'run' && selectedTemplate && (
               <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
                     <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2"><Code className="w-4 h-4" /> SQL Original</h4>
                     <code className="text-xs font-mono text-slate-600 dark:text-slate-400 block whitespace-pre-wrap">{selectedTemplate.sql}</code>
                  </div>
                  
                  <div className="space-y-3">
                     {selectedTemplate.parameters.length === 0 ? <p className="text-xs text-slate-500">Este template não requer parâmetros.</p> : 
                        selectedTemplate.parameters.map(param => (
                           <div key={param}>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{param}</label>
                              <input type="text" value={params[param]} onChange={e => setParams({...params, [param]: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500" placeholder={`Valor para ${param}`} />
                           </div>
                        ))
                     }
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                     <button onClick={() => setView('list')} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm">Voltar</button>
                     <button onClick={handleRun} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center gap-2"><Play className="w-4 h-4" /> Executar</button>
                  </div>
               </div>
            )}

         </div>
      </div>
    </div>
  );
};

export default TemplateModal;
