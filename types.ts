
export interface Column {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  references?: string; // e.g., "users.id"
}

export interface Table {
  name: string;
  schema: string; // New field for categorization
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
  error?: string; // Short technical error
  detailedError?: string; // Longer, helpful explanation
  errorLine?: number; // The line number where the error likely occurred
  correctedSql?: string;
}

export interface QueryResult {
  sql: string;
  explanation: string;
  tips?: string[];
  validation?: ValidationResult;
}

export type AppStep = 'connection' | 'builder' | 'preview' | 'results' | 'dashboard';

export type Operator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

export interface Filter {
  id: string;
  column: string;
  operator: Operator;
  value: string;
}

export type AggregateFunction = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'NONE';

export interface CalculatedColumn {
  id: string;
  alias: string;
  expression: string;
}

export interface ExplicitJoin {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: JoinType;
}

export interface OrderBy {
  id: string;
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface BuilderState {
  selectedTables: string[]; // "schema.table"
  selectedColumns: string[]; // "schema.table.column"
  calculatedColumns?: CalculatedColumn[];
  aggregations: Record<string, AggregateFunction>; // key is "schema.table.column"
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
  isError?: boolean;
  mockData?: any[];
}

export interface AppSettings {
  theme: 'light' | 'dark';
  enableAiGeneration: boolean;
  enableAiValidation: boolean;
  enableAiTips: boolean;
  aiGenerationTimeout: number; // ms
  defaultDbHost: string;
  defaultDbPort: string;
  defaultDbUser: string;
  defaultDbName: string;
  defaultLimit: number;
  defaultRowsPerPage: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  enableAiGeneration: true,
  enableAiValidation: true,
  enableAiTips: true,
  aiGenerationTimeout: 3000,
  defaultDbHost: 'localhost',
  defaultDbPort: '5432',
  defaultDbUser: 'postgres',
  defaultDbName: '',
  defaultLimit: 100,
  defaultRowsPerPage: 10
};

export interface DashboardItem {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'area';
  data: any[];
  config: {
    xAxis: string;
    yKeys: string[];
  };
  sql: string;
  createdAt: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  createdAt: number;
  schemaName: string;
  state: BuilderState;
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  timestamp: number;
  rowCount: number;
  durationMs: number;
  status: 'success' | 'error';
  schemaName: string;
}

export interface ExplainNode {
  type: string;
  relation?: string;
  rows: number;
  width: number;
  cost: {
    startup: number;
    total: number;
  };
  children?: ExplainNode[];
}

export const SAMPLE_SCHEMA: DatabaseSchema = {
  name: "ecommerce_sample",
  connectionSource: "simulated",
  tables: [
    {
      name: "users",
      schema: "public",
      description: "Tabela de usuários cadastrados",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "name", type: "VARCHAR(100)" },
        { name: "email", type: "VARCHAR(100)" },
        { name: "created_at", type: "TIMESTAMP" },
        { name: "country", type: "VARCHAR(50)" }
      ]
    },
    {
      name: "orders",
      schema: "public",
      description: "Pedidos realizados",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "user_id", type: "INTEGER", isForeignKey: true, references: "public.users.id" },
        { name: "total_amount", type: "DECIMAL(10,2)" },
        { name: "status", type: "VARCHAR(20)" },
        { name: "created_at", type: "TIMESTAMP" }
      ]
    },
    {
      name: "order_items",
      schema: "public",
      description: "Itens de cada pedido",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "order_id", type: "INTEGER", isForeignKey: true, references: "public.orders.id" },
        { name: "product_name", type: "VARCHAR(100)" },
        { name: "quantity", type: "INTEGER" },
        { name: "price", type: "DECIMAL(10,2)" }
      ]
    }
  ]
};
