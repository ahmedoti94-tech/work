import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { COMPANY } from "../lib/data";
import { downloadCSV, fmtDateShort, fmtMoney0, isValidEgyptianPhone } from "../lib/payroll";
import { fnvHex, qrCells } from "../lib/crypto";
import { useStore } from "../lib/store";
import type { Employee, ShiftKey, WageType } from "../lib/types";
import { Avatar, Badge, Btn, Field, Icon, Modal, SectionHead, inputCls, type BadgeTone } from "../components/ui";

const DEPTS = ["الإدارة", "الإنتاج", "التغليف", "المخازن", "الجودة", "الصيانة", "المالية", "التوزيع"];
const SHIFTS: { key: ShiftKey; label: string }[] = [
  { key: "morning", label: "صباحية ٦ص–٢م" },
  { key: "evening", label: "مسائية ٢م–١٠م" },
  { key: "night", label: "ليلية ١٠م–٦ص" },
];

function barcodeStyle(seed: string) {
  const h = fnvHex(seed);
  // أعمدة حتمية من التجزئة — شكل باركود ثابت لكل عامل
  const segs: string[] = [];
  for (let i = 0; i < 24; i++) {
    const d = parseInt(h[i % h.length], 16);
    segs.push(`${(d % 3) + 1}px`);
  }
  const stops = segs
    .map((w, i) => {
      const start = segs.slice(0, i).reduce((s, x) => s + parseInt(x) + 2, 0);
      return `currentColor ${start}px ${start + parseInt(w)}px, transparent ${start + parseInt(w)}px ${start + parseInt(w) + 2}px`;
    })
    .join(", ");
  return { background: `repeating-linear-gradient(90deg, ${stops})` } as const;
}

