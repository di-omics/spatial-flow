"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { INDICATION_COLORS, type Indication } from "@/lib/constants";

const AXIS = { fontSize: 11, fill: "hsl(205 9% 42%)" };
const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid hsl(200 16% 90%)",
  fontSize: 12,
  boxShadow: "0 10px 30px -12px rgb(16 24 40 / 0.22)",
};
const PRIMARY = "#0f766e";

export function ThroughputChart({ data }: { data: { week: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="throughput" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.9} />
            <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 16% 92%)" vertical={false} />
        <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={false} interval={1} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "hsl(200 16% 85%)" }} />
        <Line
          type="monotone"
          dataKey="count"
          name="Patients"
          stroke={PRIMARY}
          strokeWidth={2.5}
          dot={{ r: 2.5, fill: PRIMARY }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function IndicationBarChart({
  data,
}: {
  data: { indication: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 16% 92%)" vertical={false} />
        <XAxis dataKey="indication" tick={{ ...AXIS, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-18} dy={8} height={40} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(200 16% 95%)" }} />
        <Bar dataKey="count" name="Specimens" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell
              key={d.indication}
              fill={INDICATION_COLORS[d.indication as Indication] ?? PRIMARY}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FailureReasonsChart({
  data,
}: {
  data: { reason: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No failures or flags in this run.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 40)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 16% 92%)" horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="reason"
          tick={{ ...AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(200 16% 95%)" }} />
        <Bar dataKey="count" name="Cores" fill="#e0983b" radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}
