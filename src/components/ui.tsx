import { AnimatePresence, motion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect } from "react";
import { useStore } from "../lib/store";

// ─── Hand-drawn icon set (stroke-based, 24px grid) ─────────────────────────
export type IconName =
  | "logo" | "dashboard" | "clock" | "wallet" | "leave" | "store" | "cart"
  | "package" | "boxes" | "shield" | "blueprint" | "sun" | "moon" | "chevron"
  | "plus" | "minus" | "x" | "check" | "alert" | "printer" | "search" | "qr"
  | "truck" | "flame" | "wheat" | "arrow" | "user" | "menu" | "copy" | "users"
  | "stamp" | "doc" | "scale" | "filter";

const PATHS: Record<IconName, ReactNode> = {
  logo: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="9.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12.6" cy="14.4" r="0.9" fill="currentColor" stroke="none" />
      <path d="M18.5 5.5a8.2 8.2 0 0 1 0 13" strokeDasharray="1.5 2.4" />
    </>
  ),
  dashboard: <><rect x="3.5" y="3.5" width="7" height="9" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="5.5" rx="1.5" /><rect x="13.5" y="12.5" width="7" height="8" rx="1.5" /><rect x="3.5" y="16" width="7" height="4.5" rx="1.5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" /><path d="M15 12h5v3h-5a1.5 1.5 0 0 1 0-3Z" /><path d="M4 9h16" /></>,
  leave: <><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 9.5h16M8.5 3.5v4M15.5 3.5v4" /><path d="M9 14l2 2 4-4" /></>,
  store: <><path d="M4 10v9.5h16V10" /><path d="M3 6l1.5-2.5h15L21 6a2.6 2.6 0 0 1-5.2.4A2.6 2.6 0 0 1 12 6.5 2.6 2.6 0 0 1 8.2 6.4 2.6 2.6 0 0 1 3 6Z" /><path d="M9.5 19.5v-5h5v5" /></>,
  cart: <><path d="M3.5 5h2l2.2 10.5a1.6 1.6 0 0 0 1.6 1.3h7.6a1.6 1.6 0 0 0 1.6-1.2L20.5 8H6.3" /><circle cx="10" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></>,
  package: <><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" /><path d="M4 7l8 4 8-4M12 11v10M8 5l8 4" /></>,
  boxes: <><rect x="3.5" y="12.5" width="8" height="8" rx="1" /><rect x="12.5" y="12.5" width="8" height="8" rx="1" /><rect x="8" y="3.5" width="8" height="8" rx="1" /></>,
  shield: <><path d="M12 3 5 5.8v5.4c0 4.5 3 7.7 7 9.8 4-2.1 7-5.3 7-9.8V5.8L12 3Z" /><path d="M9.2 12l2 2 3.6-3.8" /></>,
  blueprint: <><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M3.5 9h5.5V3.5M15 20.5v-6h5.5M9 15h6M9 9.01v.01" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4" /></>,
  moon: <path d="M20 13.5A8.5 8.5 0 0 1 10.5 4a8.5 8.5 0 1 0 9.5 9.5Z" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  alert: <><path d="M12 4 2.8 19.5h18.4L12 4Z" /><path d="M12 10v4.2M12 16.8v.01" /></>,
  printer: <><path d="M7 8V3.5h10V8" /><path d="M5 8h14a2 2 0 0 1 2 2v6h-4v4.5H7V16H3v-6a2 2 0 0 1 2-2Z" /><path d="M7 13h10" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6" /><path d="M15.5 15.5 20.5 20.5" /></>,
  qr: <><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><path d="M13.5 13.5h3v3h-3zM17.5 17.5h3v3h-3zM20.5 13.5v.01M13.5 20.5h.01" /></>,
  truck: <><path d="M2.5 6h12v10h-12zM14.5 10h4l2.5 3.5V16h-6.5" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  flame: <path d="M12 3s1 2.4 1 4.2c2.4 1 4.5 3.4 4.5 6.3A5.9 5.9 0 0 1 12 19.5a5.9 5.9 0 0 1-5.5-6c0-2.6 1.6-4.6 3-6C10.7 6.2 12 3 12 3Zm0 16.5c-2 0-3.2-1.4-3.2-3 0-1.5 1.2-2.6 3.2-4 2 1.4 3.2 2.5 3.2 4 0 1.6-1.2 3-3.2 3Z" />,
  wheat: <><path d="M12 21V8" /><path d="M12 8c-2.5 0-4-1.8-4-4.5C10.5 3.5 12 5.3 12 8Zm0 0c2.5 0 4-1.8 4-4.5C13.5 3.5 12 5.3 12 8Zm0 5c-2.5 0-4-1.8-4-4.5C10.5 8.5 12 10.3 12 13Zm0 0c2.5 0 4-1.8 4-4.5C13.5 8.5 12 10.3 12 13Zm0 5c-2.5 0-4-1.8-4-4.5C10.5 13.5 12 15.3 12 18Zm0 0c2.5 0 4-1.8 4-4.5C13.5 13.5 12 15.3 12 18Z" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  user: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  users: <><circle cx="9" cy="9" r="3.4" /><path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0" /><path d="M15.5 5.9a3.4 3.4 0 0 1 0 6.2M17.8 13.9a6.2 6.2 0 0 1 3.4 5.6" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  copy: <><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" /></>,
  stamp: <><path d="M9.5 10.5 9 4.8A2.3 2.3 0 0 1 12 3a2.3 2.3 0 0 1 3 1.8l-.5 5.7" /><path d="M5 14.5a2.5 2.5 0 0 1 2.5-2.5h9a2.5 2.5 0 0 1 2.5 2.5v2.5H5v-2.5Z" /><path d="M4 20.5h16" /></>,
  doc: <><path d="M6 3.5h8L19 8.5v12H6v-17Z" /><path d="M13.5 3.5v5.5H19M9 13h7M9 16.5h7" /></>,
  scale: <><path d="M12 4v16M7 20h10" /><path d="M12 6 5.5 8M12 6l6.5 2" /><path d="M3 13.5 5.5 8 8 13.5a2.6 2.6 0 0 1-5 0ZM16 13.5 18.5 8 21 13.5a2.6 2.6 0 0 1-5 0Z" /></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
};

