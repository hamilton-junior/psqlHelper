
import React, { useState } from 'react';
import { X, Copy, Check, Terminal, FileCode } from 'lucide-react';

interface CodeSnippetModalProps {
  sql: string;
  onClose: () => void;
}

type Language = 'node' | 'python' | 'php' | 'go' | 'java';

const CodeSnippetModal: React.FC<CodeSnippetModalProps> = ({ sql, onClose }) => {
  const [activeLang, setActiveLang] = useState<Language>('node');
  const [copied, setCopied] = useState(false);

  // Helper to indent SQL for code blocks
  const formatSqlForCode = (s: string) => {
    return s.trim().replace(/\n/g, '\n    '); // simple indent
  };

  const snippets: Record<Language, { name: string; color: string; code: string }> = {
    node: {
      name: 'Node.js (pg)',
      color: 'text-green-600',
      code: `import { Client } from 'pg';

const client = new Client({
  user: 'dbuser',
  host: 'database.server.com',
  database: 'mydb',
  password: 'secretpassword',
  port: 5432,
});

await client.connect();

const query = \`
  ${formatSqlForCode(sql)}
\`;

try {
  const res = await client.query(query);
  console.log(res.rows);
} catch (err) {
  console.error(err);
} finally {
  await client.end();
}`
    },
    python: {
      name: 'Python (psycopg2)',
      color: 'text-blue-600',
      code: `import psycopg2

try:
    connection = psycopg2.connect(
        user="dbuser",
        password="secretpassword",
        host="127.0.0.1",
        port="5432",
        database="mydb"
    )

    cursor = connection.cursor()
    query = """
    ${formatSqlForCode(sql)}
    """

    cursor.execute(query)
    records = cursor.fetchall()

    for row in records:
        print(row)

except (Exception, psycopg2.Error) as error:
    print("Error while fetching data from PostgreSQL", error)

finally:
    if connection:
        cursor.close()
        connection.close()`
    },
    php: {
      name: 'PHP (PDO)',
      color: 'text-indigo-600',
      code: `<?php
$host = '127.0.0.1';
$db   = 'mydb';
$user = 'dbuser';
$pass = 'secretpassword';
$charset = 'utf8mb4';

$dsn = "pgsql:host=$host;port=5432;dbname=$db;options='--client_encoding=$charset'";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
     $pdo = new PDO($dsn, $user, $pass, $options);
     
     $sql = <<<EOT
${formatSqlForCode(sql)}
EOT;

     $stmt = $pdo->query($sql);
     while ($row = $stmt->fetch()) {
         print_r($row);
     }
} catch (\PDOException $e) {
     throw new \PDOException($e->getMessage(), (int)$e->getCode());
}`
    },
    go: {
      name: 'Go (pgx)',
      color: 'text-cyan-600',
      code: `package main

import (
	"context"
	"fmt"
	"os"
	"github.com/jackc/pgx/v5"
)

func main() {
	conn, err := pgx.Connect(context.Background(), "postgres://dbuser:secretpassword@localhost:5432/mydb")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Unable to connect to database: %v\\n", err)
		os.Exit(1)
	}
	defer conn.Close(context.Background())

	sql := \`
    ${formatSqlForCode(sql)}
    \`

	rows, err := conn.Query(context.Background(), sql)
	if err != nil {
		fmt.Fprintf(os.Stderr, "QueryRow failed: %v\\n", err)
		os.Exit(1)
	}
    // ... handle rows
}`
    },
    java: {
      name: 'Java (JDBC)',
      color: 'text-red-600',
      code: `import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

public class PSQLExample {
   public static void main(String args[]) {
      Connection c = null;
      Statement stmt = null;
      try {
         Class.forName("org.postgresql.Driver");
         c = DriverManager
            .getConnection("jdbc:postgresql://localhost:5432/mydb",
            "dbuser", "secretpassword");
         c.setAutoCommit(false);

         stmt = c.createStatement();
         String sql = """
         ${formatSqlForCode(sql)}
         """;
         
         ResultSet rs = stmt.executeQuery(sql);
         while ( rs.next() ) {
            // Retrieve by column name
            // int id = rs.getInt("id");
         }
         rs.close();
         stmt.close();
         c.close();
      } catch (Exception e) {
         e.printStackTrace();
         System.err.println(e.getClass().getName()+": "+e.getMessage());
         System.exit(0);
      }
   }
}`
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[activeLang].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <FileCode className="w-5 h-5" />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Exportar Código</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Integre esta query na sua aplicação</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-full overflow-hidden">
           {/* Sidebar Languages */}
           <div className="w-full md:w-48 bg-slate-50 dark:bg-slate-900/50 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 p-2 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible">
              {(Object.keys(snippets) as Language[]).map(lang => (
                 <button
                    key={lang}
                    onClick={() => { setActiveLang(lang); setCopied(false); }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium text-left flex items-center gap-2 transition-all whitespace-nowrap ${
                       activeLang === lang 
                       ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 ring-1 ring-slate-200 dark:ring-slate-700' 
                       : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                 >
                    <Terminal className={`w-3.5 h-3.5 ${snippets[lang].color}`} />
                    {snippets[lang].name}
                 </button>
              ))}
           </div>

           {/* Code Area */}
           <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
              <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                 <pre className="font-mono text-sm text-slate-300 leading-relaxed">
                    {snippets[activeLang].code}
                 </pre>
              </div>
              <div className="p-3 bg-[#252526] border-t border-[#333] flex justify-between items-center">
                 <span className="text-xs text-slate-500 font-mono">Lembre-se de instalar o driver apropriado.</span>
                 <button 
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors"
                 >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copiado!' : 'Copiar Código'}
                 </button>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default CodeSnippetModal;
