import {
  Globe, FileSpreadsheet, FileText, Presentation, Mail, Users, Database,
  Calculator, Contact, Box, Code2, CalendarClock, Gamepad2, Music, Folder,
  MessageCircle, Send, Hash, AppWindow, type LucideIcon,
} from 'lucide-react';
import { useT } from './i18n/index.js';

type Meta = { name: string; Icon: LucideIcon; color: string };

// Mapování procesů na čitelný název + ikonu + firemní barvu. Hodnota `name`
// začínající na "i18n:" se interpretuje jako klíč slovníku a překládá se
// pomocí t() v `useAppName` / `useAppMeta`.
const MAP: Record<string, Meta> = {
  'chrome.exe': { name: 'Google Chrome', Icon: Globe, color: '#4285F4' },
  'msedge.exe': { name: 'Microsoft Edge', Icon: Globe, color: '#0EA5E9' },
  'firefox.exe': { name: 'Mozilla Firefox', Icon: Globe, color: '#E66000' },
  'excel.exe': { name: 'Microsoft Excel', Icon: FileSpreadsheet, color: '#16A34A' },
  'winword.exe': { name: 'Microsoft Word', Icon: FileText, color: '#2563EB' },
  'powerpnt.exe': { name: 'PowerPoint', Icon: Presentation, color: '#EA580C' },
  'outlook.exe': { name: 'Outlook', Icon: Mail, color: '#2563EB' },
  'teams.exe': { name: 'Microsoft Teams', Icon: Users, color: '#6366F1' },
  'slack.exe': { name: 'Slack', Icon: Hash, color: '#7C3AED' },
  'navision.exe': { name: 'Microsoft Navision', Icon: Database, color: '#6366F1' },
  'sap.exe': { name: 'SAP', Icon: Database, color: '#0EA5E9' },
  'econ.exe': { name: 'E-CON', Icon: Calculator, color: '#0891B2' },
  'crm.exe': { name: 'Dynamics CRM', Icon: Contact, color: '#7C3AED' },
  'sldworks.exe': { name: 'SolidWorks', Icon: Box, color: '#DC2626' },
  'code.exe': { name: 'VS Code', Icon: Code2, color: '#2563EB' },
  'devenv.exe': { name: 'Visual Studio', Icon: Code2, color: '#7C3AED' },
  'okbase.exe': { name: 'OKbase', Icon: CalendarClock, color: '#0891B2' },
  'acrobat.exe': { name: 'Adobe Acrobat', Icon: FileText, color: '#DC2626' },
  'acrord32.exe': { name: 'Adobe Acrobat', Icon: FileText, color: '#DC2626' },
  'steam.exe': { name: 'Steam', Icon: Gamepad2, color: '#334155' },
  'spotify.exe': { name: 'Spotify', Icon: Music, color: '#16A34A' },
  'whatsapp.exe': { name: 'WhatsApp', Icon: MessageCircle, color: '#16A34A' },
  'telegram.exe': { name: 'Telegram', Icon: Send, color: '#0EA5E9' },
  'notepad.exe': { name: 'i18n:appMeta.notepad', Icon: FileText, color: '#64748B' },
  'explorer.exe': { name: 'i18n:appMeta.explorer', Icon: Folder, color: '#F59E0B' },

  // macOS – app.localizedName z NSWorkspace nemá ".exe" příponu. Klíče matchují
  // s .toLowerCase() v metaFor, takže "Google Chrome" → 'google chrome'.
  'google chrome': { name: 'Google Chrome', Icon: Globe, color: '#4285F4' },
  'chrome': { name: 'Google Chrome', Icon: Globe, color: '#4285F4' },
  'safari': { name: 'Safari', Icon: Globe, color: '#0FB5EE' },
  'firefox': { name: 'Mozilla Firefox', Icon: Globe, color: '#E66000' },
  'microsoft edge': { name: 'Microsoft Edge', Icon: Globe, color: '#0EA5E9' },
  'arc': { name: 'Arc', Icon: Globe, color: '#EC4899' },
  'brave browser': { name: 'Brave', Icon: Globe, color: '#F97316' },
  'finder': { name: 'Finder', Icon: Folder, color: '#3B82F6' },
  'terminal': { name: 'Terminal', Icon: Code2, color: '#1F2937' },
  'iterm2': { name: 'iTerm', Icon: Code2, color: '#1F2937' },
  'iterm': { name: 'iTerm', Icon: Code2, color: '#1F2937' },
  'ghostty': { name: 'Ghostty', Icon: Code2, color: '#7C3AED' },
  'xcode': { name: 'Xcode', Icon: Code2, color: '#147EFB' },
  'visual studio code': { name: 'VS Code', Icon: Code2, color: '#2563EB' },
  'cursor': { name: 'Cursor', Icon: Code2, color: '#1F2937' },
  'jetbrains toolbox': { name: 'JetBrains Toolbox', Icon: Code2, color: '#000000' },
  'intellij idea': { name: 'IntelliJ IDEA', Icon: Code2, color: '#000000' },
  'webstorm': { name: 'WebStorm', Icon: Code2, color: '#000000' },
  'pycharm': { name: 'PyCharm', Icon: Code2, color: '#000000' },
  'goland': { name: 'GoLand', Icon: Code2, color: '#000000' },
  'mail': { name: 'Mail', Icon: Mail, color: '#3B82F6' },
  'outlook': { name: 'Outlook', Icon: Mail, color: '#2563EB' },
  'microsoft outlook': { name: 'Outlook', Icon: Mail, color: '#2563EB' },
  'microsoft teams': { name: 'Microsoft Teams', Icon: Users, color: '#6366F1' },
  'teams': { name: 'Microsoft Teams', Icon: Users, color: '#6366F1' },
  'slack': { name: 'Slack', Icon: Hash, color: '#7C3AED' },
  'discord': { name: 'Discord', Icon: MessageCircle, color: '#5865F2' },
  'zoom': { name: 'Zoom', Icon: Users, color: '#2D8CFF' },
  'zoom.us': { name: 'Zoom', Icon: Users, color: '#2D8CFF' },
  'microsoft excel': { name: 'Microsoft Excel', Icon: FileSpreadsheet, color: '#16A34A' },
  'microsoft word': { name: 'Microsoft Word', Icon: FileText, color: '#2563EB' },
  'microsoft powerpoint': { name: 'PowerPoint', Icon: Presentation, color: '#EA580C' },
  'keynote': { name: 'Keynote', Icon: Presentation, color: '#2563EB' },
  'numbers': { name: 'Numbers', Icon: FileSpreadsheet, color: '#16A34A' },
  'pages': { name: 'Pages', Icon: FileText, color: '#F97316' },
  'preview': { name: 'Preview', Icon: FileText, color: '#3B82F6' },
  'adobe acrobat': { name: 'Adobe Acrobat', Icon: FileText, color: '#DC2626' },
  'adobe acrobat reader': { name: 'Adobe Acrobat', Icon: FileText, color: '#DC2626' },
  'notes': { name: 'Notes', Icon: FileText, color: '#F59E0B' },
  'notion': { name: 'Notion', Icon: FileText, color: '#1F2937' },
  'obsidian': { name: 'Obsidian', Icon: FileText, color: '#7C3AED' },
  'figma': { name: 'Figma', Icon: AppWindow, color: '#A855F7' },
  'sketch': { name: 'Sketch', Icon: AppWindow, color: '#F59E0B' },
  'spotify': { name: 'Spotify', Icon: Music, color: '#16A34A' },
  'music': { name: 'Apple Music', Icon: Music, color: '#FB7185' },
  'whatsapp': { name: 'WhatsApp', Icon: MessageCircle, color: '#16A34A' },
  'telegram': { name: 'Telegram', Icon: Send, color: '#0EA5E9' },
  'signal': { name: 'Signal', Icon: MessageCircle, color: '#2563EB' },
  'messages': { name: 'Messages', Icon: MessageCircle, color: '#10B981' },
  'calendar': { name: 'Calendar', Icon: CalendarClock, color: '#EF4444' },
  'system settings': { name: 'System Settings', Icon: AppWindow, color: '#6B7280' },
  'system preferences': { name: 'System Preferences', Icon: AppWindow, color: '#6B7280' },
  'activity monitor': { name: 'Activity Monitor', Icon: AppWindow, color: '#6B7280' },
  'claude': { name: 'Claude', Icon: MessageCircle, color: '#D97706' },
  'chatgpt': { name: 'ChatGPT', Icon: MessageCircle, color: '#10A37F' },
};

