import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

// Configurações do autoUpdater
autoUpdater.autoDownload = false;
autoUpdater.logger = console;

// Função aprimorada para buscar versões reais do GitHub
async function fetchGitHubVersions() {
  const repo = "Hamilton-Junior/psqlBuddy";
  const timestamp = new Date().getTime();
  console.log(`[MAIN] Buscando versões no GitHub: ${repo} (cb=${timestamp})`);
  
  try {
    const headers = { 
      'User-Agent': 'PSQL-Buddy-App',
      'Accept': 'application/vnd.github.v3+json',
      'Cache-Control': 'no-cache'
    };

    // 1. Tentar buscar a última release estável
    let stable = '---';
    try {
      const releaseRes = await fetch(`https://api.github.com/repos/${repo}/releases/latest?t=${timestamp}`, { headers });
      if (releaseRes.ok) {
        const data = await releaseRes.json();
        stable = data.tag_name ? data.tag_name.replace('v', '') : '---';
      } else if (releaseRes.status === 404) {
        // Fallback: Se não houver "Latest Release", buscar a última Tag
        const tagsRes = await fetch(`https://api.github.com/repos/${repo}/tags?t=${timestamp}`, { headers });
        if (tagsRes.ok) {
          const tags = await tagsRes.json();
          if (tags && tags.length > 0) {
            stable = tags[0].name.replace('v', '');
          }
        }
      }
    } catch (e) {
      console.error("[GITHUB API] Erro ao buscar estável:", e.message);
    }

    // 2. Buscar informações da branch main (canal Dev/Beta)
    let main = '---';
    try {
      const branchRes = await fetch(`https://api.github.com/repos/${repo}/branches/main?t=${timestamp}`, { headers });
      if (branchRes.ok) {
        const data = await branchRes.json();
        // Usamos os primeiros 7 caracteres do SHA do commit como "versão" de desenvolvimento
        main = data.commit && data.commit.sha ? data.commit.sha.substring(0, 7) : '---';
      }
    } catch (e) {
      console.error("[GITHUB API] Erro ao buscar main:", e.message);
    }

    console.log(`[MAIN] Versões recuperadas - Stable: ${stable}, Main: ${main}`);
    return { stable, main };
  } catch (error) {
    console.error('[GITHUB API] Falha crítica na conexão:', error.message);
    return { stable: 'Erro', main: 'Erro' };
  }
}

function startBackend() {
  const isDev = !app.isPackaged;
  if (isDev && process.env.SKIP_BACKEND === '1') return;
  const serverPath = path.join(__dirname, 'server.js');
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

  if (!app.isPackaged) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', async () => {
    const currentVersion = app.getVersion();
    mainWindow.webContents.send('app-version', currentVersion);
    
    // Busca versões e sincroniza com a UI
    const versions = await fetchGitHubVersions();
    mainWindow.webContents.send('sync-versions', versions);
  });
}

// Eventos do autoUpdater
autoUpdater.on('update-available', (info) => {
  mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('update-not-available', () => {
  mainWindow.webContents.send('update-not-available');
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow.webContents.send('update-downloading', { percent: progressObj.percent });
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow.webContents.send('update-ready', info);
});

autoUpdater.on('error', (err) => {
  mainWindow.webContents.send('update-error', { message: err.message });
});

// IPC Listeners
ipcMain.on('check-update', async () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
  } else {
    console.log('[MAIN] Verificação manual em DEV. Recarregando dados do GitHub...');
    const versions = await fetchGitHubVersions();
    mainWindow.webContents.send('sync-versions', versions);
    mainWindow.webContents.send('update-not-available');
  }
});

ipcMain.on('start-download', () => { autoUpdater.downloadUpdate(); });
ipcMain.on('install-update', () => { autoUpdater.quitAndInstall(); });

app.whenReady().then(() => { 
  startBackend(); 
  createWindow(); 
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
