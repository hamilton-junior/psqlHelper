
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

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

function startBackend() {
  if (process.env.SKIP_BACKEND === '1') {
    console.log("[MAIN] Backend externo detectado. Ignorando inicialização.");
    return;
  }

  const serverPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'server.js')
    : path.join(__dirname, 'server.js');

  if (!fs.existsSync(serverPath)) {
    console.error(`[MAIN] Erro Crítico: Arquivo do servidor não encontrado em ${serverPath}`);
    return;
  }

  serverProcess = spawn(process.execPath, [serverPath], {
    env: { 
      ...process.env, 
      ELECTRON_RUN_AS_NODE: '1',
      PORT: '3000',
      HOST: '127.0.0.1'
    },
    stdio: 'inherit'
  });

  serverProcess.on('error', (err) => {
    console.error('[MAIN] Falha catastrófica ao iniciar backend:', err);
  });
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

  mainWindow.webContents.on('did-finish-load', async () => {
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
             main = `${Math.floor(count/1000)}.${Math.floor((count%1000)/100)}.${count%100}`;
          }
       }
    }
    return { stable, main };
  } catch (e) { return { stable: 'Erro', main: 'Erro' }; }
}

app.whenReady().then(() => { 
  startBackend();
  createWindow(); 
});

app.on('window-all-closed', () => { 
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('check-update', async (event, branch) => {
  console.log(`[MAIN] Checando atualizações para o canal: ${branch}`);
  
  if (app.isPackaged && branch === 'stable') {
    autoUpdater.checkForUpdates();
  } else {
    const versions = await fetchGitHubVersions();
    const remote = branch === 'main' ? versions.main : versions.stable;
    const comparison = compareVersions(remote, CURRENT_VERSION);
    
    if (comparison !== 0) {
      const updateType = comparison < 0 ? 'downgrade' : 'upgrade';
      console.log(`[MAIN] Mudança de versão detectada: ${CURRENT_VERSION} -> ${remote} (${updateType})`);
      mainWindow.webContents.send('update-available', { 
        version: remote, 
        branch, 
        updateType,
        isManual: true 
      });
    } else {
      mainWindow.webContents.send('update-not-available');
    }
  }
});

ipcMain.on('refresh-remote-versions', async () => {
    const versions = await fetchGitHubVersions();
    if (mainWindow) mainWindow.webContents.send('sync-versions', versions);
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

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow.webContents.send('update-downloading', progressObj);
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