function metaFor(app: string): Meta {
  return MAP[app.toLowerCase()] ?? { name: prettyFallback(app), Icon: AppWindow, color: '#64748B' };
}

// Neznámý proces: "interni-nastroj.exe" → "Interni nastroj".
function prettyFallback(app: string): string {
  const base = app.replace(/\.exe$/i, '').replace(/[-_]/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : app;
}

/**
 * Čitelný název aplikace (bez .exe).
 *
 * Pozn.: pro pár Windows aplikací (Poznámkový blok, Průzkumník) je název
 * lokalizovaný – preferuj `useAppName()` v React komponentách. Tato funkce
 * vrací holý klíč slovníku v takovém případě.
 */
export function appName(app: string): string {
  return metaFor(app).name;
}

/** React hook – vrací lokalizovaný název aplikace. */
export function useAppName(): (app: string) => string {
  const { t } = useT();
  return (app: string) => {
    const n = metaFor(app).name;
    return n.startsWith('i18n:') ? t(n.slice(5)) : n;
  };
}

/** Ikonka aplikace ve formě barevného čtverečku (jako v reálném OS). */
export function AppIcon({ app, size = 18 }: { app: string; size?: number }) {
  const m = metaFor(app);
  const box = size + 10;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md"
      style={{ width: box, height: box, background: `${m.color}1f` }}
    >
      <m.Icon size={size} style={{ color: m.color }} />
    </span>
  );
}
