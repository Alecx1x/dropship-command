"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

export interface RevenueChartProps {
  data: Array<Record<string, number | string>>;
  stores: { id: string; name: string }[];
}

/** Stacked revenue-over-time area chart (last 30 days), one series per store. */
export function RevenueChart({ data, stores }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#a1a1aa33" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={28}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `$${v}`}
          width={56}
        />
        <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
        {stores.length > 1 && <Legend />}
        {stores.map((s, i) => (
          <Area
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.name}
            stackId="revenue"
            stroke={COLORS[i % COLORS.length]}
            fill={COLORS[i % COLORS.length]}
            fillOpacity={0.22}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
