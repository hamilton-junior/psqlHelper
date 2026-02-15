
import { DatabaseSchema, BuilderState, Column } from '../types';

export type SimulationData = Record<string, any[]>;

// Constants for consistent data generation
const COUNTRIES = ['Brasil', 'USA', 'Portugal', 'Argentina', 'Canada', 'Alemanha', 'Japão'];
const CATEGORIES = ['Eletrônicos', 'Livros', 'Roupas', 'Casa', 'Esportes', 'Beleza', 'Brinquedos'];
const DEPARTMENTS = ['Vendas', 'TI', 'RH', 'Financeiro', 'Marketing', 'Logística'];
const ACTIONS = ['INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'];
const STATUSES = ['Pendente', 'Pago', 'Enviado', 'Entregue', 'Cancelado'];
const NAMES_FIRST = ['Ana', 'Bruno', 'Carlos', 'Daniela', 'Eduardo', 'Fernanda', 'Gabriel', 'Helena', 'Igor', 'Julia'];
const NAMES_LAST = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Lima', 'Ferreira', 'Costa', 'Almeida'];
const COMPANIES = ['Tech Solutions', 'Global Imports', 'Soft House', 'Mega Varejo', 'LogiTrans', 'Green Foods'];

const generateValue = (col: Column, index: number, rowCount: number): any => {
  const name = col.name.toLowerCase();
  const type = col.type.toLowerCase();
  if (name === 'id' || name === 'grid') return index + 1;
  if (name.endsWith('_id') || name.endsWith('_grid') || name === 'performed_by') return Math.floor(Math.random() * rowCount) + 1;
  if (type.includes('bool')) return Math.random() < 0.8;
  if (type.includes('json')) return JSON.stringify({ key: `val_${index}` });
  if (type.includes('int') || type.includes('serial') || type.includes('number')) {
    if (name === 'rating') return Math.floor(Math.random() * 5) + 1;
    return Math.floor(Math.random() * 1000);
  }
  if (type.includes('decimal') || type.includes('numeric') || type.includes('float')) return parseFloat((10 + Math.random() * 500).toFixed(2));
  if (type.includes('date') || type.includes('time')) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 730));
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }
  if (name.includes('email')) return `user${index + 1}@example.com`;
  if (name.includes('name')) return `${NAMES_FIRST[index % NAMES_FIRST.length]} ${NAMES_LAST[index % NAMES_LAST.length]}`;
  if (name.includes('status')) return STATUSES[index % STATUSES.length];
  if (name.includes('country') || name.includes('pais')) return COUNTRIES[index % COUNTRIES.length];
  return `Valor ${index + 1}`;
};

export const initializeSimulation = (schema: DatabaseSchema): SimulationData => {
  console.log(`[SIMULATION] Inicializando base para: ${schema.name}`);
  const data: SimulationData = {};
  const rowCount = 40;
  schema.tables.forEach(table => {
    const tableKey = `${table.schema || 'public'}.${table.name}`;
    const rows = [];
    for (let i = 0; i < rowCount; i++) {
      const row: any = {};
      table.columns.forEach(col => {
        row[col.name] = generateValue(col, i, rowCount);
      });
      rows.push(row);
    }
    data[tableKey] = rows;
  });
  return data;
};

const rowMatchesFilters = (row: any, filters: any[]): boolean => {
  return filters.every(filter => {
    const rowVal = row[filter.column];
    if (rowVal === undefined || rowVal === null) return filter.operator === 'IS NULL';
    const filterVal = filter.value;
    switch (filter.operator) {
      case '=': return String(rowVal) == String(filterVal);
      case '!=': return String(rowVal) != String(filterVal);
      case '>': return Number(rowVal) > Number(filterVal);
      case '<': return Number(rowVal) < Number(filterVal);
      case '>=': return Number(rowVal) >= Number(filterVal);
      case '<=': return Number(rowVal) <= Number(filterVal);
      case 'LIKE': 
      case 'ILIKE': return String(rowVal).toLowerCase().includes(String(filterVal).toLowerCase().replace(/%/g, ''));
      default: return true;
    }
  });
};

/**
 * Motor de execução offline que respeita dados em "Staging" de transação
 */
