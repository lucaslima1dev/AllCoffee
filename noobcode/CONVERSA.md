# NoobCode — resumo da conversa / escopo

Pasta no PC do Pedro: `C:\Users\Pedro\NoobCode`

## O que é
App desktop **local** (Electron) estilo Cursor Agent:
- codar **sites / web** e várias linguagens
- usa **Ollama** no PC (ou VPS no futuro)
- acessa a máquina: arquivos, terminal, instalar programas
- internet só para consultas pontuais

## Hardware alvo
- CPU: i5-12400F
- GPU: RX 6600 XT 8GB (AMD / Vulkan no Windows)
- RAM: 32GB
- SO: Windows 10

Modelo sugerido: `qwen2.5-coder:7b` (ou `14b` se couber)

## Decisões travadas
- Nome: **NoobCode**
- App **novo** (não Continue / não fork do VS Code)
- DayZ **fora** do foco principal
- Agent **instala sozinho** (winget/npm/choco), sem pedir OK a cada passo
- Online permitido para consulta; base = repertório de programação
- `.exe` (Setup + Portable) já gera no GitHub Actions

## O que NÃO é
- Não usa os modelos cloud do Cursor por padrão
- Não é integração nativa Ollama dentro do Cursor
- Preview no navegador (`npm run dev`) = só UI; agent completo = Electron

## Como abrir no PC
Ver `SETUP-PC.md` nesta pasta.

## Repo / PR
- Branch: `cursor/noobcode-agent-9df8`
- PR: https://github.com/lucaslima1dev/AllCoffee/pull/1
- Código do app: pasta `noobcode/`
