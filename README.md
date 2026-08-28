# ⛏️ MCForge — Hospedagem de Minecraft Gratuita

Sistema **completo e gratuito** de hospedagem de servidores Minecraft para rodar no **seu próprio PC** (ou VPS), com **painel web profissional** (deployável no Netlify), **suporte a Java + Bedrock**, instalação de **mods/plugins**, **maps**, **backups** e **proteção DDoS + domínio personalizado + TLS** via **Cloudflare Tunnel**.

---

## 🧠 Como funciona (entenda antes de usar)

**O Netlify NÃO roda servidores de Minecraft** (é uma plataforma de sites estáticos + funções serverless). Então o sistema é dividido em 3 partes:

| Parte | Onde roda | Para que serve |
|-------|-----------|----------------|
| **Daemon** (`daemon/`) | No seu PC | Gerencia os processos do Minecraft, API + WebSocket |
| **Painel Web** (`panel/`) | Netlify (grátis) ou local | Dashboard com console, mods, plugins, mundos, arquivos |
| **Cloudflare Tunnel** | Seu PC + Cloudflare | Proteção DDoS, domínio personalizado, TLS, esconde seu IP |

```
Jogadores 🎮 ──▶ Cloudflare (DDoS + TLS + domínio) ──▶ Tunnel ──▶ Seu PC ──▶ Servidor Minecraft
                                                                    │
Painel no Netlify ──▶ (URL do daemon) ──▶ API + WebSocket ──┘
```

---

## ✅ Pré-requisitos

- **Windows 10/11** (o guia cobre Windows; dá pra rodar em Linux/Mac adaptando)
- **~4 GB de RAM livre** (para um servidor com 2 GB + o sistema)
- Conta grátis no **Cloudflare** (opcional, mas recomendado para o modo online pela internet)
- Conta grátis no **Netlify** (opcional, para hospedar o painel)

---

## 🚀 Instalação rápida (Windows)

### Opção A — Instalador automático

```powershell
# Abra o PowerShell e execute:
cd "C:\Users\seu-usuario\Desktop\hospedagem de servidor de minecraft"
.\scripts\setup.ps1
```

Isso instala **Node.js**, **Java 21**, **cloudflared**, as dependências do daemon e compila o painel.

### Opção B — Manual

```powershell
# 1. Dependências do daemon
cd daemon
npm install

# 2. Configure a senha
Copy-Item .env.example .env
# edite o .env e mude a DAEMON_PASSWORD

# 3. Inicie o daemon
npm start
```

### Opção C — Reinstalar Java/Node manualmente

- **Java 21 (Temurin):** https://adoptium.net
- **Node.js LTS:** https://nodejs.org
- **cloudflared:** https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

---

## 🖥️ Usando o painel

1. Inicie o daemon: `cd daemon && npm start`
2. Abra **http://localhost:3000**
3. No **primeiro login**, a senha que você digitar vira a **senha mestre**
4. Vá em **Servidores → Novo Servidor** e configure:

| Campo | Explicação |
|-------|-----------|
| Tipo | Vanilla, Paper, Purpur, Forge, Fabric, NeoForge ou Bedrock |
| Versão | `latest` = mais recente, ou digite ex. `1.20.1` |
| Porta | 25565 (Java) padrão |
| RAM | Mín/Máx de memória para o servidor |
| Geyser | Ativa para **celular/console entrar junto** (Java + Bedrock) |

> ⚠️ Na primeira inicialização o servidor é **baixado automaticamente** (pode demorar alguns minutos).

---

## 🎮 Recursos do painel

### Console
- Logs em tempo real (WebSocket)
- Enviar comandos (ex: `gamemode creative @a`, `give @p diamond`)
- Histórico de comandos (seta ↑↓)

### Plugins & Mods
- **Busca integrada** no Modrinth e Hangar (milhares de plugins/mods)
- Instala automaticamente a versão compatível com seu servidor
- Upload manual de `.jar`
- Compatível com Paper, Purpur, Spigot, Forge, Fabric, NeoForge

### Mundos (Maps)
- Lista mundos com tamanho e região
- **Importar mundo** de um `.zip`
- Exportar mundo como backup

### Backups
- Backup manual com um clique
- Backups **automáticos** (intervalo configurável)
- Lista de backups com tamanho e data

### Arquivos
- Navegador de arquivos completo
- Editor de texto embutido (server.properties, configs...)
- Upload e exclusão de arquivos

### Jogadores
- **Whitelist** (só entram convidados)
- **Ops** (administradores)
- **Banimento** de jogadores

### Rede & Tunnel
- Cria/inicia/para o **Cloudflare Tunnel** direto do painel
- Instruções de DNS passo a passo para **domínio personalizado**
- Proteção DDoS + TLS automáticas

### Segurança
- **Checkup de segurança** automático
- **Usuários compartilhados** — crie contas para seus amigos acessarem o painel
- Papéis: admin ou usuário

---

