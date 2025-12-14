
import { DatabaseSchema, BuilderState, Column } from '../types';

export type SimulationData = Record<string, any[]>;

// Constants for consistent data generation
const COUNTRIES = ['Brasil', 'USA', 'Portugal', 'Argentina', 'Canada'];
const CATEGORIES = ['Eletrônicos', 'Livros', 'Roupas', 'Casa', 'Esportes'];
const NAMES_FIRST = ['Ana', 'Bruno', 'Carlos', 'Daniela', 'Eduardo', 'Fernanda', 'Gabriel', 'Helena'];
const NAMES_LAST = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Lima', 'Ferreira'];

// Helper to generate realistic-looking data based on column definition
const generateValue = (col: Column, index: number, rowCount: number): any => {
  const name = col.name.toLowerCase();
  const type = col.type.toLowerCase();

  // Handle IDs and Grid
  if (name === 'id' || name === 'grid') {
    return index + 1;
  }

  // Handle Foreign Keys (Simulate relationship to other tables usually size 20)
  if (name.endsWith('_id') || name.endsWith('_grid')) {
    // Return a random ID between 1 and rowCount (assuming 20 rows for other tables)
    return Math.floor(Math.random() * 20) + 1;
  }

  // Handle Boolean
  if (type.includes('bool')) {
    return index % 2 === 0;
  }

  // Handle Numbers
  if (type.includes('int') || type.includes('serial') || type.includes('number')) {
    if (name.includes('stock') || name.includes('qty') || name.includes('quantity')) {
      return Math.floor(Math.random() * 50) + 1;
    }
    return Math.floor(Math.random() * 1000);
  }
  
  if (type.includes('decimal') || type.includes('numeric') || type.includes('float') || name.includes('price') || name.includes('amount')) {
     return parseFloat((Math.random() * 1000).toFixed(2));
  }

  // Handle Dates
  if (type.includes('date') || type.includes('time')) {
    const date = new Date();
    // Spread dates over the last year
    date.setDate(date.getDate() - Math.floor(Math.random() * 365));
    if (type.includes('date') && !type.includes('time')) {
        return date.toISOString().split('T')[0];
    }
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }

  // Handle Strings (Context-aware based on name)
  if (name.includes('email')) return `user${index + 1}@example.com`;
  if (name.includes('name')) {
    if (name.includes('prod') || name.includes('item')) return `Produto ${String.fromCharCode(65 + (index % 5))} - ${index + 1}`;
    if (name.includes('first')) return NAMES_FIRST[index % NAMES_FIRST.length];
    if (name.includes('last')) return NAMES_LAST[index % NAMES_LAST.length];
    return `${NAMES_FIRST[index % NAMES_FIRST.length]} ${NAMES_LAST[index % NAMES_LAST.length]}`;
  }
  if (name.includes('phone') || name.includes('tel')) return `(11) 9${1000 + index}-${1000 + index}`;
  if (name.includes('address') || name.includes('rua')) return `Rua Exemplo, ${index * 10}`;
  if (name.includes('city') || name.includes('cidade')) return ['São Paulo', 'Rio de Janeiro', 'Curitiba', 'Belo Horizonte'][index % 4];
  if (name.includes('state') || name.includes('estado')) return ['SP', 'RJ', 'PR', 'MG'][index % 4];
  if (name.includes('country')) return COUNTRIES[index % COUNTRIES.length]; // Repeating for Group By
  if (name.includes('status')) return ['Ativo', 'Inativo', 'Pendente', 'Concluído'][index % 4];
  if (name.includes('category') || name.includes('categoria')) return CATEGORIES[index % CATEGORIES.length]; // Repeating for Group By
  if (name.includes('description')) return `Descrição detalhada do item ${index + 1}...`;

  // Default String
  return `Valor ${index + 1}`;
};

