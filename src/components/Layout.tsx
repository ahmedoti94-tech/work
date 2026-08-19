import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ROLE_AR, useStore, cartSummary } from "../lib/store";
import type { Role, View } from "../lib/types";
import { fmtClock, fmtDateShort, todayKey, waLink } from "../lib/payroll";
import { SUPERVISOR_PHONE } from "../lib/data";
import { Avatar, Badge, Icon, type IconName } from "./ui";

export const NAV_ACCESS: Record<View, Role[]> = {
  dashboard: ["super", "hr", "production", "sales", "customer"],
  attendance: ["super", "hr", "production", "customer"],
  payroll: ["super", "hr"],
  leaves: ["super", "hr", "customer"],
  marketplace: ["super", "sales", "customer"],
  orders: ["super", "sales", "customer"],
  security: ["super", "hr"],
  workers: ["super", "hr"],
  inventory: ["super", "production"],
  system: ["super"],
};

const NAV: { key: View; label: string; icon: IconName; group: string }[] = [
  { key: "dashboard", label: "لوحة التحكم", icon: "dashboard", group: "عام" },
  { key: "workers", label: "بوابة العمال", icon: "idcard", group: "المصنع والعمال" },
  { key: "attendance", label: "سجل الحضور والانصراف", icon: "clock", group: "المصنع والعمال" },
  { key: "payroll", label: "مسير الرواتب", icon: "payroll", group: "المصنع والعمال" },
  { key: "leaves", label: "الإجازات والأذونات", icon: "leave", group: "المصنع والعمال" },
  { key: "marketplace", label: "كتالوج الجملة", icon: "shop", group: "المبيعات والتجارة" },
  { key: "orders", label: "تتبع الطلبات", icon: "truck", group: "المبيعات والتجارة" },
  { key: "inventory", label: "إدارة المخزون", icon: "boxes", group: "المصنع والعمال" },
  { key: "security", label: "مركز الأمان", icon: "shield", group: "الإدارة العليا" },
  { key: "system", label: "النظام والتدقيق", icon: "sheet", group: "الإدارة العليا" },
];

function Logo({ size = 38 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl border border-brand/40 bg-brand/12 text-brand"
      style={{ width: size, height: size }}
    >
      <Icon name="oven" size={size * 0.58} />
    </span>
  );
}

