
export interface Column {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  references?: string; // e.g., "users.id"
}

export interface Table {
  name: string;
  columns: Column[];
  description?: string;
}

export interface DatabaseSchema {
  name: string;
  tables: Table[];
  connectionSource?: 'ai' | 'ddl' | 'simulated' | 'real';
}

export interface DbCredentials {
  host: string;
  port: string;
  user: string;
  password?: string;
  database: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  correctedSql?: string;
}

export interface QueryResult {
  sql: string;
  explanation: string;
  tips?: string[];
  validation?: ValidationResult;
}

export type AppStep = 'connection' | 'builder' | 'preview' | 'results';

export type Operator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

export interface Filter {
  id: string;
  column: string;
  operator: Operator;
  value: string;
}

export interface ExplicitJoin {
  id: string;
  fromTable: string;
  fromColumn: string;
  type: JoinType;
  toTable: string;
  toColumn: string;
}

export interface OrderBy {
  id: string;
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface BuilderState {
  selectedTables: string[];
  selectedColumns: string[]; // Format: "tableName.columnName"
  joins: ExplicitJoin[];
  filters: Filter[];
  groupBy: string[];
  orderBy: OrderBy[];
  limit: number;
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  queryResult?: QueryResult;
  mockData?: any[];
  isError?: boolean;
}

export const SAMPLE_SCHEMA: DatabaseSchema = {
  name: "E-Commerce Sample",
  connectionSource: 'simulated',
  tables: [
    {
      name: "users",
      description: "Registered customers",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "email", type: "VARCHAR(255)" },
        { name: "created_at", type: "TIMESTAMP" },
        { name: "country", type: "VARCHAR(100)" }
      ]
    },
    {
      name: "orders",
      description: "Customer orders",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "user_id", type: "INTEGER", isForeignKey: true, references: "users.id" },
        { name: "total_amount", type: "DECIMAL(10,2)" },
        { name: "status", type: "VARCHAR(50)" },
        { name: "created_at", type: "TIMESTAMP" }
      ]
    },
    {
      name: "order_items",
      description: "Items within an order",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "order_id", type: "INTEGER", isForeignKey: true, references: "orders.id" },
        { name: "product_id", type: "INTEGER", isForeignKey: true, references: "products.id" },
        { name: "quantity", type: "INTEGER" },
        { name: "price_at_purchase", type: "DECIMAL(10,2)" }
      ]
    },
    {
      name: "products",
      description: "Product inventory",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "name", type: "VARCHAR(255)" },
        { name: "category", type: "VARCHAR(100)" },
        { name: "price", type: "DECIMAL(10,2)" },
        { name: "stock_level", type: "INTEGER" }
      ]
    }
  ]
};