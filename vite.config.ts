import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Tenta encontrar a chave mesmo se houver erro de digitação no case (ex: VITE_API_kEY)
  const actualApiKey = env.VITE_API_KEY || Object.entries(env).find(([k]) => k.toUpperCase() === 'VITE_API_KEY')?.[1];

  if (!actualApiKey && mode === 'development') {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️  [VITE] VITE_API_KEY não encontrada no seu arquivo .env!');
  }

  let commitCount = '0';
  try {
    commitCount = execSync('git rev-list --count HEAD').toString().trim();
  } catch (e) {
    commitCount = '0';
  }

  const count = parseInt(commitCount, 10) || 0;
  const major = Math.floor(count / 1000);
  const minor = Math.floor((count % 1000) / 100);
  const patch = count % 100;
  
  const appVersion = `${major}.${minor}.${patch}`;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
    base: './', 
    define: {
      'process.env.API_KEY': JSON.stringify(actualApiKey),
      '__APP_VERSION__': JSON.stringify(appVersion),
      '__COMMIT_COUNT__': JSON.stringify(count)
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      host: '127.0.0.1'
    }
  };
});