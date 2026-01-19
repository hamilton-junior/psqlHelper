import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

// Configurações do autoUpdater
autoUpdater.autoDownload = false;
autoUpdater.logger = console;

/**
 * Calcula a versão baseada nos commits para manter consistência entre Main e Renderer
 */
function getCalculatedAppVersion() {
  try {
    const commitCount = execSync('git rev-list --count HEAD').toString().trim();
    const count = parseInt(commitCount, 10) || 0;
    const major = Math.floor(count / 1000);
    const minor = Math.floor((count % 1000) / 100);
    const patch = count % 100;
    const version = `${major}.${minor}.${patch}`;
    console.log(`[DEBUG:VERSION] Versão calculada via Git: ${version} (${count} commits)`);
    return version;
  } catch (e) {
    const fallback = app.getVersion();
    console.log(`[DEBUG:VERSION] Falha ao ler Git, usando fallback do package.json: ${fallback}`);
    return fallback;
  }
}

const CURRENT_CALCULATED_VERSION = getCalculatedAppVersion();

function calculateVersionFromCount(count) {
  const c = parseInt(count, 10) || 0;
  const major = Math.floor(c / 1000);
  const minor = Math.floor((c % 1000) / 100);
  const patch = c % 100;
  return `${major}.${minor}.${patch}`;
}

function compareVersions(v1, v2, context = 'General') {
  console.log(`[DEBUG:VERSION:${context}] Comparando: "${v1}" (Remota) vs "${v2}" (Local)`);
  
  if (!v1 || v1 === '---' || !v2 || v2 === '---') return 0;
  
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

async function fetchTotalCommits(repo, branch, headers) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits?sha=${branch}&per_page=1`, { headers });
    if (!res.ok) return null;
    const linkHeader = res.headers.get('link');
    if (!linkHeader) return 1;
    const match = linkHeader.match(/page=(\d+)>; rel="last"/);
    return match ? parseInt(match[1], 10) : 1;
  } catch (e) {
    console.error(`[GITHUB API] Erro ao contar commits:`, e.message);
    return null;
  }
}

async function fetchGitHubVersions() {
  const repo = "Hamilton-Junior/psqlBuddy";
  const timestamp = new Date().getTime();
  
  try {
    const headers = { 
      'User-Agent': 'PSQL-Buddy-App',
      'Accept': 'application/vnd.github.v3+json',
      'Cache-Control': 'no-cache'
    };

    let stable = '---';
    try {
      const tagsRes = await fetch(`https://api.github.com/repos/${repo}/tags?per_page=30&t=${timestamp}`, { headers });
      if (tagsRes.ok) {
        const tags = await tagsRes.json();
        const validVersions = tags
          .map(t => t.name.replace(/^v/, ''))
          .filter(v => /^\d+\.\d+\.\d+$/.test(v))
          .sort((a, b) => compareVersions(a, b, 'Sorter'));
        
        if (validVersions.length > 0) stable = validVersions[validVersions.length - 1];
      }
    } catch (e) { console.error("[GITHUB API] Erro tags:", e.message); }

    let main = '---';
    try {
      const commitCount = await fetchTotalCommits(repo, 'main', headers);
      if (commitCount !== null) main = calculateVersionFromCount(commitCount);
    } catch (e) { console.error("[GITHUB API] Erro main:", e.message); }

    console.log(`[APP] [MAIN] Sincronização: Stable=${stable}, Main=${main}`);
    return { stable, main };
  } catch (error) {
    console.error('[GITHUB API] Falha conexão:', error.message);
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
    // Envia a versão calculada dinamicamente para o frontend
    mainWindow.webContents.send('app-version', CURRENT_CALCULATED_VERSION);
    const versions = await fetchGitHubVersions();
    mainWindow.webContents.send('sync-versions', versions);
  });
}

// IPC Listeners
ipcMain.on('check-update', async (event, branch) => {
  const targetBranch = branch || 'stable';
  const current = CURRENT_CALCULATED_VERSION;
  console.log(`[APP] [UPDATE] Verificação: Canal=${targetBranch}, Local=${current}`);
  
  if (app.isPackaged && targetBranch === 'stable') {
    console.log('[APP] [UPDATE] Verificando atualizações via autoUpdater oficial...');
    autoUpdater.checkForUpdates();
  } else {
    const versions = await fetchGitHubVersions();
    mainWindow.webContents.send('sync-versions', versions);
    
    const remote = (targetBranch === 'main') ? versions.main : versions.stable;
    if (remote === 'Erro' || remote === '---') return;

    const comparison = compareVersions(remote, current, 'ManualCheck');

    if (comparison !== 0) {
      mainWindow.webContents.send('update-available', { 
        version: remote, 
        updateType: comparison > 0 ? 'upgrade' : 'downgrade',
        releaseNotes: targetBranch === 'main' 
          ? 'Novos commits detectados na branch main. Esta versão não possui release oficial e deve ser baixada manualmente.' 
          : `Nova versão estável ${remote} disponível.`,
        isManual: true,
        branch: targetBranch
      });
    } else {
      mainWindow.webContents.send('update-not-available');
    }
  }
});

ipcMain.on('start-download', (event, branch) => { 
  console.log(`[APP] [UPDATE] Solicitação de download. Canal: ${branch}, Packaged: ${app.isPackaged}`);

  if (branch === 'main') {
    console.log("[APP] [UPDATE] Canal WIP/Main: Redirecionando para download do código fonte (ZIP).");
    shell.openExternal('https://github.com/Hamilton-Junior/psqlBuddy/archive/refs/heads/main.zip');
  } else if (app.isPackaged) {
    console.log("[APP] [UPDATE] Canal Stable (Packaged): Acionando autoUpdater.downloadUpdate().");
    autoUpdater.downloadUpdate(); 
  } else {
    console.log("[APP] [UPDATE] Canal Stable (Modo Dev): autoUpdater desabilitado em modo não empacotado. Redirecionando para página de releases.");
    shell.openExternal('https://github.com/Hamilton-Junior/psqlBuddy/releases');
  }
});

ipcMain.on('install-update', () => { 
  if (app.isPackaged) {
    console.log("[APP] [UPDATE] Instalando atualização e reiniciando...");
    autoUpdater.quitAndInstall(); 
  }
});

app.whenReady().then(() => { 
  startBackend(); 
  createWindow(); 
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});