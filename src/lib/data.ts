import type {
  Advance, AttendanceRecord, AuditEntry, Batch, Employee, Governorate, LeaveRequest,
  Order, Product, RawMaterial, User,
} from "./types";
import { addDays, dateKey, isWorkday, monthKeyOf, prevMonthKey, todayKey } from "./payroll";
import { chainHash } from "./crypto";

// ─── الكيان التجاري ──────────────────────────────────────────────────────────
export const COMPANY = {
  name: "الشركة المصرية للصناعات الغذائية",
  short: "المصرية الغذائية",
  owner: "أيمن الكردي",
  taxId: "512-345-678",            // البطاقة الضريبية
  commercialReg: "س.ت ٤٥٦٧٨٩",     // السجل التجاري
  hq: "المنطقة الصناعية — مدينة السادس من أكتوبر، الجيزة",
  phone: "201001234567",
};

// ─── مصفوفة التوصيل للمحافظات (رسوم + مدة بالجنيه والأيام) ──────────────────
export const GOVERNORATES: Governorate[] = [
  { id: "g1", name: "القاهرة", fee: 35, days: "١–٢ يوم" },
  { id: "g2", name: "الجيزة", fee: 40, days: "١–٢ يوم" },
  { id: "g3", name: "القليوبية", fee: 45, days: "٢ أيام" },
  { id: "g4", name: "الإسكندرية", fee: 55, days: "٢–٣ أيام" },
  { id: "g5", name: "الشرقية", fee: 60, days: "٢–٣ أيام" },
  { id: "g6", name: "الدقهلية", fee: 60, days: "٢–٣ أيام" },
  { id: "g7", name: "المنوفية", fee: 55, days: "٢ أيام" },
  { id: "g8", name: "الغربية", fee: 55, days: "٢ أيام" },
  { id: "g9", name: "البحيرة", fee: 60, days: "٣ أيام" },
  { id: "g10", name: "الفيوم", fee: 55, days: "٢–٣ أيام" },
  { id: "g11", name: "بني سويف", fee: 60, days: "٣ أيام" },
  { id: "g12", name: "المنيا", fee: 70, days: "٣ أيام" },
  { id: "g13", name: "أسيوط", fee: 75, days: "٣–٤ أيام" },
  { id: "g14", name: "سوهاج", fee: 80, days: "٣–٤ أيام" },
  { id: "g15", name: "قنا", fee: 85, days: "٤ أيام" },
  { id: "g16", name: "الأقصر", fee: 90, days: "٤ أيام" },
  { id: "g17", name: "أسوان", fee: 95, days: "٤–٥ أيام" },
];

// ─── الهويات (RBAC) — الرقم السري للتجربة: 1234 ─────────────────────────────
export const USERS: User[] = [
  { id: "u1", name: "أيمن الكردي", role: "super", title: "المالك والمدير العام", empId: "e1", phone: "201001111111" },
  { id: "u2", name: "هالة عبد العظيم", role: "hr", title: "مديرة الموقع والموارد البشرية", phone: "201002222222" },
  { id: "u3", name: "سيد رمضان", role: "production", title: "مشرف الوردية والصالة", empId: "e4", phone: "201003333333" },
  { id: "u4", name: "مصطفى حسان", role: "sales", title: "مندوب مبيعات الجملة", phone: "201004444444" },
  { id: "u5", name: "شركة النور للتوزيع", role: "customer", title: "تاجر جملة — حساب B2B", phone: "201005555555",
    savedAddresses: [{ id: "sa1", govId: "g1", city: "العبور", street: "شارع الصنايع، بلوك ١٢", phone: "201005555555" }] },
];

