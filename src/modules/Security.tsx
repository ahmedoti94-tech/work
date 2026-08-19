import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ROLE_AR, useStore, verifyAuditChain } from "../lib/store";
import type { RefreshRotation, Role, ThreatEvent, ThreatKind } from "../lib/types";
import { fnvHex } from "../lib/crypto";
import { Badge, Btn, Icon, SectionHead, Stat } from "../components/ui";

const ACCESS_TTL = 900; // ١٥ دقيقة — Access Token قصير العمر
const REFRESH_TTL = 7 * 86400;

const THREAT_POOL: Omit<ThreatEvent, "id" | "at">[] = [
  { kind: "nosql", ip: "185.220.101.44", detail: "محاولة حقن NoSQL في ‎/api/auth/login — {\"$gt\":\"\"}", action: "حُظر بواسطة express-mongo-sanitize" },
  { kind: "xss", ip: "45.155.205.99", detail: "حمولة <script> في حقل عنوان التوصيل", action: "عُقّمت عبر xss-clean + CSP strict" },
  { kind: "brute", ip: "103.75.190.11", detail: "٢٤ محاولة دخول فاشلة على حساب hr@ خلال ٦٠ ث", action: "حظر مؤقت ١٥ د (Redis rate-limiter)" },
  { kind: "forgery", ip: "91.240.118.72", detail: "رمز QR حضور بتوقيع HMAC غير مطابق", action: "رُفض + إنذار للمشرف" },
  { kind: "geo", ip: "23.94.12.8", detail: "محاولة بصمة من موقع يبعد ٤٫٢ كم عن البوابة", action: "رُفضت — خارج السياج الجغرافي" },
  { kind: "csrf", ip: "172.98.66.20", detail: "طلب PATCH بدون SameSite token", action: "أسقطته حماية CSRF" },
  { kind: "nosql", ip: "185.220.101.44", detail: "حقن ‎$where في استعلام المسير", action: "قائمة رفض المخططات أسقطت الطلب" },
  { kind: "brute", ip: "196.251.77.3", detail: "رشّ كلمات مرور على ‎/api/attendance/scan", action: "عدّاد Redis: 429 حتى إعادة الضبط" },
];

const KIND_AR: Record<ThreatKind, { label: string; tone: "berry" | "butter" | "brand" }> = {
  nosql: { label: "حقن NoSQL", tone: "berry" },
  xss: { label: "محاولة XSS", tone: "berry" },
  brute: { label: "قوة غاشمة", tone: "butter" },
  forgery: { label: "تزوير رمز", tone: "berry" },
  geo: { label: "خروج جغرافي", tone: "butter" },
  csrf: { label: "CSRF", tone: "brand" },
};

const ENDPOINTS: { path: string; method: string; roles: Partial<Record<Role, boolean>> }[] = [
  { path: "/api/attendance/scan", method: "POST", roles: { super: true, hr: true, production: true, customer: true } },
  { path: "/api/attendance/manual", method: "POST", roles: { super: true, hr: true } },
  { path: "/api/payroll/finalize", method: "POST", roles: { super: true } },
  { path: "/api/employees/:id/salary", method: "PATCH", roles: { super: true } },
  { path: "/api/orders", method: "POST", roles: { super: true, sales: true, customer: true } },
  { path: "/api/orders/:id/status", method: "PATCH", roles: { super: true, sales: true } },
  { path: "/api/inventory/receive", method: "POST", roles: { super: true, production: true } },
  { path: "/api/audit", method: "GET", roles: { super: true } },
  { path: "/api/admin/threats", method: "GET", roles: { super: true, hr: true } },
];

const HARDENING = [
  { name: "Helmet + CSP صارم", desc: "default-src 'self' · منع الإطارات · ترقية HTTPS", on: true },
  { name: "JWT مزدوج العمر", desc: "Access ١٥ دقيقة + Refresh يدور عند كل استخدام (rotation)", on: true },
  { name: "كوكي HttpOnly · Secure · SameSite=Strict", desc: "التوكنات لا تصل لجافاسكريبت إطلاقًا", on: true },
  { name: "تجزئة bcrypt (١٢ جولة)", desc: "لكل PIN موظف وكلمة مرور — مع ملح فريد", on: true },
  { name: "تعقيم المدخلات", desc: "express-mongo-sanitize ضد ‎$operators + xss-clean", on: true },
  { name: "حدود Redis لكل مسار", desc: "auth ‏١٠/د · scan ‏٣٠/د · checkout ‏٥/د لكل IP", on: true },
  { name: "تواقيع HMAC-SHA256 للرموز", desc: "رمز حضور يدور كل ٩٠ ث — لقطة الشاشة بلا قيمة", on: true },
  { name: "سلسلة تجزئة للتدقيق", desc: "كل حدث يحمل بصمة سابقه — التعديل يكسر السلسلة فورًا", on: true },
];

