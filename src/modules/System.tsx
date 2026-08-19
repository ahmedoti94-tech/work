import { useMemo, useState } from "react";
import { ROLE_AR, useStore } from "../lib/store";
import { Badge, Btn, Icon, SectionHead, inputCls, type BadgeTone } from "../components/ui";

const FOLDERS = `ovenwright/
├─ web/                        # Next.js (RTL-first) — المتجر + بوابة المصنع
│  ├─ app/(shop)/  app/(portal)/  app/api/   # ISR للكتالوج · SSR للوحات
│  ├─ components/ modules/                   # مكونات عربية RTL
│  ├─ lib/payroll.ts · recommend.ts · crypto.ts
│  └─ public/sw.js · manifest.webmanifest    # PWA: طابور حضور دون اتصال
├─ server/                     # Node.js + Express API
│  ├─ models/                  # Mongoose: User Employee Attendance Payroll
│  │                           #   Product Order RecommendationLog AdminAudit
│  ├─ controllers/             # attendance.controller · payroll.controller
│  │                           #   order.controller · catalog.controller
│  ├─ middleware/
│  │  ├─ rbac.js               # requireRole(...['HR','SuperAdmin'])
│  │  ├─ rateLimit.js          # عدادات Redis لكل مسار
│  │  ├─ sanitize.js           # mongo-sanitize + xss-clean
│  │  └─ audit.js              # إلحاق حدث مُسلسل التجزئة لكل عملية حساسة
│  ├─ services/hmacBadge.js    # توليد والتحقق من رموز QR الموقعة
│  ├─ jobs/payroll.cron.js     # مولد المسير الشهري (الأول من كل شهر ٠٢:٠٠)
│  └─ db.js                    # connection pooling + compound indexes
└─ infra/  docker-compose.yml  # mongo:7 + redis:7 + api + web`;

const SCHEMA = `// models/Employee.js — الموظف ورمزه السري الموقّع
const Employee = new Schema({
  code:        { type: String, unique: true },      // OW-1042
  name: String, title: String, dept: String,
  pinHash:     String,                               // bcrypt 12 rounds
  shift:       { type: String, enum: ['MORNING','EVENING','NIGHT'] },
  baseSalary:  Number,                               // ر.س شهري
  phone: String, active: { type: Boolean, default: true },
  joinDate: Date
});
Employee.index({ code: 1 });

// models/Attendance.js — بوابة الحضور (ذروة ٣٠٠ بصمة/دقيقة)
const Attendance = new Schema({
  employeeId: { type: ObjectId, ref: 'Employee', required: true },
  date:       { type: String, required: true },      // YYYY-MM-DD
  inAt: Number, outAt: Number,                       // دقائق من منتصف الليل
  status:     { type: String, enum: ['ON_TIME','LATE','OVERTIME'] },
  method:     { type: String, enum: ['QR','PIN','MANUAL'] },
  gps: String, scannedBy: ObjectId
});
// فهرس مركّب = استعلام كشف اليوم فوري مهما كبر السجل
Attendance.index({ employeeId: 1, date: -1 }, { unique: true });
Attendance.index({ date: 1, status: 1 });            // تقارير الغياب اليومية

// models/Payroll.js — المسير الشهري
const Payroll = new Schema({
  employeeId: { type: ObjectId, ref: 'Employee' },
  month: String,                                     // 2025-06
  workDays: Number, presentDays: Number,
  overtimeHours: Number, overtimePay: Number,
  lateDeduction: Number, advances: Number,
  netSalary: Number,
  status: { type: String, enum: ['DRAFT','APPROVED','PAID'], default: 'DRAFT' }
});
Payroll.index({ employeeId: 1, month: 1 }, { unique: true });

// models/Product.js — الكتالوج + الشحنات (تتبع الصلاحية)
const Product = new Schema({
  slug: { type: String, unique: true }, nameAr: String,
  family: String, moqCartons: Number, stockCartons: Number,
  packs: [{ tier: String, units: Number, price: Number }],
  nutrition: [{ label: String, value: String }]
});
Product.index({ family: 1, slug: 1 });
const Batch = new Schema({
  lot: { type: String, unique: true }, productId: ObjectId,
  producedAt: Date, expiryDays: Number, qty: Number
});
Batch.index({ productId: 1, producedAt: -1 });
Batch.index({ producedAt: 1, expiryDays: 1 });       // تنبيهات الصلاحية

// models/Order.js — الطلبات وحالة الدفع
const Order = new Schema({
  customerId: ObjectId, ref: 'OW-####',
  status: { type: String, enum: ['PENDING','BAKING','SHIPPED','DELIVERED'] },
  lines: [{ productId: ObjectId, tier: String, qty: Number,
            cartons: Number, discountRate: Number, net: Number }],
  subtotal: Number, wholesaleDiscount: Number, total: Number,
  payment: { type: String, enum: ['COD','TRANSFER','GATEWAY'] },
  timeline: [{ at: Date, event: String }]
});
Order.index({ customerId: 1, status: 1, createdAt: -1 });

// models/RecommendationLog.js — وقود محرك التوصيات
const RecommendationLog = new Schema({
  customerId: ObjectId, productId: ObjectId,
  type: { type: String, enum: ['VIEW','CART','PURCHASE'] },
  cartons: { type: Number, default: 0 }, at: Date
});
RecommendationLog.index({ customerId: 1, at: -1 });
RecommendationLog.index({ productId: 1, type: 1 });

// models/AdminAudit.js — سجل غير قابل للتعديل، مُسلسل التجزئة
const AdminAudit = new Schema({
  at: Date, actor: String, role: String, ip: String, userAgent: String,
  action: String, detail: String,
  prevHash: String, hash: String                     // HMAC سلسلة
});
AdminAudit.index({ at: -1 }); AdminAudit.index({ actor: 1, at: -1 });`;

