
import React, { useState } from 'react';
import { Database, Server, ShieldCheck, Loader2, AlertTriangle, Info, FileCode, Bot, Wand2, HardDrive } from 'lucide-react';
import { DatabaseSchema, SAMPLE_SCHEMA, DbCredentials } from '../types';
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
  
  // Simulation Options
  const [useOfflineSample, setUseOfflineSample] = useState(false);
  
  // DDL / File State
  const [ddlText, setDdlText] = useState('');

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'real' && !dbName) {
      alert("Please enter a Database Name");
      return;
    }

    setLoading(true);

    if (mode === 'simulation') {
      try {
        if (useOfflineSample) {
           // Offline Mode using Sample Schema
           const schema: DatabaseSchema = JSON.parse(JSON.stringify(SAMPLE_SCHEMA));
           // Simulate async
           await new Promise(r => setTimeout(r, 500));
           onSchemaLoaded(schema);
        } else {
           // AI Generation Mode
           if (!dbName) {
              alert("Por favor, insira um nome para o banco simulado.");
              setLoading(false);
              return;
           }
           const context = description || `A database named ${dbName}`;
           const schema = await generateSchemaFromTopic(dbName, context);
           schema.name = dbName;
           schema.connectionSource = 'simulated';
           onSchemaLoaded(schema);
        }
        onClose();
      } catch (error) {
        console.error(error);
        alert("Falha ao gerar simulação.");
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // For Real connection...
    try {
        // Just simulating the 'connect' action for this modal example since backend isn't linked here
        alert("Para conexão real, por favor use a tela principal de Conexão.");
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
                <Bot className="w-4 h-4" /> Simulação
             </div>
          </button>
          <button
            onClick={() => setMode('ddl')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors ${mode === 'ddl' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50'}`}
          >
             <div className="flex items-center justify-center gap-2">
                <FileCode className="w-4 h-4" /> DDL
             </div>
          </button>
        </div>

        {/* Form */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          
          {mode === 'simulation' && (
             <div className="space-y-4">
               {/* Mode Toggle */}
               <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                     <HardDrive className="w-4 h-4" />
                     <span className="font-medium">Modo Offline (Exemplo)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={useOfflineSample} 
                      onChange={(e) => setUseOfflineSample(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
               </div>

               {useOfflineSample ? (
                  <div className="p-4 bg-indigo-50 text-indigo-800 rounded-lg border border-indigo-100 flex gap-2 items-start text-xs">
                     <Info className="w-4 h-4 shrink-0 mt-0.5" />
                     <p>Um schema de exemplo completo (E-Commerce) será carregado instantaneamente. Nenhuma conexão com internet ou IA necessária.</p>
                  </div>
               ) : (
                  <>
                    <div className="p-3 bg-blue-50 text-blue-800 rounded-lg border border-blue-100 flex gap-2 items-start text-xs">
                       <Bot className="w-4 h-4 shrink-0 mt-0.5" />
                       <p>A IA irá gerar uma estrutura de banco fictícia baseada na sua descrição.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome do Banco</label>
                      <input 
                        type="text" 
                        value={dbName} 
                        onChange={(e) => setDbName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="ex: pizzaria_db"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Descrição / Contexto</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24"
                        placeholder="Ex: Sistema de gestão de biblioteca com livros e autores..."
                      />
                    </div>
                  </>
               )}
             </div>
          )}

          {mode === 'ddl' && (
             <div className="space-y-4">
                <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome do Banco</label>
                   <input 
                     type="text" 
                     value={dbName} 
                     onChange={(e) => setDbName(e.target.value)}
                     className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                     placeholder="MeuBanco"
                   />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Cole seu SQL DDL</label>
                  <textarea
                    value={ddlText}
                    onChange={(e) => setDdlText(e.target.value)}
                    placeholder="CREATE TABLE users..."
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
          )}

          {mode === 'real' && (
            <form onSubmit={handleConnect} className="space-y-5">
              <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome do Banco <span className="text-red-500">*</span></label>
                 <input 
                   type="text" 
                   value={dbName} 
                   onChange={(e) => setDbName(e.target.value)}
                   className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                   required
                 />
              </div>
              
              {/* Other connection fields would go here but simplified for modal */}

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
                  className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Conectar'}
                </button>
              </div>
            </form>
          )}

          {mode === 'simulation' && (
              <div className="pt-6 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConnect}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {useOfflineSample ? 'Carregando...' : 'Gerando...'}
                    </>
                  ) : (
                    useOfflineSample ? (
                      <>
                        <HardDrive className="w-4 h-4" />
                        Carregar
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Gerar com IA
                      </>
                    )
                  )}
                </button>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectModal;