export function Icon({ name, size = 18, className = "", sw = 1.7 }: {
  name: IconName; size?: number; className?: string; sw?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

// ─── Buttons & badges ───────────────────────────────────────────────────────
const BTN_VARIANTS = {
  primary: "bg-brand text-cream dark:text-sunken border border-brand hover:bg-branddeep dark:hover:bg-branddeep shadow-warm",
  outline: "bg-surface text-ink border border-linestrong hover:bg-raise",
  ghost: "bg-transparent text-mute border border-transparent hover:bg-raise hover:text-ink",
  sage: "bg-sage text-cream border border-sage hover:opacity-90",
  berry: "bg-berry text-cream border border-berry hover:opacity-90",
  dark: "bg-ink text-bg border border-ink hover:opacity-90",
} as const;

export function Btn({ variant = "primary", size = "md", className = "", children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN_VARIANTS; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-[13px]", lg: "px-5 py-2.5 text-sm" };
  return (
    <button
      className={`btn-press inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold tracking-wide disabled:opacity-40 disabled:pointer-events-none ${BTN_VARIANTS[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

const BADGE_TONES = {
  amber: "bg-brand/12 text-brand border-brand/30",
  sage: "bg-sage/12 text-sage border-sage/30",
  berry: "bg-berry/12 text-berry border-berry/30",
  butter: "bg-butter/15 text-[#8a6410] dark:text-butter border-butter/40",
  mute: "bg-raise text-mute border-line",
  ink: "bg-ink text-bg border-ink",
} as const;

export function Badge({ tone = "mute", className = "", children }: {
  tone?: keyof typeof BADGE_TONES; className?: string; children: ReactNode;
}) {
  return <span className={`chip text-[10.5px] ${BADGE_TONES[tone]} ${className}`}>{children}</span>;
}

export function Card({ className = "", children, hover = false }: {
  className?: string; children: ReactNode; hover?: boolean;
}) {
  return (
    <div className={`card ${hover ? "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift hover:border-linestrong" : ""} ${className}`}>
      {children}
    </div>
  );
}

// ─── Form controls ──────────────────────────────────────────────────────────
export const inputCls =
  "w-full rounded-lg border border-linestrong bg-surface px-3 py-2 text-sm text-ink placeholder:text-mute/70 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label-xs mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-mute">{hint}</span>}
    </label>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, wide = false, footer }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-sunken/70 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={`relative w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-line bg-surface shadow-lift`}
          >
            {title != null && (
              <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-3.5 backdrop-blur">
                <h3 className="font-display text-lg font-bold">{title}</h3>
                <button onClick={onClose} className="btn-press rounded-lg p-1.5 text-mute hover:bg-raise hover:text-ink">
                  <Icon name="x" size={18} />
                </button>
              </div>
            )}
            <div className="p-5">{children}</div>
            {footer && <div className="no-print sticky bottom-0 border-t border-line bg-surface/95 px-5 py-3.5 backdrop-blur">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Avatar ─────────────────────────────────────────────────────────────────
export function Avatar({ name, hue, size = 36 }: { name: string; hue: number; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-display font-bold"
      style={{
        width: size, height: size, fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 45% 82%), hsl(${hue} 40% 68%))`,
        color: `hsl(${hue} 50% 22%)`,
        boxShadow: "inset 0 -2px 4px rgb(0 0 0 / 0.12)",
      }}
    >
      {initials}
    </div>
  );
}

// ─── Stat ───────────────────────────────────────────────────────────────────
export function Stat({ label, value, sub, tone = "default", icon }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: "default" | "sage" | "berry" | "amber"; icon?: IconName;
}) {
  const tones = {
    default: "text-ink", sage: "text-sage", berry: "text-berry", amber: "text-brand",
  };
  return (
    <Card className="relative overflow-hidden p-4">
      <div className="hatch absolute inset-x-0 top-0 h-1" />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="label-xs">{label}</p>
          <p className={`num mt-1.5 font-display text-[26px] font-bold leading-none ${tones[tone]}`}>{value}</p>
          {sub && <p className="mt-1.5 text-[11.5px] text-mute">{sub}</p>}
        </div>
        {icon && (
          <span className="rounded-lg border border-line bg-raise p-2 text-brand">
            <Icon name={icon} size={17} />
          </span>
        )}
      </div>
    </Card>
  );
}

// ─── Order stage stepper ────────────────────────────────────────────────────
export function StageSteps({ status, timeline, compact = false }: {
  status: number; timeline: { stage: number; at: string }[]; compact?: boolean;
}) {
  const stages = ["Pending", "Baking & Pack", "Shipped", "Delivered"];
  const icons: IconName[] = ["clock", "flame", "truck", "check"];
  return (
    <div className="flex items-center">
      {stages.map((s, i) => {
        const done = i < status;
        const active = i === status;
        const at = timeline.find((t) => t.stage === i)?.at;
        return (
          <div key={s} className={`flex items-center ${i < stages.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center gap-1">
              <span className={`flex items-center justify-center rounded-full border-2 transition-all duration-500 ${
                done ? "border-sage bg-sage text-cream"
                : active ? "border-brand bg-brand text-cream shadow-[0_0_0_5px] color-mix(in srgb, var(--t-brand) 15%, transparent)"
                : "border-line bg-raise text-mute"}`}
                style={{ width: compact ? 26 : 32, height: compact ? 26 : 32 }}>
                <Icon name={icons[i]} size={compact ? 12 : 15} />
              </span>
              {!compact && (
                <span className={`text-center text-[10px] font-semibold leading-tight ${active ? "text-brand" : done ? "text-sage" : "text-mute"}`}>
                  {s}
                  {at && <span className="num block text-[9px] font-normal opacity-75">
                    {new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>}
                </span>
              )}
            </div>
            {i < stages.length - 1 && (
              <div className="relative mx-1 mb-4 h-[3px] flex-1 overflow-hidden rounded-full bg-line">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-sage"
                  initial={{ width: 0 }}
                  animate={{ width: i < status ? "100%" : "0%" }}
                  transition={{ duration: 0.6, delay: i * 0.12 }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Animated counter ───────────────────────────────────────────────────────
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      key={format(value)}
    >
      {format(value)}
    </motion.span>
  );
}

// ─── Toast host ─────────────────────────────────────────────────────────────
export function ToastHost() {
  const toast = useStore((s) => s.toast);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2"
        >
          <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-lift ${
            toast.tone === "warn" ? "border-berry/40 bg-berry text-cream" : "border-ink bg-ink text-bg"
          }`}>
            <Icon name={toast.tone === "warn" ? "alert" : "check"} size={16} />
            {toast.msg}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Section heading ────────────────────────────────────────────────────────
export function SectionHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-[12.5px] text-mute">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
