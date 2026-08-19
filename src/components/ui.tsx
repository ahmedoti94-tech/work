import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import { useStore } from "../lib/store";

// ─── أيقونات SVG مخصصة ──────────────────────────────────────────────────────
const PATHS = {
  dashboard: (<>
    <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
    <rect x="13.5" y="12" width="7.5" height="9" rx="1.5" />
    <rect x="3" y="15.5" width="7.5" height="5.5" rx="1.5" />
  </>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 1.8" /></>),
  payroll: (<>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <circle cx="12" cy="12.5" r="2.6" />
    <path d="M6.5 9.5h.01M17.5 15.5h.01" />
  </>),
  leave: (<>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
    <path d="m9.5 15.5 2 2 3.5-4" />
  </>),
  shop: (<>
    <path d="M4 7.5 5.5 4h13L20 7.5" />
    <path d="M4 7.5h16v3a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-6 0 2.5 2.5 0 0 1-5 0v-3Z" />
    <path d="M5.5 13v7h13v-7" />
    <path d="M9.5 20v-4h5v4" />
  </>),
  truck: (<>
    <path d="M2.5 6h11v10h-11z" />
    <path d="M13.5 9.5h4l3 3.5v3h-7" />
    <circle cx="6.5" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </>),
  boxes: (<>
    <path d="m12 3 8 3.5-8 3.5-8-3.5L12 3Z" />
    <path d="M4 6.5V14l8 3.5 8-3.5V6.5" />
    <path d="M12 10v7.5" />
  </>),
  shield: (<>
    <path d="M12 3 5 5.5v5.2c0 4.6 3 7.7 7 9.8 4-2.1 7-5.2 7-9.8V5.5L12 3Z" />
    <path d="m9 11.5 2.2 2.2L15.5 9" />
  </>),
  qr: (<>
    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" />
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="1" />
    <rect x="3.5" y="14" width="6.5" height="6.5" rx="1" />
    <path d="M14 14h3v3h-3zM20.5 14v3M17 20.5h3.5M14 20.5h.01" />
  </>),
  oven: (<>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M4 9h16" />
    <path d="M7 6.5h.01M10 6.5h.01" />
    <rect x="7" y="12" width="10" height="5" rx="1" />
  </>),
  chart: (<><path d="M4 20V4" /><path d="M4 20h16" /><path d="m7 14 3.5-4 3 2.5L17.5 7" /></>),
  alert: (<><path d="M12 4 2.8 19.5h18.4L12 4Z" /><path d="M12 10v4M12 16.8h.01" /></>),
  check: (<path d="m5 12.5 4.5 4.5L19 7.5" />),
  x: (<path d="m6 6 12 12M18 6 6 18" />),
  plus: (<path d="M12 5v14M5 12h14" />),
  minus: (<path d="M5 12h14" />),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  moon: (<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />),
  cart: (<><circle cx="9" cy="19.5" r="1.4" /><circle cx="17" cy="19.5" r="1.4" /><path d="M3 4h2.2l2.2 11h10.4l2.2-8H6" /></>),
  user: (<><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" /></>),
  chevron: (<path d="m9 6 6 6-6 6" />),
  search: (<><circle cx="10.5" cy="10.5" r="6" /><path d="m15.5 15.5 4.5 4.5" /></>),
  pin: (<><path d="M12 21s-6.5-5.4-6.5-10a6.5 6.5 0 0 1 13 0c0 4.6-6.5 10-6.5 10Z" /><circle cx="12" cy="10.8" r="2.3" /></>),
  phone: (<path d="M5.5 4h3.6l1.4 4-2.1 1.6a12.5 12.5 0 0 0 6 6L16 13.5l4 1.4v3.6c0 .8-.7 1.5-1.5 1.5C10.6 19.6 4.4 13.4 4 5.5 4 4.7 4.7 4 5.5 4Z" />),
  edit: (<><path d="M4 20h4l11-11-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>),
  stamp: (<>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="5" strokeDasharray="2.4 2.4" />
    <path d="m9.8 12.3 1.6 1.6 3-3.4" />
  </>),
  calendar: (<><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>),
  users: (<>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M2.8 19.5c1-3.2 3.3-4.8 6.2-4.8s5.2 1.6 6.2 4.8" />
    <circle cx="16.5" cy="9.5" r="2.4" />
    <path d="M16.9 14.6c2.2.3 3.8 1.7 4.5 4.2" />
  </>),
  wheat: (<>
    <path d="M12 21V8" />
    <path d="M12 8c-3 0-4.5-1.8-4.5-4.5C10.5 3.5 12 5.3 12 8ZM12 8c3 0 4.5-1.8 4.5-4.5C13.5 3.5 12 5.3 12 8Z" />
    <path d="M12 13c-3 0-4.5-1.8-4.5-4.5C10.5 8.5 12 10.3 12 13ZM12 13c3 0 4.5-1.8 4.5-4.5C13.5 8.5 12 10.3 12 13Z" />
  </>),
  flame: (<path d="M12 3c1 3-3.5 4.6-3.5 8.5a3.5 3.5 0 0 0 7 0c0-1.5-.6-2.6-1.2-3.6 2.4 1 4.2 3.2 4.2 6.1A6.5 6.5 0 0 1 5.5 14C5.5 8.5 12 7.5 12 3Z" />),
  logout: (<><path d="M9 4H5.5v16H9" /><path d="M15 8.5 19.5 12 15 15.5M19 12H9.5" /></>),
  whatsapp: (<>
    <path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5Z" />
    <path d="M9 8.8c-.4 2.2 3.8 6.7 6.4 6.4l.7-1.6-2.2-1-.9.8c-1-.6-1.8-1.5-2.2-2.5l.9-.8-1.1-2.2L9 8.8Z" />
  </>),
  download: (<><path d="M12 4v10M8 10.5l4 4 4-4" /><path d="M4.5 17.5v2h15v-2" /></>),
  printer: (<><path d="M7 8V4h10v4" /><rect x="4" y="8" width="16" height="8" rx="1.5" /><path d="M7 13.5h10V20H7z" /></>),
  wifiOff: (<><path d="m4 4 16 16" /><path d="M6.5 9.5A13 13 0 0 1 10 7.8M14.5 8c2 .6 3.6 1.7 5 3M9 13a8 8 0 0 1 3-1.5M15.5 13.6c.6.4 1.2.8 1.7 1.4M12 17.5h.01" /></>),
  sheet: (<><rect x="4" y="3.5" width="16" height="17" rx="1.5" /><path d="M4 9h16M4 14.5h16M10 3.5v17" /></>),
  kiosk: (<><rect x="5" y="3.5" width="14" height="12" rx="1.5" /><path d="M12 15.5v3M8 20.5h8" /><circle cx="12" cy="9.5" r="2.6" /></>),
  spark: (<><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9L4.5 10.8 10.2 9 12 3.5Z" /><path d="M18.5 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" /></>),
  idcard: (<><rect x="3" y="5" width="18" height="14.5" rx="2" /><circle cx="8.3" cy="11" r="2" /><path d="M5.5 16.5c.5-1.7 1.5-2.6 2.8-2.6s2.3.9 2.8 2.6" /><path d="M14 9.5h4.5M14 12.5h4.5M14 15.5h2.5" /></>),
  scan: (<><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M4 12h16" /></>),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className = "", strokeWidth = 1.7 }:
  { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 ${className}`} aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

// ─── الأزرار ────────────────────────────────────────────────────────────────
const BTN_VARIANTS = {
  primary: "bg-brand text-cream border border-brand hover:brightness-110 shadow-warm",
  outline: "border border-linestrong bg-surface text-ink hover:bg-raise",
  ghost: "text-mute hover:text-ink hover:bg-raise",
  danger: "bg-berry text-cream border border-berry hover:brightness-110",
  sage: "bg-sage text-cream border border-sage hover:brightness-110",
  butter: "bg-butter text-sunken border border-butter hover:brightness-105",
  whatsapp: "bg-[#1f9d55] text-cream border border-[#1f9d55] hover:brightness-110",
} as const;

export function Btn({ variant = "primary", size = "md", className = "", children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN_VARIANTS; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "px-3 py-1.5 text-[12.5px] rounded-lg", md: "px-4 py-2 text-[13.5px] rounded-lg", lg: "px-5 py-2.5 text-[15px] rounded-xl" };
  return (
    <button
      className={`btn-press inline-flex items-center justify-center gap-2 font-bold disabled:opacity-40 disabled:pointer-events-none ${BTN_VARIANTS[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ─── شارات الحالة الملونة ───────────────────────────────────────────────────
const BADGE_TONES = {
  sage: "bg-sage/12 text-sage border-sage/30",
  butter: "bg-butter/14 text-butter border-butter/35",
  berry: "bg-berry/10 text-berry border-berry/30",
  brand: "bg-brand/10 text-brand border-brand/30",
  cocoa: "bg-cocoa/10 text-cocoa border-cocoa/25",
  mute: "bg-raise text-mute border-line",
} as const;
export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({ tone = "mute", children, className = "" }:
  { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={`chip text-[11px] font-bold ${BADGE_TONES[tone]} ${className}`}>{children}</span>;
}

// ─── الصورة الرمزية ─────────────────────────────────────────────────────────
const AV_COLORS = ["bg-brand/15 text-brand", "bg-sage/15 text-sage", "bg-berry/12 text-berry", "bg-butter/18 text-butter", "bg-cocoa/12 text-cocoa"];
export function Avatar({ name, size = 38, className = "" }: { name: string; size?: number; className?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
  const idx = name.length % AV_COLORS.length;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold ${AV_COLORS[idx]} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials}
    </span>
  );
}

// ─── بطاقة مؤشر ─────────────────────────────────────────────────────────────
export function Stat({ label, value, sub, icon, tone = "brand" }: {
  label: string; value: ReactNode; sub?: ReactNode; icon: IconName; tone?: BadgeTone;
}) {
  return (
    <div className="card flex items-start gap-3.5 p-4">
      <span className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border ${BADGE_TONES[tone]}`}>
        <Icon name={icon} size={19} />
      </span>
      <div className="min-w-0">
        <p className="label-xs">{label}</p>
        <p className="num mt-0.5 truncate font-display text-[22px] font-bold leading-tight">{value}</p>
        {sub && <p className="mt-0.5 text-[11.5px] font-semibold text-mute">{sub}</p>}
      </div>
    </div>
  );
}

// ─── ترويسة قسم ─────────────────────────────────────────────────────────────
export function SectionHead({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
        {desc && <p className="mt-0.5 text-[12.5px] text-mute">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ─── النافذة المنبثقة ───────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-sunken/70 backdrop-blur-[3px]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-lift sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-3.5 backdrop-blur">
          <h3 className="font-display text-[16px] font-bold">{title}</h3>
          <button onClick={onClose} className="btn-press rounded-lg p-1.5 text-mute hover:bg-raise hover:text-ink" aria-label="إغلاق">
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </div>
  );
}

// ─── حقول الإدخال ───────────────────────────────────────────────────────────
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label-xs mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-mute">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-linestrong bg-surface px-3 py-2 text-[13.5px] font-semibold outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:font-normal placeholder:text-mute/70";

// ─── هيكل تحميل (Skeleton) ───────────────────────────────────────────────────
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded-lg border border-line bg-raise ${className}`} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden rounded-xl">
      <Skeleton className="aspect-square w-full rounded-none border-0" />
      <div className="space-y-2.5 p-3.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ─── التنبيهات العائمة ──────────────────────────────────────────────────────
export function ToastHost() {
  const toasts = useStore((s) => s.toasts);
  const toneCls = { sage: "border-sage/40 text-sage", brand: "border-brand/40 text-brand", berry: "border-berry/40 text-berry", butter: "border-butter/50 text-butter" };
  return (
    <div className="pointer-events-none fixed bottom-4 start-4 z-[90] flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((t) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8 }}
          className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-surface px-3.5 py-3 shadow-lift ${toneCls[t.tone]}`}
        >
          <Icon name={t.tone === "berry" ? "alert" : t.tone === "butter" ? "clock" : "check"} size={16} className="mt-0.5" />
          <p className="text-[12.5px] font-bold leading-snug text-ink">{t.msg}</p>
        </motion.div>
      ))}
    </div>
  );
}
