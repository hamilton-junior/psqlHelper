
import React, { useState, useEffect } from 'react';
import { DatabaseSchema, DbCredentials, AppSettings } from '../../types';
import { connectToDatabase } from '../../services/dbService';
import { Server, Shield, Info, Loader2, Database, AlertCircle } from 'lucide-react';

interface ConnectionStepProps {
  onSchemaLoaded: (schema: DatabaseSchema, credentials: DbCredentials) => void;
  settings: AppSettings;
}

const ConnectionStep: React.FC<ConnectionStepProps> = ({ onSchemaLoaded, settings }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [host, setHost] = useState(settings.defaultDbHost);
  const [port, setPort] = useState(settings.defaultDbPort);
  const [user, setUser] = useState(settings.defaultDbUser);
  const [password, setPassword] = useState('');
  const [dbName, setDbName] = useState(settings.defaultDbName);
  
  // Update fields if settings change externally (e.g. reset)
  useEffect(() => {
    setHost(settings.defaultDbHost);
    setPort(settings.defaultDbPort);
    setUser(settings.defaultDbUser);
    setDbName(settings.defaultDbName);
  }, [settings]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbName) return;

    setLoading(true);
    setError('');

    const creds: DbCredentials = {
      host,
      port,
      user,
      password,
      database: dbName
    };

    try {
      const schema = await connectToDatabase(creds);
      onSchemaLoaded(schema, creds);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Connection failed. Ensure server.js is running on port 3000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Server className="w-6 h-6 text-indigo-600" />
          Conexão ao Banco de Dados
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Conecte-se a instância de seu Banco de DadosPostgreSQL local.</p>
      </div>

      <form onSubmit={handleConnect} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Host</label>
            <input 
              type="text" 
              value={host} 
              onChange={e => setHost(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
              placeholder="localhost" 
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Usuário</label>
            <input 
              type="text" 
              value={user} 
              onChange={e => setUser(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
              placeholder="postgres" 
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Nome do Banco de Dados</label>
            <div className="relative">
               <Database className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
               <input 
                 type="text" 
                 value={dbName} 
                 onChange={e => setDbName(e.target.value)}
                 className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
                 placeholder="e.g. ecommerce, analytics_db"
                 required 
               />
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Senha</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
              placeholder="••••••••" 
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Porta</label>
            <input 
              type="number" 
              value={port} 
              onChange={e => setPort(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
              placeholder="5432" 
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100 dark:border-red-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
           <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Shield className="w-4 h-4" />
              <span>Credenciais salvas apenas localmente.</span>
           </div>
           <div className="flex gap-3">
             <button 
               type="submit" 
               disabled={loading}
               className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2"
             >
               {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Conectar ao BD Local'}
             </button>
           </div>
        </div>
      </form>
      
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <p className="font-bold mb-1">Backend Local Necessário!</p>
          <p>Certifique-se que você está rodando o servidor backend em um terminal diferente utilizando <code>npm run server</code>.</p>
        </div>
      </div>
    </div>
  );
};

export default ConnectionStep;
