export type DirEntry = {
  name: string;
  path: string;
  type: "dir" | "file";
};

export type AgentEventPayload = {
  event: string;
  data: unknown;
};

export type NoobCodeAPI = {
  getWorkspace: () => Promise<string>;
  pickWorkspace: () => Promise<string>;
  setWorkspace: (root: string) => Promise<string>;
  listDir: (relPath?: string) => Promise<DirEntry[]>;
  readFile: (relPath: string) => Promise<{ path: string; content: string }>;
  listModels: () => Promise<string[]>;
  runAgent: (payload: {
    prompt: string;
    model: string;
    history?: { role: string; content: string }[];
  }) => Promise<{ ok: boolean; final?: string; error?: string; stopped?: boolean }>;
  stopAgent: () => Promise<boolean>;
  openExternal: (url: string) => Promise<boolean>;
  onAgentEvent: (cb: (payload: AgentEventPayload) => void) => () => void;
};

declare global {
  interface Window {
    noobcode: NoobCodeAPI;
  }
}

export {};