// ─── العمال — أجور بالجنيه (شهري / يومية) ────────────────────────────────────
export const EMPLOYEES: Employee[] = [
  { id: "e1", name: "أيمن الكردي", title: "المالك والمدير العام", dept: "الإدارة", shift: "morning", wageType: "monthly", baseSalary: 45000, joinDate: "2016-03-01", active: true, pin: "1234", phone: "201001111111" },
  { id: "e2", name: "محمود عبد التواب", title: "مشرف خط الإنتاج", dept: "الإنتاج", shift: "morning", wageType: "monthly", baseSalary: 12500, joinDate: "2018-06-15", active: true, pin: "1234", phone: "201012222222" },
  { id: "e3", name: "هبة الشاذلي", title: "فنية مراقبة الجودة", dept: "الجودة", shift: "morning", wageType: "monthly", baseSalary: 9800, joinDate: "2020-01-10", active: true, pin: "1234", phone: "201023333333" },
  { id: "e4", name: "سيد رمضان", title: "فني أفران", dept: "الإنتاج", shift: "evening", wageType: "monthly", baseSalary: 8600, joinDate: "2019-09-01", active: true, pin: "1234", phone: "201003333333" },
  { id: "e5", name: "نادية فتحي", title: "عاملة تغليف", dept: "التغليف", shift: "morning", wageType: "monthly", baseSalary: 6200, joinDate: "2021-02-20", active: true, pin: "1234", phone: "201065555555" },
  { id: "e6", name: "حسن الجبالي", title: "عامل مخزن", dept: "المخازن", shift: "evening", wageType: "monthly", baseSalary: 5900, joinDate: "2020-11-05", active: true, pin: "1234", phone: "201116666666" },
  { id: "e7", name: "رانيا مرسي", title: "محاسبة", dept: "المالية", shift: "morning", wageType: "monthly", baseSalary: 10500, joinDate: "2019-04-12", active: true, pin: "1234", phone: "201227777777" },
  { id: "e8", name: "مصطفى حسان", title: "فني صيانة", dept: "الصيانة", shift: "night", wageType: "monthly", baseSalary: 8200, joinDate: "2020-07-30", active: true, pin: "1234", phone: "201004444444" },
  { id: "e9", name: "شيماء بدر", title: "عاملة إنتاج", dept: "الإنتاج", shift: "morning", wageType: "monthly", baseSalary: 6000, joinDate: "2022-08-14", active: true, pin: "1234", phone: "201119999999" },
  { id: "e10", name: "عربي التهامي", title: "سائق توزيع", dept: "التوزيع", shift: "morning", wageType: "monthly", baseSalary: 7000, joinDate: "2021-05-19", active: true, pin: "1234", phone: "201061231234" },
  { id: "e11", name: "ولاء عبد الحميد", title: "عاملة تغليف", dept: "التغليف", shift: "evening", wageType: "monthly", baseSalary: 5800, joinDate: "2023-01-08", active: true, pin: "1234", phone: "201225675678" },
  { id: "e12", name: "رضا السباعي", title: "عامل عجينة", dept: "الإنتاج", shift: "night", wageType: "monthly", baseSalary: 6400, joinDate: "2022-10-25", active: false, archived: true, pin: "1234", phone: "201113453456" },
  { id: "e13", name: "عماد خليل", title: "عامل شحن وتفريغ", dept: "المخازن", shift: "morning", wageType: "daily", baseSalary: 0, dailyRate: 220, joinDate: "2024-03-02", active: true, pin: "1234", phone: "201098768765" },
  { id: "e14", name: "سعاد نصر", title: "عاملة موسمية", dept: "التغليف", shift: "evening", wageType: "daily", baseSalary: 0, dailyRate: 200, joinDate: "2024-06-15", active: true, pin: "1234", phone: "201286546543" },
];

export const SUPERVISOR_PHONE = "201003333333";

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
  { id: "lv1", empId: "e5", type: "sick", from: dateKey(addDays(t0, 2)), to: dateKey(addDays(t0, 3)), reason: "إجازة مرضية — مراجعة مستشفى التأمين الصحي", status: "pending" },
  { id: "lv2", empId: "e8", type: "permission", from: dateKey(addDays(t0, 1)), to: dateKey(addDays(t0, 1)), reason: "استخراج أوراق من الشهر العقاري (٣ ساعات)", status: "pending" },
  { id: "lv3", empId: "e6", type: "annual", from: dateKey(addDays(t0, -9)), to: dateKey(addDays(t0, -6)), reason: "إجازة سنوية عائلية", status: "approved" },
  { id: "lv4", empId: "e9", type: "sick", from: dateKey(addDays(t0, -4)), to: dateKey(addDays(t0, -3)), reason: "وعكة صحية", status: "approved" },
  { id: "lv5", empId: "e11", type: "unpaid", from: dateKey(addDays(t0, -16)), to: dateKey(addDays(t0, -14)), reason: "ظروف خاصة", status: "approved" },
  { id: "lv6", empId: "e4", type: "annual", from: dateKey(addDays(t0, -20)), to: dateKey(addDays(t0, -19)), reason: "إجازة قصيرة", status: "rejected" },
];

