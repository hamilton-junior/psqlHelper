
import { app, BrowserWindow, ipcMain, shell, utilityProcess } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverChild;

// Configurações do Atualizador
autoUpdater.autoDownload = false;
autoUpdater.allowDowngrade = true; 
autoUpdater.allowPrerelease = true; 
autoUpdater.logger = console;

function getCalculatedAppVersion() {
  if (app.isPackaged) return app.getVersion();
  try {
    const commitCount = execSync('git rev-list --count HEAD').toString().trim();
    const count = parseInt(commitCount, 10) || 0;
    const major = Math.floor(count / 1000);
    const minor = Math.floor((count % 1000) / 100);
    const patch = count % 100;
    return `${major}.${minor}.${patch}`;
  } catch (e) {
    return app.getVersion();
  }
}

const CURRENT_VERSION = getCalculatedAppVersion();

function compareVersions(v1, v2) {
  if (!v1 || v1 === '---' || !v2 || v2 === '---' || v1 === '...' || v2 === '...') return 0;
  const cleanV1 = v1.replace(/^v/, '');
  const cleanV2 = v2.replace(/^v/, '');
  const p1 = cleanV1.split('.').map(n => parseInt(n, 10) || 0);
  const p2 = cleanV2.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

/**
 * Inicializa o backend garantindo a prioridade de IPv4 e captura de logs.
 */
function startBackend() {
  console.log("[MAIN] Iniciando Backend Service...");
  
  if (process.env.SKIP_BACKEND === '1') {
    console.log("[MAIN] SKIP_BACKEND ativo.");
    return;
  }

  const serverPath = path.join(__dirname, 'server.js');

  console.log(`[MAIN] Resolvendo backend em: ${serverPath}`);

  try {
    serverChild = utilityProcess.fork(serverPath, [], {
        env: { 
            ...process.env,
            PORT: '3000',
            HOST: '127.0.0.1',
            NODE_OPTIONS: '--dns-result-order=ipv4first'
        },
        stdio: 'pipe'
    });

    serverChild.stdout.on('data', (data) => {
        console.log(`[BACKEND-STDOUT]: ${data.toString().trim()}`);
    });

    serverChild.stderr.on('data', (data) => {
        console.error(`[BACKEND-STDERR]: ${data.toString().trim()}`);
    });

    serverChild.on('spawn', () => {
        console.log("[MAIN] Processo do Backend (UtilityProcess) iniciado com sucesso.");
    });

    serverChild.on('exit', (code) => {
        console.warn(`[MAIN] O processo do Backend encerrou com código: ${code}`);
        serverChild = null;
    });
  } catch (err) {
    console.error("[MAIN] Falha crítica ao disparar utilityProcess do backend:", err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 850,
    title: "PSQL Buddy",
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0f172a', symbolColor: '#94a3b8' },
    webPreferences: { 
      preload: path.join(__dirname, 'preload.js'), 
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // Interceptar tentativas de abertura de novas janelas (links target="_blank")
  // para forçar abertura no navegador do sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('app-version', CURRENT_VERSION);
    fetchGitHubVersions().then(versions => {
      mainWindow.webContents.send('sync-versions', versions);
    }).catch(() => {});
  });
}

async function fetchGitHubVersions() {
  const repo = "Hamilton-Junior/psqlBuddy";
  const headers = { 'User-Agent': 'PSQL-Buddy-App' };
  try {
    let stable = '---';
    let main = '---';
    let totalCommits = 0;

    const tagsRes = await fetch(`https://api.github.com/repos/${repo}/tags`, { headers });
    if (tagsRes.ok) {
      const tags = await tagsRes.json();
      if (tags.length > 0) stable = tags[0].name.replace(/^v/, '');
    }

    const commitsRes = await fetch(`https://api.github.com/repos/${repo}/commits?sha=main&per_page=1`, { headers });
    if (commitsRes.ok) {
       const link = commitsRes.headers.get('link');
       if (link) {
          const match = link.match(/&page=(\d+)>; rel="last"/);
          if (match) {
             const count = parseInt(match[1]);
             totalCommits = count;
             main = `${Math.floor(count/1000)}.${Math.floor((count%1000)/100)}.${count%100}`;
          }
       } else {
          // Caso tenha apenas 1 commit ou link header ausente
          const single = await commitsRes.json();
          if (Array.isArray(single)) totalCommits = 1;
       }
    }
    return { stable, main, totalCommits };
  } catch (e) { 
    console.error("[MAIN] Erro ao buscar versões remotas:", e);
    return { stable: 'Erro', main: 'Erro', totalCommits: 0 }; 
  }
}

app.whenReady().then(() => { 
  startBackend();
  createWindow(); 
});

app.on('window-all-closed', () => { 
  if (serverChild) serverChild.kill();
  if (process.platform !== 'darwin') app.quit();
});

// Listener para abrir URLs externas de forma explícita
ipcMain.on('open-external', (event, url) => {
  if (url && typeof url === 'string' && url.startsWith('http')) {
    shell.openExternal(url);
  }
});

ipcMain.on('check-update', async (event, branch) => {
  const versions = await fetchGitHubVersions();
  const remoteVersion = branch === 'main' ? versions.main : versions.stable;
  const comparison = compareVersions(remoteVersion, CURRENT_VERSION);

  if (comparison === 0) {
    mainWindow.webContents.send('update-not-available');
    return;
  }

  const updateType = comparison < 0 ? 'downgrade' : 'upgrade';

  if (app.isPackaged && branch === 'stable') {
    autoUpdater.checkForUpdates().catch(() => {
      mainWindow.webContents.send('update-available', { 
        version: remoteVersion, 
        branch, 
        updateType,
        isManual: true 
      });
    });
  } else {
    mainWindow.webContents.send('update-available', { 
      version: remoteVersion, 
      branch, 
      updateType,
      isManual: true 
    });
  }
});

autoUpdater.on('update-available', (info) => {
  const comparison = compareVersions(info.version, CURRENT_VERSION);
  const updateType = comparison < 0 ? 'downgrade' : 'upgrade';
  mainWindow.webContents.send('update-available', { 
    version: info.version, 
    releaseNotes: info.releaseNotes,
    updateType 
  });
});

autoUpdater.on('update-not-available', () => {
  mainWindow.webContents.send('update-not-available');
});

autoUpdater.on('error', (err) => {
  console.error("[MAIN] Erro no atualizador:", err);
  mainWindow.webContents.send('update-error', err.message);
});

autoUpdater.on('download-progress', (p) => {
  mainWindow.webContents.send('update-downloading', p);
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-ready');
});

ipcMain.on('start-download', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.on('refresh-remote-versions', async () => {
    const versions = await fetchGitHubVersions();
    if (mainWindow) mainWindow.webContents.send('sync-versions', versions);
});
