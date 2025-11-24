
import React, { useState } from 'react';
import { Database, Server, ShieldCheck, Loader2, AlertTriangle, Info, FileCode, Bot, Wand2 } from 'lucide-react';
import { DatabaseSchema } from '../types';
import { generateSchemaFromTopic, parseSchemaFromDDL } from '../services/geminiService';

interface ConnectModalProps {
  onClose: () => void;
  onSchemaLoaded: (schema: DatabaseSchema) => void;
}

type ConnectMode = 'real' | 'simulation' | 'ddl';

const ConnectModal: React.FC<ConnectModalProps> = ({ onClose, onSchemaLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ConnectMode>('real');
  
  // DB Connection State
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('5432');
  const [user, setUser] = useState('postgres');
  const [password, setPassword] = useState('');
  const [dbName, setDbName] = useState('');
  const [description, setDescription] = useState('');
  
  // DDL / File State
  const [ddlText, setDdlText] = useState('');

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbName) {
      alert("Please enter a Database Name");
      return;
    }

    setLoading(true);

    if (mode === 'simulation') {
      // Direct Simulation Mode
      try {
        const context = description || `A database named ${dbName}`;
        const schema = await generateSchemaFromTopic(dbName, context);
        schema.name = dbName;
        schema.connectionSource = 'simulated';
        onSchemaLoaded(schema);
        onClose(); // Close modal on success
      } catch (error) {
        console.error(error);
        alert("Falha ao gerar simulação.");
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // For Real connection in this modal context, we simulate the "Connect" action 
    // that would typically happen in ConnectionStep. 
    // Ideally this modal passes data back to the App to trigger a connection attempt.
    
    try {
        // Fallback for demo purposes if backend isn't actually reachable via this modal
        // In a full implementation, this would call connectToDatabase
        alert("Para conexão real, por favor use a tela principal de Conexão ou certifique-se que o backend está rodando.");
        onClose();
    } catch (error) {
       alert("Could not connect.");
    } finally {
       setLoading(false);
    }
  };

  const handleDdlImport = async () => {
    if (!ddlText.trim()) return;
    setLoading(true);
    try {
      const schema = await parseSchemaFromDDL(ddlText);
      if (dbName) schema.name = dbName;
      onSchemaLoaded(schema);
      onClose();
    } catch (error) {
      alert("Failed to parse schema.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-800 p-4 flex items-center gap-3 border-b border-slate-700">
          <div className="p-2 bg-indigo-500 rounded-lg">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Nova Conexão</h3>
            <p className="text-xs text-slate-400">Configurar Fonte de Dados</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setMode('real')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors ${mode === 'real' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50'}`}
          >
             <div className="flex items-center justify-center gap-2">
                <Server className="w-4 h-4" /> Real
             </div>
          </button>
          <button
            onClick={() => setMode('simulation')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors ${mode === 'simulation' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50'}`}
          >
             <div className="flex items-center justify-center gap-2">
                <Bot className="w-4 h-4" /> Simulação (IA)
             </div>
          </button>
          <button
            onClick={() => setMode('ddl')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors ${mode === 'ddl' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50'}`}
          >
             <div className="flex items-center justify-center gap-2">
                <FileCode className="w-4 h-4" /> DDL / SQL
             </div>
          </button>
        </div>

        {/* Form */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          
          {mode === 'simulation' && (
            <div className="mb-4 p-3 bg-indigo-50 text-indigo-800 rounded-lg border border-indigo-100 flex gap-2 items-start">
               <Bot className="w-5 h-5 shrink-0 mt-0.5" />
               <div className="text-xs">
                  <p className="font-bold">Modo de Simulação Ativo</p>
                  <p>A IA irá gerar uma estrutura de banco de dados fictícia baseada no nome e descrição que você fornecer. Perfeito para testes rápidos sem backend.</p>
               </div>
            </div>
          )}

          {mode === 'ddl' ? (
             <div className="space-y-4">
                <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome do Banco (Para referência)</label>
                   <input 
                     type="text" 
                     value={dbName} 
                     onChange={(e) => setDbName(e.target.value)}
                     className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                     placeholder="MeuBanco"
                   />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Cole seu SQL DDL (CREATE TABLE...)</label>
                  <textarea
                    value={ddlText}
                    onChange={(e) => setDdlText(e.target.value)}
                    placeholder="CREATE TABLE users (id SERIAL PRIMARY KEY...);"
                    className="w-full h-40 p-3 text-xs font-mono border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
                </div>
                <button
                  onClick={handleDdlImport}
                  disabled={!ddlText.trim() || loading}
                  className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-70 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Importar Schema'}
                </button>
             </div>
          ) : (
            <form onSubmit={handleConnect} className="space-y-5">
              
              {/* Common Fields */}
              <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome do Banco <span className="text-red-500">*</span></label>
                 <input 
                   type="text" 
                   value={dbName} 
                   onChange={(e) => setDbName(e.target.value)}
                   className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                   placeholder={mode === 'simulation' ? "ex: startup_saas, pizzaria_delivery" : "ex: postgres"}
                   required
                 />
              </div>

              {/* Real Connection Fields Only */}
              {mode === 'real' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-3 gap-4">
                     <div className="col-span-2">
                       <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Host</label>
                       <div className="relative">
                         <Server className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                         <input 
                           type="text" 
                           value={host} 
                           onChange={(e) => setHost(e.target.value)}
                           className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                           placeholder="localhost"
                         />
                       </div>
                     </div>
                     <div className="col-span-1">
                       <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Porta</label>
                       <input 
                           type="text" 
                           value={port} 
                           onChange={(e) => setPort(e.target.value)}
                           className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm text-center"
                           placeholder="5432"
                       />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Usuário</label>
                       <input 
                         type="text" 
                         value={user} 
                         onChange={(e) => setUser(e.target.value)}
                         className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm"
                         placeholder="postgres"
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Senha</label>
                       <div className="relative">
                          <ShieldCheck className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                          <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm"
                            placeholder="••••••••"
                          />
                       </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Description Field (Important for Simulation) */}
              <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    {mode === 'simulation' ? 'Contexto do Negócio (Para a IA)' : 'Descrição (Opcional)'}
                 </label>
                 <textarea
                   value={description}
                   onChange={(e) => setDescription(e.target.value)}
                   className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none h-20"
                   placeholder={mode === 'simulation' ? "Ex: Um sistema de biblioteca com livros, autores e empréstimos..." : "Descrição para ajudar a identificar as tabelas..."}
                   required={mode === 'simulation'}
                 />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 py-2.5 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-sm hover:shadow ${mode === 'simulation' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-700 hover:bg-slate-800'}`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {mode === 'simulation' ? 'Gerando...' : 'Conectando...'}
                    </>
                  ) : (
                    mode === 'simulation' ? (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Criar Simulação
                      </>
                    ) : 'Conectar'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
        
        {mode === 'real' && (
           <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-400">
             <AlertTriangle className="w-3 h-3 text-amber-500" />
             <span>Requer backend rodando localmente (npm run server).</span>
           </div>
        )}
      </div>
    </div>
  );
};

export default ConnectModal;