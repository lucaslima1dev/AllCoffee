import { contextBridge, ipcRenderer } from "electron";

export type AgentEventPayload = {
  event: string;
  data: unknown;
};

contextBridge.exposeInMainWorld("noobcode", {
  getWorkspace: () => ipcRenderer.invoke("workspace:get"),
  pickWorkspace: () => ipcRenderer.invoke("workspace:pick"),
  setWorkspace: (root: string) => ipcRenderer.invoke("workspace:set", root),
  listDir: (relPath?: string) => ipcRenderer.invoke("fs:list", relPath),
  readFile: (relPath: string) => ipcRenderer.invoke("fs:read", relPath),
  listModels: () => ipcRenderer.invoke("ollama:listModels"),
  runAgent: (payload: {
    prompt: string;
    model: string;
    history?: { role: string; content: string }[];
  }) => ipcRenderer.invoke("agent:run", payload),
  stopAgent: () => ipcRenderer.invoke("agent:stop"),
  openExternal: (url: string) => ipcRenderer.invoke("shell:openExternal", url),
  onAgentEvent: (cb: (payload: AgentEventPayload) => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: AgentEventPayload) => cb(payload);
    ipcRenderer.on("agent:event", listener);
    return () => ipcRenderer.removeListener("agent:event", listener);
  },
});
