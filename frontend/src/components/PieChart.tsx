import { formatMoney } from "../utils";

// Fixed order, validated for CVD-safe adjacent contrast in both light and
// dark mode (see the dataviz skill) - never reassign a slot or cycle it.
// A 9th category/person folds into CHART_OTHER_COLOR instead of a new hue.
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];
export const CHART_OTHER_COLOR = "var(--chart-other)";
export const MAX_CHART_SLICES = CHART_COLORS.length;

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

// A thin surface-colored gap between adjacent fills, per the mark spec -
// keeps slices visually distinct even for two adjacent close hues.
const GAP_PCT = 0.5;

export function PieChart({ slices }: { slices: PieSlice[] }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  let cumulative = 0;
  const stops: string[] = [];
  slices.forEach((s, i) => {
    const start = (cumulative / total) * 100;
    cumulative += s.value;
    const end = (cumulative / total) * 100;
    const isLast = i === slices.length - 1;
    const segmentEnd = isLast ? end : Math.max(start, end - GAP_PCT);

    stops.push(`${s.color} ${start}% ${segmentEnd}%`);
    if (!isLast) {
      stops.push(`var(--color-surface) ${segmentEnd}% ${end}%`);
    }
  });

  return (
    <div className="pie-chart-wrap">
      <div className="pie-chart" style={{ background: `conic-gradient(${stops.join(", ")})` }} />
      <div className="pie-legend">
        {slices.map((s) => (
          <div className="pie-legend-row" key={s.label}>
            <span className="pie-swatch" style={{ background: s.color }} />
            <span className="pie-legend-label">{s.label}</span>
            <span className="pie-legend-value">
              {formatMoney(s.value, "USD")} · {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
