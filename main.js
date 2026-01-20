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

// Configurações do autoUpdater oficial
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
  if (
    !v1 ||
    v1 === "---" ||
    !v2 ||
    v2 === "---" ||
    v1 === "..." ||
    v2 === "..."
  )
    return 0;
  const cleanV1 = v1.replace(/^v/, "");
  const cleanV2 = v2.replace(/^v/, "");
  const p1 = cleanV1.split(".").map((n) => parseInt(n, 10) || 0);
  const p2 = cleanV2.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

/**
 * Simulador de download para ambiente de Desenvolvimento
 */
async function simulateDownloadInDev(branch) {
  const repo = "Hamilton-Junior/psqlBuddy";
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  const headers = { "User-Agent": "PSQL-Buddy-Dev-Tester" };

  console.log(`[DEV-DOWNLOAD] Buscando assets em: ${url}`);

  https
    .get(url, { headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const release = JSON.parse(data);
          const asset = release.assets.find(
            (a) =>
              a.name.endsWith(".exe") ||
              a.name.endsWith(".dmg") ||
              a.name.endsWith(".AppImage"),
          );

          if (!asset) {
            mainWindow.webContents.send(
              "update-error",
              "Nenhum binário encontrado na release para simular download.",
            );
            return;
          }

          const downloadUrl = asset.browser_download_url;
          const tempPath = path.join(app.getPath("temp"), asset.name);
          const file = fs.createWriteStream(tempPath);

          https.get(downloadUrl, (downloadRes) => {
            if (downloadRes.statusCode === 302) {
              https.get(downloadRes.headers.location, (finalRes) =>
                startStream(finalRes, asset.size, file),
              );
            } else {
              startStream(downloadRes, asset.size, file);
            }
          });
        } catch (e) {
          mainWindow.webContents.send(
            "update-error",
            "Erro ao processar JSON da release GitHub.",
          );
        }
      });
    })
    .on("error", (err) => {
      mainWindow.webContents.send(
        "update-error",
        "Erro de conexão com GitHub API.",
      );
    });

  function startStream(response, totalSize, fileStream) {
    let downloaded = 0;
    response.pipe(fileStream);
    response.on("data", (chunk) => {
      downloaded += chunk.length;
      const percent = (downloaded / totalSize) * 100;
      mainWindow.webContents.send("update-downloading", {
        percent: Math.round(percent),
      });
    });
    response.on("end", () => {
      mainWindow.webContents.send("update-ready");
    });
  }
}

async function fetchGitHubVersions() {
  const repo = "Hamilton-Junior/psqlBuddy";
  const headers = {
    "User-Agent": "PSQL-Buddy-App",
    Accept: "application/vnd.github.v3+json",
  };

  try {
    let stable = "---";
    let main = "---";

    // 1. Buscar Tags (Versão Estável)
    const tagsRes = await fetch(
      `https://api.github.com/repos/${repo}/tags?per_page=5`,
      { headers },
    );
    if (tagsRes.ok) {
      const tags = await tagsRes.json();
      const valid = tags
        .map((t) => t.name.replace(/^v/, ""))
        .filter((v) => /^\d+\.\d+\.\d+$/.test(v))
        .sort(compareVersions);
      if (valid.length > 0) stable = valid[valid.length - 1];
    }

    // 2. Buscar Contagem de Commits da Main (Versão Dev)
    // Técnica: Pedir 1 commit por página e olhar o header 'Link' para ver a última página
    const commitsRes = await fetch(
      `https://api.github.com/repos/${repo}/commits?sha=main&per_page=1`,
      { headers },
    );
    if (commitsRes.ok) {
      const linkHeader = commitsRes.headers.get("link");
      let count = 0;

      if (linkHeader) {
        const match = linkHeader.match(/&page=(\d+)>; rel="last"/);
        if (match) {
          count = parseInt(match[1], 10);
        }
      } else {
        // Se não houver link header, ou tem 1 commit ou nenhum
        const commits = await commitsRes.json();
        count = commits.length;
      }

      if (count > 0) {
        const major = Math.floor(count / 1000);
        const minor = Math.floor((count % 1000) / 100);
        const patch = count % 100;
        main = `${major}.${minor}.${patch}`;
      }
    }

    console.log(
      `[UPDATE] Versões detectadas no GitHub -> Stable: ${stable}, Main: ${main}`,
    );
    return { stable, main };
  } catch (error) {
    console.error("[UPDATE] Erro ao buscar versões remotas:", error);
    return { stable: "Erro", main: "Erro" };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    title: "PSQL Buddy",
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#0f172a", symbolColor: "#94a3b8" },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist/index.html"));
  }

  mainWindow.webContents.on("did-finish-load", async () => {
    mainWindow.webContents.send("app-version", CURRENT_VERSION);
    const versions = await fetchGitHubVersions();
    mainWindow.webContents.send("sync-versions", versions);
  });
}

// Eventos autoUpdater Oficiais
autoUpdater.on("update-available", (info) => {
  mainWindow.webContents.send("update-available", {
    version: info.version,
    updateType:
      compareVersions(info.version, CURRENT_VERSION) > 0
        ? "upgrade"
        : "downgrade",
    branch: "stable",
  });
});
autoUpdater.on("update-not-available", () =>
  mainWindow.webContents.send("update-not-available"),
);
autoUpdater.on("download-progress", (p) =>
  mainWindow.webContents.send("update-downloading", p),
);
autoUpdater.on("update-downloaded", () =>
  mainWindow.webContents.send("update-ready"),
);
autoUpdater.on("error", (e) =>
  mainWindow.webContents.send("update-error", e.message),
);

ipcMain.on("check-update", async (event, branch) => {
  console.log(`[UPDATE] Verificando: ${branch}`);
  if (app.isPackaged && branch === "stable") {
    autoUpdater.checkForUpdates();
  } else {
    const versions = await fetchGitHubVersions();
    const remote = branch === "main" ? versions.main : versions.stable;
    const comp = compareVersions(remote, CURRENT_VERSION);
    if (comp !== 0) {
      mainWindow.webContents.send("update-available", {
        version: remote,
        updateType: comp > 0 ? "upgrade" : "downgrade",
        isManual: true,
        branch,
      });
    } else {
      mainWindow.webContents.send("update-not-available");
    }
  }
});

ipcMain.on("refresh-remote-versions", async () => {
  const versions = await fetchGitHubVersions();
  mainWindow.webContents.send("sync-versions", versions);
});

ipcMain.on("start-download", (event, branch) => {
  if (branch === "stable") {
    if (app.isPackaged) {
      autoUpdater.downloadUpdate();
    } else {
      simulateDownloadInDev(branch);
    }
  } else {
    shell.openExternal(
      "https://github.com/Hamilton-Junior/psqlBuddy/archive/refs/heads/main.zip",
    );
    mainWindow.webContents.send("update-error", "MANUAL_DOWNLOAD_TRIGGERED");
  }
});

ipcMain.on("install-update", () => {
  if (app.isPackaged) {
    autoUpdater.quitAndInstall();
  } else {
    shell.showItemInFolder(path.join(app.getPath("temp")));
  }
});

app.whenReady().then(() => { 
  if (!app.isPackaged) {
    const serverPath = path.join(__dirname, 'server.js');
    serverProcess = spawn(process.execPath, [serverPath], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: 'inherit' });
  }
  createWindow(); 
});

app.on('window-all-closed', () => { if (serverProcess) serverProcess.kill(); app.quit(); });