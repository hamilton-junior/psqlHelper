
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

export interface OptimizationAnalysis {
  rating: number; // 0 to 100
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
  beginnerMode: boolean; 
  advancedMode: boolean; // New Flag for Inline Editing
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
  beginnerMode: true, 
  advancedMode: false, // Default OFF
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
  parameters: string[]; // List of extracted params like ['email', 'start_date']
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

// Diff Types
export interface DiffRow {
  key: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  dataA?: any;
  dataB?: any;
  diffColumns: string[]; // List of columns that changed
}

// Virtual Relations (Feature for implicit FKs)
export interface VirtualRelation {
  id: string;
  sourceTable: string; // schema.table
  sourceColumn: string;
  targetTable: string; // schema.table
  targetColumn: string;
  confidence?: number; // For AI suggested ones later
}

export const SAMPLE_SCHEMA: DatabaseSchema = {
  name: "ecommerce_super_store",
  connectionSource: "simulated",
  tables: [
    {
      name: "users",
      schema: "public",
      description: "Usuários da plataforma (Clientes)",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "full_name", type: "VARCHAR(100)" },
        { name: "email", type: "VARCHAR(100)" },
        { name: "country", type: "VARCHAR(50)" },
        { name: "created_at", type: "TIMESTAMP" },
        { name: "is_active", type: "BOOLEAN" }
      ]
    },
    {
      name: "profiles",
      schema: "public",
      description: "Detalhes adicionais do usuário (1:1 com users)",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "user_id", type: "INTEGER", isForeignKey: true, references: "public.users.id" },
        { name: "bio", type: "TEXT" },
        { name: "birth_date", type: "DATE" },
        { name: "preferences", type: "JSONB" }
      ]
    },
    {
      name: "categories",
      schema: "public",
      description: "Categorias de produtos",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "name", type: "VARCHAR(50)" },
        { name: "description", type: "TEXT" },
        { name: "slug", type: "VARCHAR(50)" }
      ]
    },
    {
      name: "suppliers",
      schema: "public",
      description: "Fornecedores de produtos",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "company_name", type: "VARCHAR(100)" },
        { name: "contact_email", type: "VARCHAR(100)" },
        { name: "rating", type: "DECIMAL(2,1)" },
        { name: "country", type: "VARCHAR(50)" }
      ]
    },
    {
      name: "products",
      schema: "public",
      description: "Catálogo de produtos",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "name", type: "VARCHAR(100)" },
        { name: "category_id", type: "INTEGER", isForeignKey: true, references: "public.categories.id" },
        { name: "supplier_id", type: "INTEGER", isForeignKey: true, references: "public.suppliers.id" },
        { name: "price", type: "DECIMAL(10,2)" },
        { name: "cost_price", type: "DECIMAL(10,2)" },
        { name: "stock_quantity", type: "INTEGER" },
        { name: "is_digital", type: "BOOLEAN" }
      ]
    },
    {
      name: "orders",
      schema: "public",
      description: "Pedidos de venda (Cabeçalho)",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "user_id", type: "INTEGER", isForeignKey: true, references: "public.users.id" },
        { name: "status", type: "VARCHAR(20)" },
        { name: "total_amount", type: "DECIMAL(10,2)" },
        { name: "shipping_cost", type: "DECIMAL(10,2)" },
        { name: "created_at", type: "TIMESTAMP" },
        { name: "shipped_at", type: "TIMESTAMP" }
      ]
    },
    {
      name: "order_items",
      schema: "public",
      description: "Itens de cada pedido (Detalhe)",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "order_id", type: "INTEGER", isForeignKey: true, references: "public.orders.id" },
        { name: "product_id", type: "INTEGER", isForeignKey: true, references: "public.products.id" },
        { name: "quantity", type: "INTEGER" },
        { name: "unit_price", type: "DECIMAL(10,2)" },
        { name: "discount", type: "DECIMAL(10,2)" }
      ]
    },
    {
      name: "reviews",
      schema: "public",
      description: "Avaliações de produtos",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "product_id", type: "INTEGER", isForeignKey: true, references: "public.products.id" },
        { name: "user_id", type: "INTEGER", isForeignKey: true, references: "public.users.id" },
        { name: "rating", type: "INTEGER" }, // 1 to 5
        { name: "comment", type: "TEXT" },
        { name: "created_at", type: "TIMESTAMP" }
      ]
    },
    {
      name: "employees",
      schema: "hr",
      description: "Funcionários da empresa (Schema HR)",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "first_name", type: "VARCHAR(50)" },
        { name: "last_name", type: "VARCHAR(50)" },
        { name: "department", type: "VARCHAR(50)" },
        { name: "salary", type: "DECIMAL(10,2)" },
        { name: "hire_date", type: "DATE" }
      ]
    },
    {
      name: "audit_logs",
      schema: "system",
      description: "Logs de auditoria do sistema (Schema System)",
      columns: [
        { name: "id", type: "SERIAL", isPrimaryKey: true },
        { name: "table_name", type: "VARCHAR(50)" },
        { name: "action", type: "VARCHAR(10)" }, // INSERT, UPDATE, DELETE
        { name: "performed_by", type: "INTEGER" }, // user_id
        { name: "metadata", type: "JSONB" },
        { name: "created_at", type: "TIMESTAMP" }
      ]
    }
  ]
};