export const executeOfflineQuery = (
  schema: DatabaseSchema,
  data: SimulationData,
  state: BuilderState,
  txStagedData?: SimulationData // Dados alterados na transação ativa
): any[] => {
  const { selectedTables, selectedColumns, calculatedColumns, limit, aggregations, filters, groupBy, orderBy, joins } = state;
  if (selectedTables.length === 0) return [];

  // Usar dados da transação se disponíveis, senão usar os dados base
  const getTableData = (tableId: string) => (txStagedData && txStagedData[tableId]) ? txStagedData[tableId] : data[tableId];

  const primaryTableId = selectedTables[0];
  const primaryData = getTableData(primaryTableId);
  if (!primaryData) return [];

  let resultRows = primaryData.map(row => {
    const newRow: any = {};
    Object.keys(row).forEach(k => newRow[`${primaryTableId}.${k}`] = row[k]);
    return newRow;
  });

  // Join Logic
  for (let i = 1; i < selectedTables.length; i++) {
    const targetTableId = selectedTables[i];
    const targetData = getTableData(targetTableId) || [];
    
    const explicitJoin = joins.find(j => (j.toTable === targetTableId && selectedTables.includes(j.fromTable)) || (j.fromTable === targetTableId && selectedTables.includes(j.toTable)));
    let joinColFrom = '', joinColTo = '';

    if (explicitJoin) {
       if (explicitJoin.toTable === targetTableId) {
          joinColFrom = `${explicitJoin.fromTable}.${explicitJoin.fromColumn}`;
          joinColTo = `${explicitJoin.toTable}.${explicitJoin.toColumn}`;
       } else {
          joinColFrom = `${explicitJoin.toTable}.${explicitJoin.toColumn}`;
          joinColTo = `${explicitJoin.fromTable}.${explicitJoin.fromColumn}`;
       }
    } else {
        const targetSchema = schema.tables.find(t => `${t.schema || 'public'}.${t.name}` === targetTableId);
        if (targetSchema) {
           const joinedTablesIds = selectedTables.slice(0, i);
           for (const joinedId of joinedTablesIds) {
              const fkForward = targetSchema.columns.find(c => c.isForeignKey && c.references && c.references.split('.')[0] + '.' + c.references.split('.')[1] === joinedId);
              if (fkForward) { joinColTo = `${targetTableId}.${fkForward.name}`; joinColFrom = fkForward.references!; break; }
           }
        }
    }

    if (joinColFrom && joinColTo) {
      resultRows = resultRows.map(existingRow => {
         const valFrom = existingRow[joinColFrom];
         const targetColName = joinColTo.split('.').pop()!;
         const match = targetData.find(r => String(r[targetColName]) === String(valFrom));
         if (match) {
            const joinedRow = { ...existingRow };
            Object.keys(match).forEach(k => joinedRow[`${targetTableId}.${k}`] = match[k]);
            return joinedRow;
         } else {
            const joinedRow = { ...existingRow };
            const tSchema = schema.tables.find(t => `${t.schema || 'public'}.${t.name}` === targetTableId);
            if (tSchema) tSchema.columns.forEach(c => joinedRow[`${targetTableId}.${c.name}`] = null);
            return joinedRow;
         }
      });
    }
  }

  // Calculated Columns
  if (calculatedColumns && calculatedColumns.length > 0) {
     resultRows = resultRows.map(row => {
        const enriched = { ...row };
        calculatedColumns.forEach(calc => {
           try {
              let expr = calc.expression;
              const availableKeys = Object.keys(row).sort((a,b) => b.length - a.length);
              for (const key of availableKeys) {
                 const colName = key.split('.').pop()!;
                 if (new RegExp(`\\b${colName}\\b`).test(expr)) {
                    const val = row[key];
                    expr = expr.replace(new RegExp(`\\b${colName}\\b`, 'g'), (typeof val === 'number') ? String(val) : '0');
                 }
              }
              if (/^[0-9.+\-*/()\s]+$/.test(expr)) {
                 const res = new Function(`return ${expr}`)(); 
                 enriched[calc.alias] = parseFloat(res.toFixed(2));
              }
           } catch(e) {}
        });
        return enriched;
     });
  }

  if (filters.length > 0) resultRows = resultRows.filter(row => rowMatchesFilters(row, filters));

  // Agregações
  const hasAggregations = Object.values(aggregations).some(a => a !== 'NONE');
  if (hasAggregations || groupBy.length > 0) {
     const groups: Record<string, any[]> = {};
     resultRows.forEach(row => {
        const groupKey = groupBy.length > 0 ? groupBy.map(g => row[g]).join('::') : 'ALL'; 
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(row);
     });
     resultRows = Object.keys(groups).map(key => {
        const rows = groups[key];
        const resultRow: any = {};
        groupBy.forEach(g => resultRow[g] = rows[0][g]);
        selectedColumns.forEach(fullCol => {
           const agg = aggregations[fullCol];
           const colName = fullCol.split('.').pop()!;
           if (!agg || agg === 'NONE') { if (!resultRow[fullCol]) resultRow[fullCol] = rows[0][fullCol]; } 
           else {
              const values = rows.map(r => r[fullCol]).filter(v => v !== null && v !== undefined);
              let val: any = 0;
              if (agg === 'COUNT') val = values.length;
              else if (agg === 'SUM') val = values.reduce((acc, curr) => acc + Number(curr), 0);
              else if (agg === 'AVG') val = values.length ? (values.reduce((acc, curr) => acc + Number(curr), 0) / values.length) : 0;
              else if (agg === 'MIN') val = values.length ? Math.min(...values.map(Number)) : null;
              else if (agg === 'MAX') val = values.length ? Math.max(...values.map(Number)) : null;
              resultRow[`${agg.toLowerCase()}_${colName}`] = val;
           }
        });
        return resultRow;
     });
  } else {
     let targetCols = selectedColumns.length > 0 ? selectedColumns : Object.keys(resultRows[0] || {}).filter(k => k.includes('.'));
     resultRows = resultRows.map(row => {
        const cleanRow: any = {};
        targetCols.forEach(fullCol => cleanRow[fullCol.split('.').pop()!] = row[fullCol] ?? null);
        calculatedColumns?.forEach(calc => cleanRow[calc.alias] = row[calc.alias]);
        return cleanRow;
     });
  }
  
  if (orderBy.length > 0) {
     const sort = orderBy[0];
     let sortKey = sort.column.split('.').pop()!; 
     resultRows.sort((a, b) => {
        const valA = a[sortKey] ?? a[sort.column];
        const valB = b[sortKey] ?? b[sort.column];
        return sort.direction === 'ASC' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
     });
  }

  return resultRows.slice(0, limit || 100);
};

