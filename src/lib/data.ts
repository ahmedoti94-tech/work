import type {
  Advance, AttendanceRecord, AuditEntry, Batch, Employee, LeaveRequest,
  Order, Product, RawMaterial, User,
} from "./types";
import { addDays, dateKey, isWorkday, monthKeyOf, prevMonthKey, todayKey } from "./payroll";
import { chainHash } from "./crypto";

// ─── الهويات (RBAC) ─────────────────────────────────────────────────────────
export const USERS: User[] = [
  { id: "u1", name: "عبدالله الراشد", role: "super", title: "المدير العام", empId: "e1" },
  { id: "u2", name: "منيرة السالم", role: "hr", title: "مديرة الموارد البشرية" },
  { id: "u3", name: "سعد الحربي", role: "production", title: "مدير الإنتاج والمخزون" },
  { id: "u4", name: "يزيد العتيبي", role: "sales", title: "مندوب مبيعات الجملة" },
  { id: "u5", name: "أحمد الغامدي", role: "customer", title: "عامل — بوابة ذاتية", empId: "e2" },
];

// ─── الموظفون — الرقم السري للتجربة: 1234 ──────────────────────────────────
export const EMPLOYEES: Employee[] = [
  { id: "e1", name: "عبدالله الراشد", title: "المدير العام", dept: "الإدارة", shift: "morning", baseSalary: 12000, joinDate: "2019-03-01", active: true, pin: "1234", phone: "966501111111" },
  { id: "e2", name: "أحمد الغامدي", title: "مشرف خط الإنتاج", dept: "الإنتاج", shift: "morning", baseSalary: 6200, joinDate: "2020-06-15", active: true, pin: "1234", phone: "966502222222" },
  { id: "e3", name: "سارة العتيبي", title: "فنية مراقبة الجودة", dept: "الجودة", shift: "morning", baseSalary: 5400, joinDate: "2021-01-10", active: true, pin: "1234", phone: "966503333333" },
  { id: "e4", name: "خالد المطيري", title: "فني أفران", dept: "الإنتاج", shift: "evening", baseSalary: 5000, joinDate: "2020-09-01", active: true, pin: "1234", phone: "966504444444" },
  { id: "e5", name: "نورة القحطاني", title: "عاملة تغليف", dept: "التغليف", shift: "morning", baseSalary: 3800, joinDate: "2022-02-20", active: true, pin: "1234", phone: "966505555555" },
  { id: "e6", name: "فهد الدوسري", title: "عامل مستودع", dept: "المستودع", shift: "evening", baseSalary: 3600, joinDate: "2021-11-05", active: true, pin: "1234", phone: "966506666666" },
  { id: "e7", name: "ريم الشهري", title: "محاسبة", dept: "المالية", shift: "morning", baseSalary: 5800, joinDate: "2020-04-12", active: true, pin: "1234", phone: "966507777777" },
  { id: "e8", name: "يوسف الزهراني", title: "فني صيانة", dept: "الصيانة", shift: "night", baseSalary: 4600, joinDate: "2021-07-30", active: true, pin: "1234", phone: "966508888888" },
  { id: "e9", name: "مها الحربي", title: "عاملة إنتاج", dept: "الإنتاج", shift: "morning", baseSalary: 3700, joinDate: "2022-08-14", active: true, pin: "1234", phone: "966509999999" },
  { id: "e10", name: "عبدالرحمن السبيعي", title: "سائق توزيع", dept: "التوزيع", shift: "morning", baseSalary: 4000, joinDate: "2021-05-19", active: true, pin: "1234", phone: "966511111111" },
  { id: "e11", name: "لطيفة العنزي", title: "عاملة تغليف", dept: "التغليف", shift: "evening", baseSalary: 3600, joinDate: "2023-01-08", active: true, pin: "1234", phone: "966522222222" },
  { id: "e12", name: "ماجد الشمري", title: "عامل عجينة", dept: "الإنتاج", shift: "night", baseSalary: 3900, joinDate: "2022-10-25", active: false, pin: "1234", phone: "966533333333" },
];

export const SUPERVISOR_PHONE = "966501111111";