// ─── السلف (تُخصم من المسير بالجنيه) ────────────────────────────────────────
export const ADVANCES_SEED: Advance[] = [
  { id: "ad1", empId: "e5", amount: 800, date: dateKey(addDays(t0, -6)), note: "سلفة طارئة" },
  { id: "ad2", empId: "e9", amount: 500, date: dateKey(addDays(t0, -12)), note: "سلفة مواصلات" },
  { id: "ad3", empId: "e6", amount: 1200, date: dateKey(addDays(t0, -40)), note: "سلفة إيجار", settledMonth: prevMonthKey(monthKeyOf(t0)) },
];

// ─── المنتجات — خطوط البسكويت المصرية ────────────────────────────────────────
const NUTR = (kcal: string, fat: string, sat: string, carb: string, sug: string, fib: string, pro: string, salt: string) => [
  { label: "الطاقة", value: kcal }, { label: "الدهون", value: fat }, { label: "منها مشبعة", value: sat },
  { label: "الكربوهيدرات", value: carb }, { label: "السكريات", value: sug }, { label: "الألياف", value: fib },
  { label: "البروتين", value: pro }, { label: "الملح", value: salt },
];

export const PRODUCTS: Product[] = [
  {
    id: "p1", name: "بسكويت الشاي السادة", latinName: "Classic Tea Biscuits", flavor: "هش خفيف للتحلية", family: "شاي", weight: "24 قطعة × 20غ",
    img: "https://image.qwenlm.ai/generated-images/b10311c0-6756-4eaf-9661-5d8e1de2fbaf/_result.png",
    ingredients: ["دقيق قمح فاخر ٧٢٪", "سكر", "زيت نباتي", "جلوكوز", "بيكربونات الصوديوم", "فانيليا"],
    nutrition: NUTR("458 سعرة", "16غ", "7غ", "71غ", "19غ", "1.8غ", "6.1غ", "0.5غ"),
    packs: [
      { tier: "box", units: 24, price: 30, label: "علبة عرض — ٢٤ قطعة" },
      { tier: "carton", units: 12, price: 26.5, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 24, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 5, stock: 640, rating: 4.9, badge: "الأكثر مبيعًا", soldRank: 1,
    notes: ["مع الشاي", "هش", "كلاسيكي مصري"],
  },
  {
    id: "p2", name: "بسكويت دايجستيف بالقمح الكامل", latinName: "Whole-Wheat Digestive", flavor: "قمح كامل وألياف", family: "دايجستيف", weight: "22 قطعة × 18غ",
    img: "https://image.qwenlm.ai/generated-images/c7dbc7b6-dc36-4cf8-9ecc-53b92a2d5c78/_result.png",
    ingredients: ["دقيق قمح كامل ٥٤٪", "نخالة القمح", "زيت نباتي", "سكر بني", "دبس قصب", "ملح"],
    nutrition: NUTR("472 سعرة", "21غ", "6غ", "61غ", "17غ", "6.4غ", "7.8غ", "0.6غ"),
    packs: [
      { tier: "box", units: 22, price: 36, label: "علبة عرض — ٢٢ قطعة" },
      { tier: "carton", units: 12, price: 32, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 29, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 5, stock: 510, rating: 4.8, badge: "غني بالألياف", soldRank: 2,
    notes: ["قمح كامل", "ألياف", "خيار صحي"],
  },
  {
    id: "p3", name: "سمسمية بالسمسم المحمص", latinName: "Sesame Snaps", flavor: "سمسم محمص وعسل أسود", family: "سمسم", weight: "30 قطعة × 12غ",
    img: "https://image.qwenlm.ai/generated-images/ad6809d7-7a9b-400c-ad41-9af066c8b039/_result.png",
    ingredients: ["سمسم محمص ٥٥٪", "سكر", "عسل أسود", "جلوكوز", "زيت نباتي"],
    nutrition: NUTR("540 سعرة", "31غ", "4.5غ", "52غ", "28غ", "3.8غ", "11غ", "0.2غ"),
    packs: [
      { tier: "box", units: 30, price: 24, label: "علبة عرض — ٣٠ قطعة" },
      { tier: "carton", units: 12, price: 21, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 19, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 10, stock: 880, rating: 4.7, badge: "تراثي", soldRank: 3,
    notes: ["سمسم محمص", "عسل أسود", "تقليدي"],
  },
  {
    id: "p4", name: "معمول بالعجوة", latinName: "Date Maamoul", flavor: "عجوة وسميد", family: "تمر", weight: "20 قطعة × 30غ",
    img: "https://image.qwenlm.ai/generated-images/d6519e5c-3db5-4123-9b49-610620551bbe/_result.png",
    ingredients: ["دقيق سميد", "عجوة بلح ٣٠٪", "سمن طبيعي", "سكر بودرة", "ماء زهر", "قرفة"],
    nutrition: NUTR("462 سعرة", "19غ", "11غ", "66غ", "33غ", "3غ", "4.8غ", "0.1غ"),
    packs: [
      { tier: "box", units: 20, price: 45, label: "علبة هدية — ٢٠ قطعة" },
      { tier: "carton", units: 12, price: 40, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 36, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 5, stock: 300, rating: 4.9, badge: "موسمي", soldRank: 4,
    notes: ["عجوة فاخرة", "مناسبات", "رمضان والعيد"], seasonal: "رمضان والعيد",
  },
  {
    id: "p5", name: "ساندويتش كريم الفانيليا", latinName: "Vanilla Cream Sandwich", flavor: "كريمة فانيليا بين طبقتين", family: "كريم", weight: "26 قطعة × 10غ",
    img: "https://image.qwenlm.ai/generated-images/dbe8c237-56a0-4a63-aa92-9529b0f7c4ee/_result.png",
    ingredients: ["دقيق القمح", "سكر", "زيت نباتي", "مسحوق مصل الحليب", "فانيليا طبيعية", "كاكاو"],
    nutrition: NUTR("505 سعرة", "25غ", "12غ", "65غ", "30غ", "0.8غ", "4.5غ", "0.3غ"),
    packs: [
      { tier: "box", units: 26, price: 28, label: "علبة عرض — ٢٦ قطعة" },
      { tier: "carton", units: 12, price: 25, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 22.5, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 10, stock: 96, rating: 4.6, soldRank: 5,
    notes: ["كريمة", "للأطفال", "لانكشير"],
  },
  {
    id: "p6", name: "ويفر الشوكولاتة الفاخر", latinName: "Chocolate Wafer", flavor: "شوكولاتة داكنة", family: "شوكولاتة", weight: "18 قطعة × 25غ",
    img: "https://image.qwenlm.ai/generated-images/f08db7d8-ab26-44ec-a816-97ecad2e7f56/_result.png",
    ingredients: ["دقيق القمح", "رقائق شوكولاتة ٢٤٪", "سكر", "زبدة", "كاكاو خام", "بيض"],
    nutrition: NUTR("489 سعرة", "23غ", "13غ", "64غ", "31غ", "2.1غ", "6غ", "0.5غ"),
    packs: [
      { tier: "box", units: 18, price: 40, label: "علبة عرض — ١٨ قطعة" },
      { tier: "carton", units: 12, price: 35.5, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 32, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 5, stock: 420, rating: 4.8, soldRank: 6,
    notes: ["شوكولاتة داكنة", "طبقات", "قرمشة"],
  },
  {
    id: "p7", name: "بسكويت جوز الهند", latinName: "Coconut Biscuits", flavor: "جوز هند محمص", family: "جوز هند", weight: "28 قطعة × 11غ",
    img: "https://image.qwenlm.ai/generated-images/804a5396-3e21-49a4-b574-0b5596bf53a5/_result.png",
    ingredients: ["دقيق القمح", "جوز هند مبشور ٢٢٪", "سكر", "سمن طبيعي", "بيض"],
    nutrition: NUTR("497 سعرة", "24غ", "15غ", "63غ", "26غ", "2.6غ", "5.8غ", "0.4غ"),
    packs: [
      { tier: "box", units: 28, price: 27, label: "علبة عرض — ٢٨ قطعة" },
      { tier: "carton", units: 12, price: 24, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 21.5, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 10, stock: 260, rating: 4.5, soldRank: 7,
    notes: ["جوز هند", "قرمشة", "صيفي"], seasonal: "الصيف",
  },
  {
    id: "p8", name: "بسكويت الليمون المنعش", latinName: "Lemon Biscuit Fingers", flavor: "ليمون وجلاز", family: "حمضيات", weight: "20 قطعة × 15غ",
    img: "https://image.qwenlm.ai/generated-images/b417e6ce-a99c-4e13-b319-4a71f052dc91/_result.png",
    ingredients: ["دقيق القمح", "سمن طبيعي", "سكر", "قشر ليمون طبيعي", "عصير ليمون مجفف"],
    nutrition: NUTR("478 سعرة", "22غ", "13غ", "66غ", "27غ", "1.1غ", "4.9غ", "0.3غ"),
    packs: [
      { tier: "box", units: 20, price: 33, label: "علبة عرض — ٢٠ قطعة" },
      { tier: "carton", units: 12, price: 29.5, label: "كرتونة — ١٢ علبة" },
      { tier: "pallet", units: 60, price: 26.5, label: "طبالية — ٦٠ كرتونة" },
    ],
    moqCartons: 5, stock: 180, rating: 4.6, badge: "جديد", soldRank: 8,
    notes: ["ليمون منعش", "جلاز", "خفيف"], seasonal: "الصيف",
  },
];

// ─── المواد الخام (موردون مصريون + تكلفة الوحدة بالجنيه) ─────────────────────
export const RAW_MATERIALS: RawMaterial[] = [
  { id: "rm1", name: "دقيق قمح فاخر", unit: "كيس ٥٠ كجم", qty: 140, reorderPoint: 80, capacity: 400, supplier: "مطاحن شمال القاهرة", costPerUnit: 1450 },
  { id: "rm2", name: "سكر ناعم", unit: "كيس ٥٠ كجم", qty: 62, reorderPoint: 40, capacity: 200, supplier: "الدلتا للسكر — الحوامدية", costPerUnit: 1620 },
  { id: "rm3", name: "سمن طبيعي", unit: "صفيحة ٢٠ كجم", qty: 18, reorderPoint: 25, capacity: 120, supplier: "المصرية لمنتجات الألبان", costPerUnit: 2850 },
  { id: "rm4", name: "رقائق شوكولاتة", unit: "كرتونة ١٥ كجم", qty: 34, reorderPoint: 20, capacity: 100, supplier: "كارجيل مصر", costPerUnit: 3200 },
  { id: "rm5", name: "سمسم محمص", unit: "كيس ٢٥ كجم", qty: 26, reorderPoint: 15, capacity: 90, supplier: "شركة النصر للحاصلات", costPerUnit: 2100 },
  { id: "rm6", name: "عجوة بلح", unit: "كرتونة ١٠ كجم", qty: 44, reorderPoint: 30, capacity: 150, supplier: "الوادي الجديد للتمور", costPerUnit: 950 },
  { id: "rm7", name: "نخالة قمح", unit: "كيس ٢٥ كجم", qty: 21, reorderPoint: 18, capacity: 80, supplier: "حبوب مصر للاستيراد", costPerUnit: 640 },
  { id: "rm8", name: "عبوات كرتونية مطبوعة", unit: "حزمة ١٠٠", qty: 310, reorderPoint: 150, capacity: 900, supplier: "النيل للكرتون والتغليف", costPerUnit: 380 },
];

// ─── دفعات الإنتاج (تواريخ الإنتاج والصلاحية) ────────────────────────────────
export const BATCHES: Batch[] = [
  { id: "b1", lot: "LOT-0241", productId: "p1", producedAt: dateKey(addDays(t0, -12)), expiryDays: 180, qty: 220 },
  { id: "b2", lot: "LOT-0242", productId: "p6", producedAt: dateKey(addDays(t0, -8)), expiryDays: 150, qty: 160 },
  { id: "b3", lot: "LOT-0238", productId: "p3", producedAt: dateKey(addDays(t0, -150)), expiryDays: 160, qty: 340 },
  { id: "b4", lot: "LOT-0240", productId: "p4", producedAt: dateKey(addDays(t0, -20)), expiryDays: 90, qty: 120 },
  { id: "b5", lot: "LOT-0243", productId: "p2", producedAt: dateKey(addDays(t0, -5)), expiryDays: 120, qty: 190 },
  { id: "b6", lot: "LOT-0236", productId: "p5", producedAt: dateKey(addDays(t0, -170)), expiryDays: 180, qty: 80 },
  { id: "b7", lot: "LOT-0244", productId: "p7", producedAt: dateKey(addDays(t0, -3)), expiryDays: 150, qty: 110 },
  { id: "b8", lot: "LOT-0239", productId: "p8", producedAt: dateKey(addDays(t0, -35)), expiryDays: 45, qty: 90 },
];

// ─── الطلبات (عملاء مصريون + محافظ) ─────────────────────────────────────────
export const ORDERS_SEED: Order[] = [
  {
    id: "OW-2419", customer: "أسواق العابد", customerPhone: "201007001122",
    lines: [{ productId: "p1", tier: "carton", qty: 40 }, { productId: "p4", tier: "carton", qty: 12 }],
    subtotal: 1540, discount: 108.5, deliveryFee: 0, total: 1431.5, status: "baking",
    placedAt: dateKey(addDays(t0, -1)), deliverOn: dateKey(addDays(t0, 2)), window: "08:00 – 12:00", payment: "transfer",
    governorate: "الجيزة", city: "الهرم",
  },
  {
    id: "OW-2418", customer: "شركة النور للتوزيع", customerPhone: "201005555555",
    lines: [{ productId: "p3", tier: "pallet", qty: 1 }, { productId: "p7", tier: "carton", qty: 24 }],
    subtotal: 1716, discount: 127.5, deliveryFee: 0, total: 1588.5, status: "pending",
    placedAt: todayKey(), deliverOn: dateKey(addDays(t0, 3)), window: "12:00 – 16:00", payment: "cod",
    governorate: "القاهرة", city: "العبور",
  },
  {
    id: "OW-2417", customer: "بقالة الحاج سيد", customerPhone: "201287654321",
    lines: [{ productId: "p6", tier: "carton", qty: 8 }],
    subtotal: 284, discount: 0, deliveryFee: 35, total: 319, status: "shipped",
    placedAt: dateKey(addDays(t0, -2)), deliverOn: dateKey(addDays(t0, 1)), window: "16:00 – 20:00", payment: "cod",
    governorate: "القاهرة", city: "شبرا",
  },
  {
    id: "OW-2416", customer: "فندق سفير الدقي", customerPhone: "201066554433",
    lines: [{ productId: "p4", tier: "carton", qty: 15 }, { productId: "p8", tier: "carton", qty: 10 }],
    subtotal: 895, discount: 44.75, deliveryFee: 0, total: 850.25, status: "delivered",
    placedAt: dateKey(addDays(t0, -5)), deliverOn: dateKey(addDays(t0, -3)), window: "08:00 – 12:00", payment: "transfer",
    governorate: "الجيزة", city: "الدقي",
  },
  {
    id: "OW-2415", customer: "سوبر ماركت الأسرة", customerPhone: "201113332211",
    lines: [{ productId: "p2", tier: "carton", qty: 22 }, { productId: "p5", tier: "carton", qty: 14 }],
    subtotal: 1054, discount: 52.7, deliveryFee: 0, total: 1001.3, status: "delivered",
    placedAt: dateKey(addDays(t0, -7)), deliverOn: dateKey(addDays(t0, -5)), window: "12:00 – 16:00", payment: "gateway",
    governorate: "الإسكندرية", city: "سموحة",
  },
];

// ─── سجل التدقيق (سلسلة تجزئة غير قابلة للعبث) ──────────────────────────────
const AUDIT_RAW = [
  { id: "au1", at: dateKey(addDays(t0, -1)) + " 09:14", actor: "هالة عبد العظيم", role: "hr" as const, action: "اعتماد مسير رواتب", detail: `اعتماد مسير ${prevMonthKey(monthKeyOf(t0))} وإصدار ١٢ قسيمة راتب بالجنيه` },
  { id: "au2", at: dateKey(addDays(t0, -1)) + " 07:02", actor: "سيد رمضان", role: "production" as const, action: "استلام مواد خام", detail: "استلام ٦٠ كيس دقيق قمح من مطاحن شمال القاهرة" },
  { id: "au3", at: dateKey(addDays(t0, -1)) + " 11:40", actor: "مصطفى حسان", role: "sales" as const, action: "تحديث حالة طلب", detail: "OW-2417 ← تم الشحن إلى بقالة الحاج سيد (شبرا)" },
  { id: "au4", at: dateKey(addDays(t0, -2)) + " 13:25", actor: "أيمن الكردي", role: "super" as const, action: "تعديل راتب أساسي", detail: "تعديل راتب نادية فتحي إلى 6,200 ج.م (مراجعة أداء)" },
  { id: "au5", at: dateKey(addDays(t0, -2)) + " 08:51", actor: "هالة عبد العظيم", role: "hr" as const, action: "تسجيل سلفة", detail: "سلفة ٨٠٠ ج.م لنادية فتحي — ستُخصم من مسير الشهر" },
  { id: "au6", at: dateKey(addDays(t0, -3)) + " 16:10", actor: "سيد رمضان", role: "production" as const, action: "إدخال حضور يدوي", detail: "إدخال يدوي بواسطة المشرف لمصطفى حسان (تعطل قارئ الباركود)" },
  { id: "au7", at: dateKey(addDays(t0, -4)) + " 10:33", actor: "سيد رمضان", role: "production" as const, action: "تنبيه صلاحية", detail: "LOT-0239 (بسكويت الليمون) يدخل نافذة التنبيه قبل الانتهاء" },
  { id: "au8", at: dateKey(addDays(t0, -5)) + " 12:18", actor: "أيمن الكردي", role: "super" as const, action: "إنشاء طلب جملة", detail: "OW-2416 لفندق سفير الدقي — ٢٥ كرتونة، خصم ٥٪" },
];
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

// ─── سلسلة الإيرادات (١٢ شهرًا — بالآلاف ج.م) ────────────────────────────────
export const REVENUE_SERIES = [
  { month: 3, revenue: 412, payroll: 96 }, { month: 4, revenue: 388, payroll: 96 },
  { month: 5, revenue: 455, payroll: 98 }, { month: 6, revenue: 512, payroll: 99 },
  { month: 7, revenue: 489, payroll: 101 }, { month: 8, revenue: 534, payroll: 102 },
  { month: 9, revenue: 571, payroll: 103 }, { month: 10, revenue: 602, payroll: 104 },
  { month: 11, revenue: 648, payroll: 106 }, { month: 12, revenue: 719, payroll: 108 },
  { month: 13, revenue: 692, payroll: 108 }, { month: 14, revenue: 661, payroll: 109 },
].map((r) => ({
  ...r,
  production: Math.round(r.revenue * 0.82),
  materials: Math.round(r.revenue * 0.61), // تكلفة الخامات والتشغيل
}));

export const BESTSELLERS = [
  { name: "بسكويت الشاي", sold: 1240 },
  { name: "الدايجستيف", sold: 986 },
  { name: "السمسمية", sold: 872 },
  { name: "معمول العجوة", sold: 640 },
  { name: "كريم ساندويتش", sold: 512 },
];
