# NoobCode

Agent de código local estilo Cursor: edita arquivos, usa terminal, instala programas e consulta a web pontualmente — com **Ollama** no seu PC.

## Para quem é

- Criar e manter **sites / apps web**
- Trabalhar com várias linguagens (JS/TS, HTML/CSS, Node, Python web, etc.)
- Querer um agent que **age na máquina** (não só sugere código)

## Requisitos (Windows)

- Windows 10/11
- Node.js 20+
- [Ollama](https://ollama.com) instalado
- GPU AMD/NVIDIA ajuda; CPU também roda (mais lento)

Modelo sugerido (RX 6600 XT 8GB / setup parecido):

```bash
ollama pull qwen2.5-coder:7b
```

Ou, se couber:

```bash
ollama pull qwen2.5-coder:14b
```

## Rodar em desenvolvimento

```bash
cd noobcode
npm install
npm run electron:dev
```

1. Clique em **Abrir pasta** e escolha o projeto
2. Confirme o modelo Ollama no seletor
3. Peça no chat, por exemplo:
   - `cria um landing page HTML/CSS/JS nessa pasta`
   - `instala typescript global e mostra a versão`
   - `sobe um servidor vite e me diga a url`

## O que o agent pode fazer

| Tool | Função |
|---|---|
| `list_dir` / `read_file` / `write_file` | Navegar e editar o workspace |
| `run_terminal` | Rodar comandos (npm, git, builds…) |
| `install_program` | Instalar via winget/npm/choco **sem pedir confirmação** |
| `web_search` | Consulta específica na internet |

## Build Windows

```bash
npm run electron:build
```

O instalador sai em `noobcode/release/`.

## Segurança

NoobCode é **autônomo na sua máquina**: ele pode instalar e executar o que você pedir. Use em pastas/projetos que você controla.

## Stack

- Electron + React + Monaco
- Ollama (`/api/chat` + tool calling)
- Vite + TypeScript
