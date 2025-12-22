
import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, Bot, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// Initialize the AI client using the API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface DataAnalysisChatProps {
  data: any[];
  sql: string;
}

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const DataAnalysisChat: React.FC<DataAnalysisChatProps> = ({ data, sql }) => {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: '1', role: 'assistant', text: 'Olá! Analisei os dados retornados pela sua consulta. O que você gostaria de saber sobre eles? Posso encontrar tendências, anomalias ou resumir os resultados.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Limit context to first 20 rows to avoid token limits
      const dataSample = data.slice(0, 20); 
      const context = `
        CONTEXTO SQL: "${sql}"
        
        REGRAS DE NEGÓCIO E SCHEMA DO SISTEMA:
        1. Identificação de IDs: A coluna chamada 'grid' é utilizada como Chave Primária (PK) padrão das tabelas neste sistema.
        2. Relacionamentos Implícitos: Se uma tabela (ex: 'movto') possui uma coluna com o mesmo nome de outra tabela (ex: 'produto'), isso representa uma Chave Estrangeira.
        3. Exemplo de Join: O valor em 'movto.produto' referencia 'produto.grid'.
        4. Ao analisar os dados, considere que colunas com nomes de tabelas são IDs apontando para o 'grid' daquela tabela.

        AMOSTRA DE DADOS (JSON):
        ${JSON.stringify(dataSample)}
        
        (Nota: Existem ${data.length} linhas no total. Esta é apenas uma amostra).
        
        PERGUNTA DO USUÁRIO: "${userMsg.text}"
        
        INSTRUÇÃO: Aja como um Analista de Dados Sênior. Responda à pergunta do usuário com base nos dados fornecidos e nas regras de negócio acima. 
        Use Markdown para formatar sua resposta (negrito, listas, código).
        Seja perspicaz, aponte curiosidades se houver, e seja conciso. Responda em Português.
      `;

      // Using gemini-3-flash-preview for data analysis and conversation
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: context,
      });

      const responseText = response.text || "Desculpe, não consegui analisar os dados agora.";

      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: responseText }]);
    } catch (error) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: "Erro ao conectar com o analista de IA." }]);
    } finally {
      setLoading(false);
    }
  };

  // Improved Robust Markdown Parser
  const renderFormattedText = (text: string) => {
    // 1. Safe HTML encoding (basic)
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 2. Tokenize Code Blocks to protect them from other formatting
    const codeBlocks: string[] = [];
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
       codeBlocks.push(code);
       return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // 3. Headers
    html = html.replace(/^### (.*$)/gm, '<h3 class="text-sm font-bold text-slate-800 dark:text-white mt-3 mb-1">$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2 class="text-base font-bold text-slate-800 dark:text-white mt-4 mb-2">$1</h2>');

    // 4. Bold (**text**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-indigo-900 dark:text-indigo-200">$1</strong>');
    
    // 5. Italic (*text*)
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // 6. Inline Code (`text`)
    html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono text-xs text-rose-600 dark:text-rose-300">$1</code>');

    // 7. Lists (- item)
    // Convert newlines followed by "- " into list items
    html = html.replace(/^\s*-\s+(.*)$/gm, '<li class="ml-4 list-disc marker:text-slate-400">$1</li>');

    // 8. Restore Code Blocks (formatted)
    html = html.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
       const code = codeBlocks[parseInt(index)];
       return `<pre class="bg-slate-900 text-slate-50 p-3 rounded-lg my-3 overflow-x-auto text-xs font-mono border border-slate-700 shadow-sm">${code.trim()}</pre>`;
    });
    
    // 9. Newlines to <br> (only if not inside a tag)
    // We do a simple pass to convert remaining \n to <br> but tricky to not break tags.
    // Instead, we rely on the styling 'whitespace-pre-wrap' in the container or minimal brs.
    // However, for Chat bubbles, explicit BRs are often safer for parsing:
    html = html.replace(/\n/g, '<br />');

    // Clean up excessive breaks after block elements
    html = html.replace(/(<\/h2>|<\/h3>|<\/pre>|<\/li>)\s*<br \/>/g, '$1');
    html = html.replace(/<br \/>\s*(<h2|<h3|<pre|<li)/g, '$1');

    return { __html: html };
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
             <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
             </div>
             <div 
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-tl-none'
             }`}>
                {msg.role === 'user' ? (
                  msg.text
                ) : (
                  <div dangerouslySetInnerHTML={renderFormattedText(msg.text)} />
                )}
             </div>
          </div>
        ))}
        {loading && (
           <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                 <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 text-slate-500">
                 <Loader2 className="w-3 h-3 animate-spin" />
                 <span className="text-xs">Analisando dados...</span>
              </div>
           </div>
        )}
      </div>
      
      <form onSubmit={handleSend} className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
         <div className="relative flex items-center">
            <Sparkles className="absolute left-3 w-4 h-4 text-emerald-500" />
            <input 
               type="text" 
               value={input}
               onChange={e => setInput(e.target.value)}
               placeholder="Pergunte algo sobre estes resultados..."
               className="w-full pl-10 pr-12 py-3 bg-slate-100 dark:bg-slate-900 border border-transparent focus:bg-white dark:focus:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
            />
            <button 
               type="submit"
               disabled={!input.trim() || loading}
               className="absolute right-2 p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
               <Send className="w-4 h-4" />
            </button>
         </div>
      </form>
    </div>
  );
};

export default DataAnalysisChat;