// ─── مولّد بيانات الحضور (٤٥ يومًا) ─────────────────────────────────────────
function genAttendance(): AttendanceRecord[] {
  const recs: AttendanceRecord[] = [];
  const today = new Date();
  let seq = 1;
  for (let back = 44; back >= 0; back--) {
    const d = addDays(today, -back);
    if (!isWorkday(d)) continue;
    const key = dateKey(d);
    for (const emp of EMPLOYEES) {
      if (!emp.active) continue;
      const r = Math.random();
      if (r < 0.055) continue; // غياب
      const baseStart = emp.shift === "morning" ? 360 : emp.shift === "evening" ? 840 : 1320;
      const late = Math.random() < 0.16 ? 12 + Math.floor(Math.random() * 48) : Math.floor(Math.random() * 8);
      const inMin = baseStart + late;
      const ot = Math.random() < 0.28 ? 30 + Math.floor(Math.random() * 90) : 0;
      const outMin = back === 0 ? null : inMin + 480 + 30 + ot;
      recs.push({ id: `at-${seq++}`, empId: emp.id, date: key, in: inMin, out: outMin, method: Math.random() < 0.8 ? "qr" : "manual" });
    }
  }
  return recs;
}
export const ATTENDANCE_SEED = genAttendance();

// ─── الإجازات ───────────────────────────────────────────────────────────────
const t0 = new Date();
export const LEAVES_SEED: LeaveRequest[] = [
  { id: "lv1", empId: "e5", type: "sick", from: dateKey(addDays(t0, 2)), to: dateKey(addDays(t0, 3)), reason: "إجازة مرضية — مراجعة طبية", status: "pending" },
  { id: "lv2", empId: "e8", type: "permission", from: dateKey(addDays(t0, 1)), to: dateKey(addDays(t0, 1)), reason: "مراجعة جهة حكومية (٣ ساعات)", status: "pending" },
  { id: "lv3", empId: "e6", type: "annual", from: dateKey(addDays(t0, -9)), to: dateKey(addDays(t0, -6)), reason: "إجازة سنوية عائلية", status: "approved" },
  { id: "lv4", empId: "e9", type: "sick", from: dateKey(addDays(t0, -4)), to: dateKey(addDays(t0, -3)), reason: "وعكة صحية", status: "approved" },
  { id: "lv5", empId: "e11", type: "unpaid", from: dateKey(addDays(t0, -16)), to: dateKey(addDays(t0, -14)), reason: "ظروف خاصة", status: "approved" },
  { id: "lv6", empId: "e4", type: "annual", from: dateKey(addDays(t0, -20)), to: dateKey(addDays(t0, -19)), reason: "إجازة قصيرة", status: "rejected" },
];

// ─── السلف ──────────────────────────────────────────────────────────────────
export const ADVANCES_SEED: Advance[] = [
  { id: "ad1", empId: "e5", amount: 400, date: dateKey(addDays(t0, -6)), note: "سلفة طارئة" },
  { id: "ad2", empId: "e9", amount: 300, date: dateKey(addDays(t0, -12)), note: "سلفة مواصلات" },
  { id: "ad3", empId: "e6", amount: 500, date: dateKey(addDays(t0, -40)), note: "سلفة إيجار", settledMonth: prevMonthKey(monthKeyOf(t0)) },
];

// ─── المنتجات ───────────────────────────────────────────────────────────────
const NUTR = (kcal: string, fat: string, sat: string, carb: string, sug: string, fib: string, pro: string, salt: string) => [
  { label: "الطاقة", value: kcal }, { label: "الدهون", value: fat }, { label: "منها مشبعة", value: sat },
  { label: "الكربوهيدرات", value: carb }, { label: "السكريات", value: sug }, { label: "الألياف", value: fib },
  { label: "البروتين", value: pro }, { label: "الملح", value: salt },
];

