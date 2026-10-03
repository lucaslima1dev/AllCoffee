import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import type { DirEntry } from "./vite-env";

type ChatItem =
  | { id: string; kind: "user" | "assistant"; content: string }
  | { id: string; kind: "tool"; content: string };

type BrowserApi = {
  getWorkspace: () => Promise<string>;
  pickWorkspace: () => Promise<string>;
  listDir: (relPath?: string) => Promise<DirEntry[]>;
  readFile: (relPath: string) => Promise<{ path: string; content: string }>;
  listModels: () => Promise<string[]>;
  runAgent: (payload: {
    prompt: string;
    model: string;
    history?: { role: string; content: string }[];
  }) => Promise<{ ok: boolean; final?: string; error?: string; stopped?: boolean }>;
  stopAgent: () => Promise<boolean>;
  onAgentEvent: (cb: (payload: { event: string; data: unknown }) => void) => () => void;
};

const browserFallback: BrowserApi = {
  async getWorkspace() {
    return "(abra no Electron para usar o filesystem)";
  },
  async pickWorkspace() {
    return "(disponível só no app Electron)";
  },
  async listDir() {
    return [];
  },
  async readFile() {
    return { path: "", content: "" };
  },
  async listModels() {
    try {
      const res = await fetch("http://127.0.0.1:11434/api/tags");
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: { name: string }[] };
      return (data.models || []).map((m) => m.name);
    } catch {
      return [];
    }
  },
  async runAgent() {
    return {
      ok: false,
      error: "Agent completo só no Electron. Aqui é preview da UI.",
    };
  },
  async stopAgent() {
    return true;
  },
  onAgentEvent() {
    return () => undefined;
  },
};

function api(): BrowserApi {
  return window.noobcode || browserFallback;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function languageFromPath(filePath: string) {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "html":
      return "html";
    case "md":
      return "markdown";
    case "py":
      return "python";
    case "rs":
      return "rust";
    case "go":
      return "go";
    default:
      return "plaintext";
  }
}

