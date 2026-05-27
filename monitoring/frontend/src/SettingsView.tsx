import { useEffect, useState } from 'react';
import { Bell, Save, Play, AlertTriangle, Smile, HeartPulse, Quote, Monitor, Sparkles, BadgeCheck } from 'lucide-react';
import { api } from './api.js';
import { useToast } from './Toast.js';
import { SitesAdmin } from './SitesAdmin.js';
import { DiagnosticLog } from './DiagnosticLog.js';
import { SecurityCheckPanel } from './SecurityCheckPanel.js';
import { PasswordChangePanel } from './PasswordChangePanel.js';
import { SessionsPanel } from './SessionsPanel.js';
import { useT } from './i18n/index.js';

export function SettingsView({ canEdit }: { canEdit: boolean }) {
  const { t } = useT();
  const [enabled, setEnabled] = useState(true);
  const [recipients, setRecipients] = useState('');
  const [offline, setOffline] = useState(20);
  const [funMode, setFunMode] = useState(false);
  const [healthMode, setHealthMode] = useState(false);
  const [growthMode, setGrowthMode] = useState(false);
  const [interpretMonitors, setInterpretMonitors] = useState(false);
  const [employeeReportEnabled, setEmployeeReportEnabled] = useState(false);
  const [dataMode, setDataMode] = useState<'real' | 'demo' | 'both'>('both');
  const [privacyStoreDomainOnly, setPrivacyStoreDomainOnly] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);
  const [selfAuditEnabled, setSelfAuditEnabled] = useState(false);
  const [printTrackingEnabled, setPrintTrackingEnabled] = useState(false);
  const [capturePrintDocName, setCapturePrintDocName] = useState(false);
  const [usbTrackingEnabled, setUsbTrackingEnabled] = useState(false);
  const [captureUsbFilename, setCaptureUsbFilename] = useState(false);
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
      setDataMode(d.settings.dataMode);
      setPrivacyStoreDomainOnly(d.settings.privacyStoreDomainOnly);
      setRetentionDays(d.settings.retentionDaysIntervals);
      setSelfAuditEnabled(d.settings.selfAuditEnabled);
      setPrintTrackingEnabled(d.settings.printTrackingEnabled);
      setCapturePrintDocName(d.settings.capturePrintDocName);
      setUsbTrackingEnabled(d.settings.usbTrackingEnabled);
      setCaptureUsbFilename(d.settings.captureUsbFilename);
      setSmtp(d.smtpConfigured);
    }).catch(() => undefined);
  }
  useEffect(load, []);

  async function save() {
    setMsg(t('common.saving'));
    try {
      await api.saveSettings({ alertsEnabled: enabled, alertRecipients: recipients, offlineMinutes: offline, funMode, healthMode, growthMode, interpretMonitors, employeeReportEnabled, dataMode, privacyStoreDomainOnly, retentionDaysIntervals: retentionDays, selfAuditEnabled, printTrackingEnabled, capturePrintDocName, usbTrackingEnabled, captureUsbFilename });
      setMsg(null); toast(t('settings.settingsSaved'));
    } catch (e) { toast(t('settings.saveFailed') + e, 'error'); }
    load();
  }
  async function runNow() {
    setMsg(t('settings.runStartingCheck'));
    const r = await api.runAlerts();
    setMsg(null);
    toast(r.skipped ? t('settings.runSkipped', { info: String(r.skipped) }) : t('settings.runDone', { integrity: r.integritySent, offline: r.offlineSent }), r.skipped ? 'info' : 'success');
  }

  // Sekce na stránce – pomáhá uživateli rychle skočit, kam potřebuje.
  // Vykresluje se nahoře jako chips lišta s anchor odkazy.
  const tocItems: { id: string; label: string }[] = [
    { id: 'alerts', label: t('settings.sections.alerts') },
    { id: 'privacy', label: t('settings.sections.privacy') },
    { id: 'employee', label: t('settings.sections.employee') },
    { id: 'sites', label: t('settings.sections.sites') },
    { id: 'security', label: t('settings.sections.security') },
    { id: 'account', label: t('settings.sections.account') },
    { id: 'diagnostics', label: t('settings.sections.diagnostics') },
  ];

  return (
    <div className="max-w-3xl space-y-4">
      {/* Quick-nav TOC – kliknutím přeskočíš na sekci. Skrytý na mobilech (overflow). */}
      <nav aria-label={t('settings.tocAriaLabel')} className="sticky top-[57px] z-[5] -mx-1 mb-2 hidden flex-wrap gap-1.5 rounded-lg border border-gray-200 bg-white/90 px-2 py-2 text-xs backdrop-blur dark:border-slate-700 dark:bg-slate-900/85 md:flex">
        {tocItems.map((it) => (
          <a key={it.id} href={`#${it.id}`} className="rounded-md px-2 py-1 muted-2 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-slate-800 dark:hover:text-white">
            {it.label}
          </a>
        ))}
      </nav>

      <section id="alerts" className="card p-5 scroll-mt-32">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Bell size={16} className="text-emerald-600" /> {t('settings.sections.emailAlerts')}</h3>

        {!smtp && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle size={16} className="mt-0.5" />
            <span>{t('settings.smtpMissing')}</span>
          </div>
        )}

        <label className="mb-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} disabled={!canEdit} onChange={(e) => setEnabled(e.target.checked)} />
          {t('settings.sendAlertsLabel')}
        </label>

        <label className="mb-1 block text-sm muted">{t('settings.recipientsLabel')}</label>
        <input
          value={recipients}
          disabled={!canEdit}
          onChange={(e) => setRecipients(e.target.value)}
          placeholder="sef@firma.cz, hr@firma.cz"
          className="field mb-4 w-full"
        />

        <label className="mb-1 block text-sm muted">{t('settings.offlineAfterLabel')}</label>
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
            <button onClick={save} className="btn-primary"><Save size={15} /> {t('common.save')}</button>
            <button onClick={runNow} className="btn-ghost"><Play size={15} /> {t('settings.runCheckNow')}</button>
            {msg && <span className="text-sm muted">{msg}</span>}
          </div>
        )}
      </section>

      <section id="privacy" className="card p-5 scroll-mt-32">
        <h3 className="mb-3 text-sm font-semibold">{t('settings.sections.privacy')}</h3>

        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="mb-1 font-semibold">⚠️ {t('settings.privacyBanner.title')}</div>
          <ul className="ml-4 list-disc space-y-0.5">
            {t('settings.privacyBanner.collected').split('\n').map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <div className="mt-2">
            {t('settings.privacyBanner.legalNotice')}<code>monitoring/docs/pravni/</code>.
          </div>
        </div>

        <label className="mb-4 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={privacyStoreDomainOnly} disabled={!canEdit} onChange={(e) => setPrivacyStoreDomainOnly(e.target.checked)} className="mt-1" />
          <span>
            <span className="font-medium">{t('settings.domainOnlyTitle')}</span>
            <span className="muted-2">{t('settings.domainOnlyLongDesc')}</span>
          </span>
        </label>

        <label className="mb-1 block text-sm muted">{t('settings.retentionLabel')}</label>
        <div className="mb-1 flex items-center gap-2">
          <input type="number" min={7} max={3650} value={retentionDays} disabled={!canEdit} onChange={(e) => setRetentionDays(Number(e.target.value))} className="field w-32" />
          <span className="text-xs muted-2">{retentionDays >= 1825 ? t('settings.retentionLong') : retentionDays >= 365 ? t('settings.retentionMed') : t('settings.retentionShort')}</span>
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
          <span className="muted-2">{t('settings.quickPick')}</span>
          {[
            { v: 90, l: t('settings.retentionQuick90') },
            { v: 365, l: t('settings.retentionQuick1Year') },
            { v: 1095, l: t('settings.retentionQuick3Years') },
            { v: 1825, l: t('settings.retentionQuick5Years') },
          ].map(({ v, l }) => (
            <button key={v} disabled={!canEdit} onClick={() => setRetentionDays(v)} className={`rounded-full border px-2 py-0.5 text-xs ${retentionDays === v ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'border-gray-300 dark:border-slate-600'}`}>{l}</button>
          ))}
        </div>
        <p className="mb-3 text-xs muted-2">
          {t('settings.retentionExplanationPrefix')}<b>{t('settings.retentionExplanationRaw')}</b>{t('settings.retentionExplanationMid')}<b>{t('settings.retentionExplanationDaily')}</b>{t('settings.retentionExplanationDailyDesc')}<b>{t('settings.retentionExplanationForever')}</b>{t('settings.retentionExplanationSuffix')}
        </p>

        {canEdit && (
          <div className="mt-3">
            <button onClick={save} className="btn-primary"><Save size={15} /> {t('common.save')}</button>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h3 className="mb-3 text-sm font-semibold">{t('settings.sections.demoData')}</h3>
        <p className="mb-3 text-xs muted-2">{t('settings.dataModeDesc')}</p>
        <div className="inline-flex rounded-lg bg-gray-100 p-1 text-sm dark:bg-slate-800">
          {(['real', 'demo', 'both'] as const).map((mode) => (
            <button
              key={mode}
              disabled={!canEdit}
              onClick={() => setDataMode(mode)}
              className={`rounded-md px-4 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${dataMode === mode ? 'bg-white shadow-sm font-medium dark:bg-slate-700' : 'muted hover:text-gray-900 dark:hover:text-slate-200'}`}
            >
              {t(`settings.dataMode.${mode}`)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] muted-2">
          {t(`settings.dataMode.${dataMode}Hint`)}
        </p>
        {canEdit && (
          <div className="mt-3">
            <button onClick={save} className="btn-primary"><Save size={15} /> {t('common.save')}</button>
          </div>
        )}
      </section>

      <section id="employee" className="card p-5 scroll-mt-32">
        <h3 className="mb-3 text-sm font-semibold">{t('settings.sections.employee')}</h3>

        <label className="mb-4 flex items-start gap-3 rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-500/10">
          <input type="checkbox" checked={employeeReportEnabled} disabled={!canEdit} onChange={(e) => setEmployeeReportEnabled(e.target.checked)} className="mt-1" />
          <span>
            <span className="flex items-center gap-1.5 font-medium"><BadgeCheck size={15} className="text-emerald-600" /> {t('settings.enableSelfReportTitle')}</span>
            <span className="muted-2">{t('settings.enableSelfReportLongDesc')}</span>
          </span>
        </label>

        <label className={`mb-4 flex items-start gap-3 text-sm ${!employeeReportEnabled ? 'opacity-50' : ''}`}>
          <input type="checkbox" checked={selfAuditEnabled} disabled={!canEdit || !employeeReportEnabled} onChange={(e) => setSelfAuditEnabled(e.target.checked)} className="mt-1" />
          <span>
            <span className="font-medium">{t('settings.enableSelfAuditTitle')}</span>
            <span className="muted-2">{t('settings.enableSelfAuditLongDesc')}<b>{t('settings.enableSelfAuditDefault')}</b>{t('settings.enableSelfAuditRecommendation')}{!employeeReportEnabled && <i>{t('settings.enableSelfAuditDepNote')}</i>}</span>
          </span>
        </label>

        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide muted-2">{t('settings.optionalReportModes')}</h4>

        <label className="mb-3 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={funMode} disabled={!canEdit} onChange={(e) => setFunMode(e.target.checked)} className="mt-1" />
          <span>
            <span className="flex items-center gap-1.5 font-medium"><Smile size={15} className="text-amber-500" /> {t('settings.funModeTitle')}</span>
            <span className="muted-2">{t('settings.funModeLongDesc')}</span>
          </span>
        </label>

        <label className="mb-3 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={healthMode} disabled={!canEdit} onChange={(e) => setHealthMode(e.target.checked)} className="mt-1" />
          <span>
            <span className="flex items-center gap-1.5 font-medium"><HeartPulse size={15} className="text-rose-500" /> {t('settings.healthModeTitle')}</span>
            <span className="muted-2">{t('settings.healthModeLongDesc')}</span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={growthMode} disabled={!canEdit} onChange={(e) => setGrowthMode(e.target.checked)} className="mt-1" />
          <span>
            <span className="flex items-center gap-1.5 font-medium"><Quote size={15} className="text-indigo-500" /> {t('settings.growthModeTitle')}</span>
            <span className="muted-2">{t('settings.growthModeLongDesc')}</span>
          </span>
        </label>

        {canEdit && (
          <button onClick={save} className="btn-primary mt-4"><Save size={15} /> {t('settings.saveModes')}</button>
        )}

        <p className="mt-4 text-xs muted-2">
          {t('settings.plannedNoteEmployee')}
        </p>
      </section>

      <section id="printusb" className="card p-5 scroll-mt-32">
        <h3 className="mb-3 text-sm font-semibold">{t('settings.sectionPrintUsb')}</h3>
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {t('settings.printUsbBanner')}
        </div>

        <label className="mb-3 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={printTrackingEnabled} disabled={!canEdit} onChange={(e) => setPrintTrackingEnabled(e.target.checked)} className="mt-1" />
          <span>
            <span className="font-medium">{t('settings.printTrackingLabel')}</span>
            <span className="muted-2"> {t('settings.printTrackingDesc')}</span>
          </span>
        </label>
        <label className="mb-4 ml-6 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={capturePrintDocName} disabled={!canEdit || !printTrackingEnabled} onChange={(e) => setCapturePrintDocName(e.target.checked)} className="mt-1" />
          <span>
            <span className="font-medium">{t('settings.capturePrintDocNameLabel')}</span>
            <span className="muted-2"> {t('settings.capturePrintDocNameDesc')}</span>
          </span>
        </label>

        <label className="mb-3 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={usbTrackingEnabled} disabled={!canEdit} onChange={(e) => setUsbTrackingEnabled(e.target.checked)} className="mt-1" />
          <span>
            <span className="font-medium">{t('settings.usbTrackingLabel')}</span>
            <span className="muted-2"> {t('settings.usbTrackingDesc')}</span>
          </span>
        </label>
        <label className="ml-6 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={captureUsbFilename} disabled={!canEdit || !usbTrackingEnabled} onChange={(e) => setCaptureUsbFilename(e.target.checked)} className="mt-1" />
          <span>
            <span className="font-medium">{t('settings.captureUsbFilenameLabel')}</span>
            <span className="muted-2"> {t('settings.captureUsbFilenameDesc')}</span>
          </span>
        </label>

        {canEdit && (
          <button onClick={save} className="btn-primary mt-4"><Save size={15} /> {t('common.save')}</button>
        )}
      </section>

      <section id="sites" className="scroll-mt-32">
        <SitesAdmin canEdit={canEdit} />
      </section>

      <section className="card p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-violet-500" /> {t('settings.sections.interpretation')}</h3>
        <p className="mb-4 text-xs muted-2">
          {t('settings.interpretWarningLong')}
        </p>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={interpretMonitors} disabled={!canEdit} onChange={(e) => setInterpretMonitors(e.target.checked)} className="mt-1" />
          <span>
            <span className="flex items-center gap-1.5 font-medium"><Monitor size={15} className="text-sky-500" /> {t('settings.pirateMonitorTitle')}</span>
            <span className="muted-2">
              {t('settings.pirateMonitorLongDesc')}
            </span>
            <span className="mt-1 block text-xs muted-2">
              <strong>{t('settings.pirateMonitorConsequence')}</strong>{t('settings.pirateMonitorConsequenceDesc')}
            </span>
          </span>
        </label>

        {canEdit && (
          <button onClick={save} className="btn-primary mt-4"><Save size={15} /> {t('settings.saveInterpretation')}</button>
        )}
      </section>

      <section id="security" className="scroll-mt-32">
        <SecurityCheckPanel canEdit={canEdit} />
      </section>

      <section id="account" className="scroll-mt-32 space-y-4">
        <PasswordChangePanel />
        <SessionsPanel />
      </section>

      <section id="diagnostics" className="scroll-mt-32">
        <DiagnosticLog canEdit={canEdit} />
      </section>
    </div>
  );
}
