import { useEffect, useState } from 'react';
import { Bell, Save, Play, Info, AlertTriangle } from 'lucide-react';
import { api } from './api.js';

export function SettingsView({ canEdit }: { canEdit: boolean }) {
  const [enabled, setEnabled] = useState(true);
  const [recipients, setRecipients] = useState('');
  const [offline, setOffline] = useState(20);
  const [smtp, setSmtp] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  function load() {
    api.getSettings().then((d) => {
      setEnabled(d.settings.alertsEnabled);
      setRecipients(d.settings.alertRecipients.join(', '));
      setOffline(d.settings.offlineMinutes);
      setSmtp(d.smtpConfigured);
    }).catch(() => undefined);
  }
  useEffect(load, []);

  async function save() {
    setMsg('Ukládám…');
    await api.saveSettings({ alertsEnabled: enabled, alertRecipients: recipients, offlineMinutes: offline }).catch((e) => setMsg('Chyba: ' + e));
    setMsg('Uloženo.');
    load();
  }
  async function runNow() {
    setMsg('Spouštím kontrolu…');
    const r = await api.runAlerts();
    setMsg(r.skipped ? `Přeskočeno: ${r.skipped}` : `Hotovo – praktiky: ${r.integritySent}, offline: ${r.offlineSent}`);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Bell size={16} className="text-emerald-600" /> E-mailová upozornění</h3>

        {!smtp && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle size={16} className="mt-0.5" />
            <span>SMTP server zatím není nastaven (proměnné <code>SMTP_HOST</code> atd. na serveru). Bez něj se e-maily neodešlou.</span>
          </div>
        )}

        <label className="mb-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} disabled={!canEdit} onChange={(e) => setEnabled(e.target.checked)} />
          Posílat upozornění (detekce pirátských praktik + výpadek agenta)
        </label>

        <label className="mb-1 block text-sm muted">E-maily příjemců (oddělené čárkou)</label>
        <input
          value={recipients}
          disabled={!canEdit}
          onChange={(e) => setRecipients(e.target.value)}
          placeholder="sef@firma.cz, hr@firma.cz"
          className="field mb-4 w-full"
        />

        <label className="mb-1 block text-sm muted">Hlásit „agent offline" po (minutách bez dat)</label>
        <input
          type="number"
          min={5}
          max={1440}
          value={offline}
          disabled={!canEdit}
          onChange={(e) => setOffline(Number(e.target.value))}
          className="field mb-4 w-32"
        />

        {canEdit && (
          <div className="flex items-center gap-3">
            <button onClick={save} className="btn-primary"><Save size={15} /> Uložit</button>
            <button onClick={runNow} className="btn-ghost"><Play size={15} /> Spustit kontrolu teď</button>
            {msg && <span className="text-sm muted">{msg}</span>}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Info size={16} className="text-blue-500" /> Plánované možnosti</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm muted">
          <li><b>Self-service náhled pro zaměstnance</b> – každý uvidí jen svá data (posiluje transparentnost a právní obhajitelnost).</li>
          <li>Z toho lze udělat <b>soutěž „Zaměstnanec měsíce"</b> – žebříček efektivity jako motivace, ne jen kontrola.</li>
        </ul>
      </div>
    </div>
  );
}
