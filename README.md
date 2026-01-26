# 🚀 PSQL Buddy

[![GitHub Release](https://img.shields.io/github/v/release/Hamilton-Junior/psqlBuddy?style=for-the-badge&color=indigo&label=versão)](https://github.com/Hamilton-Junior/psqlBuddy/releases)
[![GitHub License](https://img.shields.io/github/license/Hamilton-Junior/psqlBuddy?style=for-the-badge&color=orange&label=licença)](https://github.com/Hamilton-Junior/psqlBuddy/blob/main/LICENSE.txt)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![Electron](https://img.shields.io/badge/Electron-34-47848F?style=for-the-badge&logo=electron)

**PSQL Buddy** é um construtor visual de consultas PostgreSQL de última geração, turbinado por Inteligência Artificial. Projetado para transformar a maneira como desenvolvedores e analistas interagem com seus dados, ele traduz linguagem natural em SQL complexo e performático.

---

## ✨ Funcionalidades Principais

- **🧠 AI SQL Architect**: Traduza perguntas como *"Quais clientes gastaram mais de R$500 no mês passado?"* diretamente para SQL válido via Gemini AI.
- **🗺️ Mapa Interativo do Schema**: Visualize tabelas e relacionamentos em um canvas infinito com detecção automática de chaves e validação de interseção de dados.
- **🔍 Data Diff & Auditoria**: Compare registros entre tabelas ou instâncias para identificar divergências em segundos.
- **💻 Editor Monaco Integrado**: Experiência de codificação nível VS Code com auto-complete inteligente baseado nas suas tabelas reais.
- **📊 AI Data Analyst**: Chat integrado para analisar os resultados da sua query, gerando insights e gráficos automáticos.
- **🛠️ Canivete Suíço Dev**: Extrator de SQL de arquivos de log, construtor de fórmulas personalizadas e templates de query parametrizados.

---

## 🛠️ Stack Tecnológica

- **Frontend**: React 19 + Tailwind CSS + Lucide Icons
- **Desktop**: Electron 34
- **Inteligência Artificial**: Google Gemini API (modelos Flash e Pro)
- **Editor**: Monaco Editor (VS Code Engine)
- **Gráficos**: Recharts
- **Banco de Dados**: Node-Postgres (pg)

---

## 🚀 Como Executar

### Pré-requisitos
1. **Node.js 20+** instalado.
2. Uma chave de API do **Google AI Studio** (Gemini).

### Instalação
```bash
# Clone o repositório
git clone https://github.com/Hamilton-Junior/psqlBuddy.git

# Entre na pasta
cd psqlBuddy

# Instale as dependências
npm install
```

### Configuração
Crie um arquivo `.env` na raiz do projeto:
```env
VITE_API_KEY=sua_chave_gemini_aqui
GH_TOKEN=seu_token_github_para_releases
```

### Rodar em Desenvolvimento
```bash
# Inicia o Vite, o Servidor de Banco de Dados e o Electron simultaneamente
npm run dev:all
```

---

## ⚖️ Licença e Uso

Este software é distribuído sob uma licença **Atribuição-NãoComercial**.

1. **Livre Modificação**: Você pode alterar e adaptar o código conforme suas necessidades.
2. **Uso Não Comercial**: É estritamente proibida a venda, sublicenciamento ou qualquer uso que gere lucro direto ou indireto com o software.
3. **Créditos Obrigatórios**: Toda e qualquer derivação deste projeto deve obrigatoriamente manter os créditos originais e apontar para este repositório: `https://github.com/Hamilton-Junior/psqlBuddy`.

Consulte o arquivo `LICENSE.txt` para ler os termos na íntegra.

---

## 🤝 Contribuições

Feedbacks e Pull Requests são extremamente bem-vindos! Sinta-se à vontade para abrir uma *Issue* se encontrar algum comportamento inesperado ou tiver uma sugestão de nova funcionalidade.

Desenvolvido com ❤️ por [Hamilton Junior](https://github.com/Hamilton-Junior)