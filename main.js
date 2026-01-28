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

// Caminho para armazenamento persistente fora do escopo do navegador
const STORAGE_FILE = path.join(app.getPath('userData'), 'psqlbuddy_storage.json');

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
    let wip = '---';
    let bleedingEdge = '---';
    let totalCommits = 0;

    // Busca Releases para separar Estável de Pré-release (WIP)
    const releasesRes = await fetch(`https://api.github.com/repos/${repo}/releases`, { headers });
    if (releasesRes.ok) {
      const releases = await releasesRes.json();
      const latestStable = releases.find(r => !r.prerelease);
      const latestWip = releases.find(r => r.prerelease);
      
      if (latestStable) stable = latestStable.tag_name.replace(/^v/, '');
      if (latestWip) wip = latestWip.tag_name.replace(/^v/, '');
    }

    // Busca Commits para o Bleeding Edge
    const commitsRes = await fetch(`https://api.github.com/repos/${repo}/commits?sha=main&per_page=1`, { headers });
    if (commitsRes.ok) {
       const link = commitsRes.headers.get('link');
       if (link) {
          const match = link.match(/&page=(\d+)>; rel="last"/);
          if (match) {
             totalCommits = parseInt(match[1]);
             const major = Math.floor(totalCommits / 1000);
             const minor = Math.floor((totalCommits % 1000) / 100);
             const patch = totalCommits % 100;
             bleedingEdge = `${major}.${minor}.${patch}`;
          }
       } else {
          const single = await commitsRes.json();
          if (Array.isArray(single)) {
             totalCommits = single.length;
             const major = Math.floor(totalCommits / 1000);
             const minor = Math.floor((totalCommits % 1000) / 100);
             const patch = totalCommits % 100;
             bleedingEdge = `${major}.${minor}.${patch}`;
          }
       }
    }
    return { stable, wip, bleedingEdge, totalCommits };
  } catch (e) { 
    console.error("[MAIN] Erro ao buscar versões remotas:", e);
    return { stable: 'Erro', wip: 'Erro', bleedingEdge: 'Erro', totalCommits: 0 }; 
  }
}

// Persistência de Dados
ipcMain.handle('get-persistent-store', async () => {
    console.log(`[MAIN] Solicitando leitura de persistência: ${STORAGE_FILE}`);
    try {
        if (fs.existsSync(STORAGE_FILE)) {
            const data = fs.readFileSync(STORAGE_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error("[MAIN] Erro ao ler arquivo de persistência:", e);
    }
    return {};
});

ipcMain.on('save-persistent-store', (event, data) => {
    try {
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
        console.log(`[MAIN] Persistência salva com sucesso (${Object.keys(data).length} chaves).`);
    } catch (e) {
        console.error("[MAIN] Falha crítica ao gravar persistência:", e);
    }
});

app.whenReady().then(() => { 
  startBackend();
  createWindow(); 
});

app.on('window-all-closed', () => { 
  if (serverChild) serverChild.kill();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('open-external', (event, url) => {
  if (url && typeof url === 'string' && url.startsWith('http')) {
    shell.openExternal(url);
  }
});

ipcMain.on('check-update', async (event, branch) => {
  console.log(`[MAIN] Verificando atualização para a branch: ${branch}`);
  const versions = await fetchGitHubVersions();
  
  const remoteVersion = branch === 'main' ? versions.wip : versions.stable;
  const comparison = compareVersions(remoteVersion, CURRENT_VERSION);

  if (comparison === 0) {
    console.log(`[MAIN] Nenhuma atualização necessária. Versão local ${CURRENT_VERSION} é idêntica à remota ${remoteVersion}.`);
    mainWindow.webContents.send('update-not-available');
    return;
  }

  const updateType = comparison < 0 ? 'downgrade' : 'upgrade';
  console.log(`[MAIN] Diferença de versão identificada (${updateType}): ${CURRENT_VERSION} -> ${remoteVersion}`);

  // Configura o autoUpdater de acordo com o canal selecionado e garante que downgrade seja permitido
  autoUpdater.allowPrerelease = (branch === 'main');
  autoUpdater.allowDowngrade = true;

  if (app.isPackaged) {
    autoUpdater.checkForUpdates().then((result) => {
       console.log("[MAIN] checkForUpdates concluído com sucesso.", result ? "Update encontrado" : "Nenhum update via library");
    }).catch((err) => {
      console.warn("[MAIN] Erro ao verificar via autoUpdater, enviando via IPC:", err.message);
      mainWindow.webContents.send('update-available', { 
        version: remoteVersion, 
        branch: branch === 'main' ? 'WIP' : 'Stable', 
        updateType,
        isManual: true 
      });
    });
  } else {
    mainWindow.webContents.send('update-available', { 
      version: remoteVersion, 
      branch: branch === 'main' ? 'WIP' : 'Stable', 
      updateType,
      isManual: true 
    });
  }
});

autoUpdater.on('update-available', (info) => {
  console.log(`[MAIN] Update disponível detectado pela library: ${info.version}`);
  const comparison = compareVersions(info.version, CURRENT_VERSION);
  const updateType = comparison < 0 ? 'downgrade' : 'upgrade';
  mainWindow.webContents.send('update-available', { 
    version: info.version, 
    releaseNotes: info.releaseNotes,
    updateType 
  });
});

autoUpdater.on('update-not-available', () => {
  console.log("[MAIN] Library reportou: Update não disponível.");
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
  console.log("[MAIN] Download do pacote de atualização concluído.");
  mainWindow.webContents.send('update-ready');
});

ipcMain.on('start-download', async () => {
  console.log("[MAIN] Solicitação de início de download recebida do renderer.");
  
  const initiateDownload = async () => {
    try {
        const paths = await autoUpdater.downloadUpdate();
        console.log("[MAIN] downloadUpdate() resolvido. Caminhos:", paths);
    } catch (err) {
        if (err.message && err.message.includes("Please check update first")) {
            console.log("[MAIN] Estado do updater inconsistente. Forçando nova verificação antes do download...");
            const checkResult = await autoUpdater.checkForUpdates();
            if (checkResult && checkResult.updateInfo) {
                console.log("[MAIN] UpdateInfo populado. Re-tentando download...");
                await autoUpdater.downloadUpdate();
            } else {
                throw new Error("Não foi possível localizar as informações do pacote de instalação no servidor.");
            }
        } else {
            throw err;
        }
    }
  };

  initiateDownload().catch(err => {
     console.error("[MAIN] Falha crítica ao processar downloadUpdate():", err);
     if (mainWindow) {
        mainWindow.webContents.send('update-error', `Erro ao baixar: ${err.message}`);
     }
  });
});

ipcMain.on('install-update', () => {
  console.log("[MAIN] Solicitando quitAndInstall()...");
  autoUpdater.quitAndInstall();
});

ipcMain.on('refresh-remote-versions', async () => {
    const versions = await fetchGitHubVersions();
    if (mainWindow) mainWindow.webContents.send('sync-versions', versions);
});