const ROUTES = `POST /api/auth/[...nextauth]      تسجيل دخول · bcrypt + JWT في HttpOnly
GET  /api/products?family=&q=     كتالوج عام (ISR 60s) — للجميع
POST /api/orders                  إنشاء طلب · Zod + rate limit · خصم الشرائح
PATCH /api/orders/:id/status      تحديث الحالة · sales/super فقط · تدقيق + واتساب
GET  /api/attendance/today        كشف اليوم · hr/super/production
POST /api/attendance/punch        بصمة · الموظف نفسه أو مشرف · يعمل عبر مزامنة PWA
POST /api/attendance/manual       إدخال يدوي · hr/super فقط · تدقيق إلزامي
GET  /api/payroll?month=          المسير · hr/super فقط
POST /api/payroll/finalize        اعتماد المسير · super فقط · تسوية السلف
POST /api/advances                تسجيل سلفة · hr/super · تدقيق
PATCH /api/employees/:id/salary   تعديل راتب · super فقط · تدقيق مزدوج
GET  /api/inventory/alerts        حد الطلب + الصلاحية · production/super
GET  /api/audit                   السجل · super فقط · قراءة بلا تعديل`;

const EXPRESS = `// server/app.js — الترتيب الأمني قبل أي مسار
app.use(helmet({                                    // رؤوس صارمة
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], imgSrc: ["'self'", "data:", "https:"],
    scriptSrc: ["'self'"], frameAncestors: ["'none'"] } },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
app.use(mongoSanitize());                           // يسقط ‎$gt/‎$where من الأجسام
app.use(xss());                                     // يعقّم حقول النصوص
app.use(cookieParser());

// middleware/rateLimit.js — عدادات Redis مشتركة بين العُقد
const redis = new Redis(process.env.REDIS_URL);     // Connection pooling
const limiter = (key, max, windowSec) => rateLimit({
  windowMs: windowSec * 1000, max,
  store: new RedisStore({ client: redis, prefix: \`rl:\${key}:\` }),
  keyGenerator: (req) => req.ip,
});
app.use('/api/auth',        limiter('auth',     10, 60));
app.use('/api/attendance/scan', limiter('scan', 30, 60));
app.use('/api/orders',      limiter('checkout',  5, 60));

// middleware/rbac.js — Zero-Trust: الصلاحية تُفحص في كل طلب
const requireRole = (...roles) => (req, res, next) => {
  const claims = verifyAccess(req.cookies.access);  // Access قصير العمر
  if (!claims)            return res.sendStatus(401);
  if (!roles.includes(claims.role)) return res.sendStatus(403);
  req.user = claims; next();
};

// المسارات — كل واحد محمي بوسيط صلاحيات + تدقيق
router.post('/attendance/scan',  requireRole('FactoryWorker','HR','SuperAdmin'),
                                  attendanceController.scan);     // HMAC + Geo
router.post('/attendance/manual',requireRole('HR','SuperAdmin'),
                                  audit('MANUAL_PUNCH'), attendanceController.manual);
router.post('/payroll/generate', requireRole('HR','SuperAdmin'),
                                  audit('PAYROLL_DRAFT'), payrollController.generate);
router.post('/payroll/finalize', requireRole('SuperAdmin'),
                                  audit('PAYROLL_APPROVE'), payrollController.finalize);
router.patch('/employees/:id/salary', requireRole('SuperAdmin'),
                                  audit('SALARY_EDIT'), employeeController.setSalary);
router.get ('/catalog',          catalogController.list);         // Redis cache 60s
router.post('/orders',           requireRole('B2B_Merchant','Retail_Customer'),
                                  orderController.create);`;