export default function App() {
  const [workspace, setWorkspace] = useState("");
  const [files, setFiles] = useState<DirEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("// Abra uma pasta e selecione um arquivo");
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("qwen2.5-coder:7b");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      id: "welcome",
      kind: "assistant",
      content:
        "NoobCode pronto. Escolha a pasta do projeto, confirme o modelo Ollama e peça o que quiser: criar site, instalar deps, rodar servidor, corrigir bug.",
    },
  ]);
  const [status, setStatus] = useState("idle");
  const [running, setRunning] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const history = useMemo(
    () =>
      messages
        .filter((m) => m.kind === "user" || m.kind === "assistant")
        .map((m) => ({ role: m.kind, content: m.content })),
    [messages]
  );

  async function refreshFiles(rootLabel?: string) {
    const entries = await api().listDir(".");
    setFiles(entries);
    if (rootLabel) setWorkspace(rootLabel);
  }

  useEffect(() => {
    (async () => {
      const root = await api().getWorkspace();
      setWorkspace(root);
      await refreshFiles(root);
      const available = await api().listModels();
      setModels(available);
      if (available.length) {
        const preferred =
          available.find((m) => m.includes("coder")) ||
          available.find((m) => m.includes("qwen")) ||
          available[0];
        setModel(preferred);
      }
    })();

    const off = api().onAgentEvent((payload) => {
      if (payload.event === "status") {
        const data = payload.data as { state?: string; step?: number };
        if (data.state === "thinking") setStatus(`pensando (passo ${data.step})`);
        else if (data.state === "running") setStatus("rodando");
        else if (data.state === "done") setStatus("concluído");
        else if (data.state === "stopped") setStatus("parado");
        else setStatus(data.state || "…");
      }
      if (payload.event === "assistant") {
        const data = payload.data as { content: string; partial?: boolean };
        setMessages((prev) => {
          if (data.partial) {
            return [...prev, { id: uid(), kind: "assistant", content: data.content }];
          }
          const last = prev[prev.length - 1];
          if (last?.kind === "assistant" && last.content === data.content) return prev;
          return [...prev, { id: uid(), kind: "assistant", content: data.content }];
        });
      }
      if (payload.event === "tool:start") {
        const data = payload.data as { name: string; args: unknown };
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            kind: "tool",
            content: `▶ ${data.name}\n${JSON.stringify(data.args, null, 2)}`,
          },
        ]);
      }
      if (payload.event === "tool:result") {
        const data = payload.data as { name: string; result: unknown };
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            kind: "tool",
            content: `✓ ${data.name}\n${JSON.stringify(data.result, null, 2).slice(0, 2500)}`,
          },
        ]);
        void refreshFiles();
      }
      if (payload.event === "error") {
        const data = payload.data as { message: string };
        setStatus("erro");
        setMessages((prev) => [
          ...prev,
          { id: uid(), kind: "assistant", content: `Erro: ${data.message}` },
        ]);
      }
    });

    return off;
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, running]);

  async function onPickWorkspace() {
    const root = await api().pickWorkspace();
    setWorkspace(root);
    setCurrentPath(null);
    setFileContent("// Selecione um arquivo");
    await refreshFiles(root);
  }

  async function openFile(entry: DirEntry) {
    if (entry.type === "dir") {
      const nested = await api().listDir(entry.path);
      const parent = entry.path.includes("/")
        ? entry.path.split("/").slice(0, -1).join("/")
        : ".";
      const withParent: DirEntry[] =
        entry.path === "."
          ? nested
          : [{ name: "..", path: parent || ".", type: "dir" }, ...nested];
      setFiles(withParent);
      return;
    }
    const file = await api().readFile(entry.path);
    setCurrentPath(file.path);
    setFileContent(file.content);
  }

  async function sendPrompt() {
    const text = prompt.trim();
    if (!text || running) return;
    setPrompt("");
    setRunning(true);
    setStatus("rodando");
    setMessages((prev) => [...prev, { id: uid(), kind: "user", content: text }]);

    const result = await api().runAgent({
      prompt: text,
      model,
      history,
    });

    // Respostas do assistant já chegam via onAgentEvent; aqui só erros sem event.
    if (!result.ok && result.error) {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const msg = `Falha: ${result.error}`;
        if (last?.kind === "assistant" && last.content.includes(result.error || "")) return prev;
        return [...prev, { id: uid(), kind: "assistant", content: msg }];
      });
      setStatus("erro");
    }

    await refreshFiles();
    if (currentPath) {
      try {
        const file = await api().readFile(currentPath);
        setFileContent(file.content);
      } catch {
        /* arquivo pode ter sido movido */
      }
    }
    setRunning(false);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>NoobCode</strong>
          <span>agent local</span>
        </div>
        <div className="workspace">
          <button className="btn" onClick={onPickWorkspace}>
            Abrir pasta
          </button>
          <code title={workspace}>{workspace || "…"}</code>
        </div>
        <div className="controls">
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {models.length === 0 ? (
              <option value={model}>{model} (instale Ollama)</option>
            ) : (
              models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))
            )}
          </select>
          {running ? (
            <button className="btn danger" onClick={() => api().stopAgent()}>
              Parar
            </button>
          ) : null}
        </div>
      </header>

      <div className="main">
        <aside className="panel">
          <h2>Arquivos</h2>
          <div className="file-list">
            {files.length === 0 ? (
              <div className="empty">Nenhum arquivo listado. Abra uma pasta do projeto.</div>
            ) : (
              files.map((f) => (
                <button
                  key={f.path}
                  className={`file-item ${f.type} ${currentPath === f.path ? "active" : ""}`}
                  onClick={() => openFile(f)}
                >
                  {f.type === "dir" ? "📁 " : "📄 "}
                  {f.name}
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="editor-wrap panel">
          <div className="editor-path">{currentPath || "sem arquivo"}</div>
          <Editor
            theme="vs-dark"
            path={currentPath || "scratch.ts"}
            language={languageFromPath(currentPath || "ts")}
            value={fileContent}
            onChange={(value) => setFileContent(value || "")}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              automaticLayout: true,
              wordWrap: "on",
            }}
          />
        </section>

        <aside className="panel chat">
          <h2>Agent</h2>
          <div className="messages">
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.kind}`}>
                <div className="role">{m.kind}</div>
                <pre>{m.content}</pre>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="composer">
            <textarea
              value={prompt}
              placeholder="Ex: cria um site Next.js na pasta atual, instala deps e sobe o dev server"
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void sendPrompt();
                }
              }}
            />
            <div className="composer-actions">
              <span className={`status ${running ? "running" : status === "erro" ? "error" : ""}`}>
                {running ? status : status === "idle" ? "Ctrl+Enter para enviar" : status}
              </span>
              <button className="btn primary" disabled={running || !prompt.trim()} onClick={() => void sendPrompt()}>
                Enviar
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
