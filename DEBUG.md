# Debugging Repovisor VS Code Extension

## Quick Start (F5 Debugging)

### 1. Install Dependencies
```bash
cd repovisor-vscode
npm install
cd webview-ui && npm install && cd ..
```

### 2. Build Webview UI
```bash
cd webview-ui
npm run build
cd ..
```

### 3. Press F5 to Debug
- Open the project in VS Code
- Press `F5` (or Run → Start Debugging)
- A new Extension Development Host window opens
- The extension auto-activates

## Common Issues & Fixes

### Issue: "Cannot find module" errors
**Fix:** Run `npm install` in both root and `webview-ui/` directories.

### Issue: Webview shows blank/white
**Fix:** Build the webview UI first:
```bash
cd webview-ui
npm run build
```
Check that `webview-ui/dist/assets/` has `index.js` and `index.css`.

### Issue: Azure provider not showing
**Fix:** Check `src/providers/AzureProvider.ts` exists and `src/services/ReviewService.ts` imports it.

### Issue: Sidebar not appearing
**Fix:** Make sure `activationEvents` in `package.json` includes `"onView:repovisorSidebar"`.

### Issue: Commands not found
**Fix:** Check `contributes.commands` in `package.json` and ensure commands are registered in `extension.ts`.

## Debug Console Output

Add breakpoints in:
- `src/extension.ts` — extension activation
- `src/services/ReviewService.ts` — review logic
- `src/providers/*.ts` — AI provider calls
- `src/panels/RepovisorPanel.ts` — webview communication

Use `console.log()` — output appears in Debug Console (Ctrl+Shift+Y).

## Testing Without Building

For quick TypeScript testing without full build:
```bash
npx ts-node src/services/ConfigService.ts
```

## Webview Dev Mode

For hot-reload webview development:
```bash
cd webview-ui
npm run dev
```
Then in VS Code, use the "Run Extension (Webview UI Dev)" launch config.
