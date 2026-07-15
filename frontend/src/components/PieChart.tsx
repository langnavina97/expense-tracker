import { formatMoney } from "../utils";

export const CHART_COLORS = [
  "#5b5bd6",
  "#e8590c",
  "#0ca678",
  "#e64980",
  "#1c7ed6",
  "#f08c00",
  "#7048e8",
  "#12b886",
  "#e03131",
  "#495057",
];

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

export function PieChart({ slices }: { slices: PieSlice[] }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  let cumulative = 0;
  const stops = slices.map((s) => {
    const start = (cumulative / total) * 100;
    cumulative += s.value;
    const end = (cumulative / total) * 100;
    return `${s.color} ${start}% ${end}%`;
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
