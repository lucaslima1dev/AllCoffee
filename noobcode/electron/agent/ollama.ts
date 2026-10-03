export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
};

export type ToolCall = {
  id?: string;
  type?: string;
  function: {
    name: string;
    arguments: string | Record<string, unknown>;
  };
};

export type OllamaChatResponse = {
  message: ChatMessage;
  done: boolean;
};

const DEFAULT_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";

export async function listOllamaModels(host = DEFAULT_HOST) {
  try {
    const res = await fetch(`${host}/api/tags`);
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = (await res.json()) as { models?: { name: string }[] };
    return (data.models || []).map((m) => m.name);
  } catch {
    return [] as string[];
  }
}

export async function chatOllama(params: {
  model: string;
  messages: ChatMessage[];
  tools?: unknown[];
  host?: string;
}) {
  const host = params.host || DEFAULT_HOST;
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      tools: params.tools,
      stream: false,
      options: {
        temperature: 0.2,
        num_ctx: 8192,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama chat falhou (${res.status}): ${text}`);
  }

  return (await res.json()) as OllamaChatResponse;
}
