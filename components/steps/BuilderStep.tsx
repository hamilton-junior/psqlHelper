
import React, { useState } from 'react';
import { DatabaseSchema, BuilderState } from '../../types';
import { Layers, CheckCircle2, ChevronRight, Settings2, RefreshCw, Search, X } from 'lucide-react';

interface BuilderStepProps {
  schema: DatabaseSchema;
  state: BuilderState;
  onStateChange: (state: BuilderState) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

const BuilderStep: React.FC<BuilderStepProps> = ({ schema, state, onStateChange, onGenerate, isGenerating }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const toggleTable = (tableName: string) => {
    const isSelected = state.selectedTables.includes(tableName);
    let newTables = [];
    if (isSelected) {
      newTables = state.selectedTables.filter(t => t !== tableName);
      // Remove columns from this table
      const newColumns = state.selectedColumns.filter(c => !c.startsWith(`${tableName}.`));
      onStateChange({ ...state, selectedTables: newTables, selectedColumns: newColumns });
    } else {
      newTables = [...state.selectedTables, tableName];
      onStateChange({ ...state, selectedTables: newTables });
    }
  };

  const toggleColumn = (tableName: string, colName: string) => {
    const fullId = `${tableName}.${colName}`;
    const isSelected = state.selectedColumns.includes(fullId);
    let newColumns = [];
    
    if (isSelected) {
      newColumns = state.selectedColumns.filter(c => c !== fullId);
    } else {
      newColumns = [...state.selectedColumns, fullId];
    }
    
    // Auto-select table if column selected
    let newTables = state.selectedTables;
    if (!state.selectedTables.includes(tableName)) {
      newTables = [...state.selectedTables, tableName];
    }

    onStateChange({ ...state, selectedTables: newTables, selectedColumns: newColumns });
  };

  const selectAllColumns = (tableName: string) => {
    const table = schema.tables.find(t => t.name === tableName);
    if (!table) return;
    
    const allCols = table.columns.map(c => `${tableName}.${c.name}`);
    // Add only ones not already present
    const newCols = Array.from(new Set([...state.selectedColumns, ...allCols]));
    
    let newTables = state.selectedTables;
    if (!state.selectedTables.includes(tableName)) {
      newTables = [...state.selectedTables, tableName];
    }
    
    onStateChange({ ...state, selectedTables: newTables, selectedColumns: newCols });
  };

  const filteredTables = schema.tables.filter(table => 
    table.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (table.description && table.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-end mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            Query Builder
          </h2>
          <p className="text-slate-500 mt-1">
            Connected to: <span className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{schema.name}</span>
          </p>
        </div>
      </div>

      {/* Main Builder Area */}
      <div className="flex-1 flex gap-6 min-h-0">
        
        {/* Table Selection */}
        <div className="w-1/3 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-100 font-semibold text-slate-700">
            Tables ({schema.tables.length})
          </div>
          
          {/* Search Input */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search tables..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
             {filteredTables.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm italic">
                  No tables match "{searchTerm}"
                </div>
             ) : (
               filteredTables.map(table => {
                 const isSelected = state.selectedTables.includes(table.name);
                 return (
                   <div 
                     key={table.name}
                     onClick={() => toggleTable(table.name)}
                     className={`p-3 rounded-lg cursor-pointer transition-all border ${
                       isSelected 
                        ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                        : 'hover:bg-slate-50 border-transparent'
                     }`}
                   >
                     <div className="flex items-center justify-between mb-1">
                       <span className={`font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                          {table.name}
                       </span>
                       {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                     </div>
                     <p className="text-xs text-slate-500 line-clamp-2">{table.description || 'No description'}</p>
                   </div>
                 )
               })
             )}
          </div>
        </div>

        {/* Column Selection */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
           <div className="p-4 bg-slate-50 border-b border-slate-100 font-semibold text-slate-700 flex justify-between items-center">
             <span>Column Selection</span>
             <span className="text-xs font-normal text-slate-500">
               {state.selectedColumns.length} selected
             </span>
           </div>
           <div className="flex-1 overflow-y-auto p-4">
             {state.selectedTables.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-400">
                 <Layers className="w-12 h-12 mb-3 opacity-20" />
                 <p>Select a table from the left to view columns</p>
               </div>
             ) : (
               <div className="space-y-6">
                 {state.selectedTables.map(tableName => {
                   const table = schema.tables.find(t => t.name === tableName);
                   if (!table) return null;
                   return (
                     <div key={tableName} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                       <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                         <h4 className="font-mono font-bold text-indigo-600 text-sm">{tableName}</h4>
                         <button 
                           onClick={() => selectAllColumns(tableName)}
                           className="text-[10px] uppercase font-bold text-slate-400 hover:text-indigo-600 tracking-wider"
                         >
                           Select All
                         </button>
                       </div>
                       <div className="grid grid-cols-2 gap-2">
                         {table.columns.map(col => {
                           const isChecked = state.selectedColumns.includes(`${tableName}.${col.name}`);
                           return (
                             <label 
                               key={col.name} 
                               className={`flex items-center p-2 rounded border cursor-pointer transition-all ${
                                 isChecked ? 'bg-indigo-50/50 border-indigo-200' : 'border-slate-100 hover:border-slate-200'
                               }`}
                             >
                               <input 
                                 type="checkbox"
                                 checked={isChecked}
                                 onChange={() => toggleColumn(tableName, col.name)}
                                 className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                               />
                               <span className="ml-2 text-sm font-mono text-slate-600">{col.name}</span>
                               <span className="ml-auto text-[10px] text-slate-400">{col.type}</span>
                             </label>
                           );
                         })}
                       </div>
                     </div>
                   );
                 })}
               </div>
             )}
           </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-6 bg-slate-800 text-white p-4 rounded-xl flex items-center justify-between shadow-lg">
         <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Selected Tables</span>
              <span className="font-mono text-xl font-bold">{state.selectedTables.length}</span>
            </div>
            <div className="w-px h-8 bg-slate-700"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Selected Columns</span>
              <span className="font-mono text-xl font-bold">{state.selectedColumns.length === 0 ? 'ALL (*)' : state.selectedColumns.length}</span>
            </div>
         </div>

         <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded border border-slate-700">
               <Settings2 className="w-4 h-4 text-slate-400" />
               <span className="text-xs text-slate-400">Limit:</span>
               <input 
                 type="number" 
                 value={state.limit}
                 onChange={(e) => onStateChange({...state, limit: parseInt(e.target.value) || 10})}
                 className="w-16 bg-transparent text-right font-mono text-sm outline-none focus:text-indigo-400"
               />
            </div>

            <button
              onClick={onGenerate}
              disabled={state.selectedTables.length === 0 || isGenerating}
              className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-indigo-900/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Building...
                </>
              ) : (
                <>
                  Preview & Execute Query
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
         </div>
      </div>
    </div>
  );
};

export default BuilderStep;
