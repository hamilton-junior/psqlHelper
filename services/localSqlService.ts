

import { BuilderState, DatabaseSchema, QueryResult, ExplicitJoin } from '../types';

// Helper to ensure consistent ID generation
const getTableId = (t: any) => `${t.schema || 'public'}.${t.name}`;

export const generateLocalSql = (schema: DatabaseSchema, state: BuilderState): QueryResult => {
  const { selectedTables, selectedColumns, calculatedColumns, aggregations, joins, filters, groupBy, orderBy, limit } = state;

  if (selectedTables.length === 0) {
    throw new Error("Nenhuma tabela selecionada.");
  }

  // --- 1. SELECT Clause ---
  let selectItems: string[] = [];

  // Standard Columns
  if (selectedColumns.length > 0) {
    selectItems = selectedColumns.map(col => {
      const agg = aggregations[col];
      if (agg && agg !== 'NONE') {
        // extract col name from "schema.table.col"
        const parts = col.split('.');
        const colName = parts[parts.length - 1];
        const alias = `${agg.toLowerCase()}_${colName}`;
        return `${agg}(${col}) AS ${alias}`;
      }
      return col;
    });
  } else {
    selectItems.push('*');
  }

  // Calculated Columns (Feature #5)
  if (calculatedColumns && calculatedColumns.length > 0) {
    calculatedColumns.forEach(calc => {
      // Ensure formula doesn't break SQL (basic sanitation)
      selectItems.push(`(${calc.expression}) AS "${calc.alias}"`);
    });
  }

  const selectClause = selectItems.join(',\n  ');

  // --- 2. FROM & JOIN Clause ---
  // selectedTables contains strings like "schema.table"
  const primaryTableId = selectedTables[0];
  let fromClause = `FROM ${primaryTableId}`;
  const joinedTables = new Set<string>([primaryTableId]);
  let joinClauses: string[] = [];

  // 2a. Process Explicit Joins first
  joins.forEach(join => {
    // Only process if both tables are in the selection list to avoid weird partial SQL
    if (selectedTables.includes(join.fromTable) && selectedTables.includes(join.toTable)) {
       joinClauses.push(`${join.type} JOIN ${join.toTable} ON ${join.fromTable}.${join.fromColumn} = ${join.toTable}.${join.toColumn}`);
       joinedTables.add(join.fromTable);
       joinedTables.add(join.toTable);
    }
  });

  // 2b. Implicit Auto-Join (Local FK Logic) for tables not yet joined
  // ... (Keep existing Auto-Join logic, it is good) ...
  const tablesToAutoJoin = selectedTables.filter(t => !joinedTables.has(t) && t !== primaryTableId);
  const remainingTables = selectedTables.filter(t => t !== primaryTableId);
  
  remainingTables.forEach(targetTableId => {
    // Check if we already covered this in explicit joins
    const alreadyExplicitlyJoined = joins.some(j => 
      (j.fromTable === targetTableId && joinedTables.has(j.toTable)) || 
      (j.toTable === targetTableId && joinedTables.has(j.fromTable))
    );

    if (!alreadyExplicitlyJoined && !joinedTables.has(targetTableId)) {
       // Look for FK in Schema
       let foundLink = false;
       
       // Try to find a link from an existing table TO the target table
       for (const existingTableId of Array.from(joinedTables)) {
          // Find actual Table object using fully qualified match
          const tSchema = schema.tables.find(t => `${t.schema || 'public'}.${t.name}` === existingTableId);
          if (tSchema) {
             const fkCol = tSchema.columns.find(c => {
                 if (!c.isForeignKey || !c.references) return false;
                 
                 // Handle new 3-part references (schema.table.col)
                 const parts = c.references.split('.');
                 
                 if (parts.length === 3) {
                    const [refSchema, refTable] = parts;
                    const refTableId = `${refSchema}.${refTable}`;
                    // Exact match on Fully Qualified ID to avoid schema collision
                    return refTableId === targetTableId;
                 } else {
                    // Legacy/Simulated fallback
                    const [refTable] = parts;
                    return targetTableId.endsWith(`.${refTable}`);
                 }
             });

             if (fkCol && fkCol.references) {
                // Determine the target column name strictly
                const parts = fkCol.references.split('.');
                const targetColName = parts[parts.length - 1]; // Last part is always column
                
                // SQL Construction: JOIN targetTable ON existing.fk = targetTable.pk
                joinClauses.push(`LEFT JOIN ${targetTableId} ON ${existingTableId}.${fkCol.name} = ${targetTableId}.${targetColName}`); 
                joinedTables.add(targetTableId);
                foundLink = true;
                break;
             }
          }
       }

       // If not found, try to find a link FROM the target table TO an existing table
       if (!foundLink) {
          const targetSchema = schema.tables.find(t => `${t.schema || 'public'}.${t.name}` === targetTableId);
          if (targetSchema) {
             for (const existingTableId of Array.from(joinedTables)) {
                const fkCol = targetSchema.columns.find(c => {
                   if (!c.isForeignKey || !c.references) return false;
                   
                   const parts = c.references.split('.');
                   if (parts.length === 3) {
                      const [refSchema, refTable] = parts;
                      const refTableId = `${refSchema}.${refTable}`;
                      // Check if this FK points to the existing table
                      return refTableId === existingTableId;
                   } else {
                      const [refTable] = parts;
                      return existingTableId.endsWith(`.${refTable}`);
                   }
                });

                if (fkCol && fkCol.references) {
                   // Determine the target column name (on the existing table)
                   const parts = fkCol.references.split('.');
                   const targetColName = parts[parts.length - 1];

                   // SQL Construction: JOIN targetTable ON targetTable.fk = existing.pk
                   joinClauses.push(`LEFT JOIN ${targetTableId} ON ${targetTableId}.${fkCol.name} = ${existingTableId}.${targetColName}`);
                   joinedTables.add(targetTableId);
                   foundLink = true;
                   break;
                }
             }
          }
       }

       // --- Heuristic 1: Table Name match Column Name (e.g. movto.produto -> produto.grid) ---
       if (!foundLink) {
           const targetSimpleName = targetTableId.split('.')[1]; // 'produto'
           const targetSchemaObj = schema.tables.find(t => getTableId(t) === targetTableId);

           if (targetSchemaObj) {
               // Try to find if any existing table has a column named exactly like the target table
               for (const existingTableId of Array.from(joinedTables)) {
                   const existingSchemaObj = schema.tables.find(t => getTableId(t) === existingTableId);
                   if (existingSchemaObj) {
                       // Does existing table have column 'produto'?
                       const linkingCol = existingSchemaObj.columns.find(c => c.name.toLowerCase() === targetSimpleName.toLowerCase());
                       
                       // Priority: 'grid' > PK > 'id'
                       const targetPk = targetSchemaObj.columns.find(c => c.name.toLowerCase() === 'grid') 
                                     || targetSchemaObj.columns.find(c => c.isPrimaryKey) 
                                     || targetSchemaObj.columns.find(c => c.name.toLowerCase() === 'id');

                       if (linkingCol && targetPk) {
                           joinClauses.push(`LEFT JOIN ${targetTableId} ON ${existingTableId}.${linkingCol.name} = ${targetTableId}.${targetPk.name}`);
                           joinedTables.add(targetTableId);
                           foundLink = true;
                           break;
                       }
                   }
               }
           }
       }

       // --- Heuristic 2: Reverse Table Name match (e.g. produto.movto -> movto.grid) ---
       if (!foundLink) {
           const targetSchemaObj = schema.tables.find(t => getTableId(t) === targetTableId);
           if (targetSchemaObj) {
               for (const existingTableId of Array.from(joinedTables)) {
                   const existingSimpleName = existingTableId.split('.')[1];
                   const existingSchemaObj = schema.tables.find(t => getTableId(t) === existingTableId);

                   if (existingSchemaObj) {
                        // Does target table have column 'movto'?
                        const linkingCol = targetSchemaObj.columns.find(c => c.name.toLowerCase() === existingSimpleName.toLowerCase());
                        
                        // Priority: 'grid' > PK > 'id'
                        const existingPk = existingSchemaObj.columns.find(c => c.name.toLowerCase() === 'grid')
                                        || existingSchemaObj.columns.find(c => c.isPrimaryKey)
                                        || existingSchemaObj.columns.find(c => c.name.toLowerCase() === 'id');

                        if (linkingCol && existingPk) {
                            joinClauses.push(`LEFT JOIN ${targetTableId} ON ${targetTableId}.${linkingCol.name} = ${existingTableId}.${existingPk.name}`);
                            joinedTables.add(targetTableId);
                            foundLink = true;
                            break;
                        }
                   }
               }
           }
       }

       // --- Heuristic 3: Shared Name Logic (e.g. abast.abastecimento = movto.abastecimento) ---
       if (!foundLink) {
          const targetName = targetTableId.split('.')[1]; // get table name part
          // Find any existing table with the same name but different schema
          const existingMatchId = Array.from(joinedTables).find(jid => jid.split('.')[1] === targetName);

          if (existingMatchId) {
             const targetSchemaObj = schema.tables.find(t => getTableId(t) === targetTableId);
             const existingSchemaObj = schema.tables.find(t => getTableId(t) === existingMatchId);

             if (targetSchemaObj && existingSchemaObj) {
                // Try finding common 'grid', 'id' or PK
                const hasGridTarget = targetSchemaObj.columns.find(c => c.name.toLowerCase() === 'grid');
                const hasGridExisting = existingSchemaObj.columns.find(c => c.name.toLowerCase() === 'grid');

                if (hasGridTarget && hasGridExisting) {
                    joinClauses.push(`INNER JOIN ${targetTableId} ON ${existingMatchId}.grid = ${targetTableId}.grid`);
                    joinedTables.add(targetTableId);
                    foundLink = true;
                } else {
                    const hasIdTarget = targetSchemaObj.columns.find(c => c.name.toLowerCase() === 'id');
                    const hasIdExisting = existingSchemaObj.columns.find(c => c.name.toLowerCase() === 'id');

                    if (hasIdTarget && hasIdExisting) {
                        joinClauses.push(`INNER JOIN ${targetTableId} ON ${existingMatchId}.id = ${targetTableId}.id`);
                        joinedTables.add(targetTableId);
                        foundLink = true;
                    } else {
                        // Try PKs
                        const targetPk = targetSchemaObj.columns.find(c => c.isPrimaryKey);
                        const existingPk = existingSchemaObj.columns.find(c => c.isPrimaryKey);
                        if (targetPk && existingPk && targetPk.name === existingPk.name) {
                            joinClauses.push(`INNER JOIN ${targetTableId} ON ${existingMatchId}.${existingPk.name} = ${targetTableId}.${targetPk.name}`);
                            joinedTables.add(targetTableId);
                            foundLink = true;
                        }
                    }
                }
             }
          }
       }

       // Fallback: Cross Join (Comma) if no relationship found
       if (!foundLink) {
          fromClause += `, ${targetTableId}`;
          joinedTables.add(targetTableId);
       }
    }
  });


  // --- 3. WHERE Clause ---
  let whereClause = "";
  if (filters.length > 0) {
    const conditions = filters.map(f => {
      if (f.operator === 'IS NULL' || f.operator === 'IS NOT NULL') {
        return `${f.column} ${f.operator}`;
      }
      const val = !isNaN(Number(f.value)) ? f.value : `'${f.value}'`; // Simple quote logic
      return `${f.column} ${f.operator} ${val}`;
    });
    whereClause = `WHERE ${conditions.join(' AND ')}`;
  }

  // --- 4. GROUP BY ---
  let groupByClause = "";
  if (groupBy.length > 0) {
    groupByClause = `GROUP BY ${groupBy.join(', ')}`;
  }

  // --- 5. ORDER BY ---
  let orderByClause = "";
  if (orderBy.length > 0) {
    const orders = orderBy.map(o => `${o.column} ${o.direction}`);
    orderByClause = `ORDER BY ${orders.join(', ')}`;
  }

  // --- Assembly ---
  const sql = `SELECT ${selectClause}
${fromClause}
${joinClauses.length > 0 ? joinClauses.join('\n') : ''}
${whereClause}
${groupByClause}
${orderByClause}
LIMIT ${limit};`.trim();

  const cleanSql = sql.replace(/\n\s*\n/g, '\n');

  return {
    sql: cleanSql,
    explanation: "Consulta gerada localmente baseada na sua seleção manual. O modo offline não fornece explicações detalhadas de lógica.",
    tips: [] 
  };
};