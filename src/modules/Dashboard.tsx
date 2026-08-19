import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend,
  Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { BESTSELLERS, COMPANY, REVENUE_SERIES, SUPERVISOR_PHONE } from "../lib/data";
import {
  MONTHS_AR_SHORT, addDays, computePayroll, dateKey, dayStats, fmtDateShort,
  fmtMoney0, monthKeyNow, monthLabel, prevMonthKey, todayKey, waLink,
  workdaysElapsed, workdaysInMonth,
} from "../lib/payroll";
import { STATUS_AR, useStore } from "../lib/store";
import type { OrderStatus } from "../lib/types";
import { Badge, Btn, Icon, SectionHead, Stat } from "../components/ui";

const tooltipStyle = {
  background: "var(--t-surface)",
  border: "1px solid var(--t-line)",
  borderRadius: 10,
  fontFamily: "Tajawal, sans-serif",
  fontSize: 12,
  direction: "rtl" as const,
};

function daysLeft(producedAt: string, expiryDays: number) {
  const [y, m, d] = producedAt.split("-").map(Number);
  const exp = addDays(new Date(y, m - 1, d), expiryDays);
  return Math.ceil((exp.getTime() - new Date().getTime()) / 86400000);
}

export default function Dashboard() {
  const { user, employees, attendance, orders, products, advances, batches, leaves, raw, setView, finalizedMonths } = useStore();
  const role = user.role;
  const month = monthKeyNow();
  const today = todayKey();
  const active = employees.filter((e) => e.active);

  const todayRecs = useMemo(
    () => active.map((e) => ({ e, r: attendance.find((a) => a.empId === e.id && a.date === today) })),
    [active, attendance, today]
  );
  const present = todayRecs.filter((x) => x.r?.in != null).length;
  const late = todayRecs.filter((x) => x.r && dayStats(x.r, x.e.shift).late > 0).length;
  const absent = active.length - present;

  const payrollNow = useMemo(
    () => active.reduce((s, e) => s + computePayroll(e, month, attendance, leaves, advances).net, 0),
    [active, month, attendance, leaves, advances]
  );
  const wd = workdaysInMonth(month);
  const elapsed = workdaysElapsed(month);
  const projected = (payrollNow / Math.max(1, elapsed)) * wd;

  const last = REVENUE_SERIES[REVENUE_SERIES.length - 1];
  const revenueK = last.revenue * 1000;
  const opexK = (last.materials + last.payroll) * 1000;
  const profitK = revenueK - opexK;
  const margin = Math.round((profitK / revenueK) * 100);

  const activeOrders = orders.filter((o) => o.status !== "delivered");
  const openAdvances = advances.filter((a) => !a.settledMonth).reduce((s, a) => s + a.amount, 0);
  const lowStock = raw.filter((r) => r.qty < r.reorderPoint);
  const expiring = batches
    .map((b) => ({ ...b, left: daysLeft(b.producedAt, b.expiryDays), name: products.find((p) => p.id === b.productId)?.name ?? "" }))
    .filter((b) => b.left <= 21)
    .sort((a, b) => a.left - b.left);

  const statusCounts = (["pending", "baking", "shipped", "delivered"] as OrderStatus[]).map((s) => ({
    name: STATUS_AR[s], value: orders.filter((o) => o.status === s).length,
  }));
  const pieColors = ["var(--t-butter)", "var(--t-brand)", "var(--t-cocoa)", "var(--t-sage)"];

  const greeting = new Date().getHours() < 12 ? "صباح الخير" : new Date().getHours() < 17 ? "مساء النور" : "مساء الخير";
  const firstName = user.name.split(" ")[0];

  const sendDailyDigest = () => {
    const text = `تقرير ${fmtDateShort(today)} — ${COMPANY.name}\n\n• الحضور: ${present} من ${active.length} (متأخرون: ${late})\n• طلبات نشطة: ${activeOrders.length}\n• مواد تحت حد الطلب: ${lowStock.length}\n• دفعات تقترب صلاحيتها: ${expiring.length}`;
    window.open(waLink(SUPERVISOR_PHONE, text), "_blank");
  };

  return (
    <div className="space-y-5">
      {/* الترويسة */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-xs">{fmtDateShort(today)} · {monthLabel(month)}</p>
          <h1 className="mt-1 font-display text-[28px] font-bold leading-tight tracking-tight">
            {greeting}، {role === "super" ? `أ. ${firstName}` : firstName}
          </h1>
          <p className="mt-0.5 text-[13px] text-mute">
            {role === "super" ? "نظرة المالك: الربحية والإنتاج والتكاليف بالجنيه المصري" : "نظرة سريعة على حال المصنع اليوم — كل الأرقام محدثة لحظيًا"}
          </p>
        </div>
        {(role === "super" || role === "hr" || role === "production") && (
          <Btn variant="whatsapp" onClick={sendDailyDigest}>
            <Icon name="whatsapp" size={16} /> تقرير اليوم واتساب
          </Btn>
        )}
      </div>

      {/* شريط المصنع الحي */}
      <div className="overflow-hidden rounded-xl border border-line bg-ink text-bg dark:bg-cream dark:text-sunken">
        <div className="marquee flex w-max items-center gap-8 whitespace-nowrap px-6 py-2.5 text-[12.5px] font-bold">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center gap-8">
              <span>الوردية الصباحية تعمل — دفعة الدايجستيف في التغليف</span>
              <span className="text-butter">خصم ١٤٪ على طلبات ٥٠ كرتونة فأكثر</span>
              <span>حضور اليوم: {present} من {active.length}</span>
              <span className="text-butter">{activeOrders.length} طلب قيد التجهيز</span>
              <span>آخر شحنة: OW-2417 غادرت إلى شبرا</span>
              <span className="text-butter">{lowStock.length} خامة تحت حد إعادة الطلب</span>
            </div>
          ))}
        </div>
      </div>

      {/* مؤشرات المالك: أرباح وخسائر */}
      {role === "super" && (
        <div className="card relative overflow-hidden p-5">
          <div className="dotgrid absolute inset-0 opacity-20" />
          <div className="relative">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-[19px] font-bold">حساب الأرباح والخسائر — {monthLabel(month)}</h2>
                <p className="text-[12px] font-semibold text-mute">الإيرادات مقابل تكلفة التشغيل (خامات + رواتب) بالجنيه المصري</p>
              </div>
              <Badge tone={margin >= 20 ? "sage" : "butter"}>هامش {margin}٪</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { l: "إيرادات الشهر", v: fmtMoney0(revenueK), s: "مبيعات جملة وتجزئة", tone: "text-ink" },
                { l: "تكلفة التشغيل", v: fmtMoney0(opexK), s: `خامات ${fmtMoney0(last.materials * 1000)} + رواتب ${fmtMoney0(last.payroll * 1000)}`, tone: "text-berry" },
                { l: "مجمل الربح", v: fmtMoney0(profitK), s: "قبل المصروفات الإدارية", tone: "text-sage" },
                { l: "رواتب متوقعة للشهر", v: fmtMoney0(projected), s: `${active.length} عامل — يومي وشهري`, tone: "text-brand" },
              ].map((c, i) => (
                <motion.div key={c.l} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  className="rounded-xl border border-line bg-surface/85 p-4">
                  <p className="label-xs">{c.l}</p>
                  <p className={`num mt-1.5 font-display text-[22px] font-bold leading-none ${c.tone}`}>{c.v}</p>
                  <p className="mt-1.5 text-[10.5px] font-semibold text-mute">{c.s}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* المؤشرات السريعة */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {role === "sales" || role === "customer" ? (
          <>
            <Stat label="إيرادات الشهر" value={fmtMoney0(revenueK)} sub="آخر ٣٠ يومًا" icon="chart" />
            <Stat label="الطلبات النشطة" value={activeOrders.length} sub="قيد التجهيز والشحن" icon="truck" tone="butter" />
            <Stat label="منتجات الكتالوج" value={products.length} sub="٨ خطوط بسكويت" icon="shop" tone="sage" />
            <Stat label="التوصيل المجاني" value="من 1,200 ج.م" sub="أو برسوم المحافظة" icon="boxes" tone="cocoa" />
          </>
        ) : role === "production" ? (
          <>
            <Stat label="حضور الوردية" value={`${present}/${active.length}`} sub={`متأخرون: ${late}`} icon="users" tone={present / active.length > 0.85 ? "sage" : "butter"} />
            <Stat label="مواد تحت حد الطلب" value={lowStock.length} sub={lowStock[0] ? `أهمها: ${lowStock[0].name}` : "المخزون سليم"} icon="alert" tone={lowStock.length ? "berry" : "sage"} />
            <Stat label="دفعات تنتهي قريبًا" value={expiring.length} sub="خلال ٢١ يومًا" icon="boxes" tone={expiring.length ? "butter" : "sage"} />
            <Stat label="الطلبات النشطة" value={activeOrders.length} sub="جاهزة للتغليف" icon="truck" tone="butter" />
          </>
        ) : (
          <>
            <Stat label="حضور اليوم" value={`${present}/${active.length}`} sub={`متأخرون: ${late} · غائبون: ${absent}`} icon="users" tone={present / active.length > 0.85 ? "sage" : "butter"} />
            <Stat label="رواتب الشهر حتى الآن" value={fmtMoney0(payrollNow)} sub={`متوقع كامل الشهر: ${fmtMoney0(projected)}`} icon="payroll" />
            <Stat label="الطلبات النشطة" value={activeOrders.length} sub={`${orders.filter((o) => o.status === "shipped").length} بالشحن الآن`} icon="truck" tone="butter" />
            <Stat label="سلف مفتوحة" value={fmtMoney0(openAdvances)} sub="تُخصم من مسير الشهر" icon="alert" tone={openAdvances > 0 ? "butter" : "sage"} />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* الإيرادات */}
        <div className="card p-4 lg:col-span-2">
          <SectionHead title="الإيرادات مقابل تكلفة التشغيل" desc="١٢ شهرًا — بالآلاف (ج.م)" />
          <div dir="ltr" className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={REVENUE_SERIES} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--t-brand)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--t-brand)" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="gPay" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--t-cocoa)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--t-cocoa)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--t-line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickFormatter={(m: number) => MONTHS_AR_SHORT[(m - 1) % 12]} tick={{ fill: "var(--t-mute)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--t-mute)", fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number | string, n: string) => [`${Number(v).toLocaleString()} ألف ج.م`, n === "revenue" ? "الإيرادات" : "الخامات"]} />
                <Area type="monotone" dataKey="revenue" stroke="var(--t-brand)" strokeWidth={2.4} fill="url(#gRev)" />
                <Area type="monotone" dataKey="materials" stroke="var(--t-cocoa)" strokeWidth={2} fill="url(#gPay)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* حالة الطلبات */}
        <div className="card p-4">
          <SectionHead title="حالة الطلبات" desc="توزيع مباشر" />
          <div dir="ltr" className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusCounts} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">
                  {statusCounts.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {statusCounts.map((s, i) => (
              <span key={s.name} className="flex items-center gap-1.5 text-[11.5px] font-bold">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: pieColors[i] }} />
                {s.name} <span className="num text-mute">({s.value})</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* الأكثر مبيعًا */}
        <div className="card p-4">
          <SectionHead title="الأكثر مبيعًا" desc="كراتين هذا الشهر" />
          <div dir="ltr" className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={BESTSELLERS} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" orientation="right" width={92} tick={{ fill: "var(--t-ink)", fontSize: 11, fontFamily: "Tajawal" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--t-raise)" }} formatter={(v: number | string) => [`${v} كرتونة`, "المبيعات"]} />
                <Bar dataKey="sold" radius={[6, 0, 0, 6]} barSize={16}>
                  {BESTSELLERS.map((_, i) => <Cell key={i} fill={i === 0 ? "var(--t-brand)" : "var(--t-butter)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* الإنتاجية مقابل التكلفة */}
        <div className="card p-4">
          <SectionHead title="الإنتاج الفعلي ضد الخامات" desc="مؤشر كفاءة التشغيل" />
          <div dir="ltr" className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={REVENUE_SERIES.slice(-8)} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--t-line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickFormatter={(m: number) => MONTHS_AR_SHORT[(m - 1) % 12]} tick={{ fill: "var(--t-mute)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--t-mute)", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="production" fill="var(--t-butter)" radius={[5, 5, 0, 0]} barSize={14} name="الإنتاج" />
                <Line type="monotone" dataKey="materials" stroke="var(--t-cocoa)" strokeWidth={2.2} dot={false} name="الخامات" />
                <Legend wrapperStyle={{ fontFamily: "Tajawal", fontSize: 11, direction: "rtl" }} formatter={(v: string) => (v === "الإنتاج" ? v : "الخامات")} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* تنبيهات الصلاحية + الأفران */}
        <div className="space-y-4">
          <div className="card p-4">
            <SectionHead title="تنبيهات الصلاحية" desc="دفعات تنتهي خلال ٢١ يومًا" />
            {expiring.length === 0 && <p className="py-6 text-center text-[12.5px] font-semibold text-mute">لا توجد دفعات قريبة من الانتهاء</p>}
            <div className="space-y-2">
              {expiring.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-line bg-raise px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-bold">{b.name}</p>
                    <p className="num text-[10.5px] font-semibold text-mute">{b.lot} · {b.qty} كرتونة</p>
                  </div>
                  <Badge tone={b.left <= 7 ? "berry" : "butter"}>
                    {b.left < 0 ? "منتهية" : `باقي ${b.left} يوم`}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
              <h3 className="font-display text-[15px] font-bold">الأفران الآن</h3>
              <Badge tone="sage"><span className="tick-dot h-1.5 w-1.5 rounded-full bg-sage" /> مباشر</Badge>
            </div>
            {[
              { name: "فرن النفق A", status: "يعمل", temp: 185, tone: "sage" as const },
              { name: "فرن النفق B", status: "يعمل", temp: 172, tone: "sage" as const },
              { name: "فرن التوست C", status: "إحماء", temp: 96, tone: "butter" as const },
            ].map((o, i) => (
              <div key={o.name} className="flex items-center gap-3 border-t border-line px-4 py-3">
                <span className="text-brand"><Icon name="flame" size={18} className={`oven-flame ${o.tone === "butter" ? "opacity-60" : ""}`} /></span>
                <div className="flex-1">
                  <p className="text-[13px] font-bold">{o.name}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(o.temp / 220) * 100}%` }} transition={{ delay: 0.2 + i * 0.12, duration: 0.7 }}
                      className="h-full rounded-full bg-brand" />
                  </div>
                </div>
                <div className="text-end">
                  <p className="num text-[14px] font-bold">{o.temp}°</p>
                  <Badge tone={o.tone}>{o.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* أحدث الطلبات */}
      <div className="card overflow-hidden">
        <SectionHead title="أحدث الطلبات" desc="آخر ٥ طلبات واردة"
          actions={user.role !== "customer" ? <Btn variant="outline" size="sm" onClick={() => setView("orders")}>عرض الكل <Icon name="chevron" size={14} className="rotate-180" /></Btn> : undefined} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] font-bold text-mute">
                <th className="px-4 py-2.5 text-start">الطلب</th>
                <th className="px-3 py-2.5 text-start">العميل</th>
                <th className="px-3 py-2.5 text-start">المحافظة</th>
                <th className="px-3 py-2.5 text-start">الإجمالي</th>
                <th className="px-4 py-2.5 text-start">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 5).map((o) => (
                <tr key={o.id} className="border-b border-line/60 last:border-0 hover:bg-raise/60">
                  <td className="num px-4 py-2.5 font-bold text-brand">{o.id}</td>
                  <td className="px-3 py-2.5 font-semibold">{o.customer}</td>
                  <td className="px-3 py-2.5 text-mute">{o.governorate ?? "—"}</td>
                  <td className="num px-3 py-2.5 font-bold">{fmtMoney0(o.total)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={o.status === "delivered" ? "sage" : o.status === "shipped" ? "brand" : o.status === "baking" ? "butter" : "mute"}>
                      {STATUS_AR[o.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-[11px] text-mute">
        {finalizedMonths.includes(prevMonthKey(month)) ? `مسير ${monthLabel(prevMonthKey(month))} معتمد ومُصدر` : `مسير الشهر السابق بانتظار اعتماد الإدارة — ${monthLabel(prevMonthKey(month))}`}
      </p>
    </div>
  );
}
