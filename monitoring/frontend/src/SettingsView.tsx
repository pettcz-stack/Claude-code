import { useEffect, useState } from 'react';
import { Bell, Save, Play, AlertTriangle, Smile, HeartPulse, Quote, Monitor, Sparkles, BadgeCheck } from 'lucide-react';
import { api } from './api.js';
import { useToast } from './Toast.js';
import { SitesAdmin } from './SitesAdmin.js';
import { DiagnosticLog } from './DiagnosticLog.js';
import { SecurityCheckPanel } from './SecurityCheckPanel.js';

export function SettingsView({ canEdit }: { canEdit: boolean }) {
  const [enabled, setEnabled] = useState(true);
  const [recipients, setRecipients] = useState('');
  const [offline, setOffline] = useState(20);
  const [funMode, setFunMode] = useState(false);
  const [healthMode, setHealthMode] = useState(false);
  const [growthMode, setGrowthMode] = useState(false);
  const [interpretMonitors, setInterpretMonitors] = useState(false);
  const [employeeReportEnabled, setEmployeeReportEnabled] = useState(false);
  const [showDemoDevices, setShowDemoDevices] = useState(true);
  const [privacyStoreDomainOnly, setPrivacyStoreDomainOnly] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);
  const [selfAuditEnabled, setSelfAuditEnabled] = useState(false);
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
      setEmployeeReportEnabled(d.settings.employeeReportEnabled);
      setShowDemoDevices(d.settings.showDemoDevices);
      setPrivacyStoreDomainOnly(d.settings.privacyStoreDomainOnly);
      setRetentionDays(d.settings.retentionDaysIntervals);
      setSelfAuditEnabled(d.settings.selfAuditEnabled);
      setSmtp(d.smtpConfigured);
    }).catch(() => undefined);
  }
  useEffect(load, []);

  async function save() {
    setMsg('Ukládám…');
    try {
      await api.saveSettings({ alertsEnabled: enabled, alertRecipients: recipients, offlineMinutes: offline, funMode, healthMode, growthMode, interpretMonitors, employeeReportEnabled, showDemoDevices, privacyStoreDomainOnly, retentionDaysIntervals: retentionDays, selfAuditEnabled });
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
        <h3 className="mb-3 text-sm font-semibold">Soukromí a uchovávání dat (GDPR)</h3>

        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="mb-1 font-semibold">⚠️ Co FOCUS sbírá – přečti před nasazením</div>
          <ul className="ml-4 list-disc space-y-0.5">
            <li>Aktivní/nečinný čas, název aktivní aplikace, počet úhozů a kliků (NIKDY ne obsah).</li>
            <li><b>Titulek aktivního okna</b> jen pokud bylo CAPTURETITLE=1 při instalaci MSI. Default je VYPNUTO.</li>
            <li>HW telemetrie pro IT (CPU, RAM, baterie, disky, BIOS, antivirus).</li>
            <li>Hostname, MAC, lokální IP, Windows SID a jméno přihlášeného uživatele.</li>
          </ul>
          <div className="mt-2">
            Před nasazením musíš zaměstnance <b>písemně poučit</b> dle § 316 odst. 3 ZP a čl. 13 GDPR.
            Vzor poučení a další právní šablony jsou v repu: <code>monitoring/docs/pravni/</code>.
          </div>
        </div>

        <label className="mb-4 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={privacyStoreDomainOnly} disabled={!canEdit} onChange={(e) => setPrivacyStoreDomainOnly(e.target.checked)} className="mt-1" />
          <span>
            <span className="font-medium">Ukládat z prohlížeče jen doménu, ne celý titulek</span>
            <span className="muted-2"> Místo „Schůzka 14:00 – Outlook" se uloží jen „outlook.com". Méně osobních dat, lepší soukromí (vhodné pro DE/expanzi). Klasifikace (práce/zábava/sázky) funguje dál podle pravidel domén.</span>
          </span>
        </label>

        <label className="mb-1 block text-sm muted">Mazat detail aktivity starší než (dní)</label>
        <div className="mb-1 flex items-center gap-2">
          <input type="number" min={7} max={3650} value={retentionDays} disabled={!canEdit} onChange={(e) => setRetentionDays(Number(e.target.value))} className="field w-32" />
          <span className="text-xs muted-2">{retentionDays >= 1825 ? '≈ 5 let i víc – maximum, drží detail navždy' : retentionDays >= 365 ? '≈ rok i víc – CZ standard' : '< rok – privacy-first (DE)'}</span>
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
          <span className="muted-2">Rychlá volba:</span>
          {[
            { v: 90, l: '90 dní (privacy-first)' },
            { v: 365, l: '1 rok' },
            { v: 1095, l: '3 roky' },
            { v: 1825, l: '5 let (drží vše)' },
          ].map(({ v, l }) => (
            <button key={v} disabled={!canEdit} onClick={() => setRetentionDays(v)} className={`rounded-full border px-2 py-0.5 text-xs ${retentionDays === v ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'border-gray-300 dark:border-slate-600'}`}>{l}</button>
          ))}
        </div>
        <p className="mb-3 text-xs muted-2">
          Maže se jen <b>syrový detail</b> (minutové intervaly s titulky oken). <b>Denní agregáty</b> (kolik % byla práce / zábava / sázky / sítě, kolik hodin) <b>zůstávají navždy</b> – historickou statistiku neztratíš. Když chceš mít detail typu „přesně 14. 1. 2025 ve 14:32 byl na sazka.cz" navždy, dej 5 let; když chceš mít přísný privacy režim, nech 90 dní.
        </p>

        {canEdit && (
          <div className="mt-3">
            <button onClick={save} className="btn-primary"><Save size={15} /> Uložit</button>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold">Ukázková (demo) data</h3>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={showDemoDevices} disabled={!canEdit} onChange={(e) => setShowDemoDevices(e.target.checked)} className="mt-1" />
          <span>
            <span className="font-medium">Zobrazovat ukázková zařízení a uživatele</span>
            <span className="muted-2"> Pro produkční provoz vypněte – v přehledech, žebříčcích, exportech ani v upozorněních se pak ukázková data (vygenerovaná pro demo) nebudou objevovat. Záznamy v databázi zůstávají, jen jsou skryté – kdykoli můžete přepínač zase zapnout.</span>
          </span>
        </label>
        {canEdit && (
          <div className="mt-3">
            <button onClick={save} className="btn-primary"><Save size={15} /> Uložit</button>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold">Report zaměstnance</h3>

        <label className="mb-4 flex items-start gap-3 rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-500/10">
          <input type="checkbox" checked={employeeReportEnabled} disabled={!canEdit} onChange={(e) => setEmployeeReportEnabled(e.target.checked)} className="mt-1" />
          <span>
            <span className="flex items-center gap-1.5 font-medium"><BadgeCheck size={15} className="text-emerald-600" /> Zpřístupnit report přímo zaměstnancům</span>
            <span className="muted-2">Výchozí stav je vypnuto. Po zapnutí uvidí každý zaměstnanec svůj vlastní report (ikonka v liště PC) – svůj dnešní rozpad: kolik % času pracoval, kolik % byla zábava na PC a kolik % byly neměřitelné aktivity. Vidí jen sám sebe, ne kolegy. Když je vypnuto, do aplikace má přístup jen vedení / HR / IT podle rolí.</span>
          </span>
        </label>

        <label className={`mb-4 flex items-start gap-3 text-sm ${!employeeReportEnabled ? 'opacity-50' : ''}`}>
          <input type="checkbox" checked={selfAuditEnabled} disabled={!canEdit || !employeeReportEnabled} onChange={(e) => setSelfAuditEnabled(e.target.checked)} className="mt-1" />
          <span>
            <span className="font-medium">Ukázat zaměstnanci „kdo se na moje data díval"</span>
            <span className="muted-2"> Doplňkový panel v reportu zaměstnance s výpisem přístupů (kdo a kdy se na něj koukal). <b>Defaultně vypnuto.</b> Doporučeno spíš pro firmy s odbory / pro německý trh (Betriebsrat to vyžaduje) nebo pro maximální transparentnost. {!employeeReportEnabled && <i>Aktivuje se jen pokud je zapnutý report zaměstnance výše.</i>}</span>
          </span>
        </label>

        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide muted-2">Volitelné režimy reportu</h4>

        <label className="mb-3 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={funMode} disabled={!canEdit} onChange={(e) => setFunMode(e.target.checked)} className="mt-1" />
          <span>
            <span className="flex items-center gap-1.5 font-medium"><Smile size={15} className="text-amber-500" /> Ocenění a zajímavosti</span>
            <span className="muted-2">Odznaky, „naťukaná" vzdálenost prstů, kalorie spálené psaním, hravé srovnání s kolegy. Motivuje k výkonu.</span>
          </span>
        </label>

        <label className="mb-3 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={healthMode} disabled={!canEdit} onChange={(e) => setHealthMode(e.target.checked)} className="mt-1" />
          <span>
            <span className="flex items-center gap-1.5 font-medium"><HeartPulse size={15} className="text-rose-500" /> Tipy pro pohodu při práci</span>
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

      <SitesAdmin canEdit={canEdit} />

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

      <SecurityCheckPanel canEdit={canEdit} />

      <DiagnosticLog canEdit={canEdit} />
    </div>
  );
}
