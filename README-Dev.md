# Repovisor AI — VS Code Extension

> 🤖 **AI-powered code review inside VS Code.**
>
> Review pull requests from GitHub/GitLab, analyze individual files, or review selected code snippets — all powered by your choice of LLM provider.

---

## Features

### 🔍 Three Review Modes
| Mode | How to Access | Use Case |
|------|--------------|----------|
| **PR Review** | Panel → Enter `owner/repo` + PR number | Full diff analysis with inline findings |
| **File Review** | Right-click file in editor/explorer → "Review Current File" | Instant review of any open file |
| **Selection Review** | Highlight code → Right-click → "Review Selection" | Review specific code blocks |

### 🤖 Multi-Provider AI Support
- **OpenAI** (GPT-4o)
- **Anthropic Claude** (3.5 Sonnet)
- **Moonshot Kimi** (K2)
- **DeepSeek** (Chat)

Auto-fallback to the next available provider if the requested one fails.

### ⚡ Review Profiles
| Profile | Speed | Findings | Depth |
|---------|-------|----------|-------|
| **Fast** | ~10s | 5 max | Critical issues only |
| **Standard** | ~30s | 10 max | Security, performance, quality |
| **Deep** | ~2min | Unlimited | Exhaustive + architectural |

### 🛡️ Built-in Rule Engine
- **Secret Detection** — flags API keys, tokens, passwords in diffs
- **Debug Logging** — catches `console.log`, `print()`, `debugger`
- **Test Coverage** — warns when source files change without test updates

### 📝 Platform Integration
- **GitHub** — fetches PRs, diffs, posts structured reviews with inline comments
- **GitLab** — fetches MRs, changes, posts discussions with position-based notes
- **Auto-post** — optionally publish reviews automatically after analysis

### 🎨 Native VS Code UI
- Activity bar sidebar with quick actions
- Full React webview panel with tabs (Review / Results / History / Settings)
- CodeLens buttons above files
- Dark/light theme aware (uses VS Code CSS variables)

---

## Installation

### From Source

```bash
# 1. Extract
unzip repovisor-vscode.zip -d repovisor-vscode
cd repovisor-vscode

# 2. Install extension dependencies
npm install

# 3. Build the webview UI
cd webview-ui
npm install
npm run build
cd ..

# 4. Compile TypeScript
npx tsc -p ./

# 5. Package as .vsix
npx vsce package

# 6. Install in VS Code
code --install-extension repovisor-1.0.0.vsix

# Log path:
 C:\Users\<username>\AppData\Roaming\Code\User\globalStorage\nihar-sarkar.repovisor
```

---

## Configuration

Open VS Code Settings (`Ctrl+,`) and search for **"Repovisor"**.

### Required

| Setting | Description |
|---------|-------------|
| `repovisor.githubToken` | GitHub Personal Access Token with `repo` scope |
| `repovisor.gitlabToken` | GitLab Personal Access Token |

### AI Provider Keys (add at least one)

| Setting | Provider |
|---------|----------|
| `repovisor.openaiApiKey` | OpenAI |
| `repovisor.anthropicApiKey` | Anthropic Claude |
| `repovisor.moonshotApiKey` | Moonshot (Kimi) |
| `repovisor.deepseekApiKey` | DeepSeek |

### Optional

| Setting | Default | Description |
|---------|---------|-------------|
| `repovisor.defaultProvider` | `openai` | Default AI provider |
| `repovisor.defaultProfile` | `standard` | Default review depth |
| `repovisor.autoPostComments` | `false` | Auto-publish reviews to platform |
| `repovisor.enableRules` | `true` | Enable built-in rule engine |
| `repovisor.gitlabUrl` | `https://gitlab.com` | Self-hosted GitLab URL |

---

## Usage

### Commands

| Command | Shortcut | Action |
|---------|----------|--------|
| `Repovisor: Open Panel` | `Ctrl+Shift+R` | Open main review panel |
| `Repovisor: Quick PR Review` | `Ctrl+Shift+Q` | Fast PR input dialog |
| `Repovisor: Review Current File` | — | Review active editor file |
| `Repovisor: Review Selection` | — | Review highlighted code |

### Reviewing a Pull Request

