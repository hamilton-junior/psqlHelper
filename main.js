
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

function startBackend() {
  const isDev = !app.isPackaged;
  
  if (isDev && process.env.SKIP_BACKEND === '1') {
    console.log(`[MAIN] SKIP_BACKEND ativo. Assumindo que o servidor já está rodando na porta 3000.`);
    return;
  }

  const serverPath = path.join(__dirname, 'server.js');
  console.log(`[MAIN] Iniciando backend em:`, serverPath);
  
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { 
      ...process.env, 
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: isDev ? 'development' : 'production'
    },
    stdio: 'inherit'
  });

  serverProcess.on('error', (err) => {
    console.error('[MAIN] Falha ao iniciar processo do servidor:', err);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    title: "PSQL Buddy",
    titleBarStyle: 'hidden', 
    titleBarOverlay: {       
      color: '#0f172a',      
      symbolColor: '#94a3b8',
      height: 35
    },
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') 
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    const url = 'http://127.0.0.1:5173';
    mainWindow.loadURL(url).catch(() => {
      console.log("[MAIN] Vite ainda não está pronto, tentando novamente em 2s...");
      setTimeout(() => mainWindow.loadURL(url), 2000);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

// IPC para Atualizações
ipcMain.on('check-update', (event, branch = 'stable') => {
  console.log(`[UPDATE] Verificando atualizações na branch: ${branch}...`);
  const updateData = branch === 'main' 
    ? { version: '0.3.0-nightly', notes: 'Atualização WIP (branch main): Novas funcionalidades experimentais.', branch: 'Main' }
    : { version: '0.2.0', notes: 'Atualização Estável: Versão consolidada.', branch: 'Stable' };

  setTimeout(() => {
    mainWindow.webContents.send('update-available', updateData);
    setTimeout(() => mainWindow.webContents.send('update-downloading', { percent: 100 }), 2000);
    setTimeout(() => mainWindow.webContents.send('update-ready'), 3000);
  }, 1000);
});

ipcMain.on('install-update', () => {
  console.log('[UPDATE] Reiniciando para instalar atualização...');
});

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
