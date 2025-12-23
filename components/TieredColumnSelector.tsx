
import React, { useMemo } from 'react';
import { DatabaseSchema, Table } from '../types';
import { ChevronRight } from 'lucide-react';

interface TieredColumnSelectorProps {
  value: string; // Format: "schema.table.column"
  onChange: (newValue: string) => void;
  schema: DatabaseSchema;
  availableTablesOnly?: string[]; // Optional: list of IDs to restrict selection
  className?: string;
  placeholder?: string;
}

const TieredColumnSelector: React.FC<TieredColumnSelectorProps> = ({ 
  value, 
  onChange, 
  schema, 
  availableTablesOnly,
  className = "",
  placeholder = "Selecione..."
}) => {
  // Parse current value
  const parts = value.split('.');
  const currentSchema = parts.length >= 3 ? parts[0] : (parts.length === 2 ? 'public' : '');
  const currentTable = parts.length >= 3 ? parts[1] : (parts.length === 2 ? parts[0] : '');
  const currentColumn = parts.length >= 3 ? parts[2] : (parts.length === 2 ? parts[1] : '');

  // 1. Get Schemas
  const allSchemas = useMemo(() => {
    const s = Array.from(new Set(schema.tables.map(t => t.schema || 'public'))).sort();
    return s;
  }, [schema.tables]);

  const showSchemaSelector = allSchemas.length > 1;

  // 2. Filter Tables by Schema
  const tablesForSchema = useMemo(() => {
    const targetSchema = currentSchema || (showSchemaSelector ? '' : 'public');
    let tables = schema.tables.filter(t => (t.schema || 'public') === targetSchema);
    
    if (availableTablesOnly && availableTablesOnly.length > 0) {
      tables = tables.filter(t => availableTablesOnly.includes(`${t.schema || 'public'}.${t.name}`));
    }
    
    return tables.sort((a, b) => a.name.localeCompare(b.name));
  }, [schema.tables, currentSchema, showSchemaSelector, availableTablesOnly]);

  // 3. Get Columns for Table
  const columnsForTable = useMemo(() => {
    const table = tablesForSchema.find(t => t.name === currentTable);
    return table ? [...table.columns].sort((a, b) => a.name.localeCompare(b.name)) : [];
  }, [tablesForSchema, currentTable]);

  const handleSchemaChange = (s: string) => {
    onChange(`${s}..`); // Reset table and column
  };

  const handleTableChange = (t: string) => {
    const s = currentSchema || (showSchemaSelector ? '' : 'public');
    onChange(`${s}.${t}.`); // Reset column
  };

  const handleColumnChange = (c: string) => {
    const s = currentSchema || (showSchemaSelector ? '' : 'public');
    onChange(`${s}.${currentTable}.${c}`);
  };

  const selectBaseClass = "text-xs bg-[#1e293b] border border-slate-700 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 shadow-inner appearance-none transition-all";

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {showSchemaSelector && (
        <div className="relative">
          <select 
            value={currentSchema} 
            onChange={(e) => handleSchemaChange(e.target.value)}
            className={`${selectBaseClass} min-w-[100px] hover:border-slate-500`}
          >
            <option value="">Schema</option>
            {allSchemas.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      <div className="relative">
        <select 
          value={currentTable} 
          onChange={(e) => handleTableChange(e.target.value)}
          className={`${selectBaseClass} min-w-[130px] hover:border-slate-500`}
        >
          <option value="">Tabela</option>
          {tablesForSchema.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
      </div>

      <ChevronRight className="w-3 h-3 text-slate-500 shrink-0 mx-0.5" />

      <div className="relative">
        <select 
          value={currentColumn} 
          onChange={(e) => handleColumnChange(e.target.value)}
          disabled={!currentTable}
          className={`${selectBaseClass} min-w-[150px] hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <option value="">Coluna</option>
          {columnsForTable.map(c => (
            <option key={c.name} value={c.name}>
              {c.isPrimaryKey ? '🔑 ' : ''}{c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default TieredColumnSelector;
