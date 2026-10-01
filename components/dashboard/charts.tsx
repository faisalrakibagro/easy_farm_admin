'use client';

import { useCallback, useId, useState } from 'react';
import { localeFor } from '@/lib/languages';

/*
 * Small SVG charts for the dashboard — no chart library.
 * Colours come from the --chart-* tokens in globals.css (validated for
 * colour-blind separation in light and dark mode); text uses the normal
 * slate ink so it follows the theme.
 */

export const CHART = {
  c1: 'var(--chart-1)', c2: 'var(--chart-2)', c3: 'var(--chart-3)',
  c4: 'var(--chart-4)', c5: 'var(--chart-5)', c6: 'var(--chart-6)', other: 'var(--chart-other)',
};
export const SERIES = [CHART.c1, CHART.c2, CHART.c3, CHART.c4, CHART.c5, CHART.c6];

/** Width of an element, kept up to date as it resizes. */
function useWidth(): [(el: HTMLDivElement | null) => (() => void) | void, number] {
  const [width, setWidth] = useState(0);
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

export function compact(n: number, lang: string): string {
  const abs = Math.abs(n);
  const fmt = (v: number, s: string) => `${n < 0 ? '−' : ''}${v.toLocaleString(localeFor(lang), { maximumFractionDigits: 1 })}${s}`;
  if (lang === 'ar') {
    // Arabic readers count in thousands and millions, not lakh/crore.
    if (abs >= 1e6) return fmt(abs / 1e6, ' مليون');
    if (abs >= 1e3) return fmt(abs / 1e3, ' ألف');
  } else {
    if (abs >= 1e7) return fmt(abs / 1e7, lang === 'bn' ? ' কোটি' : 'Cr');
    if (abs >= 1e5) return fmt(abs / 1e5, lang === 'bn' ? ' লাখ' : 'L');
  }
  if (abs >= 1e3) return fmt(abs / 1e3, 'k');
  return fmt(abs, '');
}

export function taka(n: number, lang: string): string {
  return `${n < 0 ? '−' : ''}৳${Math.abs(n).toLocaleString(localeFor(lang), { maximumFractionDigits: 0 })}`;
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: React.ReactNode }) {
  const left = Math.min(Math.max(x, 96), width - 96);
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full min-w-[11rem] whitespace-nowrap rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
      style={{ left, top: y - 8 }}
    >
      {children}
    </div>
  );
}

function Swatch({ color, line }: { color: string; line?: boolean }) {
  return line
    ? <span className="inline-block w-3.5 h-0.5 rounded-full align-middle" style={{ background: color }} />
    : <span className="inline-block w-2.5 h-2.5 rounded-[3px] align-middle" style={{ background: color }} />;
}

/* ── Income vs cost columns with a profit line ─────────────────────────── */

export interface MonthPoint { label: string; income: number; cost: number; profit: number }

