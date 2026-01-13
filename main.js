import { app, BrowserWindow, ipcMain, net } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

// ATENÇÃO: Verifique se este caminho está correto no seu GitHub
const GITHUB_REPO = "Hamilton-Junior/psql-buddy";

function startBackend() {
  const isDev = !app.isPackaged;
  if (isDev && process.env.SKIP_BACKEND === '1') return;
  
  const nodeServerPath = path.join(__dirname, 'server.js');
  
  serverProcess = spawn(process.execPath, [nodeServerPath], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit'
  });

  serverProcess.on('error', (err) => {
    console.error("[BACKEND] Falha ao iniciar servidor Node.js:", err.message);
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

// --- LOGICA DE VERSÃO E ATUALIZAÇÃO MELHORADA ---

async function fetchGitHubData(apiPath) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      protocol: 'https:',
      hostname: 'api.github.com',
      path: apiPath,
      headers: { 
        'User-Agent': 'PSQL-Buddy-App',
        'Accept': 'application/vnd.github.v3+json'
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

async function getGitHubBranchStatus(branch) {
  try {
    // Busca informações da branch para validar existência
    const branchCheck = await fetchGitHubData(`/repos/${GITHUB_REPO}/branches/${branch}`);
    if (!branchCheck.ok) {
       return { error: true, status: branchCheck.status, branch, ok: false };
    }

    // Busca o contador de commits
    const response = await fetchGitHubData(`/repos/${GITHUB_REPO}/commits?sha=${branch}&per_page=1`);
    if (!response.ok) return { error: true, status: response.status, ok: false };

    const commits = response.json;
    const linkHeader = response.headers['link'];
    let count = parseTotalCommitsFromLink(linkHeader);

    // Se não houver link header, mas houver commits, o contador é a quantidade retornada (repos muito pequenos)
    if (count === 0 && Array.isArray(commits)) count = commits.length;

    const major = Math.floor(count / 1000);
    const minor = Math.floor((count % 1000) / 100);
    const patch = count % 100;
    const versionString = `${major}.${minor}.${patch}`;

    return {
      version: versionString,
      commitCount: count,
      lastMessage: (Array.isArray(commits) && commits[0]?.commit?.message) || "Sem descrição.",
      url: `https://github.com/${GITHUB_REPO}/archive/refs/heads/${branch}.zip`,
      ok: true,
      branch
    };
  } catch (e) { 
    return { error: true, message: e.message, ok: false }; 
  }
}

ipcMain.on('check-update', async (event, requestedBranch = 'stable') => {
  try {
    // Tenta as 3 branches mais comuns para garantir que teremos algo para comparar
    const [mainStatus, stableStatus, masterStatus] = await Promise.all([
      getGitHubBranchStatus('main'),
      getGitHubBranchStatus('stable'),
      getGitHubBranchStatus('master')
    ]);

    const versionsInfo = {
      stable: stableStatus.ok ? stableStatus.version : (mainStatus.ok ? mainStatus.version : (masterStatus.ok ? masterStatus.version : "N/A")),
      main: mainStatus.ok ? mainStatus.version : (masterStatus.ok ? masterStatus.version : "N/A"),
    };

    if (mainWindow && !mainWindow.isDestroyed()) {
       mainWindow.webContents.send('sync-versions', versionsInfo);
    }

    // Pega a versão LOCAL (injetada no build)
    const currentAppVersion = app.isPackaged ? app.getVersion() : '0.1.10'; 
    
    // Define qual status remoto usar para comparação de atualização
    let targetStatus = null;
    if (requestedBranch === 'stable' && stableStatus.ok) targetStatus = stableStatus;
    else if (mainStatus.ok) targetStatus = mainStatus;
    else if (masterStatus.ok) targetStatus = masterStatus;

    if (targetStatus && targetStatus.ok) {
      if (targetStatus.version !== currentAppVersion) {
        mainWindow.webContents.send('update-available', {
          version: targetStatus.version,
          notes: targetStatus.lastMessage,
          branch: targetStatus.branch,
          allVersions: versionsInfo,
          downloadUrl: targetStatus.url
        });
      } else {
        mainWindow.webContents.send('update-not-available', { version: currentAppVersion });
      }
    } else {
       // Se chegamos aqui, o repositório ou as branches não foram encontrados
       const errorMsg = `GitHub respondeu 404 para o repositório ${GITHUB_REPO}. Verifique se o nome do repositório no main.js está idêntico ao do seu GitHub (Case Sensitive).`;
       mainWindow.webContents.send('update-error', { message: errorMsg });
    }
  } catch (error) {
    mainWindow.webContents.send('update-error', { message: "Erro de conexão ao consultar GitHub." });
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

ipcMain.on('install-update', () => { 
  app.relaunch(); 
  app.exit(); 
});

app.whenReady().then(() => { startBackend(); createWindow(); });

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