function QrGlyph({ seed, size = 96 }: { seed: string; size?: number }) {
  const n = 21;
  const cells = qrCells(seed, n);
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} className="rounded-md border border-line bg-cream p-1 text-ink" shapeRendering="crispEdges">
      {cells.map((on, i) => on && <rect key={i} x={i % n} y={Math.floor(i / n)} width="1" height="1" fill="currentColor" />)}
      <rect x="0" y="0" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x={n - 5} y="0" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="0" y={n - 5} width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export default function Workers() {
  const { employees, addWorker, updateWorker, archiveWorker, toast, user, auditLog } = useStore();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("الكل");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [adding, setAdding] = useState(false);
  const [cardEmp, setCardEmp] = useState<Employee | null>(null);

  const list = useMemo(
    () => employees.filter(
      (e) => (showArchived || !e.archived)
        && (dept === "الكل" || e.dept === dept)
        && (e.name + e.title).includes(q)
    ),
    [employees, q, dept, showArchived]
  );
  const activeAll = employees.filter((e) => e.active);
  const monthlyTotal = activeAll.filter((e) => e.wageType === "monthly").reduce((s, e) => s + e.baseSalary, 0);

  const exportWorkers = () => {
    downloadCSV("سجل-العمال.csv", [
      ["سجل العمال — " + COMPANY.name],
      ["الاسم", "المسمى الوظيفي", "القسم", "الوردية", "نوع الأجر", "الراتب/اليومية (ج.م)", "الهاتف", "تاريخ التعيين", "الحالة"],
      ...list.map((e) => [
        e.name, e.title, e.dept,
        e.shift === "morning" ? "صباحية" : e.shift === "evening" ? "مسائية" : "ليلية",
        e.wageType === "monthly" ? "شهري" : "يومي",
        e.wageType === "monthly" ? e.baseSalary : e.dailyRate ?? 0,
        e.phone, e.joinDate, e.archived ? "مؤرشف" : "نشط",
      ]),
    ]);
    toast("نُزّل سجل العمال بصيغة Excel — جاهز للأرشفة", "sage");
  };

  return (
    <div>
      <SectionHead
        title="بوابة العمال"
        desc="بيانات العمال والأجور والشيفتات — كل إضافة تولّد بطاقة عمل ورمز QR موقّعًا فورًا"
        actions={
          <>
            <Btn variant="outline" onClick={exportWorkers}><Icon name="sheet" size={15} /> تصدير السجل</Btn>
            <Btn size="lg" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> إضافة عامل جديد</Btn>
          </>
        }
      />

      {/* مؤشرات القوى العاملة */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: "إجمالي العمال", v: employees.length, s: "شامل المؤرشفين", tone: "" },
          { l: "نشطون في الورديات", v: activeAll.length, s: "يُسجَّل حضورهم ويوميًا", tone: "text-sage" },
          { l: "بالأجر اليومي", v: activeAll.filter((e) => e.wageType === "daily").length, s: "يومية × أيام الحضور", tone: "text-butter" },
          { l: "إجمالي الرواتب الشهرية", v: fmtMoney0(monthlyTotal), s: "قبل الإضافي والخصومات", tone: "text-brand" },
        ].map((c, i) => (
          <motion.div key={c.l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="card px-4 py-3.5">
            <p className="label-xs">{c.l}</p>
            <p className={`num mt-1 font-display text-[20px] font-bold leading-none ${c.tone}`}>{c.v}</p>
            <p className="mt-1 text-[10.5px] font-semibold text-mute">{c.s}</p>
          </motion.div>
        ))}
      </div>

      {/* الفلاتر */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon name="search" size={14} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو المسمى…"
            className={`${inputCls} w-52 py-1.5 ps-8 text-[12.5px]`} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["الكل", ...DEPTS].map((d) => (
            <button key={d} onClick={() => setDept(d)}
              className={`btn-press rounded-full border px-3 py-1 text-[11.5px] font-bold ${dept === d ? "border-brand bg-brand text-cream" : "border-line bg-surface text-mute hover:text-ink"}`}>
              {d}
            </button>
          ))}
        </div>
        <button onClick={() => setShowArchived(!showArchived)}
          className={`btn-press ms-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-bold ${showArchived ? "border-berry/40 bg-berry/10 text-berry" : "border-line bg-surface text-mute"}`}>
          <Icon name="logout" size={12} /> إظهار المؤرشفين ({employees.filter((e) => e.archived).length})
        </button>
      </div>

      {/* الجدول */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] font-bold text-mute">
                <th className="px-4 py-3 text-start">العامل</th>
                <th className="px-3 py-3 text-start">المسمى والقسم</th>
                <th className="px-3 py-3 text-start">الوردية</th>
                <th className="px-3 py-3 text-start">الأجر</th>
                <th className="px-3 py-3 text-start">التعيين</th>
                <th className="px-4 py-3 text-start">الحالة</th>
                <th className="px-4 py-3 text-start">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className={`border-b border-line/60 last:border-0 hover:bg-raise/60 ${e.archived ? "opacity-55" : ""}`}>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={e.name} size={34} />
                      <span className="leading-tight">
                        <span className="block font-bold">{e.name}</span>
                        <span className="num block text-[10.5px] text-mute" dir="ltr">+{e.phone}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="block font-semibold">{e.title}</span>
                    <span className="text-[10.5px] text-mute">{e.dept}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={e.shift === "morning" ? "butter" : e.shift === "evening" ? "brand" : "cocoa"}>
                      {e.shift === "morning" ? "صباحية" : e.shift === "evening" ? "مسائية" : "ليلية"}
                    </Badge>
                  </td>
                  <td className="num px-3 py-2.5 font-bold">
                    {e.wageType === "daily" ? `${fmtMoney0(e.dailyRate ?? 0)} /يوم` : fmtMoney0(e.baseSalary)}
                    <span className="block text-[10px] font-semibold text-mute">{e.wageType === "daily" ? "أجر يومي" : "راتب شهري"}</span>
                  </td>
                  <td className="num px-3 py-2.5 text-mute">{e.joinDate}</td>
                  <td className="px-4 py-2.5">
                    {e.archived ? <Badge tone="mute">مؤرشف</Badge> : e.active ? <Badge tone="sage">نشط</Badge> : <Badge tone="mute">موقوف</Badge>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex gap-1.5">
                      <Btn size="sm" variant="outline" onClick={() => setCardEmp(e)} title="بطاقة العمل والـQR">
                        <Icon name="idcard" size={14} /> بطاقة
                      </Btn>
                      {!e.archived && (
                        <>
                          <Btn size="sm" variant="ghost" onClick={() => setEditing(e)} title="تعديل البيانات">
                            <Icon name="edit" size={14} />
                          </Btn>
                          <Btn size="sm" variant="ghost" className="text-berry" onClick={() => archiveWorker(e.id)} title="أرشفة">
                            <Icon name="logout" size={14} />
                          </Btn>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="p-10 text-center text-[13px] font-semibold text-mute">لا يوجد عمال مطابقون للبحث</p>}
        </div>
      </div>

      <WorkerForm
        open={adding || !!editing}
        initial={editing}
        onClose={() => { setAdding(false); setEditing(null); }}
        onSave={(data) => {
          if (editing) {
            updateWorker(editing.id, data);
          } else {
            const emp = addWorker(data);
            setCardEmp(emp); // البطاقة والـQR فور الإضافة
          }
          setAdding(false); setEditing(null);
        }}
      />

      <IdCardModal emp={cardEmp} onClose={() => setCardEmp(null)} />
    </div>
  );
}

/* ─── نموذج الإضافة/التعديل مع تحقق من الرقم المصري ─── */
function WorkerForm({ open, initial, onClose, onSave }: {
  open: boolean; initial: Employee | null; onClose: () => void;
  onSave: (d: { name: string; phone: string; title: string; dept: string; shift: ShiftKey; wageType: WageType; baseSalary: number; dailyRate?: number }) => void;
}) {
  const [f, setF] = useState({
    name: "", phone: "201", title: "", dept: "الإنتاج", shift: "morning" as ShiftKey,
    wageType: "monthly" as WageType, baseSalary: "6000", dailyRate: "200",
  });
  const [key, setKey] = useState("");

  // إعادة التهيئة عند الفتح
  const formKey = open ? (initial?.id ?? "new") : "closed";
  if (open && key !== formKey) {
    setKey(formKey);
    setF({
      name: initial?.name ?? "", phone: initial?.phone ?? "201", title: initial?.title ?? "",
      dept: initial?.dept ?? "الإنتاج", shift: initial?.shift ?? "morning",
      wageType: initial?.wageType ?? "monthly",
      baseSalary: initial ? String(initial.baseSalary) : "6000",
      dailyRate: initial?.dailyRate ? String(initial.dailyRate) : "200",
    });
  }

  const phoneOk = isValidEgyptianPhone(f.phone);
  const money = f.wageType === "monthly" ? Number(f.baseSalary) : Number(f.dailyRate);
  const valid = f.name.trim().length >= 5 && f.title.trim().length >= 3 && phoneOk && money > 0;

  return (
    <Modal open={open} onClose={onClose} title={initial ? `تعديل بيانات — ${initial.name}` : "إضافة عامل جديد"} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم الرباعي">
          <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="مثال: محمد أحمد عبد العزيز" />
        </Field>
        <Field label="المسمى الوظيفي">
          <input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="مثال: عامل خط إنتاج" />
        </Field>
        <Field label="القسم">
          <select className={inputCls} value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })}>
            {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="الوردية">
          <select className={inputCls} value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value as ShiftKey })}>
            {SHIFTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="رقم الموبايل المصري">
          <input dir="ltr" className={`${inputCls} num text-start ${f.phone.length > 3 && !phoneOk ? "border-berry" : phoneOk ? "border-sage" : ""}`}
            value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="2010XXXXXXXX" />
          <p className={`mt-1 flex items-center gap-1 text-[10.5px] font-bold ${phoneOk ? "text-sage" : "text-mute"}`}>
            {phoneOk ? <><Icon name="check" size={11} /> رقم صحيح (+20 1X XXXX XXXX)</> : "الصيغة: 2010 أو 2011 أو 2012 أو 2015 ثم ٨ أرقام"}
          </p>
        </Field>
        <div>
          <p className="label-xs mb-1.5">نوع الأجر</p>
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-line bg-raise p-1.5">
            {(["monthly", "daily"] as WageType[]).map((w) => (
              <button key={w} onClick={() => setF({ ...f, wageType: w })}
                className={`btn-press rounded-lg px-3 py-2 text-[12.5px] font-bold ${f.wageType === w ? "bg-brand text-cream shadow-warm" : "text-mute hover:text-ink"}`}>
                {w === "monthly" ? "راتب شهري" : "أجر يومي (يومية)"}
              </button>
            ))}
          </div>
        </div>
        <Field label={f.wageType === "monthly" ? "الراتب الشهري (ج.م)" : "اليومية (ج.م/يوم)"}>
          <input type="number" min={0} step={50} dir="ltr" className={`${inputCls} num text-start`}
            value={f.wageType === "monthly" ? f.baseSalary : f.dailyRate}
            onChange={(e) => setF(f.wageType === "monthly" ? { ...f, baseSalary: e.target.value } : { ...f, dailyRate: e.target.value })} />
          <p className="mt-1 text-[10.5px] font-bold text-mute">
            {f.wageType === "daily"
              ? `تعادل ≈ ${fmtMoney0(Number(f.dailyRate || 0) * 26)} شهريًا (٢٦ يوم عمل)`
              : `تعادل ≈ ${fmtMoney0(Number(f.baseSalary || 0) / 26)} يوميًا`}
          </p>
        </Field>
        <div className="flex items-end rounded-xl border border-dashed border-line bg-raise/60 px-3.5 py-2.5">
          <p className="text-[11px] font-bold leading-relaxed text-mute">
            <Icon name="qr" size={14} className="me-1 inline text-brand" />
            عند الحفظ يُنشأ رمز دخول مبدئي <b className="num" dir="ltr">1234</b> وبطاقة عمل بـQR موقّع HMAC — تُطبع وتُسلَّم للعامل فورًا.
          </p>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
        <Btn size="lg" disabled={!valid} onClick={() => onSave({
          name: f.name.trim(), phone: f.phone.trim(), title: f.title.trim(), dept: f.dept,
          shift: f.shift, wageType: f.wageType,
          baseSalary: f.wageType === "monthly" ? Number(f.baseSalary) : 0,
          dailyRate: f.wageType === "daily" ? Number(f.dailyRate) : undefined,
        })}>
          <Icon name={initial ? "check" : "plus"} size={16} /> {initial ? "حفظ التعديلات" : "إضافة وتوليد البطاقة"}
        </Btn>
      </div>
    </Modal>
  );
}

