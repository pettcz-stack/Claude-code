import { useEffect, useMemo, useState } from 'react';
import { Printer, Usb, ChevronLeft, FileText, AlertTriangle } from 'lucide-react';
import { api, type PrintSummaryRow, type PrintJobRow, type UsbSummaryRow, type UsbEventRow, type AppSettings } from './api.js';
import { useT, type Locale } from './i18n/index.js';

const LOCALE_TO_BCP47: Record<Locale, string> = {
  cs: 'cs-CZ', sk: 'sk-SK', en: 'en-GB', pl: 'pl-PL', de: 'de-DE',
};

function formatBytes(bytes: number, locale: string): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const n = (bytes / Math.pow(k, i));
  return `${n.toLocaleString(locale, { maximumFractionDigits: i === 0 ? 0 : 1 })} ${units[i]}`;
}

/**
 * Tisk & USB přehled – top uživatelé + drill-down detail.
 * Funkce je citlivá (názvy dokumentů / souborů); viditelně zobrazuje
 * info-bannery, když je sběr názvů v Settings vypnut.
 */
export function PrintUsbView({ from, to }: { from: string; to: string }) {
  const { t, locale } = useT();
  const bcp47 = LOCALE_TO_BCP47[locale];
  const [tab, setTab] = useState<'print' | 'usb'>('print');
  const [printRows, setPrintRows] = useState<PrintSummaryRow[] | null>(null);
  const [usbRows, setUsbRows] = useState<UsbSummaryRow[] | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [drilldown, setDrilldown] = useState<{ kind: 'print' | 'usb'; userId: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then((d) => setSettings(d.settings)).catch(() => undefined);
  }, []);

  useEffect(() => {
    setDrilldown(null);
    if (tab === 'print') {
      setPrintRows(null);
      api.printSummary(from, to).then((d) => setPrintRows(d.rows)).catch((e) => setError(String(e)));
    } else {
      setUsbRows(null);
      api.usbSummary(from, to).then((d) => setUsbRows(d.rows)).catch((e) => setError(String(e)));
    }
  }, [tab, from, to]);

  if (drilldown) {
    return drilldown.kind === 'print'
      ? <PrintDetail userId={drilldown.userId} name={drilldown.name} from={from} to={to} onBack={() => setDrilldown(null)} bcp47={bcp47} />
      : <UsbDetail userId={drilldown.userId} name={drilldown.name} from={from} to={to} onBack={() => setDrilldown(null)} bcp47={bcp47} />;
  }

  const trackingOff = tab === 'print' ? settings && !settings.printTrackingEnabled : settings && !settings.usbTrackingEnabled;
  const nameOff = tab === 'print' ? settings && settings.printTrackingEnabled && !settings.capturePrintDocName
    : settings && settings.usbTrackingEnabled && !settings.captureUsbFilename;

  return (
    <div className="space-y-4">
      <header className="card p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {tab === 'print' ? <Printer size={18} className="text-emerald-600" /> : <Usb size={18} className="text-emerald-600" />}
          {t('printUsb.pageTitle')}
        </h2>
        <p className="mt-1 text-xs muted-2">{t('printUsb.pageSubtitle')}</p>

        <div className="mt-3 inline-flex gap-1 rounded-lg bg-gray-100 p-1 text-sm dark:bg-slate-800">
          <button onClick={() => setTab('print')} className={`flex items-center gap-1.5 rounded px-3 py-1 ${tab === 'print' ? 'bg-white shadow-sm dark:bg-slate-700' : 'muted'}`}>
            <Printer size={14} /> {t('printUsb.printSectionTitle')}
          </button>
          <button onClick={() => setTab('usb')} className={`flex items-center gap-1.5 rounded px-3 py-1 ${tab === 'usb' ? 'bg-white shadow-sm dark:bg-slate-700' : 'muted'}`}>
            <Usb size={14} /> {t('printUsb.usbSectionTitle')}
          </button>
        </div>
      </header>

      {error && <div className="card p-4 text-sm text-red-600">{t('common.error')}: {error}</div>}

      {trackingOff && (
        <div className="card flex items-start gap-3 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{tab === 'print' ? t('printUsb.printOff') : t('printUsb.usbOff')}</span>
        </div>
      )}

      {nameOff && (
        <div className="card flex items-start gap-3 border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200">
          <FileText size={16} className="mt-0.5 shrink-0" />
          <span>{tab === 'print' ? t('printUsb.printDocOff') : t('printUsb.usbNameOff')}</span>
        </div>
      )}

      {tab === 'print' && printRows && (
        <div className="card p-5">
          <h3 className="mb-1 text-sm font-semibold">{t('printUsb.printSectionTitle')}</h3>
          <p className="mb-3 text-xs muted-2">{t('printUsb.printSectionHint')}</p>
          {printRows.length === 0 ? (
            <p className="text-sm muted-2">{t('printUsb.emptyJobs')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr>
                  <th className="th">{t('printUsb.colUser')}</th>
                  <th className="th">{t('printUsb.colDept')}</th>
                  <th className="th text-right">{t('printUsb.colJobs')}</th>
                  <th className="th text-right">{t('printUsb.colPages')}</th>
                  <th className="th text-right">{t('printUsb.colA4')}</th>
                  <th className="th text-right">{t('printUsb.colA3')}</th>
                  <th className="th text-right">{t('printUsb.colColor')}</th>
                  <th className="th text-right">{t('printUsb.colDuplex')}</th>
                </tr></thead>
                <tbody>
                  {printRows.map((r) => (
                    <tr key={r.userId ?? r.displayName} className="divide-row cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50"
                        onClick={() => r.userId && setDrilldown({ kind: 'print', userId: r.userId, name: r.displayName })}>
                      <td className="td font-medium">{r.displayName}</td>
                      <td className="td muted">{r.department ?? '—'}</td>
                      <td className="td text-right tabular-nums">{r.jobs}</td>
                      <td className="td text-right tabular-nums font-semibold">{r.pages}</td>
                      <td className="td text-right tabular-nums muted">{r.a4Pages}</td>
                      <td className="td text-right tabular-nums muted">{r.a3Pages}</td>
                      <td className="td text-right tabular-nums muted">{r.colorPages}</td>
                      <td className="td text-right tabular-nums muted">{r.duplexPages}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'usb' && usbRows && (
        <div className="card p-5">
          <h3 className="mb-1 text-sm font-semibold">{t('printUsb.usbSectionTitle')}</h3>
          <p className="mb-3 text-xs muted-2">{t('printUsb.usbSectionHint')}</p>
          {usbRows.length === 0 ? (
            <p className="text-sm muted-2">{t('printUsb.emptyEvents')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr>
                  <th className="th">{t('printUsb.colUser')}</th>
                  <th className="th">{t('printUsb.colDept')}</th>
                  <th className="th text-right">{t('printUsb.colEvents')}</th>
                  <th className="th text-right">{t('printUsb.colWriteEvents')}</th>
                  <th className="th text-right">{t('printUsb.colReadEvents')}</th>
                  <th className="th text-right">{t('printUsb.colDeleteEvents')}</th>
                  <th className="th text-right">{t('printUsb.colWriteSize')}</th>
                  <th className="th text-right">{t('printUsb.colTotalSize')}</th>
                </tr></thead>
                <tbody>
                  {usbRows.map((r) => (
                    <tr key={r.userId ?? r.displayName} className="divide-row cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50"
                        onClick={() => r.userId && setDrilldown({ kind: 'usb', userId: r.userId, name: r.displayName })}>
                      <td className="td font-medium">{r.displayName}</td>
                      <td className="td muted">{r.department ?? '—'}</td>
                      <td className="td text-right tabular-nums">{r.events}</td>
                      <td className="td text-right tabular-nums muted">{r.writeEvents}</td>
                      <td className="td text-right tabular-nums muted">{r.readEvents}</td>
                      <td className="td text-right tabular-nums muted">{r.deleteEvents}</td>
                      <td className="td text-right tabular-nums font-semibold">{formatBytes(r.writeBytes, bcp47)}</td>
                      <td className="td text-right tabular-nums muted">{formatBytes(r.totalBytes, bcp47)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PrintDetail({ userId, name, from, to, onBack, bcp47 }: { userId: string; name: string; from: string; to: string; onBack: () => void; bcp47: string }) {
  const { t } = useT();
  const [jobs, setJobs] = useState<PrintJobRow[] | null>(null);
  useEffect(() => { api.printUser(userId, from, to).then((d) => setJobs(d.jobs)).catch(() => setJobs([])); }, [userId, from, to]);
  const totalPages = useMemo(() => jobs?.reduce((s, j) => s + j.pages * j.copies, 0) ?? 0, [jobs]);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="btn-ghost text-sm"><ChevronLeft size={14} /> {t('printUsb.backToList')}</button>
      <div className="card p-5">
        <h3 className="text-sm font-semibold">{t('printUsb.detailPrintTitle')}: <span className="text-emerald-600">{name}</span></h3>
        <p className="mt-1 text-xs muted-2">{jobs ? `${jobs.length} ${t('printUsb.colJobs').toLowerCase()} · ${totalPages} ${t('printUsb.colPages').toLowerCase()}` : t('common.loading')}</p>
        {jobs && jobs.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <th className="th">{t('printUsb.colTime')}</th>
                <th className="th">{t('printUsb.colPrinter')}</th>
                <th className="th">{t('printUsb.colDocument')}</th>
                <th className="th text-right">{t('printUsb.colPages')}</th>
                <th className="th">{t('printUsb.colSize')}</th>
                <th className="th">{t('printUsb.colColor')}</th>
              </tr></thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="divide-row">
                    <td className="td text-xs tabular-nums">{new Date(j.jobAt).toLocaleString(bcp47)}</td>
                    <td className="td muted">{j.printerName ?? '—'}</td>
                    <td className="td">{j.documentName ?? <span className="muted-2 italic">{t('printUsb.docHidden')}</span>}</td>
                    <td className="td text-right tabular-nums font-medium">{j.pages * j.copies}{j.copies > 1 ? ` (${j.pages}×${j.copies})` : ''}</td>
                    <td className="td muted">{j.paperSize ?? '—'}{j.duplex ? ' · ↕' : ''}</td>
                    <td className="td muted">{j.color === null ? '—' : j.color ? '🎨' : '⚫'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {jobs && jobs.length === 0 && <p className="mt-4 text-sm muted-2">{t('printUsb.emptyJobs')}</p>}
      </div>
    </div>
  );
}

function UsbDetail({ userId, name, from, to, onBack, bcp47 }: { userId: string; name: string; from: string; to: string; onBack: () => void; bcp47: string }) {
  const { t } = useT();
  const [events, setEvents] = useState<UsbEventRow[] | null>(null);
  useEffect(() => { api.usbUser(userId, from, to).then((d) => setEvents(d.events)).catch(() => setEvents([])); }, [userId, from, to]);
  const totalBytes = useMemo(() => events?.reduce((s, e) => s + (e.sizeBytes ?? 0), 0) ?? 0, [events]);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="btn-ghost text-sm"><ChevronLeft size={14} /> {t('printUsb.backToList')}</button>
      <div className="card p-5">
        <h3 className="text-sm font-semibold">{t('printUsb.detailUsbTitle')}: <span className="text-emerald-600">{name}</span></h3>
        <p className="mt-1 text-xs muted-2">{events ? `${events.length} ${t('printUsb.colEvents').toLowerCase()} · ${formatBytes(totalBytes, bcp47)}` : t('common.loading')}</p>
        {events && events.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <th className="th">{t('printUsb.colTime')}</th>
                <th className="th">{t('printUsb.colAction')}</th>
                <th className="th">{t('printUsb.colDrive')}</th>
                <th className="th">{t('printUsb.colFile')}</th>
                <th className="th">{t('printUsb.colType')}</th>
                <th className="th text-right">{t('printUsb.colSize')}</th>
              </tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="divide-row">
                    <td className="td text-xs tabular-nums">{new Date(e.eventAt).toLocaleString(bcp47)}</td>
                    <td className="td"><ActionBadge action={e.action} /></td>
                    <td className="td font-mono text-xs">{e.driveLetter ?? '—'}{e.driveLabel ? ` · ${e.driveLabel}` : ''}</td>
                    <td className="td">{e.fileName ?? <span className="muted-2 italic">{t('printUsb.fileHidden')}</span>}</td>
                    <td className="td muted text-xs">{e.fileExt ?? '—'}</td>
                    <td className="td text-right tabular-nums">{e.sizeBytes != null ? formatBytes(e.sizeBytes, bcp47) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {events && events.length === 0 && <p className="mt-4 text-sm muted-2">{t('printUsb.emptyEvents')}</p>}
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const cls = action === 'DELETE' ? 'chip-nonwork' : action === 'WRITE' || action === 'CREATE' ? 'chip-work' : 'chip-neutral';
  return <span className={cls}>{action}</span>;
}
