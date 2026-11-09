"use client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const C = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const pctTick = (v: number) => `${Math.round(v * 100)}%`;
const pctTip = (v: unknown) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "—");

export function TrendChart({ data, series, height = 240 }: { data: Record<string, unknown>[]; series: { key: string; label: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis domain={[0, 1]} tickFormatter={pctTick} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={40} />
        <Tooltip formatter={pctTip} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={C[i % C.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarsChart({ data, series, height = 240, percent = true }: { data: Record<string, unknown>[]; series: { key: string; label: string }[]; height?: number; percent?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" interval={0} />
        <YAxis domain={percent ? [0, 1] : undefined} tickFormatter={percent ? pctTick : undefined} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={40} allowDecimals={!percent} />
        <Tooltip formatter={percent ? pctTip : undefined} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} cursor={{ fill: "var(--muted)" }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={C[i % C.length]} radius={[4, 4, 0, 0]} maxBarSize={40} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
