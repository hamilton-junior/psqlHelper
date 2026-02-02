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

export interface ServerStats {
  connections: number;
  maxConnections: number;
  dbSize: string;
  activeQueries: number;
  maxQueryDuration: string;
  transactionsCommit: number;
  transactionsRollback: number;
  cacheHitRate: string;
  tps: number;
  wraparoundAge: number;
  wraparoundPercent: number;
  statsReset?: string;
}

export interface StorageStats {
  partition: {
    total: number; // bytes
    used: number;  // bytes
    free: number;  // bytes
    percent: number;
    mount: string;
  };
  databases: Array<{
    name: string;
    size: number; // bytes
    prettySize: string;
  }>;
  dataDirectory: string;
}

export interface TableInsight {
  schema: string;
  name: string;
  totalSize: string;
  tableSize: string;
  indexSize: string;
  estimatedRows: number;
  deadTuples: number;
  lastVacuum?: string;
}

export interface UnusedIndex {
  schema: string;
  table: string;
  index: string;
  size: string;
}

export interface ActiveProcess {
  pid: number;
  user: string;
  clientAddr: string;
  duration: string;
  durationMs: number;
  state: string;
  query: string;
  waitEvent: string;
  waitEventType: string;
  isBlocked: boolean;
  blockingPids: number[];
  backendType: string;
}

export type AppStep = 'connection' | 'builder' | 'preview' | 'results' | 'datadiff' | 'dashboard' | 'serverhealth' | 'roadmap';

export interface AppSettings {
  geminiApiKey: string;
  enableAiGeneration: boolean;
  enableAiValidation: boolean;
  enableAiTips: boolean;
  beginnerMode: boolean; 
  advancedMode: boolean; 
  enableDmlSafety: boolean;
  blockDestructiveCommands: boolean;
  backgroundLoadLinks: boolean; 
  aiGenerationTimeout: number; 
  defaultDbHost: string;
  defaultDbPort: string;
  defaultDbUser: string;
  defaultDbName: string;
  defaultLimit: number;
  defaultDiffLimit: number; 
  defaultRowsPerPage: number;
  theme: 'light' | 'dark';
  updateBranch: 'stable' | 'main';
  storageQuotaTrigger: number; // Porcentagem para alerta de disco
}

export const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  enableAiGeneration: true,
  enableAiValidation: true,
  enableAiTips: true,
  beginnerMode: true, 
  advancedMode: false, 
  enableDmlSafety: true,
  blockDestructiveCommands: false,
  backgroundLoadLinks: true,
  aiGenerationTimeout: 3000,
  defaultDbHost: 'localhost',
  defaultDbPort: '5432',
  defaultDbUser: 'postgres',
  defaultDbName: '',
  defaultLimit: 100,
  defaultDiffLimit: 500, 
  defaultRowsPerPage: 10,
  theme: 'dark',
  updateBranch: 'stable',
  storageQuotaTrigger: 90
};

export interface QueryProfilingSnapshot {
  id: string;
  name: string;
  timestamp: number;
  sql: string;
  plan: any; // ExplainNode formatted or raw JSON
  metrics: {
    totalRuntime: number;
    planningTime: number;
    sharedReadBuffers?: number;
    sharedHitBuffers?: number;
    sharedWrittenBuffers?: number;
    tempReadBuffers?: number;
    tempWrittenBuffers?: number;
  };
}

export interface QueryResult {
  sql: string;
  explanation: string;
  tips?: string[];
  validation?: {
    isValid: boolean;
    error?: string;
    correctedSql?: string;
  };
}

export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

export interface ExplicitJoin {
  id: string;
  fromTable: string;
  fromColumn: string;
  type: JoinType;
  toTable: string;
  toColumn: string;
}

export type Operator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';

export interface Filter {
  id: string;
  column: string;
  operator: Operator;
  value: string;
}

export interface OrderBy {
  id: string;
  column: string;
  direction: 'ASC' | 'DESC';
}

export type AggregateFunction = 'NONE' | 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';

export interface CalculatedColumn {
  id: string;
  alias: string;
  expression: string;
}

export interface BuilderState {
  selectedTables: string[]; 
  selectedColumns: string[]; 
  aggregations: Record<string, AggregateFunction>; 
  joins: ExplicitJoin[];
  filters: Filter[];
  groupBy: string[];
  orderBy: OrderBy[];
  limit: number;
  calculatedColumns?: CalculatedColumn[];
}

export interface DashboardItem {
  id: string;
  title: string;
  type: string;
  data: any[];
  config: any;
  createdAt: number;
}

export interface VirtualRelation {
  id: string;
  sourceTable: string; 
  sourceColumn: string;
  targetTable: string; 
  targetColumn: string;
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
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  queryResult?: QueryResult;
  mockData?: any[];
}

export interface SavedQuery {
  id: string;
  name: string;
  createdAt: number;
  schemaName: string;
  state: BuilderState;
}

export interface OptimizationAnalysis {
  rating: number;
  summary: string;
  explanation: string;
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

export interface IntersectionResult {
  count: number;
  sample: any[];
  tableA: string;
  columnA: string;
  tableB: string;
  columnB: string;
  matchPercentage?: number;
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  rowCount: number;
  durationMs: number;
  status: 'success' | 'error';
  timestamp: number;
  schemaName: string;
}

export interface DiffRow {
  key: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  dataA?: any;
  dataB?: any;
  diffColumns: string[];
}

export interface QueryTemplate {
  id: string;
  name: string;
  sql: string;
  description?: string;
  parameters: string[];
}

export const SAMPLE_SCHEMA: DatabaseSchema = {
  name: 'E-Commerce Sample',
  connectionSource: 'simulated',
  tables: [
    {
      name: 'users',
      schema: 'public',
      columns: [
        { name: 'id', type: 'integer', isPrimaryKey: true },
        { name: 'name', type: 'varchar(100)' },
        { name: 'email', type: 'varchar(100)' },
        { name: 'created_at', type: 'timestamp' }
      ]
    },
    {
      name: 'orders',
      schema: 'public',
      columns: [
        { name: 'id', type: 'integer', isPrimaryKey: true },
        { name: 'user_id', type: 'integer', isForeignKey: true, references: 'public.users.id' },
        { name: 'amount', type: 'numeric(10,2)' },
        { name: 'status', type: 'varchar(20)' },
        { name: 'created_at', type: 'timestamp' }
      ]
    }
  ]
};