const CONTROLLERS = `// controllers/payroll.controller.js — المولد الشهري بنقرة واحدة
exports.generate = async (req, res) => {
  const month = req.query.month;                    // 2025-06
  const workDays = workingDays(month);              // السبت–الخميس
  const emps = await Employee.find({ active: true }).lean();

  // تجميع الحضور بخط أنابيب واحد بدل استعلام لكل موظف
  const agg = await Attendance.aggregate([
    { $match: { date: { $regex: \`^\${month}\` } } },
    { $group: { _id: '$employeeId',
        present: { $sum: 1 },
        lateMin: { $sum: { $ifNull: ['$lateMinutes', 0] } },
        otMin:   { $sum: { $ifNull: ['$overtimeMinutes', 0] } } } },
  ]);
  const byEmp = new Map(agg.map(a => [String(a._id), a]));
  const advances = await Advance.find({ month, settled: false }).lean();

  const slips = emps.map(e => {
    const a = byEmp.get(String(e._id)) ?? { present: 0, lateMin: 0, otMin: 0 };
    const perDay  = e.baseSalary / workDays;
    const hourly  = perDay / 8;
    const base    = perDay * a.present;
    const otPay   = (a.otMin / 60) * hourly * 1.5;              // إضافي ×١٫٥
    const late    = (a.lateMin / 60) * hourly;
    const adv     = advances.filter(x => String(x.employeeId) === String(e._id))
                            .reduce((s, x) => s + x.amount, 0);
    return { employeeId: e._id, month, workDays,
      presentDays: a.present, overtimeHours: +(a.otMin/60).toFixed(2),
      overtimePay: r2(otPay), lateDeduction: r2(late), advances: adv,
      netSalary: r2(base + otPay - late - adv), status: 'DRAFT' };
  });
  await Payroll.bulkWrite(slips.map(s => ({
    updateOne: { filter: { employeeId: s.employeeId, month },
                 update: { $set: s }, upsert: true } })));
  res.json({ month, slips: slips.length });
};

// controllers/attendance.controller.js — المسح دون الثانية
exports.scan = async (req, res) => {
  const t0 = Date.now();
  const badge = verifyHMAC(req.body.token);         // ‏<١ م.ث
  if (!badge.ok) return res.status(401).json({ error: badge.reason });
  if (outsideFence(req.body.gps, FACTORY))          // Geo-fence 150م
    return res.status(403).json({ error: 'GEOFENCE' });

  // upsert ذروة الورديات: استعلام واحد بدل find+save
  const rec = await Attendance.findOneAndUpdate(
    { employeeId: badge.empId, date: today() },
    { $setOnInsert: { inAt: nowMin(), method: 'QR', gps: req.body.gps } },
    { upsert: true, new: true });
  await RecommendationLog; // (لا) — هنا فقط Redis publish للوحة الحية
  redis.publish('attendance:live', JSON.stringify(rec));
  res.json({ ms: Date.now() - t0, status: rec.status });
};`;

