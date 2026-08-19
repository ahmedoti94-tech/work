import { useMemo } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { buildSalesSeries, BEST_SELLERS } from "../lib/data";
import { useStore } from "../lib/store";
import {
  computePayroll, fmtMoney0, monthKeyNow, SHIFTS, todayKey, workdaysElapsed, workdaysInMonth,
} from "../lib/payroll";
import { Badge, Card, CountUp, Icon, SectionHead, Stat } from "../components/ui";

const TICKER = [
  "LINE A · Choco Chunk @ 142 ct/min", "OVEN 2 · 218°C zone 3", "BATCH LOT-2481-A curing",
  "LINE B · Butter Rounds @ 118 ct/min", "SILO 2 flour 68% full", "QC moisture pass 3.1%",
  "LINE C · Sesame Snaps @ 96 ct/min", "Dispatch dock 2 · 09:00 slot", "Steam boiler 4.2 bar",
];

function TickerStrip() {
  const items = [...TICKER, ...TICKER];
  return (
    <div className="relative mb-5 overflow-hidden rounded-xl border border-line bg-ink text-bg dark:bg-cream dark:text-sunken">
      <div className="marquee flex w-max items-center gap-6 whitespace-nowrap px-4 py-2 text-[11.5px] font-semibold tracking-wide">
        {items.map((t, i) => (
          <span key={i} className="flex items-center gap-2">
            <Icon name="wheat" size={13} className="text-butter" /> {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function useChartColors() {
  const theme = useStore((s) => s.theme);
  return theme === "dark"
    ? { brand: "#e39b3a", butter: "#eec45e", sage: "#a4ba6c", berry: "#e06a4d", mute: "#a08a69", grid: "#3a2c1d", cocoa: "#d3a878" }
    : { brand: "#c0761f", butter: "#e2b23f", sage: "#67763c", berry: "#b0432a", mute: "#8a7355", grid: "#e0d2b6", cocoa: "#5f4126" };
}

const tooltipStyle = {
  background: "var(--t-surface)", border: "1px solid var(--t-line)", borderRadius: 10,
  fontSize: 12, fontFamily: "Spline Sans Mono, monospace", color: "var(--t-ink)",
  boxShadow: "0 10px 30px -12px rgb(36 22 9 / 0.25)",
};

export default function Dashboard() {
  const { user, orders, employees, attendance, leaves, advances, rawMaterials, setView } = useStore();
  const c = useChartColors();
  const role = user.role;
  const sales = useMemo(() => buildSalesSeries(), []);
  const last28 = sales.slice(-28);
  const revenue28 = last28.reduce((s, p) => s + p.revenue, 0);
  const units28 = last28.reduce((s, p) => s + p.units, 0);

  const weekly = useMemo(() => {
    const out: { w: string; revenue: number; units: number }[] = [];
    for (let i = 0; i < sales.length; i += 7) {
      const chunk = sales.slice(i, i + 7);
      out.push({
        w: chunk[0].label,
        revenue: chunk.reduce((s, p) => s + p.revenue, 0),
        units: chunk.reduce((s, p) => s + p.units, 0),
      });
    }
    return out;
  }, [sales]);

  // attendance today
  const tk = todayKey();
  const todayRecs = attendance.filter((a) => a.date === tk);
  const present = todayRecs.filter((r) => r.in != null).length;
  const late = todayRecs.filter((r) => {
    if (r.in == null) return false;
    const emp = employees.find((e) => e.id === r.empId);
    return emp ? r.in > SHIFTS[emp.shift].start + 10 : false;
  }).length;
  const absent = employees.filter((e) => e.active && !todayRecs.some((r) => r.empId === e.id && r.in != null)).length;
  const donut = [
    { name: "On time", value: present - late, color: c.sage },
    { name: "Late", value: late, color: c.butter },
    { name: "Not punched", value: absent, color: c.berry },
  ].filter((d) => d.value > 0);

  // payroll forecast
  const mk = monthKeyNow();
  const payrollForecast = useMemo(
    () => employees.reduce((s, e) => s + computePayroll(e, mk, attendance, leaves, advances).net, 0),
    [employees, attendance, leaves, advances, mk]
  );
  const monthPct = Math.round((workdaysElapsed(mk) / workdaysInMonth(mk)) * 100);

  const openOrders = orders.filter((o) => o.status < 3).length;
  const lowStock = rawMaterials.filter((r) => r.stock <= r.reorderAt).length;
  const pendingLeaves = leaves.filter((l) => l.status === "pending").length;

  const isCustomer = role === "customer";

  return (
    <div>
      {!isCustomer && <TickerStrip />}

      {/* headline row */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-xs">Plant #1 · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {isCustomer ? `Welcome back, ${user.name.split(" ")[0]}` : "The ovens never sleep."}
          </h2>
          <p className="mt-1 max-w-xl text-[13px] text-mute">
            {isCustomer
              ? "Fresh wholesale pricing is live — volume tiers apply automatically at 10+ cartons."
              : "Live pulse of baking lines, workforce and commerce. Every figure below recalculates from plant events in real time."}
          </p>
        </div>
        <div className="flex gap-2">
          {isCustomer ? (
            <button onClick={() => setView("market")} className="btn-press inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-cream shadow-warm hover:bg-branddeep">
              Browse the bake house <Icon name="arrow" size={16} />
            </button>
          ) : (
            <Badge tone="amber" className="text-[11px]">
              <span className="tick-dot h-1.5 w-1.5 rounded-full bg-brand" /> LIVE PLANT FEED
            </Badge>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue · 28d" value={<CountUp value={revenue28} format={fmtMoney0} />} sub={`${units28.toLocaleString()} packs shipped`} tone="amber" icon="wallet" />
        {role !== "customer" && (
          <Stat label="Open orders" value={<CountUp value={openOrders} format={(n) => String(n)} />} sub={`${orders.length} total this quarter`} icon="package" />
        )}
        {(role === "hr" || role === "super_admin" || role === "production") && (
          <Stat label="Attendance today" value={<CountUp value={present} format={(n) => `${n}/${employees.length}`} />} sub={`${late} late · ${absent} not punched`} tone={late + absent > 5 ? "berry" : "sage"} icon="clock" />
        )}
        {(role === "hr" || role === "super_admin") && (
          <Stat label="Payroll forecast" value={<CountUp value={payrollForecast} format={fmtMoney0} />} sub={`${monthPct}% of month elapsed · ${pendingLeaves} leaves pending`} tone="berry" icon="scale" />
        )}
        {(role === "production" || role === "super_admin") && (
          <Stat label="Stock alerts" value={<CountUp value={lowStock} format={(n) => String(n)} />} sub="raw materials under reorder point" tone={lowStock ? "berry" : "sage"} icon="alert" />
        )}
        {role === "sales" && (
          <Stat label="Avg order value" value={<CountUp value={Math.round(orders.reduce((s, o) => s + o.total, 0) / Math.max(1, orders.length))} format={fmtMoney0} />} sub="across all channels" icon="store" />
        )}
        {role === "customer" && (
          <Stat label="Your open orders" value={<CountUp value={orders.filter((o) => o.status < 3).length} format={(n) => String(n)} />} sub="being baked right now" icon="flame" tone="amber" />
        )}
        {role === "customer" && (
          <Stat label="Best seller" value="Midnight Choco" sub="4.8★ · 2,400+ cartons/yr" icon="wheat" />
        )}
      </div>

      {/* charts */}
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <SectionHead title="Revenue — last 4 weeks" sub="Daily dispatch value across B2B contracts & retail" right={<Badge tone="sage">+18% vs prior period</Badge>} />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last28} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.brand} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={c.brand} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: c.mute }} tickLine={false} axisLine={false} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: c.mute }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${Number(v).toLocaleString()}`, "Revenue"]} labelStyle={{ color: "var(--t-mute)" }} />
                <Area type="monotone" dataKey="revenue" stroke={c.brand} strokeWidth={2.4} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <SectionHead title="Best-selling variants" sub="Cartons moved · 28 days" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={BEST_SELLERS.map((p) => ({ name: p.name.split(" ").slice(0, 2).join(" "), v: Math.round(420 / p.soldRank + 60) }))} layout="vertical" margin={{ top: 0, right: 8, left: -6, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: c.mute }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10.5, fill: "var(--t-ink)", fontWeight: 600 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} cartons`, "Sold"]} labelStyle={{ color: "var(--t-mute)" }} cursor={{ fill: "color-mix(in srgb, var(--t-brand) 6%, transparent)" }} />
                <Bar dataKey="v" radius={[0, 6, 6, 0]} barSize={18}>
                  {BEST_SELLERS.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? c.brand : i === 1 ? c.butter : c.cocoa} fillOpacity={1 - i * 0.08} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* attendance donut */}
        {(role === "hr" || role === "super_admin" || role === "production") && (
          <Card className="p-4">
            <SectionHead title="Gate status — today" sub={`${present} punched in of ${employees.length} rostered`} />
            <div className="flex items-center gap-4">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donut} dataKey="value" innerRadius={44} outerRadius={64} paddingAngle={3} strokeWidth={0}>
                      {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {donut.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-[12.5px]">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
                    <span className="font-semibold">{d.name}</span>
                    <span className="num text-mute">{d.value}</span>
                  </div>
                ))}
                <button onClick={() => setView("attendance")} className="btn-press mt-1 flex items-center gap-1.5 text-[12px] font-bold text-brand hover:gap-2.5 transition-all">
                  Open gate terminal <Icon name="arrow" size={13} />
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* production vs revenue */}
        <Card className="p-4 xl:col-span-2">
          <SectionHead title="Production vs revenue" sub="Weekly baked units (bars) against dispatch value (line)" right={
            <div className="flex items-center gap-2 text-brand">
              <Icon name="flame" size={18} className="oven-flame" />
              <span className="num text-[12px] font-bold">OVEN 2 · 218°C</span>
            </div>
          } />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weekly} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="w" tick={{ fontSize: 10, fill: c.mute }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="u" tick={{ fontSize: 10, fill: c.mute }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: c.mute }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--t-mute)" }} />
                <Bar yAxisId="u" dataKey="units" name="Units baked" fill={c.butter} fillOpacity={0.75} radius={[5, 5, 0, 0]} barSize={20} />
                <Line yAxisId="r" type="monotone" dataKey="revenue" name="Revenue" stroke={c.brand} strokeWidth={2.4} dot={{ r: 3, fill: c.brand }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* recent orders + leaves strip */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionHead title="Freshest orders" right={role !== "customer" ? (
            <button onClick={() => setView("orders")} className="btn-press flex items-center gap-1.5 text-[12px] font-bold text-brand hover:gap-2.5 transition-all">
              Pipeline <Icon name="arrow" size={13} />
            </button>
          ) : undefined} />
          <div className="space-y-2">
            {orders.slice(0, 4).map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg border border-line bg-raise px-3 py-2.5 transition-colors hover:border-linestrong">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold">{o.ref} · {o.customer}</p>
                  <p className="num text-[11px] text-mute">{new Date(o.placedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {o.items.length} lines · {o.kind}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <Badge tone={o.status === 3 ? "sage" : o.status === 1 ? "amber" : "mute"}>{["Pending", "Baking", "Shipped", "Delivered"][o.status]}</Badge>
                  <span className="num text-[13px] font-bold">{fmtMoney0(o.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="relative overflow-hidden p-4">
          <div className="hatch absolute inset-x-0 top-0 h-full opacity-40" />
          <div className="relative">
            <SectionHead title="Payroll engine — month to date" sub={`Formula: (base ÷ ${workdaysInMonth(mk)} work days) × days present + OT×1.5 − late − advances`} />
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-line bg-surface p-3">
                <p className="label-xs">Work days</p>
                <p className="num mt-1 font-display text-xl font-bold">{workdaysElapsed(mk)}<span className="text-sm text-mute">/{workdaysInMonth(mk)}</span></p>
              </div>
              <div className="rounded-lg border border-line bg-surface p-3">
                <p className="label-xs">Forecast net</p>
                <p className="num mt-1 font-display text-xl font-bold text-brand">{fmtMoney0(payrollForecast)}</p>
              </div>
              <div className="rounded-lg border border-line bg-surface p-3">
                <p className="label-xs">Open advances</p>
                <p className="num mt-1 font-display text-xl font-bold text-berry">{fmtMoney0(advances.filter((a) => !a.settledMonth).reduce((s, a) => s + a.amount, 0))}</p>
              </div>
            </div>
            {(role === "hr" || role === "super_admin") && (
              <button onClick={() => setView("payroll")} className="btn-press mt-3 flex items-center gap-1.5 text-[12.5px] font-bold text-brand hover:gap-2.5 transition-all">
                Review & finalize payslips <Icon name="arrow" size={13} />
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