## 🌐 Deixando seu servidor online na internet (com domínio)

### Passo 1 — Login no Cloudflare

```powershell
cloudflared tunnel login
```
O navegador abre, você escolhe seu domínio (ou cria um site gratuito) e autoriza.

### Passo 2 — Criar e iniciar o tunnel pelo painel

1. Abra o painel → **Rede & Tunnel**
2. **Criar Tunnel** (nome: `minecraft`)
3. **Gerar config**
4. **Iniciar Tunnel**

> Sem domínio próprio? O tunnel gera uma URL `https://xxx.trycloudflare.com` que já funciona para acesso externo.

### Passo 3 — Domínio personalizado (opcional)

1. Adicione seu domínio ao **Cloudflare** (plano Free) — siga o passo a passo do Cloudflare
2. No painel → **Rede & Tunnel → Instruções de DNS**:
   - Registro **CNAME**: `mc.seudominio.com` → `minecraft.cfargotunnel.com` (proxy laranja ☁️)
   - Registro **SRV** para Minecraft (quando necessário)
3. Jogadores conectam usando **`mc.seudominio.com`**

> 🛡️ Com o proxy laranja do Cloudflare: **DDoS filtrado, IP oculto e HTTPS**.

---

## 🐙 Tudo via GitHub (repositório + Pages + Actions)

O projeto está no GitHub: **https://github.com/moisesvvanti-dev/mcforge**

### Painel hospedado no GitHub Pages (grátis, HTTPS)
- URL: **https://moisesvvanti-dev.github.io/mcforge/**
- Deploy 100% automático: a cada `git push` na `main`, o workflow
  `.github/workflows/panel-deploy.yml` compila o React e publica no Pages.
- Para o painel falar com o daemon, defina a URL do daemon em
  **Configurações → Conexão com o Daemon** (a URL HTTPS do seu Tunnel).

### Servidor Minecraft no GitHub Actions (⚠️ EXPERIMENTAL — só testes)
- Workflow: `.github/workflows/minecraft-server.yml`
- Como ativar: **Actions → "🎮 Servidor Minecraft (Experimental)" → Run workflow**
- Escolha versão (ex: `1.21.11`), RAM (ex: `2G`) e tipo (paper/vanilla/purpur)
- O servidor sobe na nuvem do GitHub e é exposto via **Cloudflare Tunnel**
  (a URL `trycloudflare.com` aparece nos logs do job — veja no passo "Iniciar Cloudflare Tunnel")
- ⚠️ **Limitações (importantes):**
  - O job morre em no máximo **6 horas** — servidor cai
  - O mundo **NÃO é salvo** (o disco é descartado)
  - Não é CI/CD — usar demais pode dar problema na conta
  - Para 24/7 real: PC próprio ou VPS gratuita (Oracle Cloud)

---

## ☁️ Hospedando o painel no Netlify (grátis)

O painel é um app React estático — perfeito para Netlify:

### Via arrastar e soltar (mais fácil)
```powershell
cd panel
npm install
npm run build
```
1. Acesse **https://app.netlify.com/drop**
2. Arraste a pasta **`panel/dist`**
3. Pronto! Seu painel está online em `https://xxx.netlify.app`

### Via Git (deploy contínuo)
1. Suba o repositório no GitHub
2. Netlify → *Add new site → Import an existing project*
3. Build command: `cd panel && npm install && npm run build`
4. Publish directory: `panel/dist`
5. Defina a env var **`DAEMON_URL`** = URL pública do seu daemon (ex: `https://seu-tunnel.trycloudflare.com`)

### Conectando o painel ao daemon
No painel, vá em **Configurações → Conexão com o Daemon** e cole a URL pública do daemon
(ex: `https://seu-tunnel.trycloudflare.com`). O painel salva e conecta direto.

> 💡 O daemon precisa estar exposto na internet (via Tunnel) para o painel do Netlify alcançá-lo.

---

## 🔌 Configurando com seu IP e PC (sem Cloudflare Tunnel)

Se você **não quer usar o Tunnel**, dá para expor seu PC diretamente via **port forwarding**. É mais simples, porém **menos seguro** (sem TLS, IP visível).

### Passo 1 — Descubra seus IPs
- **IP local** do PC: abra o prompt e digite `ipconfig` → procure "Endereço IPv4" (ex: `192.168.42.183`)
- **IP público**: no painel → Configurações → "Detectar IP" (ex: `177.5.139.30`)

### Passo 2 — Abra as portas no roteador (port forwarding)
1. Acesse seu roteador no navegador (geralmente `http://192.168.1.1` ou `http://192.168.42.1`)
2. Procure **Encaminhamento de Portas** / *Port Forwarding* / *Virtual Server*
3. Crie regras **TCP** apontando para o IP local do seu PC (ex: `192.168.42.183`):

| Porta | Uso |
|-------|-----|
| `3000` | Painel/daemon (obrigatório para o Netlify falar com o daemon) |
| `25565` | Servidor Minecraft Java |
| `19132` | Servidor Bedrock (se usar Geyser — UDP/TCP) |

