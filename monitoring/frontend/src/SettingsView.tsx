import { useEffect, useState } from 'react';
import { Bell, Save, Play, AlertTriangle, Smile, HeartPulse, Quote, Monitor, Sparkles } from 'lucide-react';
import { api } from './api.js';
import { useToast } from './Toast.js';

export function SettingsView({ canEdit }: { canEdit: boolean }) {
  const [enabled, setEnabled] = useState(true);
  const [recipients, setRecipients] = useState('');
  const [offline, setOffline] = useState(20);
  const [funMode, setFunMode] = useState(false);
  const [healthMode, setHealthMode] = useState(false);
  const [growthMode, setGrowthMode] = useState(false);
  const [interpretMonitors, setInterpretMonitors] = useState(false);
  const [smtp, setSmtp] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const toast = useToast();

  function load() {
    api.getSettings().then((d) => {
      setEnabled(d.settings.alertsEnabled);
      setRecipients(d.settings.alertRecipients.join(', '));
      setOffline(d.settings.offlineMinutes);
      setFunMode(d.settings.funMode);
      setHealthMode(d.settings.healthMode);
      setGrowthMode(d.settings.growthMode);
      setInterpretMonitors(d.settings.interpretMonitors);
      setSmtp(d.smtpConfigured);
    }).catch(() => undefined);
  }
  useEffect(load, []);

  async function save() {
    setMsg('Ukládám…');
    try {
      await api.saveSettings({ alertsEnabled: enabled, alertRecipients: recipients, offlineMinutes: offline, funMode, healthMode, growthMode, interpretMonitors });
      setMsg(null); toast('Nastavení uloženo');
    } catch (e) { toast('Uložení selhalo: ' + e, 'error'); }
    load();
  }
  async function runNow() {
    setMsg('Spouštím kontrolu…');
    const r = await api.runAlerts();
    setMsg(null);
    toast(r.skipped ? `Přeskočeno: ${r.skipped}` : `Hotovo – praktiky: ${r.integritySent}, offline: ${r.offlineSent}`, r.skipped ? 'info' : 'success');
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
        <h3 className="mb-3 text-sm font-semibold">Režimy reportu zaměstnance</h3>

        <label className="mb-3 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={funMode} disabled={!canEdit} onChange={(e) => setFunMode(e.target.checked)} className="mt-1" />
          <span>
            <span className="flex items-center gap-1.5 font-medium"><Smile size={15} className="text-amber-500" /> Zábavný režim</span>
            <span className="muted-2">Odznaky, „naťukaná" vzdálenost prstů, kalorie spálené psaním, hravé srovnání s kolegy. Motivuje k výkonu.</span>
          </span>
        </label>

        <label className="mb-3 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={healthMode} disabled={!canEdit} onChange={(e) => setHealthMode(e.target.checked)} className="mt-1" />
          <span>
            <span className="flex items-center gap-1.5 font-medium"><HeartPulse size={15} className="text-rose-500" /> Zdravotní režim</span>
            <span className="muted-2">Mikro-tipy proveditelné při práci (bez přestávek): postavit se a pracovat ve stoje, narovnat záda, doušek vody, pohled do dálky.</span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={growthMode} disabled={!canEdit} onChange={(e) => setGrowthMode(e.target.checked)} className="mt-1" />
          <span>
            <span className="flex items-center gap-1.5 font-medium"><Quote size={15} className="text-indigo-500" /> Rozvojový režim</span>
            <span className="muted-2">Moudro dne od velikánů (Tomáš Baťa a další), které firma ctí. Jeden citát na celý den – předává firemní hodnoty.</span>
          </span>
        </label>

        {canEdit && (
          <button onClick={save} className="btn-primary mt-4"><Save size={15} /> Uložit režimy</button>
        )}

        <p className="mt-4 text-xs muted-2">
          Plánováno: self-service přístup pro zaměstnance (každý jen svá data) a soutěž „Zaměstnanec měsíce".
        </p>
      </div>

      <div className="card p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-violet-500" /> Interpretace dat</h3>
        <p className="mb-4 text-xs muted-2">
          Data na serveru zůstávají vždy úplná a nezměněná. Interpretace pouze mění, <em>jak</em> se z nich
          počítá výsledek – lze je kdykoli vypnout a skóre se vrátí k surovým hodnotám.
        </p>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={interpretMonitors} disabled={!canEdit} onChange={(e) => setInterpretMonitors(e.target.checked)} className="mt-1" />
          <span>
            <span className="flex items-center gap-1.5 font-medium"><Monitor size={15} className="text-sky-500" /> Zohlednit počet monitorů ve skóre</span>
            <span className="muted-2">
              U práce, které prokazatelně pomáhá druhý monitor (kancelář, vývoj, podnikové systémy,
              projektové řízení, grafika), je člověk s jedním monitorem v nevýhodě – dle studií odvede
              o 20–35 % méně než se dvěma. Po zapnutí dostane handicapový bonus: stejný výkon na jednom
              monitoru = vyšší skóre než na dvou/třech. Férovější srovnání lidí s nerovným vybavením.
            </span>
            <span className="mt-1 block text-xs muted-2">
              <strong>Následek ve výsledcích:</strong> u dotčených lidí poroste zobrazené skóre v přehledu,
              žebříčku i v jejich reportu. Surová data, kategorie ani časy se nemění. Vypnutím se vše vrátí zpět.
            </span>
          </span>
        </label>

        {canEdit && (
          <button onClick={save} className="btn-primary mt-4"><Save size={15} /> Uložit interpretaci</button>
        )}
      </div>
    </div>
  );
}
