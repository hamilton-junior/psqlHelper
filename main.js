import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__dirname); // Ajuste conceitual para root se necessário, ou manter local

let mainWindow;
let serverProcess;

// Configurações do autoUpdater
autoUpdater.autoDownload = false;
autoUpdater.logger = console;

/**
 * Utilitário para calcular a string de versão seguindo a lógica do projeto:
 * Major = Count / 1000
 * Minor = (Count % 1000) / 100
 * Patch = Count % 100
 */
function calculateVersionFromCount(count) {
  const c = parseInt(count, 10) || 0;
  const major = Math.floor(c / 1000);
  const minor = Math.floor((c % 1000) / 100);
  const patch = c % 100;
  return `${major}.${minor}.${patch}`;
}

/**
 * Compara duas strings de versão SemVer simplificada (x.y.z)
 */
function compareVersions(v1, v2) {
  const p1 = v1.split('.').map(n => parseInt(n, 10) || 0);
  const p2 = v2.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

/**
 * Recupera o total de commits de uma branch no GitHub.
 * Utiliza o cabeçalho 'link' da API de commits para encontrar o índice da última página.
 */
async function fetchTotalCommits(repo, branch, headers) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits?sha=${branch}&per_page=1`, { headers });
    if (!res.ok) return null;
    
    const linkHeader = res.headers.get('link');
    if (!linkHeader) return 1; // Se não tem link, provavelmente só tem 1 commit

    const match = linkHeader.match(/page=(\d+)>; rel="last"/);
    return match ? parseInt(match[1], 10) : 1;
  } catch (e) {
    console.error(`[GITHUB API] Erro ao contar commits da branch ${branch}:`, e.message);
    return null;
  }
}

// Função aprimorada para buscar versões reais do GitHub
async function fetchGitHubVersions() {
  const repo = "Hamilton-Junior/psqlBuddy";
  const timestamp = new Date().getTime();
  console.log(`[APP] [MAIN] Buscando versões no GitHub: ${repo} (cb=${timestamp})`);
  
  try {
    const headers = { 
      'User-Agent': 'PSQL-Buddy-App',
      'Accept': 'application/vnd.github.v3+json',
      'Cache-Control': 'no-cache'
    };

    // 1. Recuperar Versão Estável (Highest Tag)
    let stable = '---';
    try {
      const tagsRes = await fetch(`https://api.github.com/repos/${repo}/tags?per_page=30&t=${timestamp}`, { headers });
      if (tagsRes.ok) {
        const tags = await tagsRes.json();
        const validVersions = tags
          .map(t => t.name.replace(/^v/, ''))
          .filter(v => /^\d+\.\d+\.\d+$/.test(v))
          .sort(compareVersions);
        
        if (validVersions.length > 0) {
          stable = validVersions[validVersions.length - 1];
        }
      }
    } catch (e) {
      console.error("[GITHUB API] Erro ao processar tags para Estável:", e.message);
    }

    // 2. Recuperar Versão Main (Development)
    let main = '---';
    try {
      const commitCount = await fetchTotalCommits(repo, 'main', headers);
      
      if (commitCount !== null) {
        // Se a contagem de commits funcionar, usamos ela para calcular a versão vX.Y.Z
        main = calculateVersionFromCount(commitCount);
      } else {
        // Fallback: busca diretamente a versão no package.json da branch main do GitHub
        const pkgRes = await fetch(`https://raw.githubusercontent.com/${repo}/main/package.json?t=${timestamp}`);
        if (pkgRes.ok) {
          const pkgData = await pkgRes.json();
          main = pkgData.version || '---';
        }
      }
    } catch (e) {
      console.error("[GITHUB API] Erro ao processar branch Main:", e.message);
    }

    console.log(`[APP] [MAIN] Versões recuperadas - Stable: ${stable}, Main: ${main}`);
    return { stable, main };
  } catch (error) {
    console.error('[GITHUB API] Falha crítica na conexão:', error.message);
    return { stable: 'Erro', main: 'Erro' };
  }
}

function startBackend() {
  const isDev = !app.isPackaged;
  if (isDev && process.env.SKIP_BACKEND === '1') return;
  const serverPath = path.join(process.cwd(), 'server.js');
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit'
  });
}

function createWindow() {
  const preloadPath = path.join(process.cwd(), 'preload.js');
  
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
    mainWindow.loadFile(path.join(process.cwd(), 'dist/index.html'));
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
    console.log('[APP] [MAIN] Verificação manual em DEV. Recarregando dados do GitHub...');
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