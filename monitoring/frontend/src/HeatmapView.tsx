import { useEffect, useState } from 'react';
import { api, type Heatmap as HeatmapData } from './api.js';
import { useT } from './i18n/index.js';

export function HeatmapView({ from, to, department, userId }: { from: string; to: string; department?: string; userId?: string }) {
  const { t } = useT();
  const [data, setData] = useState<HeatmapData | null>(null);
  useEffect(() => { api.heatmap(from, to, { department, userId }).then(setData).catch(() => setData(null)); }, [from, to, department, userId]);
  if (!data) return null;
  const max = Math.max(data.max, 1);

  // Pro každý den-v-týdnu zjisti, jestli v období vůbec máme nějakou aktivitu.
  // Pokud ne (např. zařízení ještě nebylo nasazené nebo dovolená), nevykreslíme
  // černou "PC mlčí" – nemá smysl naznačovat "měl pracovat ale ne", když fyzicky
  // nemůžeme vědět. Pro dnešní DOW zase nepočítáme budoucí hodiny jako "PC mlčí".
  const rowHasData: Record<number, boolean> = {};
  for (let i = 0; i < 7; i++) {
    rowHasData[i] = (data.matrix[i] ?? []).some((v) => (v ?? 0) > 0);
  }
  const now = new Date();
  const todayDow = now.getDay(); // 0 = neděle
  const nowHour = now.getHours();
  // Konec období je v budoucnosti? Pak hodiny dnes po `now` jsou neměřitelné.
  const toDate = new Date(to);
  const rangeEndsTodayOrLater = toDate.getTime() >= now.getTime();

  const DAYS = [
    { idx: 1, label: t('heatmap.monday') },
    { idx: 2, label: t('heatmap.tuesday') },
    { idx: 3, label: t('heatmap.wednesday') },
    { idx: 4, label: t('heatmap.thursday') },
    { idx: 5, label: t('heatmap.friday') },
    { idx: 6, label: t('heatmap.saturday') },
    { idx: 0, label: t('heatmap.sunday') },
  ];

  return (
    <div className="card p-5">
      <h3 className="mb-1 text-sm font-semibold">{t('heatmap.chartTitle')}</h3>
      <p className="mb-3 text-xs muted-2">
        <b>{t('heatmap.chartSubtitlePart1')}</b>{t('heatmap.chartSubtitlePart1Desc')}
        <b> {t('heatmap.chartSubtitlePart2')}</b>{t('heatmap.chartSubtitlePart2Desc')}
        <b> {t('heatmap.chartSubtitlePart3')}</b>{t('heatmap.chartSubtitlePart3Desc')}
      </p>
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th></th>
              {Array.from({ length: 24 }, (_, h) => (
                <th key={h} className="text-[10px] font-normal muted-2" style={{ width: 22 }}>{h % 3 === 0 ? h : ''}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d.idx}>
                <td className="pr-2 text-right text-xs muted">{d.label}</td>
                {Array.from({ length: 24 }, (_, h) => {
                  const total = data.matrix[d.idx]?.[h] ?? 0;
                  const work = data.work?.[d.idx]?.[h] ?? 0;
                  const nonwork = data.nonwork?.[d.idx]?.[h] ?? 0;
                  const classified = work + nonwork;
                  // intensity (0..1) podle celkové aktivity vs. max
                  const intensity = total / max;
                  // hue: zelená 145 = práce, červená 0 = zábava (~žlutá 60 = půl na půl)
                  const workRatio = classified > 0 ? work / classified : 0.5;
                  const hue = Math.round(workRatio * 145);
                  // lightness: 92 % = bledé (skoro bílé), 45 % = syté → bledé = málo aktivity
                  const lightness = Math.round(92 - 47 * intensity);
                  // Měl by pracovat? Po–Pá v 8–16 (klasické jádro pracovní doby).
                  const isWorkHour = d.idx >= 1 && d.idx <= 5 && h >= 8 && h < 17;
                  const noActivity = total === 0;
                  // "Neměřitelné" = buď budoucí hodina (dnes po `now`, nebo `to` v budoucnu
                  // a tento DOW v tomto týdnu ještě nepřišel), nebo žádná data pro celý DOW
                  // (typicky před nasazením zařízení / dovolená přes celé období).
                  const isFutureToday = rangeEndsTodayOrLater && d.idx === todayDow && h > nowHour;
                  const unmeasurable = isFutureToday || !rowHasData[d.idx];
                  const bg = unmeasurable
                    ? 'transparent'                  // budoucnost / před nasazením – nic neoznačovat
                    : noActivity
                      ? (isWorkHour
                        ? '#111827'                  // černá = měl pracovat, ale PC mlčí
                        : 'rgba(148,163,184,0.18)')  // jiný čas = běžně mimo PC (večer, víkend)
                      : `hsl(${hue}, 80%, ${lightness}%)`;
                  const tip = unmeasurable
                    ? `${d.label} ${h}:00 – ${t('heatmap.cellUnmeasurable')}`
                    : noActivity
                      ? (isWorkHour
                        ? `${d.label} ${h}:00 – ${t('heatmap.cellNoActivityWork')}`
                        : `${d.label} ${h}:00 – ${t('heatmap.cellNoActivity')}`)
                      : `${d.label} ${h}:00 – ${total} ${t('heatmap.cellMinActive')}\n  ${t('heatmap.cellWorkUnit')}: ${work} min\n  ${t('heatmap.cellFunUnit')}: ${nonwork} min`;
                  return (
                    <td key={h} title={tip}
                      style={{ width: 20, height: 18, borderRadius: 3, background: bg, border: unmeasurable ? '1px dashed rgba(148,163,184,0.25)' : 'none' }} />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] muted-2">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: 'hsl(145,80%,45%)' }} /> {t('heatmap.legendWorkStrong')}</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: 'hsl(145,80%,80%)' }} /> {t('heatmap.legendWorkPale')}</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: 'hsl(0,80%,55%)' }} /> {t('heatmap.legendFunStrong')}</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: 'hsl(0,80%,85%)' }} /> {t('heatmap.legendFunPale')}</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: 'rgba(148,163,184,0.30)' }} /> {t('heatmap.legendGrey')}</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: '#111827' }} /> {t('heatmap.legendBlack')}</span>
      </div>
    </div>
  );
}