/**
 * Simula a aplicação de um script de UPDATE em memória (Staging)
 */
export const applySimulationUpdate = (data: SimulationData, sql: string): SimulationData => {
  console.log("[SIMULATION] Aplicando modificações ao Shadow Staging...");
  const newData = JSON.parse(JSON.stringify(data));
  const updateMatch = sql.match(/UPDATE\s+([a-zA-Z0-9_.]+)\s+SET\s+(.+)\s+WHERE\s+(.+)\s*=/i);
  if (!updateMatch) return newData;

  const [_, tableName, setClause, pkName] = updateMatch;
  const tableKey = tableName.includes('.') ? tableName : `public.${tableName}`;
  const rows = newData[tableKey];
  if (!rows) return newData;

  // Extrair o valor da PK e os novos valores (simplificado para o construtor do app)
  const pkValueMatch = sql.match(/WHERE\s+"?[a-zA-Z0-9_]+"?.+\s*=\s*'?([a-zA-Z0-9_-]+)'?/i);
  const pkValue = pkValueMatch ? pkValueMatch[1] : null;

  if (pkValue && rows) {
    const cleanPkName = pkName.replace(/"/g, '').trim();
    const rowToUpdate = rows.find((r: any) => String(r[cleanPkName]) === String(pkValue));
    if (rowToUpdate) {
       const assignments = setClause.split(',');
       assignments.forEach(assign => {
          const [col, val] = assign.split('=').map(s => s.trim().replace(/"/g, '').replace(/'/g, ''));
          rowToUpdate[col] = val;
       });
    }
  }
  return newData;
};