export const PRODUCTS: Product[] = [
  {
    id: "p1", name: "شورتبرد الزبدة الذهبي", latinName: "Golden Shortbread", flavor: "زبدة طبيعية", family: "زبدة", weight: "24 قطعة × 20غ",
    img: "https://image.qwenlm.ai/generated-images/b10311c0-6756-4eaf-9661-5d8e1de2fbaf/_result.png",
    ingredients: ["دقيق القمح", "زبدة طبيعية ٣٢٪", "سكر ناعم", "خلاصة الفانيليا", "ملح بحري"],
    nutrition: NUTR("512 سعرة", "26غ", "16غ", "61غ", "20غ", "1.4غ", "5.2غ", "0.4غ"),
    packs: [
      { tier: "box", units: 24, price: 14, label: "علبة عرض — ٢٤ قطعة" },
      { tier: "carton", units: 12, price: 12.5, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 11.2, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 5, stock: 640, rating: 4.9, badge: "الأكثر مبيعًا", soldRank: 1,
    notes: ["زبدة فرنسية", "مقرمش", "كلاسيكي"],
  },
  {
    id: "p2", name: "كوكيز الشوكولاتة الفاخر", latinName: "Choco Chunk Cookies", flavor: "شوكولاتة داكنة", family: "شوكولاتة", weight: "18 قطعة × 25غ",
    img: "https://image.qwenlm.ai/generated-images/f08db7d8-ab26-44ec-a816-97ecad2e7f56/_result.png",
    ingredients: ["دقيق القمح", "رقائق شوكولاتة ٢٤٪", "سكر بني", "زبدة", "كاكاو", "بيض"],
    nutrition: NUTR("489 سعرة", "23غ", "13غ", "64غ", "31غ", "2.1غ", "6غ", "0.5غ"),
    packs: [
      { tier: "box", units: 18, price: 16, label: "علبة عرض — ١٨ قطعة" },
      { tier: "carton", units: 12, price: 14.5, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 13, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 5, stock: 420, rating: 4.8, soldRank: 2,
    notes: ["شوكولاتة داكنة", "قطع غنية", "مقرمش"],
  },
  {
    id: "p3", name: "السمسمية المقرمشة", latinName: "Sesame Snaps", flavor: "سمسم محمّص", family: "سمسم", weight: "30 قطعة × 12غ",
    img: "https://image.qwenlm.ai/generated-images/ad6809d7-7a9b-400c-ad41-9af066c8b039/_result.png",
    ingredients: ["سمسم محمّص ٥٥٪", "سكر", "جلوكوز", "زيت نباتي", "ملح"],
    nutrition: NUTR("540 سعرة", "31غ", "4.5غ", "52غ", "28غ", "3.8غ", "11غ", "0.2غ"),
    packs: [
      { tier: "box", units: 30, price: 10, label: "علبة عرض — ٣٠ قطعة" },
      { tier: "carton", units: 12, price: 9, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 8, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 10, stock: 880, rating: 4.7, badge: "تراثي", soldRank: 3,
    notes: ["سمسم محمّص", "قرمشة", "تقليدي"],
  },
  {
    id: "p4", name: "معمول التمر الملكي", latinName: "Royal Date Maamoul", flavor: "عجوة تمر", family: "تمر", weight: "20 قطعة × 30غ",
    img: "https://image.qwenlm.ai/generated-images/d6519e5c-3db5-4123-9b49-610620551bbe/_result.png",
    ingredients: ["دقيق سميد", "عجوة تمر ٣٠٪", "زبدة", "سكر بودرة", "ماء زهر", "هيل"],
    nutrition: NUTR("462 سعرة", "19غ", "11غ", "66غ", "33غ", "3غ", "4.8غ", "0.1غ"),
    packs: [
      { tier: "box", units: 20, price: 18, label: "علبة هدية — ٢٠ قطعة" },
      { tier: "carton", units: 12, price: 16.5, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 15, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 5, stock: 300, rating: 4.9, badge: "موسمي", soldRank: 4,
    notes: ["عجوة فاخرة", "تقليدي", "مناسبات"], seasonal: "رمضان والعيد",
  },
  {
    id: "p5", name: "بسكويت الشوفان بالعسل", latinName: "Oat & Honey Digestive", flavor: "شوفان وعسل", family: "شوفان", weight: "22 قطعة × 18غ",
    img: "https://image.qwenlm.ai/generated-images/c7dbc7b6-dc36-4cf8-9ecc-53b92a2d5c78/_result.png",
    ingredients: ["شوفان كامل ٤٠٪", "دقيق قمح كامل", "عسل طبيعي ٨٪", "سكر", "زيت نباتي"],
    nutrition: NUTR("448 سعرة", "18غ", "6غ", "62غ", "19غ", "5.5غ", "7.4غ", "0.6غ"),
    packs: [
      { tier: "box", units: 22, price: 12, label: "علبة عرض — ٢٢ قطعة" },
      { tier: "carton", units: 12, price: 11, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 9.8, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 5, stock: 510, rating: 4.6, badge: "صحي", soldRank: 5,
    notes: ["شوفان كامل", "عسل", "صحي"],
  },
  {
    id: "p6", name: "ويفر الفانيليا الهش", latinName: "Vanilla Wafer Rolls", flavor: "كريمة فانيليا", family: "فانيليا", weight: "26 قطعة × 10غ",
    img: "https://image.qwenlm.ai/generated-images/dbe8c237-56a0-4a63-aa92-9529b0f7c4ee/_result.png",
    ingredients: ["دقيق القمح", "سكر", "زيت نباتي", "مسحوق مصل الحليب", "فانيليا طبيعية"],
    nutrition: NUTR("505 سعرة", "25غ", "12غ", "65غ", "30غ", "0.8غ", "4.5غ", "0.3غ"),
    packs: [
      { tier: "box", units: 26, price: 9, label: "علبة عرض — ٢٦ قطعة" },
      { tier: "carton", units: 12, price: 8.2, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 7.4, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 10, stock: 96, rating: 4.4, soldRank: 7,
    notes: ["فانيليا", "طبقات", "خفيف"],
  },
  {
    id: "p7", name: "مقرمشات جوز الهند", latinName: "Coconut Crisp", flavor: "جوز هند محمّص", family: "جوز هند", weight: "28 قطعة × 11غ",
    img: "https://image.qwenlm.ai/generated-images/804a5396-3e21-49a4-b574-0b5596bf53a5/_result.png",
    ingredients: ["دقيق القمح", "جوز هند مبشور ٢٢٪", "سكر", "زبدة", "بيض"],
    nutrition: NUTR("497 سعرة", "24غ", "15غ", "63غ", "26غ", "2.6غ", "5.8غ", "0.4غ"),
    packs: [
      { tier: "box", units: 28, price: 11, label: "علبة عرض — ٢٨ قطعة" },
      { tier: "carton", units: 12, price: 10, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 9, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 10, stock: 260, rating: 4.5, soldRank: 6,
    notes: ["جوز هند", "قرمشة", "استوائي"], seasonal: "الصيف",
  },
  {
    id: "p8", name: "أصابع الليمون المنعشة", latinName: "Lemon Shortbread Fingers", flavor: "ليمون وجلّاز", family: "حمضيات", weight: "20 قطعة × 15غ",
    img: "https://image.qwenlm.ai/generated-images/b417e6ce-a99c-4e13-b319-4a71f052dc91/_result.png",
    ingredients: ["دقيق القمح", "زبدة", "سكر", "قشر ليمون طبيعي", "عصير ليمون مجفف"],
    nutrition: NUTR("478 سعرة", "22غ", "13غ", "66غ", "27غ", "1.1غ", "4.9غ", "0.3غ"),
    packs: [
      { tier: "box", units: 20, price: 13, label: "علبة عرض — ٢٠ قطعة" },
      { tier: "carton", units: 12, price: 11.8, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 10.5, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 5, stock: 180, rating: 4.6, badge: "جديد", soldRank: 8,
    notes: ["ليمون منعش", "جلّاز", "خفيف"], seasonal: "الصيف",
  },
];

// ─── المواد الخام ───────────────────────────────────────────────────────────
export const RAW_MATERIALS: RawMaterial[] = [
  { id: "rm1", name: "دقيق القمح", unit: "كيس ٥٠ كغ", qty: 140, reorderPoint: 80, capacity: 400, supplier: "مطاحن الراجحي" },
  { id: "rm2", name: "السكر الناعم", unit: "كيس ٥٠ كغ", qty: 62, reorderPoint: 40, capacity: 200, supplier: "شركة السكر المتحدة" },
  { id: "rm3", name: "الزبدة الطبيعية", unit: "كرتون ٢٠ كغ", qty: 18, reorderPoint: 25, capacity: 120, supplier: "ألبان الصافي" },
  { id: "rm4", name: "رقائق الشوكولاتة", unit: "كرتون ١٥ كغ", qty: 34, reorderPoint: 20, capacity: 100, supplier: "كاليبو" },
  { id: "rm5", name: "السمسم المحمّص", unit: "كيس ٢٥ كغ", qty: 26, reorderPoint: 15, capacity: 90, supplier: "مكسرات الرياض" },
  { id: "rm6", name: "عجوة التمر", unit: "كرتون ١٠ كغ", qty: 44, reorderPoint: 30, capacity: 150, supplier: "تمور القصيم" },
  { id: "rm7", name: "الشوفان الكامل", unit: "كيس ٢٥ كغ", qty: 21, reorderPoint: 18, capacity: 80, supplier: "الحبوب الوطنية" },
  { id: "rm8", name: "عبوات كرتونية", unit: "حزمة ١٠٠", qty: 310, reorderPoint: 150, capacity: 900, supplier: "مصنع التغليف الحديث" },
];

// ─── دفعات الإنتاج (تواريخ الصلاحية) ────────────────────────────────────────
export const BATCHES: Batch[] = [
  { id: "b1", lot: "LOT-0241", productId: "p1", producedAt: dateKey(addDays(t0, -12)), expiryDays: 180, qty: 220 },
  { id: "b2", lot: "LOT-0242", productId: "p2", producedAt: dateKey(addDays(t0, -8)), expiryDays: 150, qty: 160 },
  { id: "b3", lot: "LOT-0238", productId: "p3", producedAt: dateKey(addDays(t0, -150)), expiryDays: 160, qty: 340 },
  { id: "b4", lot: "LOT-0240", productId: "p4", producedAt: dateKey(addDays(t0, -20)), expiryDays: 90, qty: 120 },
  { id: "b5", lot: "LOT-0243", productId: "p5", producedAt: dateKey(addDays(t0, -5)), expiryDays: 120, qty: 190 },
  { id: "b6", lot: "LOT-0236", productId: "p6", producedAt: dateKey(addDays(t0, -170)), expiryDays: 180, qty: 80 },
  { id: "b7", lot: "LOT-0244", productId: "p7", producedAt: dateKey(addDays(t0, -3)), expiryDays: 150, qty: 110 },
  { id: "b8", lot: "LOT-0239", productId: "p8", producedAt: dateKey(addDays(t0, -35)), expiryDays: 45, qty: 90 },
];

// ─── الطلبات ────────────────────────────────────────────────────────────────
export const ORDERS_SEED: Order[] = [
  {
    id: "OW-2419", customer: "أسواق التميمي", customerPhone: "966541111111",
    lines: [{ productId: "p1", tier: "carton", qty: 40 }, { productId: "p4", tier: "carton", qty: 12 }],
    subtotal: 6932, discount: 489.6, deliveryFee: 0, total: 6442.4, status: "baking",
    placedAt: dateKey(addDays(t0, -1)), deliverOn: dateKey(addDays(t0, 2)), window: "08:00 – 12:00", payment: "transfer",
  },
  {
    id: "OW-2418", customer: "مؤسسة النخبة للتوزيع", customerPhone: "966542222222",
    lines: [{ productId: "p3", tier: "pallet", qty: 1 }, { productId: "p7", tier: "carton", qty: 24 }],
    subtotal: 6180, discount: 522, deliveryFee: 0, total: 5658, status: "pending",
    placedAt: todayKey(), deliverOn: dateKey(addDays(t0, 3)), window: "12:00 – 16:00", payment: "cod",
  },
  {
    id: "OW-2417", customer: "بقالة الخير", customerPhone: "966543333333",
    lines: [{ productId: "p2", tier: "carton", qty: 8 }],
    subtotal: 928, discount: 0, deliveryFee: 45, total: 973, status: "shipped",
    placedAt: dateKey(addDays(t0, -2)), deliverOn: dateKey(addDays(t0, 1)), window: "16:00 – 20:00", payment: "cod",
  },
  {
    id: "OW-2416", customer: "فندق القصر الذهبي", customerPhone: "966544444444",
    lines: [{ productId: "p4", tier: "carton", qty: 15 }, { productId: "p8", tier: "carton", qty: 10 }],
    subtotal: 2042, discount: 102.1, deliveryFee: 0, total: 1939.9, status: "delivered",
    placedAt: dateKey(addDays(t0, -5)), deliverOn: dateKey(addDays(t0, -3)), window: "08:00 – 12:00", payment: "transfer",
  },
  {
    id: "OW-2415", customer: "أسواق العائلة", customerPhone: "966545555555",
    lines: [{ productId: "p5", tier: "carton", qty: 22 }, { productId: "p6", tier: "carton", qty: 14 }],
    subtotal: 1656.4, discount: 82.8, deliveryFee: 0, total: 1573.6, status: "delivered",
    placedAt: dateKey(addDays(t0, -7)), deliverOn: dateKey(addDays(t0, -5)), window: "12:00 – 16:00", payment: "gateway",
  },
];

// ─── سجل التدقيق (سلسلة تجزئة غير قابلة للعبث) ──────────────────────────────
const AUDIT_RAW = [
  { id: "au1", at: dateKey(addDays(t0, -1)) + " 09:14", actor: "منيرة السالم", role: "hr" as const, action: "اعتماد مسير رواتب", detail: `اعتماد مسير ${prevMonthKey(monthKeyOf(t0))} وإصدار ١١ قسيمة راتب` },
  { id: "au2", at: dateKey(addDays(t0, -1)) + " 07:02", actor: "سعد الحربي", role: "production" as const, action: "استلام مواد خام", detail: "استلام ٦٠ كيس دقيق قمح من مطاحن الراجحي" },
  { id: "au3", at: dateKey(addDays(t0, -1)) + " 11:40", actor: "يزيد العتيبي", role: "sales" as const, action: "تحديث حالة طلب", detail: "OW-2417 ← تم الشحن إلى بقالة الخير" },
  { id: "au4", at: dateKey(addDays(t0, -2)) + " 13:25", actor: "عبدالله الراشد", role: "super" as const, action: "تعديل راتب أساسي", detail: "تعديل راتب نورة القحطاني إلى 3,800 ر.س (مراجعة أداء)" },
  { id: "au5", at: dateKey(addDays(t0, -2)) + " 08:51", actor: "منيرة السالم", role: "hr" as const, action: "تسجيل سلفة", detail: "سلفة ٤٠٠ ر.س لنورة القحطاني — ستُخصم من مسير الشهر" },
  { id: "au6", at: dateKey(addDays(t0, -3)) + " 16:10", actor: "أحمد الغامدي", role: "customer" as const, action: "إدخال حضور يدوي", detail: "إدخال يدوي بواسطة المشرف ليوسف الزهراني (تعطل قارئ الباركود)" },
  { id: "au7", at: dateKey(addDays(t0, -4)) + " 10:33", actor: "سعد الحربي", role: "production" as const, action: "تنبيه صلاحية", detail: "LOT-0239 (أصابع الليمون) يدخل نافذة التنبيه قبل الانتهاء" },
  { id: "au8", at: dateKey(addDays(t0, -5)) + " 12:18", actor: "عبدالله الراشد", role: "super" as const, action: "إنشاء طلب جملة", detail: "OW-2416 لفندق القصر الذهبي — ٢٥ كرتونة، خصم ٥٪" },
];
// السلسلة تُبنى زمنيًا (الأقدم ← الأحدث) ثم تُعرض بالأحدث أولًا
export const AUDIT_SEED: AuditEntry[] = (() => {
  let prev = "GENESIS";
  const chained = [...AUDIT_RAW].reverse().map((e) => {
    const hash = chainHash(prev, e.at, e.actor, e.action, e.detail);
    const out: AuditEntry = { ...e, prevHash: prev, hash };
    prev = hash;
    return out;
  });
  return chained.reverse();
})();

// ─── سلسلة الإيرادات (١٢ شهرًا) ──────────────────────────────────────────────
export const REVENUE_SERIES = [
  { month: 3, revenue: 412, payroll: 96 }, { month: 4, revenue: 388, payroll: 96 },
  { month: 5, revenue: 455, payroll: 98 }, { month: 6, revenue: 512, payroll: 99 },
  { month: 7, revenue: 489, payroll: 101 }, { month: 8, revenue: 534, payroll: 102 },
  { month: 9, revenue: 571, payroll: 103 }, { month: 10, revenue: 602, payroll: 104 },
  { month: 11, revenue: 648, payroll: 106 }, { month: 12, revenue: 719, payroll: 108 },
  { month: 13, revenue: 692, payroll: 108 }, { month: 14, revenue: 661, payroll: 109 },
].map((r) => ({ ...r, production: Math.round(r.revenue * 0.82) }));

export const BESTSELLERS = [
  { name: "شورتبرد الزبدة", sold: 1240 },
  { name: "كوكيز الشوكولاتة", sold: 986 },
  { name: "السمسمية", sold: 872 },
  { name: "معمول التمر", sold: 640 },
  { name: "شوفان بالعسل", sold: 512 },
];
