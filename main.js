import { app, BrowserWindow, ipcMain, spawn } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fs from 'fs';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

// Configurações do autoUpdater
autoUpdater.autoDownload = false; // Não baixar automaticamente sem autorização
autoUpdater.logger = console;

function startBackend() {
  const isDev = !app.isPackaged;
  if (isDev && process.env.SKIP_BACKEND === '1') return;
  const serverPath = path.join(__dirname, 'server.js');
  console.log(`[MAIN] Iniciando servidor backend em: ${serverPath}`);
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit'
  });
}

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  
  mainWindow = new BrowserWindow({
    width: 1280, height: 850, minWidth: 1000, minHeight: 700,
    title: "PSQL Buddy",
    titleBarStyle: 'hidden', 
    titleBarOverlay: { color: '#0f172a', symbolColor: '#94a3b8', height: 35 },
    backgroundColor: '#0f172a',
    webPreferences: { 
      nodeIntegration: false, 
      contextIsolation: true, 
      preload: preloadPath 
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    const url = 'http://127.0.0.1:5173';
    const loadWithRetry = () => {
      mainWindow.loadURL(url).catch(() => {
        setTimeout(loadWithRetry, 2000);
      });
    };
    loadWithRetry();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // Notificar frontend sobre a versão atual real
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('app-version', app.getVersion());
  });
}

// --- LÓGICA DE ATUALIZAÇÃO NATIVA ---

autoUpdater.on('update-available', (info) => {
  console.log('[UPDATE] Atualização disponível:', info.version);
  mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('update-not-available', () => {
  console.log('[UPDATE] Aplicativo está atualizado.');
  mainWindow.webContents.send('update-not-available');
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`[UPDATE] Progresso: ${progressObj.percent}%`);
  mainWindow.webContents.send('update-downloading', { percent: progressObj.percent });
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[UPDATE] Download concluído.');
  mainWindow.webContents.send('update-ready', info);
});

autoUpdater.on('error', (err) => {
  console.error('[UPDATE] Erro:', err);
  mainWindow.webContents.send('update-error', { message: err.message });
});

// IPC Listeners
ipcMain.on('check-update', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
  } else {
    console.log('[UPDATE] Simulação em modo DEV: Verificação ignorada.');
  }
});

ipcMain.on('start-download', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// Lifecycle
app.whenReady().then(() => { 
  startBackend(); 
  createWindow(); 

  // Verificar atualizações automaticamente 5 segundos após iniciar
  setTimeout(() => {
    if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify();
  }, 5000);
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});