export function IncomeCostChart({ data, lang, labels }: {
  data: MonthPoint[]; lang: string;
  labels: { income: string; cost: string; profit: string };
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const height = 260;
  const pad = { top: 16, right: 12, bottom: 28, left: 48 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;

  // Round axis: 4–5 steps of a "nice" size that cover the lowest profit and the highest bar.
  const rawMax = Math.max(1, ...data.flatMap(d => [d.income, d.cost, d.profit]));
  const rawMin = Math.min(0, ...data.map(d => d.profit));
  const step = niceMax((rawMax - rawMin) / 4);
  const lo = Math.floor(rawMin / step) * step;
  const maxV = Math.ceil(rawMax / step) * step;
  const y = (v: number) => pad.top + innerH - ((v - lo) / (maxV - lo)) * innerH;
  const slot = data.length ? innerW / data.length : 0;
  const barW = Math.max(4, Math.min(22, slot / 3.2));
  const cx = (i: number) => pad.left + slot * i + slot / 2;
  const ticks = Array.from({ length: Math.round((maxV - lo) / step) + 1 }, (_, i) => lo + step * i);
  const profitPath = data.map((d, i) => `${i ? 'L' : 'M'}${cx(i)},${y(d.profit)}`).join(' ');

  // Bars with a rounded top (4px) anchored to the zero line.
  const bar = (x: number, v: number) => {
    const top = y(Math.max(v, 0)), base = y(0), h = Math.max(0, base - top), r = Math.min(4, h);
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mb-2">
        <span className="flex items-center gap-1.5"><Swatch color={CHART.c1} />{labels.income}</span>
        <span className="flex items-center gap-1.5"><Swatch color={CHART.c5} />{labels.cost}</span>
        <span className="flex items-center gap-1.5"><Swatch color={CHART.c2} line />{labels.profit}</span>
      </div>
      <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={`${labels.income} / ${labels.cost}`}>
            {ticks.map((tv, i) => (
              <g key={i}>
                <line x1={pad.left} x2={width - pad.right} y1={y(tv)} y2={y(tv)} className="stroke-slate-200" strokeDasharray={tv === 0 ? undefined : '3 4'} />
                <text x={pad.left - 8} y={y(tv) + 4} textAnchor="end" className="fill-slate-400 text-[10px]">{compact(tv, lang)}</text>
              </g>
            ))}
            {data.map((d, i) => (
              <g key={d.label}>
                {hover === i && <rect x={cx(i) - slot / 2 + 2} y={pad.top} width={slot - 4} height={innerH} rx={8} className="fill-slate-100" />}
                <path d={bar(cx(i) - barW - 1, d.income)} fill={CHART.c1} />
                <path d={bar(cx(i) + 1, d.cost)} fill={CHART.c5} />
                <text x={cx(i)} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[10.5px]">{d.label}</text>
                <rect x={cx(i) - slot / 2} y={pad.top} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            ))}
            <path d={profitPath} fill="none" stroke={CHART.c2} strokeWidth={2} strokeLinejoin="round" pointerEvents="none" />
            {data.map((d, i) => (
              <circle key={i} cx={cx(i)} cy={y(d.profit)} r={hover === i ? 5 : 3.5} fill={CHART.c2} stroke="var(--card)" strokeWidth={2} pointerEvents="none" />
            ))}
          </svg>
        )}
        {hover !== null && data[hover] && (
          <Tooltip x={cx(hover)} y={y(Math.max(data[hover].income, data[hover].cost, data[hover].profit))} width={width}>
            <p className="font-semibold text-slate-700 mb-1">{data[hover].label}</p>
            <p className="flex justify-between gap-4 text-slate-500"><span><Swatch color={CHART.c1} /> {labels.income}</span><span className="font-medium text-slate-700">{taka(data[hover].income, lang)}</span></p>
            <p className="flex justify-between gap-4 text-slate-500"><span><Swatch color={CHART.c5} /> {labels.cost}</span><span className="font-medium text-slate-700">{taka(data[hover].cost, lang)}</span></p>
            <p className="flex justify-between gap-4 text-slate-500"><span><Swatch color={CHART.c2} line /> {labels.profit}</span><span className={`font-semibold ${data[hover].profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{taka(data[hover].profit, lang)}</span></p>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/* ── Donut with legend ─────────────────────────────────────────────────── */

export interface Slice { key: string; label: string; value: number; color: string }

export function DonutChart({ data, lang, centerLabel, format = 'taka' }: {
  data: Slice[]; lang: string; centerLabel: string; format?: 'taka' | 'count';
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 168, r = 64, stroke = 20, c = 2 * Math.PI * r;
  const fmt = (v: number) => format === 'taka' ? taka(v, lang) : v.toLocaleString(localeFor(lang));
  const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0;
  const active = data.find(d => d.key === hover);

  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={centerLabel}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100" />
          {total > 0 && data.map(d => {
            const len = (d.value / total) * c;
            const gap = data.length > 1 ? Math.min(3, len / 3) : 0;
            const el = (
              <circle
                key={d.key}
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={d.color}
                strokeWidth={hover === d.key ? stroke + 5 : stroke}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-offset}
                opacity={hover && hover !== d.key ? 0.35 : 1}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHover(d.key)}
                onMouseLeave={() => setHover(null)}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
          <div>
            <p className="text-[0.68rem] text-slate-400">{active ? active.label : centerLabel}</p>
            <p className="text-lg font-bold text-slate-800 leading-tight">{fmt(active ? active.value : total)}</p>
            {active && <p className="text-[0.68rem] font-medium text-slate-500">{pct(active.value)}%</p>}
          </div>
        </div>
      </div>
      <ul className="w-full space-y-1.5 min-w-0">
        {data.map(d => (
          <li
            key={d.key}
            onMouseEnter={() => setHover(d.key)}
            onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-2.5 rounded-lg px-2 py-1 text-sm transition-colors ${hover === d.key ? 'bg-slate-100' : ''}`}
          >
            <Swatch color={d.color} />
            <span className="flex-1 truncate text-slate-600">{d.label}</span>
            <span className="font-medium text-slate-800 tabular-nums">{fmt(d.value)}</span>
            <span className="w-9 text-end text-xs text-slate-400 tabular-nums">{pct(d.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Area chart (daily series) ─────────────────────────────────────────── */

export function AreaChart({ data, lang, unit, color = CHART.c2, height = 200 }: {
  data: { label: string; value: number }[]; lang: string; unit: string; color?: string; height?: number;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 14, right: 10, bottom: 24, left: 36 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const maxV = niceMax(Math.max(1, ...data.map(d => d.value)));
  const x = (i: number) => pad.left + (data.length > 1 ? (innerW * i) / (data.length - 1) : innerW / 2);
  const y = (v: number) => pad.top + innerH - (v / maxV) * innerH;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ');
  const area = data.length ? `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z` : '';
  // Unique per chart, so two area charts on one page keep their own colours.
  const gid = `area-grad-${useId().replace(/:/g, '')}`;
  const num = (v: number) => v.toLocaleString(localeFor(lang), { maximumFractionDigits: 1 });

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - box.left) / box.width) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  };

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={unit}>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map(f => (
            <g key={f}>
              <line x1={pad.left} x2={width - pad.right} y1={y(maxV * f)} y2={y(maxV * f)} className="stroke-slate-200" strokeDasharray={f ? '3 4' : undefined} />
              <text x={pad.left - 6} y={y(maxV * f) + 4} textAnchor="end" className="fill-slate-400 text-[10px]">{num(maxV * f)}</text>
            </g>
          ))}
          <path d={area} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {[0, Math.floor((data.length - 1) / 2), data.length - 1].filter((v, i, a) => a.indexOf(v) === i && data[v]).map(i => (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} className="fill-slate-400 text-[10.5px]">{data[i].label}</text>
          ))}
          {hover !== null && data[hover] && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={y(0)} className="stroke-slate-300" strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(data[hover].value)} r={5} fill={color} stroke="var(--card)" strokeWidth={2} />
            </g>
          )}
          <rect x={pad.left} y={pad.top} width={innerW} height={innerH} fill="transparent" onMouseMove={onMove} />
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={x(hover)} y={y(data[hover].value)} width={width}>
          <p className="text-slate-400">{data[hover].label}</p>
          <p className="font-semibold text-slate-800">{num(data[hover].value)} {unit}</p>
        </Tooltip>
      )}
    </div>
  );
}

/* ── Sparkline for KPI cards ───────────────────────────────────────────── */

export function Sparkline({ values, color, height = 36 }: { values: number[]; color: string; height?: number }) {
  const w = 120;
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(w * i) / (values.length - 1), height - 3 - ((v - min) / span) * (height - 6)]);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden>
      <path d={`${line} L${w},${height} L0,${height} Z`} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={2.5} fill={color} />
    </svg>
  );
}

/* ── Horizontal bars (compare a few groups) ────────────────────────────── */

export function HBars({ data, lang, format = 'taka' }: {
  data: { key: string; label: string; value: number; color: string }[]; lang: string; format?: 'taka' | 'count';
}) {
  const max = Math.max(1, ...data.map(d => Math.abs(d.value)));
  return (
    <div className="space-y-3">
      {data.map(d => (
        <div key={d.key}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-600">{d.label}</span>
            <span className={`font-semibold tabular-nums ${d.value < 0 ? 'text-red-500' : 'text-slate-800'}`}>
              {format === 'taka' ? taka(d.value, lang) : d.value.toLocaleString(localeFor(lang))}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(Math.abs(d.value) / max) * 100}%`, background: d.value < 0 ? CHART.c5 : d.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