/* ─── بطاقة العمل القابلة للطباعة ─── */
function IdCardModal({ emp, onClose }: { emp: Employee | null; onClose: () => void }) {
  if (!emp) return null;
  const code = `EMP-${emp.id.replace(/\D/g, "").padStart(3, "0")}`;
  return (
    <Modal open={!!emp} onClose={onClose} title="بطاقة العمل — جاهزة للطباعة">
      <div id="print-area" className="overflow-hidden rounded-2xl border-2 border-brand/40 bg-surface shadow-lift">
        <div className="hatch flex items-center justify-between bg-ink px-5 py-3 text-bg">
          <div className="leading-tight">
            <p className="font-display text-[14px] font-bold">{COMPANY.name}</p>
            <p className="text-[9.5px] font-semibold opacity-70">{COMPANY.hq}</p>
          </div>
          <span className="rounded-md bg-butter px-2.5 py-1 font-display text-[11px] font-bold text-sunken">بطاقة عامل</span>
        </div>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-4">
            <Avatar name={emp.name} size={64} />
            <div className="leading-snug">
              <p className="font-display text-[17px] font-bold">{emp.name}</p>
              <p className="text-[12px] font-semibold text-mute">{emp.title} — قسم {emp.dept}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={emp.shift === "morning" ? "butter" : emp.shift === "evening" ? "brand" : "cocoa"}>
                  وردية {emp.shift === "morning" ? "صباحية" : emp.shift === "evening" ? "مسائية" : "ليلية"}
                </Badge>
                <Badge tone="mute">{emp.wageType === "daily" ? "أجر يومي" : "راتب شهري"}</Badge>
                <Badge tone="mute">تعيين {emp.joinDate}</Badge>
              </div>
              <p className="num mt-2 text-[11px] font-bold text-brand" dir="ltr">{code}</p>
              <div className="mt-1 h-8 w-44 text-ink" style={barcodeStyle(emp.id)} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <QrGlyph seed={fnvHex(emp.id + "-badge-v1")} size={104} />
            <p className="text-[9.5px] font-bold text-mute">QR موقّع HMAC-SHA256</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line bg-raise/70 px-5 py-2.5">
          <p className="text-[9.5px] font-semibold text-mute">البطاقة ملك للشركة وتُعاد عند انتهاء الخدمة · الرمز اللحظي للبوابات يدور كل ٩٠ ثانية من التطبيق</p>
          <p className="num text-[9.5px] font-bold text-mute" dir="ltr">TAX {COMPANY.taxId}</p>
        </div>
      </div>
      <div className="no-print mt-4 flex flex-wrap justify-end gap-2">
        <Btn variant="outline" onClick={onClose}>إغلاق</Btn>
        <Btn onClick={() => window.print()}><Icon name="printer" size={16} /> طباعة البطاقة</Btn>
      </div>
    </Modal>
  );
}
