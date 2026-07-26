/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'vscode-bg': 'var(--vscode-editor-background)',
        'vscode-fg': 'var(--vscode-foreground)',
        'vscode-btn-bg': 'var(--vscode-button-background)',
        'vscode-btn-fg': 'var(--vscode-button-foreground)',
        'vscode-btn-hover': 'var(--vscode-button-hoverBackground)',
        'vscode-btn-secondary-bg': 'var(--vscode-button-secondaryBackground)',
        'vscode-btn-secondary-fg': 'var(--vscode-button-secondaryForeground)',
        'vscode-btn-secondary-hover': 'var(--vscode-button-secondaryHoverBackground)',
        'vscode-input-bg': 'var(--vscode-input-background)',
        'vscode-input-fg': 'var(--vscode-input-foreground)',
        'vscode-input-border': 'var(--vscode-input-border)',
        'vscode-focus': 'var(--vscode-focusBorder)',
        'vscode-panel-border': 'var(--vscode-panel-border)',
        'vscode-selection-bg': 'var(--vscode-editor-inactiveSelectionBackground)',
        'vscode-desc': 'var(--vscode-descriptionForeground)',
        'vscode-error': 'var(--vscode-errorForeground)',
        'vscode-list-hover': 'var(--vscode-list-hoverBackground)',
        'vscode-list-active-bg': 'var(--vscode-list-activeSelectionBackground)',
        'vscode-list-active-fg': 'var(--vscode-list-activeSelectionForeground)',
        'vscode-sidebar-bg': 'var(--vscode-sideBar-background)',
      },
    },
  },
  plugins: [],
}