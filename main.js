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
let downloadedZipPath = "";

const GITHUB_REPO = "Hamilton-Junior/psqlBuddy";

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
  console.log(`[MAIN] Criando janela principal. Preload path: ${preloadPath}`);
  
  if (!fs.existsSync(preloadPath)) {
    console.error(`[CRITICAL] Arquivo de preload NÃO encontrado no caminho: ${preloadPath}`);
  }

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
  console.log(`[UPDATE:Compare] Iniciando comparação: Remota(${vRemote}) vs Local(${vLocal})`);
  
  if (!vRemote || !vLocal) return 'equal';

  const parse = (v) => String(v).trim().replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const r = parse(vRemote);
  const l = parse(vLocal);
  
  // Garante que ambos tenham 3 partes
  while (r.length < 3) r.push(0);
  while (l.length < 3) l.push(0);

  for (let i = 0; i < 3; i++) {
    if (r[i] > l[i]) {
      console.log(`[UPDATE:Compare] Resultado: NEWER (Remoto ${vRemote} > Local ${vLocal})`);
      return 'newer';
    }
    if (r[i] < l[i]) {
      console.log(`[UPDATE:Compare] Resultado: OLDER (Remoto ${vRemote} < Local ${vLocal})`);
      return 'older';
    }
  }
  
  console.log(`[UPDATE:Compare] Resultado: EQUAL`);
  return 'equal';
}

async function getGitHubBranchStatus(branch) {
  try {
    const response = await fetchGitHubData(`/repos/${GITHUB_REPO}/commits?sha=${branch}&per_page=1`);
    if (!response.ok) return { error: true, status: response.status, branch };
    
    const commits = response.json;
    const linkHeader = response.headers['link'];
    
    let count = parseTotalCommitsFromLink(linkHeader);
    if (count === 0 && Array.isArray(commits)) count = commits.length;

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
  } catch (e) { 
    return { error: true, message: e.message }; 
  }
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
    const currentAppVersion = getAppVersion();
    
    const [mainS, stableS] = await Promise.all([
      getGitHubBranchStatus('main'),
      getGitHubBranchStatus('stable')
    ]);
    
    if (mainWindow) {
       mainWindow.webContents.send('sync-versions', {
          stable: stableS.ok ? stableS.version : "Erro",
          main: mainS.ok ? mainS.version : "Erro",
       });
    }

    const targetStatus = branch === 'main' ? mainS : stableS;

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
  if (!updateUrl) return;

  const request = net.request(updateUrl);
  request.on('response', (response) => {
    const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
    let receivedBytes = 0;
    const tempFileName = `psqlbuddy-update-${Date.now()}.zip`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);
    const fileStream = fs.createWriteStream(tempFilePath);

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
      downloadedZipPath = tempFilePath;
      console.log(`[UPDATE] Arquivo baixado em: ${tempFilePath}`);
      mainWindow.webContents.send('update-ready', { path: tempFilePath });
    });
  });
  request.on('error', (err) => {
     console.error("[UPDATE] Erro no download:", err);
     mainWindow.webContents.send('update-error', { message: err.message });
  });
  request.end();
});

ipcMain.on('install-update', () => { 
  const isDev = !app.isPackaged;
  const appPath = app.getAppPath();
  const exePath = process.execPath;
  
  console.log(`[UPDATE] Iniciando instalação real...`);
  console.log(`[UPDATE] Path da App: ${appPath}`);
  console.log(`[UPDATE] Zip Path: ${downloadedZipPath}`);

  if (!downloadedZipPath || !fs.existsSync(downloadedZipPath)) {
    console.error("[UPDATE] Arquivo de atualização não encontrado.");
    return;
  }

  if (isDev) {
    console.warn("[DEV MODE] Relaunch simulado. Em produção, os arquivos seriam extraídos.");
    app.relaunch(); 
    app.exit();
    return;
  }

  // Lógica de atualização "Real" em produção via script externo
  // Este script espera o processo morrer, extrai o zip por cima do app e reinicia.
  const isWin = process.platform === 'win32';
  const scriptPath = path.join(os.tmpdir(), isWin ? 'updater.bat' : 'updater.sh');
  
  let scriptContent = "";
  if (isWin) {
    // Windows Batch + PowerShell para extração
    scriptContent = `@echo off
echo Instalando atualizacao do PSQL Buddy...
timeout /t 2 /nobreak > nul
powershell -Command "Expand-Archive -Path '${downloadedZipPath}' -DestinationPath '${path.dirname(appPath)}' -Force"
start "" "${exePath}"
del "%~f0"
`;
  } else {
    // Linux/Mac Shell Script
    scriptContent = `#!/bin/bash
sleep 2
unzip -o "${downloadedZipPath}" -d "${path.dirname(appPath)}"
open "${exePath}" || "${exePath}" &
rm "$0"
`;
  }

  try {
    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
    
    // Executa o script de forma independente e fecha o app
    const child = spawn(isWin ? 'cmd.exe' : '/bin/sh', [isWin ? '/c' : '', scriptPath], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    
    app.quit();
  } catch (e) {
    console.error("[UPDATE] Erro ao criar script de atualização:", e);
    app.relaunch();
    app.exit();
  }
});

app.whenReady().then(() => { startBackend(); createWindow(); });
app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
