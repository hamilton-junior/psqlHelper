import React from 'react';
import { DatabaseSchema } from '../types';
import { Database, Table as TableIcon, Key, ArrowRight } from 'lucide-react';

interface SchemaViewerProps {
  schema: DatabaseSchema;
  onRegenerateClick: () => void;
}

const SchemaViewer: React.FC<SchemaViewerProps> = ({ schema, onRegenerateClick }) => {
  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
        <div className="flex items-center gap-2 text-slate-700">
          <Database className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-sm uppercase tracking-wider">Schema: {schema.name}</h2>
        </div>
        <button 
          onClick={onRegenerateClick}
          className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          Change DB
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {schema.tables.map((table) => (
          <div key={table.name} className="group">
            <div className="flex items-center gap-2 mb-2 text-slate-800 font-medium">
              <TableIcon className="w-4 h-4 text-slate-400" />
              <span>{table.name}</span>
            </div>
            <div className="pl-2 border-l-2 border-slate-100 ml-2 space-y-1">
              {table.columns.map((col) => (
                <div key={col.name} className="flex items-center text-xs text-slate-600 py-0.5 hover:bg-slate-50 rounded px-1">
                  <div className="w-4 mr-1 flex justify-center">
                    {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-500 transform rotate-45" />}
                    {col.isForeignKey && <ArrowRight className="w-3 h-3 text-blue-400" />}
                  </div>
                  <span className="font-mono text-slate-700 mr-2">{col.name}</span>
                  <span className="text-slate-400 text-[10px]">{col.type.toLowerCase()}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
        <p>Tip: Tables are linked via Foreign Keys (blue arrow).</p>
      </div>
    </div>
  );
};

export default SchemaViewer;