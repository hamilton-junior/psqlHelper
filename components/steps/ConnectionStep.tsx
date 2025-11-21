import React, { useState } from 'react';
import { DatabaseSchema, DbCredentials } from '../../types';
import { connectToDatabase } from '../../services/dbService';
import { Server, Shield, Info, Loader2, Database, AlertCircle } from 'lucide-react';

interface ConnectionStepProps {
  onSchemaLoaded: (schema: DatabaseSchema, credentials: DbCredentials) => void;
}

const ConnectionStep: React.FC<ConnectionStepProps> = ({ onSchemaLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('5432');
  const [user, setUser] = useState('postgres');
  const [password, setPassword] = useState('');
  const [dbName, setDbName] = useState('postgres');
  
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
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Server className="w-6 h-6 text-indigo-600" />
          Database Connection
        </h2>
        <p className="text-slate-500 mt-2">Connect to your local PostgreSQL database instance.</p>
      </div>

      <form onSubmit={handleConnect} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Host</label>
            <input 
              type="text" 
              value={host} 
              onChange={e => setHost(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              placeholder="localhost" 
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Username</label>
            <input 
              type="text" 
              value={user} 
              onChange={e => setUser(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              placeholder="postgres" 
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Database Name</label>
            <div className="relative">
               <Database className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
               <input 
                 type="text" 
                 value={dbName} 
                 onChange={e => setDbName(e.target.value)}
                 className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                 placeholder="e.g. ecommerce, analytics_db"
                 required 
               />
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              placeholder="••••••••" 
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Port</label>
            <input 
              type="number" 
              value={port} 
              onChange={e => setPort(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              placeholder="5432" 
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
           <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Shield className="w-4 h-4" />
              <span>Credentials stored locally only</span>
           </div>
           <div className="flex gap-3">
             <button 
               type="submit" 
               disabled={loading}
               className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
             >
               {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect to Local DB'}
             </button>
           </div>
        </div>
      </form>
      
      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-bold mb-1">Local Backend Required</p>
          <p>Ensure you are running the backend server in a separate terminal using <code>npm run server</code>.</p>
        </div>
      </div>
    </div>
  );
};

export default ConnectionStep;