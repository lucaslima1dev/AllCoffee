import * as fs from "fs/promises";
import * as path from "path";
import { spawn } from "child_process";

function resolveSafe(root: string, relPath: string) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, relPath || ".");
  if (!target.startsWith(resolvedRoot)) {
    throw new Error(`Caminho fora do workspace: ${relPath}`);
  }
  return target;
}

export async function listDirectory(root: string, relPath = ".") {
  const dir = resolveSafe(root, relPath);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.name !== ".git" && e.name !== "node_modules" && e.name !== "dist" && e.name !== "dist-electron")
    .map((e) => ({
      name: e.name,
      path: path.relative(root, path.join(dir, e.name)).replace(/\\/g, "/") || e.name,
      type: e.isDirectory() ? "dir" : "file",
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export async function readTextFile(root: string, relPath: string) {
  const file = resolveSafe(root, relPath);
  const content = await fs.readFile(file, "utf8");
  return { path: relPath.replace(/\\/g, "/"), content };
}

export async function writeTextFile(root: string, relPath: string, content: string) {
  const file = resolveSafe(root, relPath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
  return { path: relPath.replace(/\\/g, "/"), bytes: Buffer.byteLength(content, "utf8") };
}

export async function runShell(command: string, cwd: string, timeoutMs = 120_000) {
  return new Promise<{
    command: string;
    cwd: string;
    code: number | null;
    stdout: string;
    stderr: string;
  }>((resolve) => {
    const isWin = process.platform === "win32";
    const child = spawn(isWin ? "cmd.exe" : "bash", isWin ? ["/d", "/s", "/c", command] : ["-lc", command], {
      cwd,
      env: process.env,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({
        command,
        cwd,
        code: null,
        stdout: stdout.slice(-20_000),
        stderr: `${stderr}\n[timeout after ${timeoutMs}ms]`.slice(-20_000),
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 40_000) stdout = stdout.slice(-40_000);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 40_000) stderr = stderr.slice(-40_000);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        command,
        cwd,
        code,
        stdout: stdout.slice(-20_000),
        stderr: stderr.slice(-20_000),
      });
    });
  });
}

export async function installPackage(spec: string, manager: "auto" | "npm" | "winget" | "choco" = "auto") {
  const isWin = process.platform === "win32";
  let command = "";

  if (manager === "npm" || (!isWin && manager === "auto")) {
    command = `npm install -g ${spec}`;
  } else if (manager === "winget" || (isWin && manager === "auto")) {
    command = `winget install --id ${spec} -e --accept-package-agreements --accept-source-agreements`;
  } else if (manager === "choco") {
    command = `choco install ${spec} -y`;
  } else {
    command = `npm install -g ${spec}`;
  }

  return runShell(command, process.cwd(), 300_000);
}

export async function webSearch(query: string) {
  const results: { title: string; url: string; snippet: string }[] = [];

  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "NoobCode/0.1" },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        AbstractText?: string;
        AbstractURL?: string;
        Heading?: string;
        RelatedTopics?: Array<{
          Text?: string;
          FirstURL?: string;
          Topics?: Array<{ Text?: string; FirstURL?: string }>;
        }>;
      };

      if (data.AbstractText) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL || "",
          snippet: data.AbstractText,
        });
      }

      for (const topic of data.RelatedTopics || []) {
        if (topic.Text && topic.FirstURL) {
          results.push({ title: topic.Text.slice(0, 120), url: topic.FirstURL, snippet: topic.Text });
        }
        for (const nested of topic.Topics || []) {
          if (nested.Text && nested.FirstURL) {
            results.push({ title: nested.Text.slice(0, 120), url: nested.FirstURL, snippet: nested.Text });
          }
        }
      }
    }
  } catch {
    /* fallback abaixo */
  }

  if (results.length === 0) {
    try {
      const htmlRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: { "User-Agent": "NoobCode/0.1" },
      });
      if (htmlRes.ok) {
        const html = await htmlRes.text();
        const re =
          /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
        let match: RegExpExecArray | null;
        while ((match = re.exec(html)) && results.length < 8) {
          const title = match[2].replace(/<[^>]+>/g, "").trim();
          const snippet = match[3].replace(/<[^>]+>/g, "").trim();
          let link = match[1];
          const uddg = /uddg=([^&]+)/.exec(link);
          if (uddg) link = decodeURIComponent(uddg[1]);
          results.push({ title, url: link, snippet });
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (results.length === 0) {
    results.push({
      title: "Busca sem resultados estruturados",
      url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      snippet: "Abra o link manualmente ou refine a query. O agent também pode usar conhecimento local.",
    });
  }

  return { query, results: results.slice(0, 8) };
}
