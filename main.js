import { app, BrowserWindow, ipcMain, net } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;
let updateUrl = "";

const GITHUB_REPO = "Hamilton-Junior/psqlBuddy";

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
        setTimeout(loadWithRetry, 2000);
      });
    };
    loadWithRetry();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

async function fetchGitHubData(apiPath) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      protocol: 'https:',
      hostname: 'api.github.com',
      path: apiPath,
      headers: { 
        'User-Agent': 'PSQLBuddy-App',
        'Accept': 'application/vnd.github.v3+json',
        'Cache-Control': 'no-cache'
      }
    });
    
    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ 
            json, 
            headers: response.headers, 
            status: response.statusCode,
            ok: response.statusCode >= 200 && response.statusCode < 300
          });
        } catch (e) {
          resolve({ json: {}, headers: response.headers, status: response.statusCode, ok: false });
        }
      });
    });
    request.on('error', (err) => reject(err));
    request.end();
  });
}

function parseTotalCommitsFromLink(linkHeader) {
  if (!linkHeader) return 0;
  const links = Array.isArray(linkHeader) ? linkHeader[0] : linkHeader;
  const match = links.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return match ? parseInt(match[1], 10) : 0;
}

function compareVersions(vRemote, vLocal) {
  console.log(`[DEBUG:Version] Iniciando comparação. Remota: "${vRemote}" | Local: "${vLocal}"`);
  if (!vRemote || !vLocal) return 'equal';
  
  const clean = (v) => String(v).trim().replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const r = clean(vRemote);
  const l = clean(vLocal);
  
  for (let i = 0; i < 3; i++) {
    const remoteVal = r[i] || 0;
    const localVal = l[i] || 0;
    if (remoteVal > localVal) {
      console.log(`[DEBUG:Version] Resultado: NEWER (Remoto ${remoteVal} > Local ${localVal})`);
      return 'newer';
    }
    if (remoteVal < localVal) {
      console.log(`[DEBUG:Version] Resultado: OLDER (Remoto ${remoteVal} < Local ${localVal})`);
      return 'older';
    }
  }
  return 'equal';
}

async function getGitHubBranchStatus(branch) {
  try {
    const response = await fetchGitHubData(`/repos/${GITHUB_REPO}/commits?sha=${branch}&per_page=1`);
    if (!response.ok) return { error: true, status: response.status, branch };
    const commits = response.json;
    const linkHeader = response.headers['link'];
    let count = parseTotalCommitsFromLink(linkHeader) || (Array.isArray(commits) ? commits.length : 0);
    const major = Math.floor(count / 1000);
    const minor = Math.floor((count % 1000) / 100);
    const patch = count % 100;
    const versionString = `${major}.${minor}.${patch}`;
    return {
      version: versionString,
      lastMessage: (Array.isArray(commits) && commits[0]?.commit?.message) || "Sem descrição.",
      url: `https://github.com/${GITHUB_REPO}/archive/refs/heads/${branch}.zip`,
      ok: true
    };
  } catch (e) { return { error: true, message: e.message }; }
}

function getAppVersion() {
  try {
    if (app.isPackaged) return app.getVersion();
    const commitCount = execSync('git rev-list --count HEAD').toString().trim();
    const count = parseInt(commitCount, 10) || 0;
    const major = Math.floor(count / 1000);
    const minor = Math.floor((count % 1000) / 100);
    const patch = count % 100;
    return `${major}.${minor}.${patch}`;
  } catch (e) { 
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
      return pkg.version;
    } catch (e2) { return '0.1.10'; }
  }
}

ipcMain.on('check-update', async (event, branch = 'stable') => {
  console.log(`[IPC] Verificando atualização canal: ${branch}`);
  try {
    const [mainStatus, stableStatus] = await Promise.all([
      getGitHubBranchStatus('main'),
      getGitHubBranchStatus('stable')
    ]);
    
    if (mainWindow) {
       mainWindow.webContents.send('sync-versions', {
          stable: stableStatus.ok ? stableStatus.version : "Erro",
          main: mainStatus.ok ? mainStatus.version : "Erro",
       });
    }
    
    const currentAppVersion = getAppVersion();
    const targetStatus = branch === 'main' ? mainStatus : stableStatus;

    if (targetStatus && targetStatus.ok) {
      updateUrl = targetStatus.url;
      const result = compareVersions(targetStatus.version, currentAppVersion);
      mainWindow.webContents.send('update-check-result', {
        comparison: result,
        remoteVersion: targetStatus.version,
        localVersion: currentAppVersion,
        notes: targetStatus.lastMessage,
        url: targetStatus.url,
        branch: branch === 'main' ? 'Main' : 'Stable'
      });
    }
  } catch (error) {
    console.error(`[IPC] Erro na verificação:`, error);
  }
});

ipcMain.on('start-download', () => {
  console.log(`[UPDATE] Iniciando download real: ${updateUrl}`);
  
  if (!updateUrl) {
    console.error("[UPDATE] URL de download não definida.");
    return;
  }

  // No Electron, para baixar arquivos grandes de forma robusta e mostrar progresso real:
  const request = net.request(updateUrl);
  
  request.on('response', (response) => {
    const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
    let receivedBytes = 0;
    const tempFilePath = path.join(os.tmpdir(), 'psqlbuddy-update.zip');
    const fileStream = fs.createWriteStream(tempFilePath);

    console.log(`[UPDATE] Tamanho total: ${totalBytes} bytes`);

    response.on('data', (chunk) => {
      receivedBytes += chunk.length;
      fileStream.write(chunk);
      
      if (totalBytes > 0) {
        const percent = (receivedBytes / totalBytes) * 100;
        mainWindow.webContents.send('update-downloading', { percent });
      }
    });

    response.on('end', () => {
      fileStream.end();
      console.log(`[UPDATE] Download concluído em: ${tempFilePath}`);
      mainWindow.webContents.send('update-ready');
    });
  });

  request.on('error', (err) => {
    console.error(`[UPDATE] Erro no download: ${err.message}`);
  });

  request.end();
});

ipcMain.on('install-update', () => { 
  const isDev = !app.isPackaged;
  console.log(`[UPDATE] Solicitada instalação. Modo: ${isDev ? 'DESENVOLVIMENTO' : 'PRODUÇÃO'}`);
  
  if (isDev) {
    console.log("%c[AVISO] No modo dev (npm dev:all), o reinício não altera a versão.", "color: orange; font-weight: bold;");
    console.log("[DICA] Para atualizar o código-fonte realmente, utilize 'git pull'.");
    console.log("[INFO] O reinício simula o ciclo completo de atualização de um binário real.");
  }

  app.relaunch(); 
  app.exit(); 
});

app.whenReady().then(() => { startBackend(); createWindow(); });
app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});