
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
  
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { 
      ...process.env, 
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: isDev ? 'development' : 'production'
    },
    stdio: 'inherit'
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
    const loadWithRetry = () => {
      mainWindow.loadURL(url).catch(() => {
        setTimeout(loadWithRetry, 1500);
      });
    };
    loadWithRetry();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

// --- LOGICA DE ATUALIZAÇÃO ---

ipcMain.on('check-update', (event, branch = 'stable') => {
  console.log(`[UPDATE] Verificando branch: ${branch}...`);
  
  // Simula metadados da atualização
  const updateData = branch === 'main' 
    ? { version: '0.3.0-nightly', notes: 'Recursos experimentais: Novo Canvas de Diagrama e exportação para PDF.', branch: 'Main' }
    : { version: '0.2.0', notes: 'Melhorias de estabilidade, suporte a SSL e novo visual para o Comparador de Dados.', branch: 'Stable' };

  // Retorna apenas a disponibilidade
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', updateData);
    }
  }, 1200);
});

ipcMain.on('start-download', () => {
  console.log('[UPDATE] Usuário iniciou o download...');
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 15;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      mainWindow.webContents.send('update-downloading', { percent: 100 });
      setTimeout(() => mainWindow.webContents.send('update-ready'), 500);
    } else {
      mainWindow.webContents.send('update-downloading', { percent: progress });
    }
  }, 400);
});

ipcMain.on('install-update', () => {
  console.log('[UPDATE] Reiniciando para "instalar"...');
  app.relaunch();
  app.exit();
});

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