function ClockChip() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hidden items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 md:flex">
      <span className="tick-dot h-1.5 w-1.5 rounded-full bg-sage" />
      <span className="num text-[13px] font-bold">{fmtClock(now)}</span>
      <span className="text-[11px] font-semibold text-mute">{fmtDateShort(todayKey())}</span>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { view, setView, user } = useStore();
  const allowed = NAV.filter((n) => NAV_ACCESS[n.key].includes(user.role));
  let lastGroup = "";
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <Logo />
        <div className="leading-tight">
          <p className="font-display text-[15.5px] font-bold leading-snug">المصرية للصناعات الغذائية</p>
          <p className="text-[10.5px] font-bold text-mute">إدارة المصنع والمتجر — مصر</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {allowed.map((n) => {
          const showGroup = n.group !== lastGroup;
          lastGroup = n.group;
          const active = view === n.key;
          return (
            <div key={n.key}>
              {showGroup && <p className="label-xs px-3 pb-1.5 pt-4 text-[10px]">{n.group}</p>}
              <button
                onClick={() => { setView(n.key); onNavigate?.(); }}
                className={`btn-press group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-[13.5px] font-bold transition-colors ${
                  active ? "bg-brand/10 text-brand" : "text-mute hover:bg-raise hover:text-ink"
                }`}
              >
                {active && (
                  <motion.span layoutId="nav-pill" className="absolute inset-y-1.5 start-0 w-1 rounded-full bg-brand" />
                )}
                <Icon name={n.icon} size={18} className={active ? "text-brand" : "text-mute group-hover:text-ink"} />
                {n.label}
              </button>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-line p-4">
        <div className="flex items-center gap-2.5">
          <Avatar name={user.name} size={36} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-bold">{user.name}</p>
            <p className="text-[10.5px] font-semibold text-mute">{user.title}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme, user, loginAs, view, setView, cart, products, cartOpen, setCartOpen, online, offlineQueue, users } = useStore();
  const [drawer, setDrawer] = useState(false);
  const [roleMenu, setRoleMenu] = useState(false);
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const sum = cartSummary(cart, products);

  const sendDigest = () => {
    const s = useStore.getState();
    const today = todayKey();
    const active = s.employees.filter((e) => e.active);
    const present = active.filter((e) => s.attendance.some((a) => a.empId === e.id && a.date === today && a.in != null)).length;
    const text = `تقرير ${fmtDateShort(today)} — الشركة المصرية للصناعات الغذائية\n\n• الحضور: ${present} من ${active.length}\n• طلبات نشطة: ${s.orders.filter((o) => o.status !== "delivered").length}\n• مواد تحت حد الطلب: ${s.raw.filter((r) => r.qty < r.reorderPoint).length}`;
    window.open(waLink(SUPERVISOR_PHONE, text), "_blank");
  };

  return (
    <div className="ambient min-h-screen">
      {/* الشريط الجانبي — شاشات كبيرة */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-[262px] border-e border-line bg-surface/70 backdrop-blur-sm lg:block">
        <SidebarContent />
      </aside>

      {/* الشريط الجانبي — جوال */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-sunken/60 backdrop-blur-[2px] lg:hidden" onClick={() => setDrawer(false)} />
            <motion.aside
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 start-0 z-50 w-[280px] border-e border-line bg-surface shadow-lift lg:hidden"
            >
              <SidebarContent onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:ps-[262px]">
        {/* الشريط العلوي */}
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
          <div className="flex items-center gap-2.5 px-4 py-2.5 lg:px-7">
            <button className="btn-press rounded-lg border border-line bg-surface p-2 text-mute lg:hidden" onClick={() => setDrawer(true)} aria-label="القائمة">
              <Icon name="dashboard" size={17} />
            </button>
            <div className="lg:hidden"><Logo size={34} /></div>

            <div className="ms-1 hidden items-center sm:flex">
              {!online && (
                <Badge tone="berry" className="py-1.5">
                  <Icon name="wifiOff" size={13} /> دون اتصال{offlineQueue.length > 0 ? ` — ${offlineQueue.length} بالانتظار` : ""}
                </Badge>
              )}
              {online && offlineQueue.length > 0 && (
                <Badge tone="butter" className="py-1.5"><Icon name="clock" size={13} /> مزامنة {offlineQueue.length} تسجيل</Badge>
              )}
            </div>

            <div className="ms-auto flex items-center gap-2">
              <ClockChip />
              <button onClick={toggleTheme} className="btn-press rounded-lg border border-line bg-surface p-2 text-mute hover:text-brand" aria-label="تبديل الوضع">
                <Icon name={theme === "light" ? "moon" : "sun"} size={17} />
              </button>
              {NAV_ACCESS.marketplace.includes(user.role) && (
                <button onClick={() => setCartOpen(!cartOpen)} className="btn-press relative rounded-lg border border-line bg-surface p-2 text-mute hover:text-brand" aria-label="سلة الطلب">
                  <Icon name="cart" size={17} />
                  {cartCount > 0 && (
                    <span className="pop num absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-cream">
                      {cartCount}
                    </span>
                  )}
                </button>
              )}
              <div className="relative">
                <button onClick={() => setRoleMenu(!roleMenu)}
                  className="btn-press flex items-center gap-2 rounded-lg border border-line bg-surface py-1 pe-2 ps-1">
                  <Avatar name={user.name} size={28} />
                  <span className="hidden text-start leading-tight sm:block">
                    <span className="block text-[12px] font-bold">{user.name.split(" ")[0]}</span>
                    <span className="block text-[10px] font-semibold text-brand">{ROLE_AR[user.role]}</span>
                  </span>
                  <Icon name="chevron" size={13} className={`text-mute transition-transform ${roleMenu ? "rotate-90" : "-rotate-90"}`} />
                </button>
                <AnimatePresence>
                  {roleMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setRoleMenu(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                        className="absolute end-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-lift"
                      >
                        <p className="label-xs border-b border-line px-3.5 py-2.5">تبديل الهوية (محاكاة الصلاحيات)</p>
                        {users.map((u) => (
                          <button key={u.id} onClick={() => { loginAs(u.id); setRoleMenu(false); }}
                            className={`btn-press flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start hover:bg-raise ${u.id === user.id ? "bg-brand/6" : ""}`}>
                            <Avatar name={u.name} size={32} />
                            <span className="min-w-0 flex-1 leading-tight">
                              <span className="block truncate text-[12.5px] font-bold">{u.name}</span>
                              <span className="block text-[10.5px] font-semibold text-mute">{u.title}</span>
                            </span>
                            {u.id === user.id && <Icon name="check" size={15} className="text-brand" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          {sum.discount > 0 && cartOpen && (
            <div className="border-t border-butter/30 bg-butter/10 px-4 py-1.5 text-center text-[11.5px] font-bold text-butter lg:px-7">
              وفّرت {sum.discount.toLocaleString("en-US")} ر.س بخصومات الكميات في هذا الطلب
            </div>
          )}
        </header>

        <main className="relative px-4 py-5 pb-28 lg:px-7 lg:py-7 lg:pb-10">{children}</main>

        <footer className="relative border-t border-line px-4 py-5 text-center text-[11px] text-mute lg:px-7">
          الشركة المصرية للصناعات الغذائية — منصة تشغيل المصنع: عمال وحضور ورواتب وكتالوج جملة ومخزون، على بيانات تشغيلية محاكاة
        </footer>
      </div>

      {/* رصيف الإجراءات السريعة — للمديرين على الشاشات الكبيرة */}
      {user.role !== "customer" && user.role !== "sales" && (
        <div className="fixed bottom-6 end-5 z-40 hidden flex-col gap-2 lg:flex">
          {[
            { label: "كشك البصمة", icon: "kiosk" as IconName, fn: () => { setView("attendance"); window.dispatchEvent(new CustomEvent("ow-open-kiosk")); } },
            { label: "مسير الرواتب", icon: "payroll" as IconName, fn: () => setView("payroll"), roles: ["super", "hr"] },
            { label: "تقرير واتساب", icon: "whatsapp" as IconName, fn: sendDigest },
            { label: "المخزون", icon: "boxes" as IconName, fn: () => setView("inventory"), roles: ["super", "production"] },
          ]
            .filter((a) => !a.roles || (a.roles as Role[]).includes(user.role))
            .map((a) => (
              <button key={a.label} onClick={a.fn}
                className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-mute shadow-lift transition-all hover:-translate-y-0.5 hover:border-brand hover:text-brand">
                <Icon name={a.icon} size={20} />
                <span className="pointer-events-none absolute end-full me-3 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11.5px] font-bold text-ink opacity-0 shadow-warm transition-opacity group-hover:opacity-100">
                  {a.label}
                </span>
              </button>
            ))}
        </div>
      )}

      {/* شريط التنقل السفلي — أجهزة أرضية المصنع والجوال */}
      <nav className="fixed inset-x-3 bottom-3 z-40 flex items-stretch justify-around rounded-2xl border border-line bg-surface/95 px-1 py-1.5 shadow-lift backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}>
        {NAV.filter((n) => NAV_ACCESS[n.key].includes(user.role)).slice(0, 5).map((n) => {
          const active = view === n.key;
          return (
            <button key={n.key} onClick={() => setView(n.key)}
              className={`btn-press flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[9.5px] font-bold ${active ? "bg-brand/10 text-brand" : "text-mute"}`}>
              <Icon name={n.icon} size={19} className={active ? "text-brand" : ""} />
              <span className="truncate">{n.label.split(" ")[0] === "سجل" ? "الحضور" : n.label.split(" ").slice(0, 2).join(" ")}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