1. Open the Repovisor panel (`Ctrl+Shift+R`)
2. Select platform (GitHub/GitLab)
3. Enter repository: `owner/repo`
4. Enter PR/MR number
5. Choose AI provider and review profile
6. Click **Start Review**

Results appear in the **Results** tab with:
- Risk level badge (Critical / High / Medium / Low)
- Severity-ranked findings
- File path + line numbers
- Code snippets
- Fix suggestions

### Reviewing a File

Right-click any file in the editor or explorer → **"Repovisor: Review Current File"**

### Reviewing a Selection

Highlight code in the editor → Right-click → **"Repovisor: Review Selection"**

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Sidebar       │     │   Main Panel    │     │   CodeLens      │
│   (Quick Actions)│     │   (React UI)    │     │   (File Review) │
└────────┬────────┘     └────────┬────────┘     └─────────────────┘
         │                       │
         └───────────────────────┘
                     │
            ┌────────▼────────┐
            │  ReviewService   │
            │  (Orchestrator)  │
            └────────┬────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼───┐    ┌──────▼──────┐   ┌───▼────┐
│ GitHub │    │  AI Provider │   │ Rules  │
│ Service│    │  (OpenAI/    │   │ Engine │
│        │    │   Claude/    │   │        │
│        │    │   Kimi/      │   │        │
│        │    │   DeepSeek)  │   │        │
└────────┘    └──────────────┘   └────────┘
    │
┌───▼───┐
│ GitLab│
│Service│
└───────┘
```

---

## File Structure

```
repovisor-vscode/
├── package.json                    # Extension manifest
├── tsconfig.json                   # TypeScript config
├── src/
│   ├── extension.ts                # Entry point & commands
│   ├── types/
│   │   └── index.ts                # Shared TypeScript types
│   ├── services/
│   │   ├── ConfigService.ts        # VS Code settings wrapper
│   │   └── ReviewService.ts        # Core review orchestration
│   ├── providers/
│   │   ├── BaseProvider.ts         # Abstract AI provider
│   │   ├── OpenAIProvider.ts       # OpenAI GPT-4o
│   │   ├── AnthropicProvider.ts    # Claude 3.5 Sonnet
│   │   ├── MoonshotProvider.ts     # Kimi K2
│   │   ├── DeepSeekProvider.ts     # DeepSeek Chat
│   │   └── ReviewCodeLensProvider.ts # CodeLens integration
│   ├── github/
│   │   └── GitHubService.ts        # GitHub API (PRs, diffs, reviews)
│   ├── gitlab/
│   │   └── GitLabService.ts        # GitLab API (MRs, changes, discussions)
│   ├── rules/
│   │   └── RuleEngine.ts           # Built-in security/quality rules
│   ├── panels/
│   │   ├── RepovisorPanel.ts      # Main webview panel
│   │   └── SidebarProvider.ts      # Activity bar sidebar
│   └── utils/
│       └── uuid.ts                 # UUID generation
└── webview-ui/                     # React 18 + Vite + Tailwind
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── components/
        │   └── TabNav.tsx
        └── pages/
            ├── ReviewPanel.tsx
            ├── HistoryPanel.tsx
            └── SettingsPanel.tsx
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Extension Runtime | VS Code API + TypeScript |
| Webview UI | React 18 + Vite + Tailwind CSS |
| HTTP Client | Native `fetch` (VS Code 1.85+) |
| AI Integration | REST APIs (OpenAI, Anthropic, Moonshot, DeepSeek) |
| Platforms | GitHub REST API v3, GitLab API v4 |

---

## Troubleshooting

### "No AI providers configured"
Add at least one API key in VS Code Settings → search "repovisor".

### "GitHub token not configured"
Generate a token at **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)** with `repo` scope.

### "PR not found"
- Verify repo format: `owner/repo` (e.g., `facebook/react`)
- Ensure the PR exists and is accessible with your token
- For private repos, the token needs `repo` scope

### "Invalid JSON from AI provider"
- Some providers (Claude) wrap JSON in markdown fences — the parser strips these automatically
- For very large diffs, try the **Fast** profile to reduce context
- Ensure your API key has sufficient quota

### Webview shows blank
Run `npm run build` inside `webview-ui/` to generate the `dist/` folder.

---

## License

MIT
