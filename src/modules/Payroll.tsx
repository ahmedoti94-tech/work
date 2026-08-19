import { useMemo, useState } from "react";
import {
  computePayroll, downloadCSV, fmtDateShort, fmtMoney, fmtMoney0, monthKeyNow,
  monthLabel, prevMonthKey, round2, todayKey, waLink,
} from "../lib/payroll";
import { useStore } from "../lib/store";
import type { Employee, PayrollResult } from "../lib/types";
import { Avatar, Badge, Btn, Field, Icon, Modal, SectionHead, inputCls } from "../components/ui";

export default function Payroll() {
  const { employees, attendance, leaves, advances, finalizedMonths, finalizePayroll, addAdvance, adjustSalary, user, toast } = useStore();
  const [month, setMonth] = useState(monthKeyNow());
  const [slip, setSlip] = useState<{ emp: Employee; res: PayrollResult } | null>(null);
  const [advEmp, setAdvEmp] = useState("e5");
  const [advAmt, setAdvAmt] = useState("300");
  const [advNote, setAdvNote] = useState("سلفة طارئة");
  const [salaryEmp, setSalaryEmp] = useState<Employee | null>(null);
  const [salaryVal, setSalaryVal] = useState("");

  const active = employees.filter((e) => e.active);
  const results = useMemo(
    () => active.map((emp) => ({ emp, res: computePayroll(emp, month, attendance, leaves, advances) })),
    [active, month, attendance, leaves, advances]
  );
  const totals = useMemo(() => ({
    net: round2(results.reduce((s, r) => s + r.res.net, 0)),
    ot: round2(results.reduce((s, r) => s + r.res.otPay, 0)),
    ded: round2(results.reduce((s, r) => s + r.res.lateDeduction + r.res.advancesTotal, 0)),
  }), [results]);

  const isCurrent = month === monthKeyNow();
  const finalized = finalizedMonths.includes(month);
  const months = [monthKeyNow(), prevMonthKey(monthKeyNow())];

  const exportSheet = () => {
    const rows: (string | number)[][] = [
      [`مسير الرواتب — ${monthLabel(month)}`],
      ["الاسم", "المسمى", "أيام الحضور", "الراتب الأساسي", "إضافي", "خصم تأخير", "سلف", "إجمالي الاستحقاق", "الصافي"],
      ...results.map(({ emp, res }) => [
        emp.name, emp.title, res.presentDays + res.paidLeaveDays, emp.baseSalary, res.otPay,
        res.lateDeduction, res.advancesTotal, res.gross, res.net,
      ]),
      ["الإجمالي", "", "", "", totals.ot, "", "", "", totals.net],
    ];
    downloadCSV(`مسير-الرواتب-${month}.csv`, rows);
    toast("تم تنزيل مسير الرواتب بصيغة Excel (CSV) جاهز للطباعة", "sage");
  };

  const sendSlipWhatsApp = (emp: Employee, res: PayrollResult) => {
    const text =
      `قسيمة راتب — ${monthLabel(month)}\nالشركة المصرية للصناعات الغذائية\n\n` +
      `الاسم: ${emp.name}\nالمسمى: ${emp.title}\n\n` +
      `أيام الحضور: ${res.presentDays} من ${res.workDays}\n` +
      `الراتب الأساسي: ${fmtMoney(res.baseEarned)}\n` +
      `وقت إضافي: ${fmtMoney(res.otPay)}\n` +
      `خصم تأخير: ${fmtMoney(res.lateDeduction)}\n` +
      `سلف: ${fmtMoney(res.advancesTotal)}\n\n` +
      `صافي الراتب: ${fmtMoney(res.net)}\n\nشكرًا لعطائك`;
    window.open(waLink(emp.phone, text), "_blank");
    toast(`جارٍ فتح واتساب لإرسال قسيمة ${emp.name} رقميًا`, "sage");
  };

  return (
    <div>
      <SectionHead
        title="مسير الرواتب"
        desc="حساب تلقائي: الأساسي ÷ أيام العمل × الحضور + إضافي ×١٫٥ − تأخير وسلف"
        actions={
          <>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputCls} w-auto py-2 text-[13px] font-bold`}>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}{finalizedMonths.includes(m) ? " — معتمد" : ""}</option>)}
            </select>
            <Btn variant="outline" onClick={exportSheet}><Icon name="sheet" size={16} /> تصدير Excel / طباعة</Btn>
            <Btn variant="sage" size="lg" disabled={!isCurrent || finalized} onClick={() => finalizePayroll(month)}>
              <Icon name="stamp" size={17} /> حساب رواتب الشهر بنقرة واحدة
            </Btn>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {finalized ? (
          <Badge tone="sage" className="py-1.5"><Icon name="check" size={13} /> المسير معتمد — صدرت {results.length} قسيمة وسُوّيت السلف</Badge>
        ) : isCurrent ? (
          <Badge tone="butter" className="py-1.5"><Icon name="clock" size={13} /> مسودة — الشهر ما زال جارٍ، الأرقام تتحدث يوميًا</Badge>
        ) : (
          <Badge tone="mute" className="py-1.5">عرض تاريخي للشهر السابق</Badge>
        )}
        <span className="ms-auto text-[12.5px] font-bold text-mute">
          صافي المسير: <b className="num text-ink">{fmtMoney0(totals.net)}</b> · إضافي <b className="num text-sage">{fmtMoney0(totals.ot)}</b> · استقطاعات <b className="num text-berry">{fmtMoney0(totals.ded)}</b>
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card overflow-hidden xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold text-mute">
                  <th className="px-4 py-3 text-start">الموظف</th>
                  <th className="px-3 py-3 text-start">الأساسي</th>
                  <th className="px-3 py-3 text-start">حضور</th>
                  <th className="px-3 py-3 text-start">إضافي</th>
                  <th className="px-3 py-3 text-start">استقطاعات</th>
                  <th className="px-3 py-3 text-start">الصافي</th>
                  <th className="px-4 py-3 text-start">القسيمة</th>
                </tr>
              </thead>
              <tbody>
                {results.map(({ emp, res }) => (
                  <tr key={emp.id} className="border-b border-line/60 last:border-0 hover:bg-raise/60">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={emp.name} size={32} />
                        <span className="leading-tight">
                          <span className="block font-bold">{emp.name}</span>
                          <span className="block text-[10.5px] text-mute">{emp.title}</span>
                        </span>
                      </span>
                    </td>
                    <td className="num px-3 py-2.5">{fmtMoney0(emp.baseSalary)}</td>
                    <td className="num px-3 py-2.5">{res.presentDays + res.paidLeaveDays}<span className="text-mute">/{res.workDays}</span></td>
                    <td className="num px-3 py-2.5 text-sage">{res.otPay > 0 ? `+${fmtMoney0(res.otPay)}` : "—"}</td>
                    <td className="num px-3 py-2.5 text-berry">{res.lateDeduction + res.advancesTotal > 0 ? `−${fmtMoney0(res.lateDeduction + res.advancesTotal)}` : "—"}</td>
                    <td className="num px-3 py-2.5 font-display text-[14px] font-bold">{fmtMoney0(res.net)}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex gap-1.5">
                        <Btn size="sm" variant="outline" onClick={() => setSlip({ emp, res })}><Icon name="printer" size={14} /> قسيمة</Btn>
                        <Btn size="sm" variant="whatsapp" onClick={() => sendSlipWhatsApp(emp, res)} title="إرسال رقمي"><Icon name="whatsapp" size={14} /></Btn>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          {/* السلف */}
          <div className="card p-5">
            <h3 className="font-display text-[15px] font-bold">نظام السلف والخصومات</h3>
            <p className="mt-0.5 text-[11.5px] text-mute">تُسجَّل هنا وتُخصم تلقائيًا من مسير الشهر عند الاعتماد</p>
            <div className="mt-3 space-y-3">
              <Field label="الموظف">
                <select className={inputCls} value={advEmp} onChange={(e) => setAdvEmp(e.target.value)}>
                  {active.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="المبلغ (ج.م)"><input type="number" className={`${inputCls} num`} value={advAmt} onChange={(e) => setAdvAmt(e.target.value)} min={50} step={50} /></Field>
                <Field label="السبب"><input className={inputCls} value={advNote} onChange={(e) => setAdvNote(e.target.value)} /></Field>
              </div>
              <Btn className="w-full" onClick={() => {
                const amt = Number(advAmt);
                if (!amt || amt < 50) { toast("أدخل مبلغًا صحيحًا (٥٠ ر.س فأكثر)", "berry"); return; }
                addAdvance(advEmp, amt, advNote || "سلفة");
              }}>
                <Icon name="plus" size={15} /> تسجيل سلفة الآن
              </Btn>
            </div>
            <div className="mt-4 border-t border-line pt-3">
              <p className="label-xs mb-2">السلف المفتوحة هذا الشهر</p>
              {advances.filter((a) => !a.settledMonth).length === 0 && <p className="text-[12px] font-semibold text-mute">لا توجد سلف مفتوحة</p>}
              <div className="space-y-1.5">
                {advances.filter((a) => !a.settledMonth).map((a) => {
                  const emp = employees.find((e) => e.id === a.empId);
                  return (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-line bg-raise px-3 py-2 text-[12px] font-semibold">
                      <span>{emp?.name} <span className="text-mute">— {a.note}</span></span>
                      <span className="num font-bold text-berry">{fmtMoney0(a.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* تعديل راتب (مدير النظام فقط) */}
          {user.role === "super" && (
            <div className="card p-5">
              <h3 className="flex items-center gap-2 font-display text-[15px] font-bold"><Icon name="shield" size={16} className="text-brand" /> تعديل راتب أساسي</h3>
              <p className="mt-0.5 text-[11.5px] text-mute">صلاحية المدير العام فقط — يُسجَّل في التدقيق (رقابة مزدوجة موصى بها)</p>
              <div className="mt-3 space-y-3">
                <Field label="الموظف">
                  <select className={inputCls} value={salaryEmp?.id ?? ""} onChange={(ev) => {
                    const emp = employees.find((x) => x.id === ev.target.value) ?? null;
                    setSalaryEmp(emp); setSalaryVal(emp ? String(emp.baseSalary) : "");
                  }}>
                    <option value="">اختر موظفًا…</option>
                    {active.map((e) => <option key={e.id} value={e.id}>{e.name} — {fmtMoney0(e.baseSalary)}</option>)}
                  </select>
                </Field>
                {salaryEmp && (
                  <>
                    <Field label="الراتب الجديد (ج.م)">
                      <input type="number" className={`${inputCls} num`} value={salaryVal} onChange={(e) => setSalaryVal(e.target.value)} step={100} />
                    </Field>
                    <Btn className="w-full" variant="butter" onClick={() => {
                      const v = Number(salaryVal);
                      if (!v || v < 1000) { toast("أدخل راتبًا صحيحًا", "berry"); return; }
                      adjustSalary(salaryEmp.id, v); setSalaryEmp(null);
                    }}>
                      <Icon name="edit" size={15} /> اعتماد التعديل
                    </Btn>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* القسيمة */}
      <Modal open={!!slip} onClose={() => setSlip(null)} title={`قسيمة راتب — ${slip ? monthLabel(slip.res.monthKey) : ""}`} wide>
        {slip && (
          <div id="print-area" className="rounded-xl border border-line bg-surface p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-xl font-bold">الشركة المصرية للصناعات الغذائية</p>
                <p className="text-[12px] text-mute">المنطقة الصناعية — ٦ أكتوبر، الجيزة · ب.ض 512-345-678 · س.ت ٤٥٦٧٨٩</p>
              </div>
              <span className="stamp-in rounded-lg border-2 border-brand px-3 py-1.5 font-display text-[13px] font-bold text-brand">
                {finalizedMonths.includes(slip.res.monthKey) ? "معتمدة" : "مسودة"}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["الموظف", slip.emp.name], ["المسمى", slip.emp.title],
                ["الشهر", monthLabel(slip.res.monthKey)], ["تاريخ الإصدار", fmtDateShort(todayKey())],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-line bg-raise px-3 py-2">
                  <p className="label-xs text-[9.5px]">{l}</p>
                  <p className="mt-0.5 text-[12.5px] font-bold">{v}</p>
                </div>
              ))}
            </div>

            <div className="perf mt-6 pt-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="label-xs mb-2">ملخص الحضور</p>
                  {[
                    ["أيام العمل في الشهر", String(slip.res.workDays)],
                    ["أيام الحضور", String(slip.res.presentDays)],
                    ["إجازة مدفوعة", String(slip.res.paidLeaveDays)],
                    ["غياب", String(slip.res.absentDays)],
                    ["وقت إضافي", `${slip.res.otHours} ساعة`],
                    ["تأخير", `${slip.res.lateMinutes} دقيقة`],
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between border-b border-dashed border-line py-1.5 text-[12.5px] font-semibold">
                      <span className="text-mute">{l}</span><span className="num font-bold">{v}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="label-xs mb-2">الاستحقاقات والاستقطاعات</p>
                  {slip.res.rows.map((r) => (
                    <div key={r.label} className="flex justify-between border-b border-dashed border-line py-1.5 text-[12.5px] font-semibold">
                      <span className="text-mute">{r.label}</span>
                      <span className={`num font-bold ${r.kind === "earn" ? "text-sage" : "text-berry"}`}>
                        {r.value >= 0 ? "+" : "−"}{fmtMoney(Math.abs(r.value))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl border-2 border-brand/40 bg-brand/6 px-4 py-3">
              <span className="font-display text-[15px] font-bold">صافي الراتب المستحق</span>
              <span className="num font-display text-2xl font-bold text-brand">{fmtMoney(slip.res.net)}</span>
            </div>

            <p className="mt-4 text-center text-[10.5px] text-mute">
              أُصدرت إلكترونيًا من نظام الشركة — للاستفسار تواصل مع الموارد البشرية · وثيقة {finalizedMonths.includes(slip.res.monthKey) ? "نهائية" : "مبدئية"}
            </p>
          </div>
        )}
        <div className="no-print mt-4 flex flex-wrap justify-end gap-2">
          <Btn variant="whatsapp" onClick={() => slip && sendSlipWhatsApp(slip.emp, slip.res)}>
            <Icon name="whatsapp" size={16} /> إرسال واتساب للموظف
          </Btn>
          <Btn onClick={() => window.print()}><Icon name="printer" size={16} /> طباعة / حفظ PDF</Btn>
        </div>
      </Modal>
    </div>
  );
}
