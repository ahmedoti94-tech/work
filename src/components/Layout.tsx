import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ViewKey } from "../lib/types";
import { NAV_ACCESS, ROLE_LABEL, useStore } from "../lib/store";
import { USERS } from "../lib/data";
import { fmtClock } from "../lib/payroll";
import { Avatar, Badge, Icon } from "./ui";
import type { IconName } from "./ui";

const NAV: { key: ViewKey; label: string; icon: IconName; group: string }[] = [
  { key: "dashboard", label: "Overview", icon: "dashboard", group: "Command" },
  { key: "market", label: "Marketplace", icon: "store", group: "Commerce" },
  { key: "orders", label: "Orders", icon: "package", group: "Commerce" },
  { key: "attendance", label: "Gate Terminal", icon: "clock", group: "Workforce" },
  { key: "payroll", label: "Payroll", icon: "wallet", group: "Workforce" },
  { key: "leaves", label: "Leaves", icon: "leave", group: "Workforce" },
  { key: "inventory", label: "Inventory", icon: "boxes", group: "Operations" },
  { key: "system", label: "System & Audit", icon: "shield", group: "Operations" },
];

const VIEW_TITLES: Record<ViewKey, string> = {
  dashboard: "Command Overview", market: "Biscuit Marketplace", orders: "Order Pipeline",
  attendance: "Gate Terminal & Attendance", payroll: "Automated Payroll", leaves: "Leave Desk",
  inventory: "Inventory Control", system: "System & Audit Trail",
};

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hidden md:flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5">
      <span className="tick-dot h-1.5 w-1.5 rounded-full bg-sage" />
      <span className="num text-[13px] font-semibold tracking-wide">{fmtClock(now)}</span>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { view, setView, user } = useStore();
  const groups = [...new Set(NAV.map((n) => n.group))];
  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {groups.map((g) => {
        const items = NAV.filter((n) => n.group === g && NAV_ACCESS[n.key].includes(user.role));
        if (!items.length) return null;
        return (
          <div key={g}>
            <p className="label-xs px-2 pb-1.5">{g}</p>
            <div className="space-y-0.5">
              {items.map((n) => {
                const active = view === n.key;
                return (
                  <button
                    key={n.key}
                    onClick={() => { setView(n.key); onNavigate?.(); }}
                    className={`btn-press group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold transition-colors ${
                      active ? "bg-ink text-bg dark:bg-cream dark:text-sunken" : "text-mute hover:bg-raise hover:text-ink"
                    }`}
                  >
                    <span className={active ? "text-brand" : "text-mute group-hover:text-brand"}>
                      <Icon name={n.icon} size={17} />
                    </span>
                    {n.label}
                    {active && <span className="absolute right-2 h-1.5 w-1.5 rounded-full bg-brand" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  const user = useStore((s) => s.user);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-cream shadow-warm">
          <Icon name="logo" size={22} sw={1.6} />
        </span>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-extrabold tracking-tight">Ovenwright</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">Biscuit Works · Est. 1987</p>
        </div>
      </div>
      <NavList onNavigate={onNavigate} />
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-raise px-2.5 py-2">
          <Avatar name={user.name} hue={user.role === "customer" ? 300 : 30} size={32} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[12.5px] font-bold">{user.name}</p>
            <p className="truncate text-[10.5px] text-mute">{user.title}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme, user, loginAs, view, cartOpen, setCartOpen } = useStore();
  const cartCount = useStore((s) => s.cart.reduce((n, c) => n + c.qty, 0));
  const [drawer, setDrawer] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenu(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="ambient min-h-screen">
      <div className="pointer-events-none fixed inset-0 dotgrid opacity-40" />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-line bg-surface/90 backdrop-blur lg:block">
        <SidebarInner />
      </aside>
      {/* Mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-sunken/70" onClick={() => setDrawer(false)} />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="absolute inset-y-0 left-0 w-64 border-r border-line bg-surface"
            >
              <SidebarInner onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative lg:pl-60">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
            <button className="btn-press rounded-lg border border-line bg-surface p-2 lg:hidden" onClick={() => setDrawer(true)}>
              <Icon name="menu" size={17} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-[17px] font-extrabold tracking-tight">{VIEW_TITLES[view]}</h1>
              <p className="hidden text-[11px] text-mute sm:block">Ovenwright Factory OS · plant #1 · 6th of October City</p>
            </div>
            <LiveClock />
            <button
              onClick={toggleTheme}
              title="Toggle dark / light"
              className="btn-press rounded-lg border border-line bg-surface p-2 text-mute hover:text-brand"
            >
              <Icon name={theme === "light" ? "moon" : "sun"} size={17} />
            </button>
            <button
              onClick={() => setCartOpen(!cartOpen)}
              className="btn-press relative rounded-lg border border-line bg-surface p-2 text-mute hover:text-brand"
              title="Order cart"
            >
              <Icon name="cart" size={17} />
              {cartCount > 0 && (
                <motion.span
                  key={cartCount} initial={{ scale: 0.5 }} animate={{ scale: 1 }}
                  className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-cream"
                >
                  {cartCount}
                </motion.span>
              )}
            </button>
            {/* Identity / RBAC switcher */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenu(!userMenu)}
                className="btn-press flex items-center gap-2 rounded-lg border border-line bg-surface py-1.5 pl-1.5 pr-2.5"
              >
                <Avatar name={user.name} hue={user.role === "customer" ? 300 : 30} size={26} />
                <span className="hidden text-left sm:block">
                  <span className="block text-[12px] font-bold leading-tight">{ROLE_LABEL[user.role]}</span>
                  <span className="block text-[10px] leading-tight text-mute">switch identity</span>
                </span>
                <Icon name="chevron" size={14} className="text-mute" />
              </button>
              <AnimatePresence>
                {userMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-surface shadow-lift"
                  >
                    <p className="label-xs border-b border-line bg-raise px-4 py-2.5">Demo RBAC · sign in as</p>
                    {USERS.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { loginAs(u.id); setUserMenu(false); }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-raise ${u.id === user.id ? "bg-raise/70" : ""}`}
                      >
                        <Avatar name={u.name} hue={u.role === "customer" ? 300 : 30} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold">{u.name}</span>
                          <span className="block truncate text-[11px] text-mute">{u.title}</span>
                        </span>
                        <Badge tone={u.role === "super_admin" ? "ink" : u.role === "customer" ? "butter" : "amber"}>
                          {ROLE_LABEL[u.role]}
                        </Badge>
                      </button>
                    ))}
                    <p className="border-t border-line bg-raise px-4 py-2 text-[10.5px] leading-snug text-mute">
                      Each role sees a scoped navigation tree. Privileged actions are written to the immutable audit trail.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="relative z-10 px-4 py-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="relative z-10 border-t border-line px-4 py-5 text-center text-[11px] text-mute lg:px-8">
          Ovenwright Biscuit Works · Factory OS demo — payroll engine, gate terminal & B2B marketplace running on simulated plant data
        </footer>
      </div>
    </div>
  );
}