function fmtClockTtl(sec: number) {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Security() {
  const { user, audit, toast, auditLog, security } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [issuedAt, setIssuedAt] = useState(() => Date.now() - 210_000);
  const [refreshExp, setRefreshExp] = useState(() => Date.now() + REFRESH_TTL);
  const [rotations, setRotations] = useState<RefreshRotation[]>([
    { id: "rr1", at: "قبل ساعتين", ip: "10.24.18.41" },
    { id: "rr2", at: "أمس ٢١:١٤", ip: "10.24.18.41" },
  ]);
  const [threats, setThreats] = useState<ThreatEvent[]>(() =>
    THREAT_POOL.slice(0, 3).map((t, i) => ({ ...t, id: `th-${i}`, at: `قبل ${3 + i * 4} د` }))
  );
  const [buckets, setBuckets] = useState({
    auth: { used: 3, limit: 10 }, scan: { used: security.scans || 12, limit: 30 }, checkout: { used: 1, limit: 5 },
  });
  const poolIdx = useRef(3);

  // نبض حي: عدّ تنازلي + تدفق تهديدات + انجراف العدّادات
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const feed = setInterval(() => {
      const src = THREAT_POOL[poolIdx.current % THREAT_POOL.length];
      poolIdx.current++;
      setThreats((prev) => [{ ...src, id: `th-${Date.now()}`, at: "الآن" }, ...prev].slice(0, 9));
      setBuckets((b) => ({
        ...b,
        scan: { ...b.scan, used: Math.min(b.scan.limit, b.scan.used + (Math.random() > 0.5 ? 1 : 0)) },
      }));
    }, 7000);
    return () => { clearInterval(t); clearInterval(feed); };
  }, []);

  const accessLeft = Math.round((issuedAt + ACCESS_TTL * 1000 - now) / 1000);
  const accessPct = Math.max(0, Math.min(100, (accessLeft / ACCESS_TTL) * 100));
  const refreshDays = Math.max(0, Math.ceil((refreshExp - now) / 86400000));
  const accessToken = useMemo(
    () => `eyJhbGciOiJIUzI1NiJ9.${fnvHex(user.id + String(issuedAt))}…${fnvHex(String(accessLeft)).slice(0, 10)}`,
    [user.id, issuedAt, accessLeft > 0 ? Math.floor(accessLeft / 60) : 0]
  );

  const rotateRefresh = () => {
    setIssuedAt(Date.now());
    setRefreshExp(Date.now() + REFRESH_TTL);
    setRotations((r) => [{ id: `rr-${Date.now()}`, at: "الآن", ip: "10.24.18.41" }, ...r].slice(0, 5));
    auditLog(user.name, user.role, "تدوير توكن الجلسة", "إبطال Refresh القديم وإصدار زوج جديد (rotation)");
    toast("تم تدوير التوكنات — الرمز القديم أصبح باطلًا فورًا", "sage");
  };

  const simulateAttack = () => {
    const src = THREAT_POOL[poolIdx.current % THREAT_POOL.length];
    poolIdx.current++;
    setThreats((prev) => [{ ...src, id: `th-${Date.now()}`, at: "الآن" }, ...prev].slice(0, 9));
    auditLog("جدار الحماية", user.role, "صد هجوم", `${KIND_AR[src.kind].label} من ${src.ip}`);
    toast(`صُدَّت ${KIND_AR[src.kind].label} من ${src.ip} وسُجّلت في التدقيق`, "berry");
  };

  const chain = useMemo(() => verifyAuditChain(audit), [audit]);
  const recentAudit = audit.slice(0, 7);

  return (
    <div>
      <SectionHead
        title="مركز الأمان والحماية"
        desc="جلسات JWT قصيرة العمر · حدود Redis · سجل تهديدات حي · تدقيق مُسلسل التجزئة"
        actions={
          <>
            <Btn variant="danger" onClick={simulateAttack}><Icon name="alert" size={15} /> حقن هجوم تجريبي</Btn>
            <Btn onClick={rotateRefresh}><Icon name="logout" size={15} /> تدوير التوكن الآن</Btn>
          </>
        }
      />

      {/* مؤشرات */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="مسوحات اليوم" value={security.scans + 47} sub={`مرفوضة: ${security.blocked + 3}`} icon="scan" />
        <Stat label="هجمات مصدودة (٢٤ س)" value={threats.length + 18} sub="آخرها قبل دقائق" icon="shield" tone="berry" />
        <Stat label="نزاهة سلسلة التدقيق" value={chain.ok ? "سليمة" : "مكسورة"} sub={`${audit.length} حدث مُسلسل`} icon="check" tone={chain.ok ? "sage" : "berry"} />
        <Stat label="جلسات نشطة" value={4} sub="٣ أجهزة + بوابة المصنع" icon="users" tone="butter" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* دورة حياة التوكن */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[15px] font-bold">دورة حياة الجلسة</h3>
            <Badge tone={accessLeft <= 0 ? "berry" : "sage"}>
              <span className="tick-dot h-1.5 w-1.5 rounded-full bg-current" />
              {accessLeft <= 0 ? "انتهى Access" : "نشطة"}
            </Badge>
          </div>

          <div className="mt-4 rounded-xl border border-line bg-sunken/50 p-3">
            <p className="label-xs text-[9.5px]">Access Token — عمر ١٥ دقيقة</p>
            <p dir="ltr" className="num mt-1 truncate text-start text-[11px] font-semibold text-mute">{accessToken}</p>
            <div className="mt-2.5 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
                <motion.div
                  className={`h-full rounded-full ${accessLeft <= 0 ? "bg-berry" : accessPct < 25 ? "bg-butter" : "bg-sage"}`}
                  animate={{ width: `${accessPct}%` }} transition={{ duration: 0.6 }}
                />
              </div>
              <span className={`num text-[13px] font-bold ${accessLeft <= 0 ? "text-berry" : accessPct < 25 ? "text-butter" : "text-sage"}`}>
                {fmtClockTtl(accessLeft)}
              </span>
            </div>
            {accessLeft <= 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-berry">
                <Icon name="alert" size={13} /> انتهت الصلاحية — اطلب زوجًا جديدًا عبر Refresh (HttpOnly)
              </p>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-raise px-3 py-2.5">
            <div>
              <p className="text-[12.5px] font-bold">Refresh Token</p>
              <p className="text-[10.5px] font-semibold text-mute">HttpOnly · Secure · SameSite=Strict · يدور عند كل استخدام</p>
            </div>
            <Badge tone="brand">باقي {refreshDays} أيام</Badge>
          </div>

          <p className="label-xs mt-4 mb-1.5">سجل التدوير (آخر ٥)</p>
          <div className="space-y-1">
            {rotations.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-raise/70 px-2.5 py-1.5 text-[11.5px] font-semibold">
                <span className="flex items-center gap-1.5 text-mute"><Icon name="logout" size={12} /> {r.at}</span>
                <span className="num text-mute" dir="ltr">{r.ip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* حدود المعدل */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[15px] font-bold">حدود المعدل (Redis)</h3>
            <Badge tone="mute">نافذة ٦٠ ثانية</Badge>
          </div>
          <div className="mt-4 space-y-4">
            {[
              { key: "auth", label: "تسجيل الدخول", desc: "‎/api/auth/* — لكل IP" },
              { key: "scan", label: "مسح رموز الحضور", desc: "‎/api/attendance/scan — لكل بوابة" },
              { key: "checkout", label: "إتمام الطلبات", desc: "‎/api/orders — لكل عميل" },
            ].map(({ key, label, desc }) => {
              const b = buckets[key as keyof typeof buckets];
              const pct = Math.min(100, (b.used / b.limit) * 100);
              const hot = pct >= 80;
              return (
                <div key={key}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <p className="text-[13px] font-bold">{label}</p>
                    <span className={`num text-[12px] font-bold ${hot ? "text-berry" : "text-mute"}`}>{b.used}/{b.limit}</span>
                  </div>
                  <p className="mb-1.5 text-[10.5px] font-semibold text-mute" dir="ltr">{desc}</p>
                  <div className="h-2.5 overflow-hidden rounded-full bg-sunken">
                    <motion.div
                      className={`h-full rounded-full ${hot ? "bg-berry" : pct >= 50 ? "bg-butter" : "bg-brand"}`}
                      animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }}
                    />
                  </div>
                  {hot && <p className="mt-1 text-[10.5px] font-bold text-berry">اقترب الحد — ستُرفَض الطلبات الزائدة برمز 429</p>}
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border border-line bg-raise/70 p-3 text-[11px] font-semibold leading-relaxed text-mute">
            العدّادات مشتركة بين كل العُقد عبر Redis — ذروة تبديل الورديات (٦:٠٠ و١٤:٠٠) تُعالَج من الطابور دون أي تأخير ملحوظ.
          </div>
        </div>

        {/* تدفق التهديدات */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h3 className="font-display text-[15px] font-bold">سجل التهديدات المصدودة</h3>
            <Badge tone="berry"><span className="tick-dot h-1.5 w-1.5 rounded-full bg-berry" /> مباشر</Badge>
          </div>
          <div className="max-h-[380px] divide-y divide-line/70 overflow-auto">
            {threats.map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }} className={`flex gap-3 px-5 py-3 ${i === 0 ? "bg-berry/5" : ""}`}>
                <Badge tone={KIND_AR[t.kind].tone} className="h-fit shrink-0">{KIND_AR[t.kind].label}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold">{t.detail}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] font-semibold text-mute">
                    <span dir="ltr" className="num">{t.ip}</span> · {t.at} · <span className="text-sage">{t.action}</span>
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* مصفوفة RBAC */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h3 className="font-display text-[15px] font-bold">مصفوفة الصلاحيات — Zero-Trust RBAC</h3>
            <Badge tone="mute">وسيط حماية على كل مسار</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-[10.5px] font-bold text-mute">
                  <th className="px-5 py-2.5 text-start">المسار</th>
                  {(["super", "hr", "production", "sales", "customer"] as Role[]).map((r) => (
                    <th key={r} className="px-2 py-2.5 text-center">{ROLE_AR[r]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((e) => (
                  <tr key={e.path + e.method} className="border-b border-line/60 last:border-0 hover:bg-raise/60">
                    <td className="px-5 py-2">
                      <span className="num me-2 rounded bg-raise px-1.5 py-0.5 text-[10px] font-bold text-brand" dir="ltr">{e.method}</span>
                      <span className="num text-[11.5px] font-semibold" dir="ltr">{e.path}</span>
                    </td>
                    {(["super", "hr", "production", "sales", "customer"] as Role[]).map((r) => (
                      <td key={r} className="px-2 py-2 text-center">
                        {e.roles[r]
                          ? <Icon name="check" size={15} className="inline text-sage" />
                          : <Icon name="x" size={13} className="inline text-line-strong" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* التدقيق المسلسل */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h3 className="font-display text-[15px] font-bold">التدقيق مُسلسل التجزئة</h3>
            <Badge tone={chain.ok ? "sage" : "berry"}>{chain.ok ? "السلسلة سليمة" : "انكسار!"}</Badge>
          </div>
          <div className="divide-y divide-line/70">
            {recentAudit.map((a) => (
              <div key={a.id} className="px-5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-bold">{a.action}</p>
                  <span className="num text-[10px] text-mute" dir="ltr">{a.ip}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-mute">{a.detail}</p>
                <p className="num mt-1 flex items-center gap-1.5 text-[9.5px] text-mute" dir="ltr">
                  <Icon name="shield" size={10} className="text-brand" />
                  {a.prevHash.slice(0, 8)} ← {a.hash.slice(0, 8)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* قائمة التحصين */}
      <div className="card mt-4 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-[15px] font-bold">قائمة التحصين الإنتاجية</h3>
          <Badge tone="sage">{HARDENING.filter((h) => h.on).length}/{HARDENING.length} مفعّلة</Badge>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {HARDENING.map((h, i) => (
            <motion.div key={h.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-line bg-raise/70 p-3.5">
              <p className="flex items-start justify-between gap-2 text-[13px] font-bold">
                {h.name}
                {h.on ? <Icon name="check" size={16} className="shrink-0 text-sage" /> : <Icon name="alert" size={16} className="shrink-0 text-butter" />}
              </p>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-mute">{h.desc}</p>
            </motion.div>
          ))}
        </div>
        <p className="mt-3.5 text-[11px] font-semibold text-mute">
          المخططات الكاملة (Mongoose + وسطاء Express + إعداد Redis) موثقة في صفحة «النظام والتدقيق → المخطط المعماري».
        </p>
      </div>
    </div>
  );
}
