# Setup no PC — C:\Users\Pedro\NoobCode

## 1) Clonar o projeto nessa pasta

Abra PowerShell:

```powershell
cd C:\Users\Pedro
git clone https://github.com/lucaslima1dev/AllCoffee.git NoobCode
cd NoobCode
git checkout cursor/noobcode-agent-9df8
```

## 2) Abrir no Cursor / IDE

```powershell
cursor C:\Users\Pedro\NoobCode
```

Ou: File → Open Folder → `C:\Users\Pedro\NoobCode`  
Ou abra o arquivo workspace: `C:\Users\Pedro\NoobCode\NoobCode.code-workspace`

## 3) Rodar o NoobCode

```powershell
cd C:\Users\Pedro\NoobCode\noobcode
npm install
ollama pull qwen2.5-coder:7b
npm run electron:dev
```

## 4) (Opcional) Gerar / usar .exe

```powershell
npm run electron:build:win
```

Ou baixe o artifact **NoobCode-Windows** nas Actions da PR.

## Estrutura

```
C:\Users\Pedro\NoobCode\
  noobcode\          ← app (código + Electron)
  NoobCode.code-workspace
  ...
```