export const initializeSimulation = (schema: DatabaseSchema): SimulationData => {
  const data: SimulationData = {};
  
  // Generate ~20 rows for each table
  const rowCount = 20;

  schema.tables.forEach(table => {
    // Use schema-qualified name as key to ensure uniqueness in simulation store
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

// --- Offline Query Engine Helpers ---

// Check if a row matches the filters
const rowMatchesFilters = (row: any, filters: any[]): boolean => {
  return filters.every(filter => {
    const [schema, tbl, col] = filter.column.split('.'); 
    // Handle 3-part keys (schema.table.col) which is the standard now
    // row keys are stored as "schema.table.col"
    
    let rowVal = row[filter.column];
    
    // Fallback for legacy keys if any
    if (rowVal === undefined) {
        // Try without schema if missing
        const shortKey = `${tbl}.${col}`;
        rowVal = row[shortKey];
    }
    
    // Safety check for null/undefined
    if (rowVal === undefined || rowVal === null) {
       return filter.operator === 'IS NULL';
    }

    const filterVal = filter.value;
    
    switch (filter.operator) {
      case '=': return String(rowVal) == String(filterVal);
      case '!=': return String(rowVal) != String(filterVal);
      case '>': return Number(rowVal) > Number(filterVal);
      case '<': return Number(rowVal) < Number(filterVal);
      case '>=': return Number(rowVal) >= Number(filterVal);
      case '<=': return Number(rowVal) <= Number(filterVal);
      case 'IS NULL': return rowVal === null;
      case 'IS NOT NULL': return rowVal !== null;
      case 'LIKE': 
      case 'ILIKE':
        return String(rowVal).toLowerCase().includes(String(filterVal).toLowerCase().replace(/%/g, ''));
      default: return true;
    }
  });
};

export const executeOfflineQuery = (
  schema: DatabaseSchema,
  data: SimulationData,
  state: BuilderState
): any[] => {
  const { selectedTables, selectedColumns, calculatedColumns, limit, aggregations, filters, groupBy, orderBy, joins } = state;
  
  if (selectedTables.length === 0) return [];

  // 1. Flatten / Join Data
  // Start with primary table rows
  const primaryTableId = selectedTables[0]; // "schema.table"
  
  if (!data[primaryTableId]) {
      console.warn(`Data for ${primaryTableId} not found in simulation.`);
      return [];
  }

  let resultRows = data[primaryTableId].map(row => {
    // Prefix keys with full table ID to avoid collisions
    const newRow: any = {};
    Object.keys(row).forEach(k => newRow[`${primaryTableId}.${k}`] = row[k]);
    return newRow;
  });

  // Handle explicit joins first if any
  // We iterate through remaining selected tables and try to join them
  for (let i = 1; i < selectedTables.length; i++) {
    const targetTableId = selectedTables[i]; // "schema.table"
    const targetData = data[targetTableId] || [];
    
    // Check if there is an Explicit Join defined for this table
    const explicitJoin = joins.find(j => 
       (j.toTable === targetTableId && selectedTables.includes(j.fromTable)) ||
       (j.fromTable === targetTableId && selectedTables.includes(j.toTable))
    );

    let joinColFrom = '';
    let joinColTo = '';
    let joinType = 'LEFT';

    if (explicitJoin) {
       if (explicitJoin.toTable === targetTableId) {
          joinColFrom = `${explicitJoin.fromTable}.${explicitJoin.fromColumn}`;
          joinColTo = `${explicitJoin.toTable}.${explicitJoin.toColumn}`;
       } else {
          joinColFrom = `${explicitJoin.toTable}.${explicitJoin.toColumn}`;
          joinColTo = `${explicitJoin.fromTable}.${explicitJoin.fromColumn}`;
       }
       joinType = explicitJoin.type;
    } else {
        // AUTO-JOIN LOGIC (Implicit)
        const targetSchema = schema.tables.find(t => `${t.schema || 'public'}.${t.name}` === targetTableId);
        
        if (targetSchema) {
           const joinedTablesIds = selectedTables.slice(0, i);
           
           for (const joinedId of joinedTablesIds) {
              const fk = targetSchema.columns.find(c => {
                  if (!c.isForeignKey || !c.references) return false;
                  const refParts = c.references.split('.');
                  if (refParts.length === 3) {
                      const refTableId = `${refParts[0]}.${refParts[1]}`;
                      return refTableId === joinedId;
                  }
                  return false;
              });

              if (fk) {
                 joinColTo = `${targetTableId}.${fk.name}`; // foreign key in target
                 joinColFrom = fk.references!; // primary key in source
                 break;
              }
           }
        }
    }

    // Perform Join Execution
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
            // Nulls for left join
            const joinedRow = { ...existingRow };
            const tSchema = schema.tables.find(t => `${t.schema || 'public'}.${t.name}` === targetTableId);
            if (tSchema) {
                tSchema.columns.forEach(c => joinedRow[`${targetTableId}.${c.name}`] = null);
            }
            return joinedRow;
         }
      });
    } else {
       // Cartesian Product Fallback
       resultRows = resultRows.map((existingRow, idx) => {
          const match = targetData[idx % targetData.length]; 
          const joinedRow = { ...existingRow };
          if (match) {
             Object.keys(match).forEach(k => joinedRow[`${targetTableId}.${k}`] = match[k]);
          }
          return joinedRow;
       });
    }
  }

  // 1.5. Calculate Columns (Scalar) - Enrich rows before filtering/grouping
  if (calculatedColumns && calculatedColumns.length > 0) {
     resultRows = resultRows.map(row => {
        const enriched = { ...row };
        calculatedColumns.forEach(calc => {
           try {
              let expr = calc.expression;
              // Sort keys by length desc to avoid partial replacement
              const availableKeys = Object.keys(row).sort((a,b) => b.length - a.length);
              
              for (const key of availableKeys) {
                 const colName = key.split('.').pop()!;
                 // Replace word-bounded column name with value
                 if (new RegExp(`\\b${colName}\\b`).test(expr)) {
                    const val = row[key];
                    const valStr = (typeof val === 'number') ? String(val) : 0; // Default to 0 for math safety
                    expr = expr.replace(new RegExp(`\\b${colName}\\b`, 'g'), String(valStr));
                 }
              }
              
              // Safe eval for math
              if (/^[0-9.+\-*/()\s]+$/.test(expr)) {
                 // eslint-disable-next-line no-new-func
                 const result = new Function(`return ${expr}`)(); 
                 enriched[calc.alias] = parseFloat(result.toFixed(2));
              } else {
                 enriched[calc.alias] = null;
              }
           } catch(e) {
              enriched[calc.alias] = null;
           }
        });
        return enriched;
     });
  }

  // 2. Filter
  if (filters.length > 0) {
     resultRows = resultRows.filter(row => rowMatchesFilters(row, filters));
  }

  // 3. Grouping & Aggregation
  const hasAggregations = Object.values(aggregations).some(a => a !== 'NONE');
  
  if (hasAggregations || groupBy.length > 0) {
     const groups: Record<string, any[]> = {};
     
     // Bucket rows
     resultRows.forEach(row => {
        const groupKey = groupBy.length > 0 
           ? groupBy.map(g => row[g]).join('::') 
           : 'ALL'; 
        
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(row);
     });

     // Calculate Aggregates per bucket
     resultRows = Object.keys(groups).map(key => {
        const rows = groups[key];
        const resultRow: any = {};
        
        // Add Group By Columns
        groupBy.forEach(g => {
           resultRow[g] = rows[0][g];
        });

        // Add Aggregated Columns
        selectedColumns.forEach(fullCol => {
           const agg = aggregations[fullCol];
           const colName = fullCol.split('.').pop()!;

           if (!agg || agg === 'NONE') {
              if (!resultRow[fullCol]) {
                 resultRow[fullCol] = rows[0][fullCol]; 
              }
           } else {
              const values = rows.map(r => r[fullCol]).filter(v => v !== null && v !== undefined);
              let val: any = 0;
              
              if (agg === 'COUNT') val = values.length;
              else if (agg === 'SUM') val = values.reduce((acc, curr) => acc + Number(curr), 0);
              else if (agg === 'AVG') val = values.length ? (values.reduce((acc, curr) => acc + Number(curr), 0) / values.length) : 0;
              else if (agg === 'MIN') val = values.length ? Math.min(...values.map(Number)) : null;
              else if (agg === 'MAX') val = values.length ? Math.max(...values.map(Number)) : null;
              
              if ((agg === 'AVG' || agg === 'SUM') && val !== null && !Number.isInteger(val)) {
                 val = parseFloat(val.toFixed(2));
              }

              resultRow[`${agg.toLowerCase()}_${colName}`] = val;
           }
        });
        
        // Add Calculated Columns (Aggregated?) 
        // Note: Complex logic omitted for simplicity, assumes scalar calculated columns are Grouped By or just picked from first row if not aggregated.
        calculatedColumns?.forEach(calc => {
           resultRow[calc.alias] = rows[0][calc.alias];
        });

        return resultRow;
     });
  } else {
     // No Aggregation: Map to Output Format
     let targetCols = selectedColumns;
     if (targetCols.length === 0) {
        if (resultRows.length > 0) {
           // Exclude system keys, only take full schema keys + calculated
           targetCols = Object.keys(resultRows[0]).filter(k => k.includes('.') || calculatedColumns?.some(c => c.alias === k));
        }
     }

     resultRows = resultRows.map(row => {
        const cleanRow: any = {};
        targetCols.forEach(fullCol => {
           const colName = fullCol.split('.').pop()!;
           cleanRow[colName] = row[fullCol] !== undefined ? row[fullCol] : null;
        });
        
        // Include Calculated Columns explicitly
        calculatedColumns?.forEach(calc => {
           cleanRow[calc.alias] = row[calc.alias];
        });

        return cleanRow;
     });
  }
  
  // 4. Order By
  if (orderBy.length > 0) {
     const sort = orderBy[0];
     let sortKey = sort.column.split('.').pop()!; 
     if (aggregations[sort.column]) {
        sortKey = `${aggregations[sort.column]!.toLowerCase()}_${sortKey}`;
     }
     
     resultRows.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        
        if (valA < valB) return sort.direction === 'ASC' ? -1 : 1;
        if (valA > valB) return sort.direction === 'ASC' ? 1 : -1;
        return 0;
     });
  }

  // 5. Limit
  return resultRows.slice(0, limit || 100);
};
