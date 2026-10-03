import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
} from "electron";
import * as path from "path";
import { AgentSession } from "./agent/session";
import { listDirectory, readTextFile } from "./agent/tools";

let mainWindow: BrowserWindow | null = null;
let workspaceRoot = process.cwd();
const agent = new AgentSession(() => workspaceRoot);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0b1020",
    title: "NoobCode",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173";
  if (!app.isPackaged) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("workspace:get", async () => workspaceRoot);

ipcMain.handle("workspace:pick", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return workspaceRoot;
  workspaceRoot = result.filePaths[0];
  return workspaceRoot;
});

ipcMain.handle("workspace:set", async (_evt, nextRoot: string) => {
  workspaceRoot = nextRoot;
  return workspaceRoot;
});

ipcMain.handle("fs:list", async (_evt, relPath = ".") => {
  return listDirectory(workspaceRoot, relPath);
});

ipcMain.handle("fs:read", async (_evt, relPath: string) => {
  return readTextFile(workspaceRoot, relPath);
});

ipcMain.handle("ollama:listModels", async () => agent.listModels());

ipcMain.handle(
  "agent:run",
  async (
    _evt,
    payload: { prompt: string; model: string; history?: { role: string; content: string }[] }
  ) => {
    const send = (event: string, data: unknown) => {
      mainWindow?.webContents.send("agent:event", { event, data });
    };
    return agent.run(payload.prompt, payload.model, payload.history || [], send);
  }
);

ipcMain.handle("agent:stop", async () => {
  agent.stop();
  return true;
});

ipcMain.handle("shell:openExternal", async (_evt, url: string) => {
  await shell.openExternal(url);
  return true;
});
