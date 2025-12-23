
export interface Column {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  references?: string; // e.g., "users.id"
}

export interface Table {
  name: string;
  schema: string; 
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

export interface IntersectionResult {
  count: number;
  sample: any[];
  tableA: string;
  columnA: string;
  tableB: string;
  columnB: string;
  matchPercentage?: number;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string; 
  detailedError?: string; 
  errorLine?: number; 
  correctedSql?: string;
}

export interface OptimizationAnalysis {
  rating: number; 
  summary: string;
  explanation: string;
  suggestedIndexes: string[];
  optimizedSql: string;
  improvementDetails: string;
}

export interface QueryResult {
  sql: string;
  explanation: string;
  tips?: string[];
  validation?: ValidationResult;
  optimization?: OptimizationAnalysis;
}

export type AppStep = 'connection' | 'builder' | 'preview' | 'results' | 'dashboard' | 'datadiff';

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
  selectedTables: string[]; 
  selectedColumns: string[]; 
  calculatedColumns?: CalculatedColumn[];
  aggregations: Record<string, AggregateFunction>; 
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
  beginnerMode: boolean; 
  advancedMode: boolean; 
  aiGenerationTimeout: number; 
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
  beginnerMode: true, 
  advancedMode: false, 
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

export interface QueryTemplate {
  id: string;
  name: string;
  sql: string;
  description?: string;
  parameters: string[]; 
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

export interface DiffRow {
  key: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  dataA?: any;
  dataB?: any;
  diffColumns: string[]; 
}

export interface VirtualRelation {
  id: string;
  sourceTable: string; 
  sourceColumn: string;
  targetTable: string; 
  targetColumn: string;
  confidence?: number; 
}

// Fixed: Added missing SAMPLE_SCHEMA export
export const SAMPLE_SCHEMA: DatabaseSchema = {
  name: 'Ecommerce_Sample',
  tables: [
    {
      name: 'users',
      schema: 'public',
      description: 'System users and customers',
      columns: [
        { name: 'id', type: 'integer', isPrimaryKey: true },
        { name: 'full_name', type: 'varchar' },
        { name: 'email', type: 'varchar' },
        { name: 'active', type: 'boolean' },
        { name: 'created_at', type: 'timestamp' }
      ]
    },
    {
      name: 'orders',
      schema: 'public',
      description: 'Customer purchase orders',
      columns: [
        { name: 'id', type: 'integer', isPrimaryKey: true },
        { name: 'user_id', type: 'integer', isForeignKey: true, references: 'public.users.id' },
        { name: 'total_amount', type: 'decimal' },
        { name: 'status', type: 'varchar' },
        { name: 'created_at', type: 'timestamp' }
      ]
    },
    {
      name: 'products',
      schema: 'public',
      description: 'Available products for sale',
      columns: [
        { name: 'id', type: 'integer', isPrimaryKey: true },
        { name: 'name', type: 'varchar' },
        { name: 'price', type: 'decimal' },
        { name: 'stock_qty', type: 'integer' },
        { name: 'category', type: 'varchar' }
      ]
    }
  ],
  connectionSource: 'simulated'
};
