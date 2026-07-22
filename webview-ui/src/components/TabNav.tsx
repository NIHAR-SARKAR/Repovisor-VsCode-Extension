interface TabNavProps {
  activeTab: string;
  onChange: (tab: string) => void;
}

const tabs = [
  { id: 'review', label: 'Review', icon: '🔍' },
  { id: 'results', label: 'Results', icon: '📊' },
  { id: 'history', label: 'History', icon: '📜' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function TabNav({ activeTab, onChange }: TabNavProps) {
  return (
    <nav className="flex gap-1 mb-6 bg-[var(--vscode-editor-inactiveSelectionBackground)] rounded-lg p-1">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            activeTab === tab.id
              ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
              : 'hover:bg-[var(--vscode-list-hoverBackground)] opacity-70'
          }`}
        >
          <span className="mr-1">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
