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
  console.log(`[UPDATE:Compare] Verificando: Remota(${vRemote}) vs Local(${vLocal})`);
  
  if (!vRemote || !vLocal) return 'equal';

  const parse = (v) => String(v).trim().replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const r = parse(vRemote);
  const l = parse(vLocal);
  
  while (r.length < 3) r.push(0);
  while (l.length < 3) l.push(0);

  for (let i = 0; i < 3; i++) {
    if (r[i] > l[i]) return 'newer';
    if (r[i] < l[i]) return 'older';
  }
  
  return 'equal';
}

async function getGitHubBranchStatus(branch) {
  try {
    const response = await fetchGitHubData(`/repos/${GITHUB_REPO}/commits?sha=${branch}&per_page=1`);
    if (!response.ok) return { error: true, status: response.status, branch };
    
    const commits = response.json;
    const linkHeader = response.headers['link'] || response.headers['Link'];
    
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
  // Tenta SEMPRE calcular via git primeiro para manter consistência com o check remoto (baseado em commits)
  try {
    const commitCount = execSync('git rev-list --count HEAD').toString().trim();
    const count = parseInt(commitCount, 10) || 0;
    const major = Math.floor(count / 1000);
    const minor = Math.floor((count % 1000) / 100);
    const patch = count % 100;
    const dynamicVersion = `${major}.${minor}.${patch}`;
    console.log(`[VERSION] Versão dinâmica calculada via Git: ${dynamicVersion}`);
    return dynamicVersion;
  } catch (e) { 
    // Se falhar (ex: app instalado sem pasta .git), usa a versão do package ou do electron
    const version = app.getVersion();
    console.log(`[VERSION] Git indisponível. Usando versão do executável: ${version}`);
    return version;
  }
}

ipcMain.on('check-update', async (event, branch = 'stable') => {
  console.log(`[IPC] Verificando atualização no canal: ${branch}`);
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
      
      console.log(`[UPDATE] Resultado da comparação: ${result} (Remoto: ${targetStatus.version} vs Local: ${currentAppVersion})`);

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
      console.log(`[UPDATE] Download concluído: ${tempFilePath}`);
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
  const appPath = app.getAppPath(); // resources/app.asar ou pasta do app
  const exePath = process.execPath;
  const appDir = path.dirname(exePath); // Pasta onde está o .exe
  
  console.log(`[UPDATE] Iniciando instalação real...`);
  console.log(`[UPDATE] Pasta da aplicação: ${appDir}`);

  if (!downloadedZipPath || !fs.existsSync(downloadedZipPath)) {
    console.error("[UPDATE] Arquivo de atualização não localizado.");
    return;
  }

  if (isDev) {
    console.warn("[DEV MODE] Relaunch simulado. Em produção o ZIP seria extraído.");
    app.relaunch(); 
    app.exit();
    return;
  }

  const isWin = process.platform === 'win32';
  const scriptPath = path.join(os.tmpdir(), isWin ? `updater_${Date.now()}.bat` : `updater_${Date.now()}.sh`);
  const branchName = updateUrl.includes('/main.zip') ? 'main' : 'stable';
  const zipFolderName = `psqlBuddy-${branchName}`;

  let scriptContent = "";
  if (isWin) {
    // Windows: Espera 3s, extrai o ZIP para uma pasta temporária, move o conteúdo para a raiz e reinicia
    scriptContent = `@echo off
echo Atualizando PSQL Buddy... Por favor, aguarde.
timeout /t 3 /nobreak > nul
set "TEMP_EXTRACT=%TEMP%\psql_extract_%RANDOM%"
mkdir "%TEMP_EXTRACT%"
powershell -Command "Expand-Archive -Path '${downloadedZipPath.replace(/\\/g, '\\\\')}' -DestinationPath '%TEMP_EXTRACT%' -Force"
xcopy /s /y "%TEMP_EXTRACT%\\${zipFolderName}\\*" "${appDir}"
rmdir /s /q "%TEMP_EXTRACT%"
echo Instalacao concluida. Reiniciando...
start "" "${exePath}"
del "%~f0"
`;
  } else {
    // Unix: Mesma lógica usando unzip e sleep
    scriptContent = `#!/bin/bash
sleep 3
TEMP_EXTRACT="/tmp/psql_extract_$RANDOM"
mkdir -p "$TEMP_EXTRACT"
unzip -o "${downloadedZipPath}" -d "$TEMP_EXTRACT"
cp -R "$TEMP_EXTRACT/${zipFolderName}/"* "${appDir}/"
rm -rf "$TEMP_EXTRACT"
open "${exePath}" || "${exePath}" &
rm "$0"
`;
  }

  try {
    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
    console.log(`[UPDATE] Script de atualização gerado em: ${scriptPath}`);
    
    const child = spawn(isWin ? 'cmd.exe' : '/bin/sh', [isWin ? '/c' : '', scriptPath], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    
    app.quit();
  } catch (e) {
    console.error("[UPDATE] Erro ao disparar script de atualização:", e);
    app.relaunch();
    app.exit();
  }
});

app.whenReady().then(() => { startBackend(); createWindow(); });
app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
