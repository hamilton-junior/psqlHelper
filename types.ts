
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

export interface DatabaseObject {
  id: string;
  name: string;
  schema: string;
  type: 'function' | 'trigger' | 'procedure' | 'view' | 'mview';
  definition: string;
  returnType?: string;
  args?: string;
  tableName?: string; // Para triggers
  isSanitized?: boolean; // Indica se continha bytes inválidos
}

export interface DbCredentials {
  host: string;
  port: string;
  user: string;
  password?: string;
  database: string;
  color?: string; // Hex ou classe de cor para o contexto
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
  blockingPids: number[];
  backendType: string;
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

export type AppStep = 'connection' | 'builder' | 'preview' | 'results' | 'datadiff' | 'dashboard' | 'serverhealth' | 'roadmap' | 'queryflow' | 'objects';

export type ResultTab = 'table' | 'terminal' | 'chart' | 'analysis' | 'explain';
export type FilterOperator = 'contains' | 'equals' | 'starts' | 'ends' | 'gt' | 'lt';

export interface FilterRule {
  column: string;
  operator: FilterOperator;
  value: string;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'area';
  xAxis: string;
  yKeys: string[];
}

export interface AnalysisMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export interface TabResultsState {
  activeTab: ResultTab;
  search: string;
  filters: FilterRule[];
  chatMessages: AnalysisMessage[];
  chatInput: string;
  chartConfig: ChartConfig;
}

export interface QueryTab {
  id: string;
  name: string;
  currentStep: AppStep;
  builderState: BuilderState;
  queryResult: QueryResult | null;
  executionResult: any[];
  isGenerating: boolean;
  isExecuting: boolean;
  resultsState: TabResultsState;
}

export interface TransactionStep {
  sql: string;
  tabName: string;
  timestamp: number;
}

export interface TransactionInfo {
  isActive: boolean;
  sessionId: string | null;
  startTime: number | null;
  statementCount: number;
  affectedTabs: string[]; 
  steps: TransactionStep[]; // Rastro de comandos
  stagedSimulationData?: Record<string, any[]>; // Backup para rollback simulado
}

export interface ConnectionGroup {
  id: string;
  name: string;
  contextColor?: string;
  schema: DatabaseSchema | null;
  credentials: DbCredentials | null;
  simulationData: Record<string, any[]>;
  tabs: QueryTab[];
  activeTabId: string;
  transaction: TransactionInfo;
}

export interface AppSettings {
  enableAiGeneration: boolean;
  enableAiValidation: boolean;
  enableAiTips: boolean;
  beginnerMode: boolean; 
  advancedMode: boolean; 
  enableDmlSafety: boolean;
  blockDestructiveCommands: boolean;
  enableDataMasking: boolean; 
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
  storageQuotaTrigger: number; 
}

export const DEFAULT_SETTINGS: AppSettings = {
  enableAiGeneration: true,
  enableAiValidation: true,
  enableAiTips: true,
  beginnerMode: true, 
  advancedMode: false, 
  enableDmlSafety: true,
  blockDestructiveCommands: true,
  enableDataMasking: true, 
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
  plan: any; 
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
  alias?: string;
  rows: number;
  actualRows?: number;
  loops?: number;
  width: number;
  cost: {
    startup: number;
    total: number;
  };
  actualTime?: {
    startup: number;
    total: number;
  };
  exclusiveTime?: number;
  exclusivePercent?: number;
  buffers?: {
    sharedHit?: number;
    sharedRead?: number;
    localHit?: number;
    localRead?: number;
    tempHit?: number;
    tempRead?: number;
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

export interface AuditMetadata {
  client: {
    ip: string;
    os: string;
    userAgent: string;
  };
  performance: {
    totalMs: number;
    serverProcessMs: number;
  };
  server: {
    dbUser: string;
    sessionId?: string;
    rawErrorStack?: string;
  };
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  rowCount: number;
  durationMs: number;
  status: 'success' | 'error';
  timestamp: number;
  schemaName: string;
  audit?: AuditMetadata; 
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
  name: 'E-Commerce Global Enterprise',
  connectionSource: 'simulated',
  tables: [
    {
      name: 'users',
      schema: 'public',
      description: 'Armazena informações cadastrais dos clientes.',
      columns: [
        { name: 'grid', type: 'integer', isPrimaryKey: true },
        { name: 'name', type: 'varchar(100)' },
        { name: 'email', type: 'varchar(100)' },
        { name: 'country', type: 'varchar(50)' },
        { name: 'is_active', type: 'boolean' },
        { name: 'created_at', type: 'timestamp' }
      ]
    },
    {
      name: 'addresses',
      schema: 'public',
      description: 'Endereços de entrega vinculados aos usuários.',
      columns: [
        { name: 'grid', type: 'integer', isPrimaryKey: true },
        { name: 'user_id', type: 'integer', isForeignKey: true, references: 'public.users.grid' },
        { name: 'street', type: 'varchar(200)' },
        { name: 'city', type: 'varchar(100)' },
        { name: 'state', type: 'varchar(50)' },
        { name: 'zip_code', type: 'varchar(20)' },
        { name: 'is_default', type: 'boolean' }
      ]
    },
    {
      name: 'categories',
      schema: 'public',
      description: 'Categorias de organização de produtos.',
      columns: [
        { name: 'grid', type: 'integer', isPrimaryKey: true },
        { name: 'name', type: 'varchar(50)' },
        { name: 'description', type: 'text' }
      ]
    },
    {
      name: 'suppliers',
      schema: 'public',
      description: 'Fornecedores dos produtos do catálogo.',
      columns: [
        { name: 'grid', type: 'integer', isPrimaryKey: true },
        { name: 'company_name', type: 'varchar(150)' },
        { name: 'contact_name', type: 'varchar(100)' },
        { name: 'contact_email', type: 'varchar(100)' },
        { name: 'country', type: 'varchar(50)' }
      ]
    },
    {
      name: 'products',
      schema: 'public',
      description: 'Catálogo de produtos disponíveis para venda.',
      columns: [
        { name: 'grid', type: 'integer', isPrimaryKey: true },
        { name: 'name', type: 'varchar(150)' },
        { name: 'price', type: 'numeric(10,2)' },
        { name: 'stock_quantity', type: 'integer' },
        { name: 'created_at', type: 'timestamp' }
      ]
    }
  ]
};