const HMAC_NODE = `// services/hmacBadge.js — توقيع رموز الحضور (Node crypto)
const { createHmac, timingSafeEqual } = require('crypto');
const KEY = Buffer.from(process.env.BADGE_HMAC_KEY, 'hex'); // خارج الكود
const TTL = 90_000;                                 // دوران كل ٩٠ ثانية

exports.issue = (employeeCode) => {
  const exp = Date.now() + TTL;
  const body = \`\${employeeCode}.\${exp}\`;
  const sig = createHmac('sha256', KEY).update(body).digest('hex');
  return \`OW1.\${body}.\${sig}\`;                   // يُرمَّز في QR البطاقة
};

exports.verify = (token) => {
  const [v, code, exp, sig] = token.split('.');
  if (v !== 'OW1' || !code || !exp || !sig)
    return { ok: false, reason: 'MALFORMED' };
  const want = createHmac('sha256', KEY)
                 .update(\`\${code}.\${exp}\`).digest();
  const got  = Buffer.from(sig, 'hex');
  // مقارنة ثابتة الزمن — تسدّ هجمات التوقيت
  if (got.length !== want.length || !timingSafeEqual(got, want))
    return { ok: false, reason: 'BAD_SIGNATURE' };  // لقطة شاشة/تزوير
  if (Date.now() > +exp)
    return { ok: false, reason: 'EXPIRED' };
  return { ok: true, empId: code };
};
// البطاقة المطبوعة تحمل QR ثابت الهوية، بينما رموز البوابة الحية تدور —
// فمشاركة صورة البطاقة لا تكفي للدخول دون الرمز اللحظي من تطبيق الموظف.`;

const RECO_ALGO = `// services/recommend.js — «مقترح خصيصًا لك» قابل للتفسير
// يُنفَّذ كخط أنابيب Aggregation على RecommendationLog + Orders
exports.forCustomer = async (customerId) => {
  const log = await RecommendationLog.find({ customerId }).lean();
  const orders = await Order.find({ customerId }).lean();

  const familyW = {};                               // ١) تفضيل العائلات
  for (const o of orders) for (const l of o.lines)
    familyW[l.family] = (familyW[l.family] ?? 0) + l.cartons;

  const viewed = {};                                // ٢) اهتمام لحظي (تصفّح)
  for (const v of log) if (v.type === 'VIEW')
    viewed[v.productId] = (viewed[v.productId] ?? 0)
      * 0.9 + 1;                                    // اضمحلال زمني

  const month = new Date().getMonth();
  return Product.aggregate([
    { $addFields: { score: { $add: [
        // مشتريات العائلة (وزن ٣٤) + نية إعادة الطلب (وزن ٢٦)
        { $multiply: [{ $ifNull: [familyW['$family'], 0] }, 34] },
        { $multiply: [{ $ifNull: [rebuy['$_id'], 0] }, 26] },
        { $multiply: [{ $ifNull: [viewed['$_id'], 0] }, 14] },
        // ٣) موسم النكهة ٤) التقييم ٥) ندرة المخزون
        { $cond: [{ $in: [month, '$seasonMonths'] }, 12, 0] },
        { $multiply: [{ $subtract: ['$rating', 3.5] }, 6] },
        { $cond: [{ $lt: ['$stockCartons', 120] }, 4, 0] },
      ] } } },
    { $sort: { score: -1 } }, { $limit: 4 },
  ]);
  // كل نتيجة تُرفَق بأسباب عربية مولّدة من الإشارات (Explainable)
};`;

const RTL_SETUP = `// app/layout.tsx — الجذر العربي RTL
export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={tajawal.className}>{children}</body>
    </html>
  );
}

// tailwind.config — دعم الاتجاهين دون كسر التصميم
// استخدم ms/me/ps/pe و start/end (خصائص منطقية) بدل ml/mr/left/right
// الأرقام: font-mono مع direction: ltr على عناصر الأرقام فقط

// next.config.js — الأداء
experimental: { optimizePackageImports: ["recharts"] }
images: { formats: ["image/avif","image/webp"] }  // صور المنتجات`;

