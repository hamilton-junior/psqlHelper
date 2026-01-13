
import { app, BrowserWindow, ipcMain, net } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

const GITHUB_REPO = "Hamilton-Junior/psql-buddy";

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
  mainWindow = new BrowserWindow({
    width: 1280, height: 850, minWidth: 1000, minHeight: 700,
    title: "PSQL Buddy",
    titleBarStyle: 'hidden', 
    titleBarOverlay: { color: '#0f172a', symbolColor: '#94a3b8', height: 35 },
    backgroundColor: '#0f172a',
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
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
}

// --- LOGICA DE VERSÃO E ATUALIZAÇÃO ---

async function fetchGitHubData(path) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET', protocol: 'https:', hostname: 'api.github.com', path,
      headers: { 'User-Agent': 'PSQL-Buddy-App' }
    });
    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          resolve({ json: data ? JSON.parse(data) : {}, headers: response.headers });
        } catch (e) {
          resolve({ json: {}, headers: response.headers });
        }
      });
    });
    request.on('error', reject);
    request.end();
  });
}

// Retorna o total de commits e a mensagem do último
async function getGitHubCommitStatus() {
  try {
    const { json: commits, headers } = await fetchGitHubData(`/repos/${GITHUB_REPO}/commits?per_page=1`);
    const link = headers['link'];
    let count = 0;

    if (link && Array.isArray(link)) {
      const lastPageMatch = link[0].match(/&page=(\d+)>; rel="last"/);
      if (lastPageMatch) count = parseInt(lastPageMatch[1], 10);
    } else if (Array.isArray(commits)) {
       count = commits.length;
    }

    const major = Math.floor(count / 1000);
    const minor = Math.floor((count % 1000) / 100);
    const patch = count % 100;

    return {
      version: `${major}.${minor}.${patch}`,
      commitCount: count,
      lastMessage: commits[0]?.commit?.message || "Sem descrição de commit.",
      url: `https://github.com/${GITHUB_REPO}/archive/refs/heads/main.zip`
    };
  } catch (e) { 
    return null; 
  }
}

ipcMain.on('check-update', async (event, branch = 'stable') => {
  try {
    const commitStatus = await getGitHubCommitStatus();
    const { json: releases } = await fetchGitHubData(`/repos/${GITHUB_REPO}/releases`);
    
    const releaseList = Array.isArray(releases) ? releases : [];
    const latestRelease = releaseList.find(r => !r.prerelease && !r.draft);
    const stableVer = latestRelease ? latestRelease.tag_name.replace('v', '') : "0.1.0";

    const versionsInfo = {
      stable: stableVer,
      main: commitStatus?.version || "0.0.0"
    };

    if (mainWindow && !mainWindow.isDestroyed()) {
       mainWindow.webContents.send('sync-versions', versionsInfo);
    }

    const currentAppVersion = app.getVersion();

    // Se o canal for Main, compararemos commits. Se for Stable, compararemos Releases.
    if (branch === 'main' && commitStatus) {
      if (commitStatus.version !== currentAppVersion) {
        mainWindow.webContents.send('update-available', {
          version: commitStatus.version,
          notes: `[Commit Update]\n${commitStatus.lastMessage}`,
          branch: 'Main (Git)',
          isPrerelease: true,
          allVersions: versionsInfo,
          downloadUrl: commitStatus.url
        });
      }
    } else if (branch === 'stable' && latestRelease) {
      const latestVersion = latestRelease.tag_name.replace('v', '');
      if (latestVersion !== currentAppVersion) {
        mainWindow.webContents.send('update-available', {
          version: latestVersion,
          notes: latestRelease.body,
          branch: 'Stable (Release)',
          isPrerelease: false,
          allVersions: versionsInfo
        });
      }
    }
  } catch (error) {
    console.error("[UPDATE] Erro GitHub:", error.message);
  }
});

ipcMain.on('start-download', () => {
  let progress = 0;
  const interval = setInterval(() => {
    progress += 10;
    mainWindow.webContents.send('update-downloading', { percent: Math.min(progress, 100) });
    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => mainWindow.webContents.send('update-ready'), 500);
    }
  }, 200);
});

ipcMain.on('install-update', () => { app.relaunch(); app.exit(); });

app.whenReady().then(() => { startBackend(); createWindow(); });

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