### Passo 3 — Aponte o Netlify para o seu IP
No Netlify:
1. **Site settings → Environment variables → Add a variable**
2. Nome: `DAEMON_URL`
3. Valor: `http://SEU_IP_PUBLICO:3000` (ex: `http://177.5.139.30:3000`)
4. Redeploy do site (Deploys → Trigger deploy)

> 📌 **Alternativa sem variável:** na página de **Login** do painel (ou Configurações), clique em
> "Configurar URL do daemon" e cole `http://SEU_IP_PUBLICO:3000`. O painel salva no navegador e
> conecta direto (REST + WebSocket), sem depender do proxy.

### Testar se funcionou
- No navegador do celular (fora do Wi-Fi): `http://SEU_IP_PUBLICO:3000/api/health` → deve aparecer `{"status":"ok"}`
- Se não abrir: confira o firewall do Windows (liberar Node.js nas portas 3000/25565/19132)
  e se o IP público mudou (IP dinâmico muda ao reiniciar o modem)

### ⚠️ Importante
- **Sem Tunnel, seu IP fica exposto** e o tráfego não é criptografado (HTTP puro).
- O painel do Netlify é HTTPS, e navegadores **bloqueiam** chamadas HTTP diretas de páginas HTTPS
  (mixed content). Por isso o **proxy do Netlify** (com `DAEMON_URL`) é o jeito certo de usar IP direto:
  o proxy roda no servidor do Netlify e faz a ponte. O console usa polling nesse modo.
- Para HTTPS + DDoS + IP oculto de verdade, use o **Cloudflare Tunnel** (seção anterior).

---

## 🔒 Segurança em camadas

| Camada | Proteção |
|--------|----------|
| **Cloudflare** | DDoS (até 500 Gbps no free), IP oculto, TLS |
| **Tunnel** | Sem portas abertas no roteador |
| **Daemon** | Senha mestre + JWT + rate limiting |
| **Painel** | Login com senha, RBAC (admin/user) |
| **Minecraft** | Modo online (verificação Mojang), whitelist, bans |

---

## 🛠️ Estrutura do projeto

```
hospedagem de servidor de minecraft/
├── daemon/                    # Gerenciador (roda no seu PC)
│   ├── src/
│   │   ├── index.js           # Ponto de entrada
│   │   ├── api.js             # API REST completa
│   │   ├── websocket.js       # Console em tempo real
│   │   ├── auth.js            # Login, JWT, usuários
│   │   ├── config.js          # Configuração persistente
│   │   ├── server-manager.js  # Controle de processos Minecraft
│   │   ├── version-manager.js # Downloads (Vanilla/Paper/Purpur/Forge/Fabric/BDS)
│   │   ├── plugin-manager.js  # Plugins/mods (Modrinth/Hangar)
│   │   ├── world-manager.js   # Mundos e backups
│   │   ├── tunnel.js          # Cloudflare Tunnel
│   │   └── utils.js
│   ├── install.ps1
│   └── package.json
├── panel/                     # Painel web (React + Vite + Tailwind)
│   ├── src/
│   │   ├── pages/             # Dashboard, Servidores, Rede, Segurança...
│   │   ├── components/        # Layout, Console, Cards, Modais...
│   │   ├── hooks/             # useApi, useWebSocket
│   │   └── lib/               # Cliente da API do daemon
│   ├── netlify/functions/     # Proxy opcional
│   └── netlify.toml
├── scripts/
│   └── setup.ps1              # Instalador automático
├── backups/                   # Backups dos mundos
└── README.md
```

---

## ❓ Perguntas frequentes

**O Netlify roda o servidor de Minecraft?**
Não. Isso é tecnicamente impossível — Netlify não roda processos persistentes. O Netlify hospeda **apenas o painel**. O servidor roda no seu PC (ou VPS), exposto com segurança via Cloudflare Tunnel.

**Meu servidor precisa ficar online 24/7?**
Para 24/7 de graça, use uma VPS gratuita (ex: Oracle Cloud Free Tier — 4 vCPU ARM + 24 GB RAM). No seu PC, o servidor fica online enquanto ele estiver ligado.

**Como meus amigos entram?**
Pelo endereço `seu-dominio.com` (internet) ou `SEU_IP:25565` (rede local). Com o tunnel, eles entram pelo seu domínio e seu IP nunca fica exposto.

**Java e Bedrock juntos?**
Ative **Geyser** na criação do servidor. Aí jogadores de celular, console e Windows 10/11 entram na mesma porta (19132) junto com jogadores Java.

**Preciso abrir portas no roteador?**
Com o Cloudflare Tunnel, **não**. Ele cria o túnel de saída. É mais seguro e evita mexer no roteador.

---

## 📄 Licença

MIT — use, modifique e compartilhe livremente. Feito para a comunidade de Minecraft.
