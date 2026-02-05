
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
  const hasGlobalGroupBy = groupBy.length > 0;

  if (selectedColumns.length > 0) {
    selectItems = selectedColumns.map(col => {
      const agg = aggregations[col];
      if (agg && agg !== 'NONE') {
        const parts = col.split('.');
        const colName = parts[parts.length - 1];
        const alias = `${agg.toLowerCase()}_${colName}`;
        
        // Se houver agregações mas não houver Group By, o SQL falharia.
        // Convertemos para Window Function (OVER()) para permitir ver o agregado por linha.
        if (!hasGlobalGroupBy) {
           return `${agg}(${col}) OVER() AS ${alias}`;
        }
        return `${agg}(${col}) AS ${alias}`;
      }
      return col;
    });
  } else {
    // Se o usuário quer SELECT * mas existem colunas agregadas em fórmulas, 
    // o Postgres exigiria Group By de todos os campos. 
    // Para manter o SELECT * funcional, trataremos as fórmulas agregadas como Window Functions.
    selectItems.push('*');
  }

  if (calculatedColumns && calculatedColumns.length > 0) {
    calculatedColumns.forEach(calc => {
      let expr = calc.expression;
      
      // Heurística aprimorada para detectar agregadores em fórmulas: AVG, SUM, COUNT, MIN, MAX
      // Captura o nome da função e o conteúdo entre parênteses, cuidando para não duplicar OVER()
      const aggRegex = /\b(SUM|AVG|COUNT|MIN|MAX)\b\s*\(([^()]*|\([^()]*\))*\)/gi;
      
      if (aggRegex.test(expr) && !hasGlobalGroupBy && !/\bOVER\s*\(/i.test(expr)) {
         // Injeta OVER() após cada função de agregação detectada na string
         expr = expr.replace(/(\b(?:SUM|AVG|COUNT|MIN|MAX)\b\s*\((?:[^()]*|\([^()]*\))*\))/gi, '$1 OVER()');
      }
      
      selectItems.push(`(${expr}) AS "${calc.alias}"`);
    });
  }

  const selectClause = selectItems.join(',\n  ');

  // --- 2. FROM & JOIN Clause ---
  const primaryTableId = selectedTables[0];
  let fromClause = `FROM ${primaryTableId}`;
  const joinedTables = new Set<string>([primaryTableId]);
  let joinClauses: string[] = [];

  joins.forEach(join => {
    if (selectedTables.includes(join.fromTable) && selectedTables.includes(join.toTable)) {
       joinClauses.push(`${join.type} JOIN ${join.toTable} ON ${join.fromTable}.${join.fromColumn} = ${join.toTable}.${join.toColumn}`);
       joinedTables.add(join.fromTable);
       joinedTables.add(join.toTable);
    }
  });

  const remainingTables = selectedTables.filter(t => t !== primaryTableId);
  
  remainingTables.forEach(targetTableId => {
    const alreadyExplicitlyJoined = joins.some(j => 
      (j.fromTable === targetTableId && joinedTables.has(j.toTable)) || 
      (j.toTable === targetTableId && joinedTables.has(j.fromTable))
    );

    if (!alreadyExplicitlyJoined && !joinedTables.has(targetTableId)) {
       let foundLink = false;
       for (const existingTableId of Array.from(joinedTables)) {
          const tSchema = schema.tables.find(t => `${t.schema || 'public'}.${t.name}` === existingTableId);
          if (tSchema) {
             const fkCol = tSchema.columns.find(c => {
                 if (!c.isForeignKey || !c.references) return false;
                 const parts = c.references.split('.');
                 if (parts.length === 3) {
                    const [refSchema, refTable] = parts;
                    return `${refSchema}.${refTable}` === targetTableId;
                 } else {
                    const [refTable] = parts;
                    return targetTableId.endsWith(`.${refTable}`);
                 }
             });

             if (fkCol && fkCol.references) {
                const parts = fkCol.references.split('.');
                const targetColName = parts[parts.length - 1];
                joinClauses.push(`LEFT JOIN ${targetTableId} ON ${existingTableId}.${fkCol.name} = ${targetTableId}.${targetColName}`); 
                joinedTables.add(targetTableId);
                foundLink = true;
                break;
             }
          }
       }

       if (!foundLink) {
          const targetSchema = schema.tables.find(t => `${t.schema || 'public'}.${t.name}` === targetTableId);
          if (targetSchema) {
             for (const existingTableId of Array.from(joinedTables)) {
                const fkCol = targetSchema.columns.find(c => {
                   if (!c.isForeignKey || !c.references) return false;
                   const parts = c.references.split('.');
                   if (parts.length === 3) {
                      const [refSchema, refTable] = parts;
                      return `${refSchema}.${refTable}` === existingTableId;
                   } else {
                      const [refTable] = parts;
                      return existingTableId.endsWith(`.${refTable}`);
                   }
                });

                if (fkCol && fkCol.references) {
                   const parts = fkCol.references.split('.');
                   const targetColName = parts[parts.length - 1];
                   joinClauses.push(`LEFT JOIN ${targetTableId} ON ${targetTableId}.${fkCol.name} = ${existingTableId}.${targetColName}`);
                   joinedTables.add(targetTableId);
                   foundLink = true;
                   break;
                }
             }
          }
       }

       if (!foundLink) {
           const targetSimpleName = targetTableId.split('.')[1];
           const targetSchemaObj = schema.tables.find(t => getTableId(t) === targetTableId);
           if (targetSchemaObj) {
               for (const existingTableId of Array.from(joinedTables)) {
                   const existingSchemaObj = schema.tables.find(t => getTableId(t) === existingTableId);
                   if (existingSchemaObj) {
                       const linkingCol = existingSchemaObj.columns.find(c => c.name.toLowerCase() === targetSimpleName.toLowerCase());
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
      
      const isLike = f.operator === 'LIKE' || f.operator === 'ILIKE';
      
      // PostgreSQL requer literais de string para LIKE/ILIKE.
      // Sempre usamos aspas se for um operador de LIKE ou se não for um número válido.
      const val = (isLike || isNaN(Number(f.value)) || f.value === '') 
        ? `'${f.value}'` 
        : f.value;
      
      // Para usar LIKE/ILIKE em colunas não-texto (ex: bigint, int), aplicamos o cast para ::text
      const columnExpr = isLike ? `${f.column}::text` : f.column;
      
      return `${columnExpr} ${f.operator} ${val}`;
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
    explanation: "Consulta gerada localmente baseada na sua seleção manual.",
    tips: [] 
  };
};