export default function System() {
  const { audit } = useStore();
  const [tab, setTab] = useState<"audit" | "blueprint">("audit");
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const list = useMemo(
    () => audit.filter((a) => (a.actor + a.action + a.detail).includes(q)),
    [audit, q]
  );

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch { /* clipboard unavailable */ }
  };

  const toneOf = (action: string): BadgeTone =>
    action.includes("راتب") || action.includes("سلفة") ? "berry"
      : action.includes("حضور") || action.includes("مزامنة") ? "brand"
      : action.includes("طلب") || action.includes("استلام") ? "sage" : "butter";

  return (
    <div>
      <SectionHead
        title="النظام والتدقيق"
        desc="سجل الإجراءات الحساسة (IP + جهاز) + المخطط المعماري الإنتاجي: Next.js + Express + MongoDB + Redis"
        actions={
          <div className="flex gap-1.5">
            <button onClick={() => setTab("audit")} className={`btn-press rounded-full border px-4 py-1.5 text-[12.5px] font-bold ${tab === "audit" ? "border-brand bg-brand text-cream" : "border-line bg-surface text-mute"}`}>سجل التدقيق</button>
            <button onClick={() => setTab("blueprint")} className={`btn-press rounded-full border px-4 py-1.5 text-[12.5px] font-bold ${tab === "blueprint" ? "border-brand bg-brand text-cream" : "border-line bg-surface text-mute"}`}>المخطط المعماري</button>
          </div>
        }
      />

      {tab === "audit" ? (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="flex items-center gap-2 text-[13px] font-bold">
              <Icon name="shield" size={16} className="text-brand" /> سجل ملحق فقط — لا يمكن تعديله أو حذفه
            </p>
            <div className="relative">
              <Icon name="search" size={14} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-mute" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في السجل…" className={`${inputCls} w-52 py-1.5 ps-8 text-[12.5px]`} />
            </div>
          </div>
          <div className="divide-y divide-line/70">
            {list.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-raise/60">
                <span className="num w-32 shrink-0 text-[11px] font-semibold text-mute" dir="ltr">{a.at}</span>
                <Badge tone={toneOf(a.action)}>{a.action}</Badge>
                <span className="min-w-0 flex-1 text-[12.5px] font-semibold">{a.detail}</span>
                <span className="hidden items-center gap-1.5 text-[10.5px] font-bold text-mute md:flex">
                  <Icon name="shield" size={11} className="text-brand" />
                  <span dir="ltr" className="num">{a.ip ?? "—"}</span> · {a.agent ?? "خادم"}
                </span>
                <span className="text-[11px] font-bold text-mute">{a.actor} · {ROLE_AR[a.role]}</span>
              </div>
            ))}
            {list.length === 0 && <p className="p-8 text-center text-[13px] font-semibold text-mute">لا نتائج لـ «{q}»</p>}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            { key: "folders", title: "هيكل المشروع (Next.js + Express + Mongo)", desc: "بوابة المصنع · المتجر · خادم API · Redis", code: FOLDERS },
            { key: "mongo", title: "مخططات Mongoose مع الفهارس المركّبة", desc: "فهارس (employeeId,date) و(customerId,status) لاستعلامات فورية", code: SCHEMA },
            { key: "express", title: "Express + Redis: تحصين المسارات وحدود المعدل", desc: "Helmet/CSP · تعقيم · Rate-limiting · RBAC على كل مسار", code: EXPRESS },
            { key: "controllers", title: "منطق الحضور والمسير الشهري (Controllers)", desc: "Aggregation للحضور + معادلة الراتب الدقيقة + upsert الذروة", code: CONTROLLERS },
            { key: "hmac", title: "توقيع رموز QR (HMAC-SHA256)", desc: "دوران ٩٠ ثانية + مقارنة ثابتة الزمن ضد التزوير والتوقيت", code: HMAC_NODE },
            { key: "reco", title: "خوارزمية محرك التوصيات", desc: "عائلات · إعادة طلب · تصفّح · موسم · تقييم — مع أسباب مفسَّرة", code: RECO_ALGO },
            { key: "rtl", title: "إعداد RTL والخطوط العربية (Next.js + Tailwind)", desc: "الجذر lang=ar dir=rtl + خصائص اتجاه منطقية", code: RTL_SETUP },
          ].map((s) => (
            <div key={s.key} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div>
                  <h3 className="font-display text-[14.5px] font-bold">{s.title}</h3>
                  <p className="text-[11px] font-semibold text-mute">{s.desc}</p>
                </div>
                <Btn size="sm" variant="outline" onClick={() => copy(s.key, s.code)}>
                  <Icon name={copied === s.key ? "check" : "sheet"} size={14} /> {copied === s.key ? "نُسخ" : "نسخ"}
                </Btn>
              </div>
              <pre dir="ltr" className="max-h-80 overflow-auto bg-sunken/60 p-4 text-start font-mono text-[11px] leading-relaxed text-ink">
                {s.code}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
