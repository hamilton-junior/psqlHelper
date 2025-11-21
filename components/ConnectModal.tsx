
import React, { useState } from 'react';
import { Database, Server, ShieldCheck, Loader2, AlertTriangle, Info, FileCode } from 'lucide-react';
import { DatabaseSchema } from '../types';
import { generateSchemaFromTopic, parseSchemaFromDDL } from '../services/geminiService';

interface ConnectModalProps {
  onClose: () => void;
  onSchemaLoaded: (schema: DatabaseSchema) => void;
}

const ConnectModal: React.FC<ConnectModalProps> = ({ onClose, onSchemaLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'simulating'>('idle');
  
  // DB Connection State
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('5432');
  const [user, setUser] = useState('postgres');
  const [password, setPassword] = useState('');
  const [dbName, setDbName] = useState('');
  const [description, setDescription] = useState('');
  
  // DDL / File State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ddlText, setDdlText] = useState('');

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbName) {
      alert("Please enter a Database Name");
      return;
    }

    setLoading(true);
    setConnectionStatus('connecting');

    // Simulate network delay for realism
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Fallback to AI Simulation because browser cannot connect to TCP
    setConnectionStatus('simulating');
    
    try {
      const context = description || `A database named ${dbName}`;
      const schema = await generateSchemaFromTopic(dbName, context);
      // Override name to match input
      schema.name = dbName;
      schema.connectionSource = 'simulated';
      onSchemaLoaded(schema);
    } catch (error) {
      console.error(error);
      alert("Could not simulate connection. Please try again.");
      setConnectionStatus('idle');
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
            <h3 className="text-lg font-bold text-white">New Connection</h3>
            <p className="text-xs text-slate-400">PostgreSQL Database</p>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          <form onSubmit={handleConnect} className="space-y-5">
            
            {/* Connection Settings */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                 <div className="col-span-2">
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Host / Address</label>
                   <div className="relative">
                     <Server className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                     <input 
                       type="text" 
                       value={host} 
                       onChange={(e) => setHost(e.target.value)}
                       className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                       placeholder="localhost"
                     />
                   </div>
                 </div>
                 <div className="col-span-1">
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Port</label>
                   <input 
                       type="text" 
                       value={port} 
                       onChange={(e) => setPort(e.target.value)}
                       className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-center"
                       placeholder="5432"
                   />
                 </div>
              </div>

              <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Database Name <span className="text-red-500">*</span></label>
                 <input 
                   type="text" 
                   value={dbName} 
                   onChange={(e) => setDbName(e.target.value)}
                   className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                   placeholder="e.g. library_db, finance_system"
                   required
                 />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Username</label>
                   <input 
                     type="text" 
                     value={user} 
                     onChange={(e) => setUser(e.target.value)}
                     className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                     placeholder="postgres"
                   />
                </div>
                <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Password</label>
                   <div className="relative">
                      <ShieldCheck className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder="••••••••"
                      />
                   </div>
                </div>
              </div>
              
              <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Business Description (Optional)
                    <span className="ml-2 font-normal text-slate-400 normal-case">Helps identify table structure</span>
                 </label>
                 <textarea
                   value={description}
                   onChange={(e) => setDescription(e.target.value)}
                   className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none h-20"
                   placeholder="e.g. A system to manage employee shifts, salaries, and departments."
                 />
              </div>
            </div>

            {/* Advanced / Fallback Toggle */}
            <div>
               <button 
                 type="button"
                 onClick={() => setShowAdvanced(!showAdvanced)}
                 className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1"
               >
                 {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced / Import Schema File'}
               </button>
               
               {showAdvanced && (
                 <div className="mt-3 p-3 bg-slate-50 rounded border border-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 flex items-center gap-2">
                       <FileCode className="w-3 h-3" />
                       Direct Schema Import (DDL)
                    </label>
                    <textarea
                      value={ddlText}
                      onChange={(e) => setDdlText(e.target.value)}
                      placeholder="CREATE TABLE..."
                      className="w-full h-24 p-2 text-[10px] font-mono border border-slate-300 rounded mb-2"
                    />
                    <button
                      type="button"
                      onClick={handleDdlImport}
                      disabled={!ddlText.trim() || loading}
                      className="w-full py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded hover:bg-slate-300"
                    >
                      Load from SQL
                    </button>
                 </div>
               )}
            </div>

            {/* Status Messages */}
            {connectionStatus === 'simulating' && (
               <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800">
                     <p className="font-bold">Direct Connection Limit</p>
                     <p>Browsers cannot connect to local TCP ports directly. We are using AI to infer your schema structure based on the details provided.</p>
                  </div>
               </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-70 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm hover:shadow"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {connectionStatus === 'connecting' ? 'Connecting...' : 'Loading Schema...'}
                  </>
                ) : (
                  'Connect'
                )}
              </button>
            </div>

          </form>
        </div>
        
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-400">
          <Info className="w-3 h-3" />
          <span>Secure Connection: Credentials are processed locally for schema context only.</span>
        </div>
      </div>
    </div>
  );
};

export default ConnectModal;
