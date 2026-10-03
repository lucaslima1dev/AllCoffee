import { chatOllama, listOllamaModels, type ChatMessage, type ToolCall } from "./ollama";
import {
  installPackage,
  listDirectory,
  readTextFile,
  runShell,
  webSearch,
  writeTextFile,
} from "./tools";

type Emit = (event: string, data: unknown) => void;

const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "Lista arquivos e pastas relativos ao workspace atual.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Caminho relativo. Use '.' para a raiz." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Lê um arquivo de texto do workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Cria ou sobrescreve um arquivo de texto no workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_terminal",
      description:
        "Executa um comando no terminal do sistema operacional, no diretório do workspace. Use para npm, git, builds, servidores, etc.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "install_program",
      description:
        "Instala um programa ou pacote na máquina. No Windows tenta winget; também aceita npm global. Roda sem pedir confirmação.",
      parameters: {
        type: "object",
        properties: {
          spec: {
            type: "string",
            description: "ID winget (ex: Git.Git) ou pacote npm (ex: typescript).",
          },
          manager: {
            type: "string",
            enum: ["auto", "winget", "npm", "choco"],
          },
        },
        required: ["spec"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Consulta a internet para dúvidas específicas (docs, APIs, erros). Use só quando precisar de informação atual/externa.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
];

function systemPrompt(workspaceRoot: string) {
  return `Você é o NoobCode, um agent de programação local parecido com o Cursor Agent.

Missão:
- Codar sites e apps web (HTML, CSS, JS/TS, React, Next, Node, Python web, etc.).
- Ter repertório forte de linguagens e boas práticas.
- Usar a máquina do usuário de verdade: ler/escrever arquivos, rodar terminal, instalar programas.
- Internet só para consultas específicas (docs, erros, versões). O foco é conhecimento de programação + execução local.

Regras de operação:
- Workspace atual: ${workspaceRoot}
- Seja autônomo: execute tools sem pedir permissão a cada passo.
- Prefira ações concretas (criar arquivo, instalar, rodar) em vez de só explicar.
- Responda em português do Brasil, curto e direto.
- Quando terminar, resuma o que fez e como rodar.
- Sistema: ${process.platform}. No Windows use comandos compatíveis (cmd/PowerShell/winget/npm).
`;
}

function parseArgs(raw: string | Record<string, unknown>) {
  if (typeof raw === "object" && raw) return raw;
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

export class AgentSession {
  private stopped = false;

  constructor(private getRoot: () => string) {}

  stop() {
    this.stopped = true;
  }

  async listModels() {
    return listOllamaModels();
  }

  async run(
    prompt: string,
    model: string,
    history: { role: string; content: string }[],
    emit: Emit
  ) {
    this.stopped = false;
    const root = this.getRoot();
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt(root) },
      ...history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-12)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: prompt },
    ];

    emit("status", { state: "running", model, workspace: root });

    const maxSteps = 16;
    for (let step = 0; step < maxSteps; step++) {
      if (this.stopped) {
        emit("status", { state: "stopped" });
        return { ok: false, stopped: true, final: "Interrompido." };
      }

      emit("status", { state: "thinking", step: step + 1 });
      let response;
      try {
        response = await chatOllama({ model, messages, tools: TOOL_DEFS });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit("error", { message });
        return { ok: false, error: message };
      }

      const assistant = response.message;
      messages.push(assistant);

      const toolCalls = assistant.tool_calls || [];
      if (!toolCalls.length) {
        const finalText = assistant.content || "(sem resposta)";
        emit("assistant", { content: finalText });
        emit("status", { state: "done" });
        return { ok: true, final: finalText };
      }

      if (assistant.content?.trim()) {
        emit("assistant", { content: assistant.content, partial: true });
      }

      for (const call of toolCalls) {
        if (this.stopped) break;
        const result = await this.executeTool(call, root, emit);
        messages.push({
          role: "tool",
          tool_name: call.function.name,
          content: JSON.stringify(result).slice(0, 24_000),
        });
      }
    }

    const fallback = "Limite de passos do agent atingido. Peça para continuar.";
    emit("assistant", { content: fallback });
    emit("status", { state: "done" });
    return { ok: true, final: fallback, truncated: true };
  }

  private async executeTool(call: ToolCall, root: string, emit: Emit) {
    const name = call.function.name;
    const args = parseArgs(call.function.arguments);
    emit("tool:start", { name, args });

    try {
      let result: unknown;
      switch (name) {
        case "list_dir":
          result = await listDirectory(root, String(args.path || "."));
          break;
        case "read_file":
          result = await readTextFile(root, String(args.path || ""));
          break;
        case "write_file":
          result = await writeTextFile(root, String(args.path || ""), String(args.content ?? ""));
          break;
        case "run_terminal":
          result = await runShell(String(args.command || ""), root);
          break;
        case "install_program":
          result = await installPackage(
            String(args.spec || ""),
            (args.manager as "auto" | "npm" | "winget" | "choco") || "auto"
          );
          break;
        case "web_search":
          result = await webSearch(String(args.query || ""));
          break;
        default:
          result = { error: `Tool desconhecida: ${name}` };
      }
      emit("tool:result", { name, result });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result = { error: message };
      emit("tool:result", { name, result });
      return result;
    }
  }
}
