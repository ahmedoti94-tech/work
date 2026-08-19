import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SUPERVISOR_PHONE } from "../lib/data";
import {
  GRACE_MIN, OT_RATE, SHIFTS, dayStats, downloadCSV, fmtClock, fmtDateShort,
  fmtDur, fmtMin, pad2, todayKey, waLink, WEEKDAYS_AR, addDays, dateKey,
} from "../lib/payroll";
import { useStore } from "../lib/store";
import type { AttendanceRecord } from "../lib/types";
import { Avatar, Badge, Btn, Field, Icon, Modal, SectionHead, inputCls, type BadgeTone } from "../components/ui";

function statusOf(rec: AttendanceRecord | undefined, shift: keyof typeof SHIFTS): { label: string; tone: BadgeTone } {
  if (!rec || rec.in == null) return { label: "غائب", tone: "berry" };
  const st = dayStats(rec, shift);
  if (st.status === "open") return { label: "بالخدمة", tone: "brand" };
  if (st.status === "late") return { label: "متأخر", tone: "butter" };
  return { label: "حاضر", tone: "sage" };
}

export default function Attendance() {
  const { employees, attendance, punch, manualPunch, user, toast, offlineQueue, online } = useStore();
  const [clock, setClock] = useState(new Date());
  const [stamp, setStamp] = useState<{ type: "in" | "out"; t: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [mEmp, setMEmp] = useState("e2");
  const [mIn, setMIn] = useState("06:05");
  const [mOut, setMOut] = useState("");
  const [kiosk, setKiosk] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const date = todayKey();
  const myEmp = employees.find((e) => e.id === user.empId);
  const myRec = attendance.find((a) => a.empId === user.empId && a.date === date);
  const activeEmps = employees.filter((e) => e.active);

  const todayRecs = useMemo(
    () => activeEmps.map((e) => ({ emp: e, rec: attendance.find((a) => a.empId === e.id && a.date === date) })),
    [activeEmps, attendance, date]
  );
  const presentCount = todayRecs.filter((r) => r.rec?.in != null).length;
  const lateCount = todayRecs.filter((r) => r.rec && dayStats(r.rec, r.emp.shift).late > 0).length;

  const doPunch = (type: "in" | "out") => {
    if (!user.empId) return;
    const before = attendance.find((a) => a.empId === user.empId && a.date === date);
    const res = punch(user.empId, type);
    if (res && !(type === "in" && before?.in != null) && !(type === "out" && before?.out != null)) {
      setStamp({ type, t: fmtClock(new Date()).slice(0, 5) });
      setTimeout(() => setStamp(null), 2600);
    }
  };

  const simulateScan = () => {
    if (!user.empId || scanning) return;
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      doPunch(myRec?.in == null ? "in" : "out");
    }, 900);
  };

  const sendWhatsAppSummary = () => {
    const lines = todayRecs.map(({ emp, rec }) => {
      const st = statusOf(rec, emp.shift);
      const t = rec?.in != null ? `حضور ${fmtMin(rec.in)}${rec.out != null ? ` — انصراف ${fmtMin(rec.out)}` : ""}` : st.label;
      return `• ${emp.name}: ${t}`;
    });
    const text = `ملخص حضور ${fmtDateShort(date)} — مصنع أوفنرايت\n\nحاضرون: ${presentCount} من ${activeEmps.length} | متأخرون: ${lateCount}\n\n${lines.join("\n")}`;
    window.open(waLink(SUPERVISOR_PHONE, text), "_blank");
    toast("جارٍ فتح واتساب لإرسال ملخص الحضور اليومي للمشرف", "sage");
  };

  const exportRoster = () => {
    const rows: (string | number)[][] = [
      ["كشف الحضور اليومي", fmtDateShort(date)],
      ["الاسم", "المسمى", "الوردية", "الحضور", "الانصراف", "ساعات العمل", "إضافي", "تأخير", "الحالة"],
      ...todayRecs.map(({ emp, rec }) => {
        const st = dayStats(rec, emp.shift);
        return [
          emp.name, emp.title, SHIFTS[emp.shift].label,
          rec?.in != null ? fmtMin(rec.in) : "—", rec?.out != null ? fmtMin(rec.out) : "—",
          fmtDur(st.worked), fmtDur(st.ot), st.late > 0 ? `${st.late} دقيقة` : "—", statusOf(rec, emp.shift).label,
        ];
      }),
    ];
    downloadCSV(`كشف-الحضور-${date}.csv`, rows);
    toast("تم تنزيل كشف الحضور بصيغة Excel (CSV)", "sage");
  };

  const lastDays = Array.from({ length: 6 }, (_, i) => {
    const d = addDays(new Date(), -(5 - i));
    const key = dateKey(d);
    return { key, label: WEEKDAYS_AR[d.getDay()].slice(0, 5), rec: myEmp ? attendance.find((a) => a.empId === myEmp.id && a.date === key) : undefined };
  });

  return (
    <div>
      <SectionHead
        title="سجل الحضور والانصراف"
        desc="بوابة المصنع — تسجيل دقيق بالدقيقة، مع سماح تأخير ١٠ دقائق وإضافي ×١٫٥"
        actions={
          <>
            <Btn variant="butter" size="lg" onClick={() => setKiosk(true)}>
              <Icon name="kiosk" size={18} /> وضع الكشك (شاشة البوابة)
            </Btn>
            {(user.role === "hr" || user.role === "super" || user.role === "production") && (
              <>
                <Btn variant="whatsapp" onClick={sendWhatsAppSummary}>
                  <Icon name="whatsapp" size={16} /> ملخص اليوم للمشرف
                </Btn>
                <Btn variant="outline" onClick={exportRoster}>
                  <Icon name="sheet" size={16} /> تصدير Excel
                </Btn>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {/* ── بطاقة البصمة ── */}
        <div className="space-y-4 xl:col-span-2">
          <div className="card relative overflow-hidden p-5">
            {stamp && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface/70 backdrop-blur-[2px]">
                <div className={`stamp-in rounded-xl border-4 px-8 py-5 text-center ${stamp.type === "in" ? "border-sage text-sage" : "border-berry text-berry"}`}>
                  <p className="font-display text-3xl font-bold">{stamp.type === "in" ? "تم تسجيل الحضور" : "تم تسجيل الانصراف"}</p>
                  <p className="num mt-1 text-xl font-bold">{stamp.t}</p>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <div className="flex-1">
                <p className="label-xs">{fmtDateShort(date)} — {myEmp ? SHIFTS[myEmp.shift].label : "اختر هوية موظف للبصمة"}</p>
                <p className="num mt-1 font-display text-[52px] font-bold leading-none tracking-tight">{fmtClock(clock)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-mute">
                  <span className="chip">حضور: <b className="num">{myRec?.in != null ? fmtMin(myRec.in) : "—"}</b></span>
                  <span className="chip">انصراف: <b className="num">{myRec?.out != null ? fmtMin(myRec.out) : "—"}</b></span>
                  {myRec && myRec.in != null && (
                    <span className="chip">عمل اليوم: <b className="num">{fmtDur(dayStats(myRec, myEmp!.shift).worked)}</b></span>
                  )}
                  {!online && offlineQueue.length > 0 && (
                    <Badge tone="butter"><Icon name="wifiOff" size={12} /> {offlineQueue.length} تسجيل بانتظار المزامنة</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <Btn size="lg" variant="sage" disabled={myRec?.in != null} onClick={() => doPunch("in")} className="min-w-36 py-4 text-[16px]">
                  <Icon name="clock" size={20} /> تسجيل حضور
                </Btn>
                <Btn size="lg" variant="danger" disabled={myRec?.in == null || myRec?.out != null} onClick={() => doPunch("out")} className="min-w-36 py-4 text-[16px]">
                  <Icon name="logout" size={20} /> تسجيل انصراف
                </Btn>
              </div>
            </div>
            {/* آخر ٦ أيام */}
            {myEmp && (
              <div className="mt-5 flex items-center gap-2 border-t border-line pt-4">
                <span className="label-xs me-1">آخر ٦ أيام:</span>
                {lastDays.map((d) => {
                  const st = d.rec?.in != null ? (dayStats(d.rec, myEmp.shift).late > 0 ? "متأخر" : "حاضر") : "غائب";
                  const tone = st === "حاضر" ? "bg-sage" : st === "متأخر" ? "bg-butter" : "bg-berry";
                  return (
                    <span key={d.key} className="flex flex-col items-center gap-1" title={`${d.label}: ${st}`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
                      <span className="text-[10px] font-bold text-mute">{d.label}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── كشف اليوم ── */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="font-display text-[15px] font-bold">كشف اليوم — {fmtDateShort(date)}</h3>
              <div className="flex gap-2">
                <Badge tone="sage">حاضر {presentCount}</Badge>
                <Badge tone="butter">متأخر {lateCount}</Badge>
                <Badge tone="berry">غائب {activeEmps.length - presentCount}</Badge>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-start text-[11px] font-bold text-mute">
                    <th className="px-4 py-2.5 text-start">الموظف</th>
                    <th className="px-3 py-2.5 text-start">الوردية</th>
                    <th className="px-3 py-2.5 text-start">الحضور</th>
                    <th className="px-3 py-2.5 text-start">الانصراف</th>
                    <th className="px-3 py-2.5 text-start">العمل</th>
                    <th className="px-4 py-2.5 text-start">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {todayRecs.map(({ emp, rec }) => {
                    const st = dayStats(rec, emp.shift);
                    const badge = statusOf(rec, emp.shift);
                    return (
                      <tr key={emp.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-raise/60">
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2.5">
                            <Avatar name={emp.name} size={30} />
                            <span className="leading-tight">
                              <span className="block font-bold">{emp.name}</span>
                              <span className="block text-[10.5px] text-mute">{emp.title}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-mute">{SHIFTS[emp.shift].label.replace("الوردية ", "")}</td>
                        <td className="num px-3 py-2.5 font-semibold">{fmtMin(rec?.in ?? null)}</td>
                        <td className="num px-3 py-2.5 font-semibold">{fmtMin(rec?.out ?? null)}</td>
                        <td className="num px-3 py-2.5">{rec?.in != null ? fmtDur(st.worked) : "—"}</td>
                        <td className="px-4 py-2.5"><Badge tone={badge.tone}>{badge.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── العمود الجانبي ── */}
        <div className="space-y-4">
          <div className="card p-5 text-center">
            <p className="label-xs mb-3">قارئ البadge عند البوابة</p>
            <svg viewBox="0 0 11 11" className="mx-auto h-24 w-24 rounded-lg bg-cream p-2 text-ink dark:bg-sunken" shapeRendering="crispEdges">
              {Array.from({ length: 121 }, (_, i) => ((i * 7 + 3) % 5) < 2 && (
                <rect key={i} x={i % 11} y={Math.floor(i / 11)} width="1" height="1" fill="currentColor" />
              ))}
              <rect x="0" y="0" width="3" height="3" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="8" y="0" width="3" height="3" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="0" y="8" width="3" height="3" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
            <p className="mt-3 text-[12px] leading-relaxed text-mute">
              امسح بطاقة الموظف أو اضغط المحاكاة — يعمل أيضًا <b className="text-ink">دون اتصال</b> ويُزامَن تلقائيًا
            </p>
            <Btn variant="outline" className="mt-3 w-full" onClick={simulateScan} disabled={!user.empId || scanning}>
              {scanning ? <><span className="tick-dot"><Icon name="qr" size={16} /></span> جارٍ المسح…</> : <><Icon name="qr" size={16} /> محاكاة مسح البطاقة</>}
            </Btn>
          </div>

          {(user.role === "hr" || user.role === "super" || user.role === "production") && (
            <div className="card p-5">
              <h3 className="font-display text-[15px] font-bold">إدخال يدوي (مشرف)</h3>
              <p className="mt-0.5 text-[11.5px] text-mute">لحالات تعطل القارئ — يُسجَّل في التدقيق</p>
              <div className="mt-3 space-y-3">
                <Field label="الموظف">
                  <select className={inputCls} value={mEmp} onChange={(e) => setMEmp(e.target.value)}>
                    {activeEmps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="وقت الحضور"><input type="time" className={`${inputCls} num`} value={mIn} onChange={(e) => setMIn(e.target.value)} /></Field>
                  <Field label="وقت الانصراف (اختياري)"><input type="time" className={`${inputCls} num`} value={mOut} onChange={(e) => setMOut(e.target.value)} /></Field>
                </div>
                <Btn className="w-full" onClick={() => {
                  const [h1, m1] = mIn.split(":").map(Number);
                  const outMin = mOut ? mOut.split(":").map(Number)[0] * 60 + mOut.split(":").map(Number)[1] : null;
                  manualPunch(mEmp, date, h1 * 60 + m1, outMin);
                }}>
                  <Icon name="edit" size={15} /> حفظ الإدخال اليدوي
                </Btn>
              </div>
            </div>
          )}

          <div className="card p-5">
            <h3 className="font-display text-[15px] font-bold">قواعد الورديات</h3>
            <ul className="mt-3 space-y-2.5 text-[12.5px] font-semibold">
              {Object.values(SHIFTS).map((s) => (
                <li key={s.label} className="flex items-center justify-between rounded-lg border border-line bg-raise px-3 py-2">
                  <span>{s.label}</span><span className="num text-mute">{s.window}</span>
                </li>
              ))}
              <li className="flex items-center justify-between rounded-lg border border-line bg-raise px-3 py-2">
                <span>سماح التأخير</span><span className="num">{GRACE_MIN} دقائق</span>
              </li>
              <li className="flex items-center justify-between rounded-lg border border-line bg-raise px-3 py-2">
                <span>معامل الإضافي</span><span className="num">×{OT_RATE} بعد ٨ ساعات</span>
              </li>
              <li className="rounded-lg border border-line bg-raise px-3 py-2 leading-relaxed text-mute">
                يوم <b className="text-ink">الجمعة</b> عطلة رسمية للمصنع — لا يُحتسب ضمن أيام العمل
              </li>
            </ul>
          </div>
        </div>
      </div>

      <Kiosk open={kiosk} onClose={() => setKiosk(false)} />
    </div>
  );
}

/* ═══════════ وضع الكشك — شاشة البوابة بأزرار ضخمة ═══════════ */
function Kiosk({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { employees, attendance, punch, online, offlineQueue, toast } = useStore();
  const [step, setStep] = useState<"mode" | "emp" | "pin" | "done">("mode");
  const [type, setType] = useState<"in" | "out">("in");
  const [empId, setEmpId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const [doneInfo, setDoneInfo] = useState<{ name: string; t: string } | null>(null);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (open) { setStep("mode"); setPin(""); setEmpId(null); setErr(false); setDoneInfo(null); }
  }, [open]);

  const emp = employees.find((e) => e.id === empId);
  const active = employees.filter((e) => e.active);

  const pressKey = (k: string) => {
    if (k === "back") { setPin((p) => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        if (emp && next === emp.pin) {
          const t = new Date();
          punch(emp.id, type);
          setDoneInfo({ name: emp.name, t: `${pad2(t.getHours())}:${pad2(t.getMinutes())}` });
          setStep("done");
          setTimeout(() => { setStep("mode"); setPin(""); setEmpId(null); setDoneInfo(null); }, 2600);
        } else {
          setErr(true);
          toast("الرقم السري غير صحيح — حاول مجددًا", "berry");
          setTimeout(() => { setPin(""); setErr(false); }, 500);
        }
      }, 150);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] overflow-y-auto bg-[#1a110a] text-[#f1e5cf]"
        >
          <div className="dotgrid absolute inset-0 opacity-20" />
          <div className="relative mx-auto flex min-h-full max-w-3xl flex-col px-5 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/20 text-brand"><Icon name="kiosk" size={22} /></span>
                <div className="leading-tight">
                  <p className="font-display text-lg font-bold">بوابة المصنع</p>
                  <p className="text-[11px] font-semibold text-[#a08a69]">وضع الكشك — أزرار كبيرة لسرعة تبديل الورديات</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!online && <Badge tone="butter"><Icon name="wifiOff" size={12} /> دون اتصال — يُزامَن لاحقًا</Badge>}
                {offlineQueue.length > 0 && <Badge tone="butter">{offlineQueue.length} بالانتظار</Badge>}
                <button onClick={onClose} className="btn-press rounded-lg border border-[#3a2c1d] p-2 text-[#a08a69] hover:text-[#f1e5cf]" aria-label="خروج">
                  <Icon name="x" size={18} />
                </button>
              </div>
            </div>

            <p className="num mt-6 text-center font-display text-[64px] font-bold leading-none sm:text-[84px]">{fmtClock(clock)}</p>
            <p className="mt-2 text-center text-[13px] font-semibold text-[#a08a69]">{fmtDateShort(todayKey())} — الوردية {clock.getHours() < 14 ? "الصباحية" : clock.getHours() < 22 ? "المسائية" : "الليلية"}</p>

            <div className="mt-8 flex-1">
              {step === "mode" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <button onClick={() => { setType("in"); setStep("emp"); }}
                    className="btn-press group rounded-2xl border-2 border-sage/50 bg-sage/15 p-8 text-center hover:bg-sage/25">
                    <Icon name="clock" size={44} className="mx-auto text-sage transition-transform group-hover:scale-110" />
                    <p className="mt-4 font-display text-3xl font-bold text-sage">تسجيل حضور</p>
                    <p className="mt-1 text-[12.5px] font-semibold text-[#a08a69]">اضغط ثم اختر اسمك وأدخل رقمك السري</p>
                  </button>
                  <button onClick={() => { setType("out"); setStep("emp"); }}
                    className="btn-press group rounded-2xl border-2 border-berry/50 bg-berry/12 p-8 text-center hover:bg-berry/20">
                    <Icon name="logout" size={44} className="mx-auto text-berry transition-transform group-hover:scale-110" />
                    <p className="mt-4 font-display text-3xl font-bold text-berry">تسجيل انصراف</p>
                    <p className="mt-1 text-[12.5px] font-semibold text-[#a08a69]">اضغط ثم اختر اسمك وأدخل رقمك السري</p>
                  </button>
                </div>
              )}

              {step === "emp" && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-display text-xl font-bold">من أنت؟ اختر اسمك</p>
                    <Btn variant="ghost" onClick={() => setStep("mode")} className="hover:bg-[#2a1f16]"><Icon name="chevron" size={15} className="rotate-180" /> رجوع</Btn>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {active.map((e) => {
                      const rec = attendance.find((a) => a.empId === e.id && a.date === todayKey());
                      const done = type === "in" ? rec?.in != null : rec?.out != null || rec?.in == null;
                      return (
                        <button key={e.id} onClick={() => { setEmpId(e.id); setStep("pin"); }}
                          className={`btn-press rounded-xl border p-4 text-center transition-colors ${done ? "border-[#3a2c1d] bg-[#211811]/60 opacity-45" : "border-[#57432b] bg-[#2a1f16] hover:border-brand"}`}>
                          <Avatar name={e.name} size={52} className="mx-auto" />
                          <p className="mt-2.5 truncate text-[14px] font-bold">{e.name}</p>
                          <p className="text-[10.5px] font-semibold text-[#a08a69]">{e.title}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === "pin" && emp && (
                <div className="mx-auto max-w-sm text-center">
                  <button onClick={() => setStep("emp")} className="btn-press mb-4 text-[12.5px] font-bold text-[#a08a69] hover:text-[#f1e5cf]">
                    ← تغيير الموظف
                  </button>
                  <Avatar name={emp.name} size={64} className="mx-auto" />
                  <p className="mt-3 font-display text-xl font-bold">{emp.name}</p>
                  <p className="text-[12px] font-semibold text-[#a08a69]">أدخل رقمك السري ({type === "in" ? "تسجيل حضور" : "تسجيل انصراف"})</p>
                  <div className={`mx-auto mt-5 flex w-fit gap-3 ${err ? "shake" : ""}`}>
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className={`flex h-14 w-14 items-center justify-center rounded-xl border-2 text-2xl font-bold ${err ? "border-berry" : pin[i] ? "border-brand bg-brand/15 text-brand" : "border-[#57432b]"} num`}>
                        {pin[i] ? "•" : ""}
                      </span>
                    ))}
                  </div>
                  {err && <p className="mt-2 text-[12.5px] font-bold text-berry">الرقم السري غير صحيح</p>}
                  <div className="mx-auto mt-6 grid max-w-64 grid-cols-3 gap-2.5">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "ok"].map((k) => (
                      <button key={k} onClick={() => k !== "ok" && pressKey(k)}
                        disabled={k === "ok"}
                        className="btn-press num h-16 rounded-xl border-2 border-[#57432b] bg-[#2a1f16] text-2xl font-bold hover:border-brand disabled:opacity-30">
                        {k === "back" ? <Icon name="chevron" size={22} className="mx-auto" /> : k === "ok" ? <Icon name="check" size={22} className="mx-auto text-sage" /> : k}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-[11px] font-semibold text-[#a08a69]">للتجربة: الرقم السري لجميع الموظفين هو <span className="num text-brand">1234</span></p>
                </div>
              )}

              {step === "done" && doneInfo && (
                <div className="flex h-full items-center justify-center py-10">
                  <div className={`stamp-in rounded-2xl border-4 px-12 py-8 text-center ${type === "in" ? "border-sage text-sage" : "border-berry text-berry"}`}>
                    <Icon name="stamp" size={52} className="mx-auto" />
                    <p className="mt-3 font-display text-3xl font-bold">{doneInfo.name}</p>
                    <p className="mt-1 font-display text-2xl font-bold">{type === "in" ? "تم تسجيل الحضور" : "تم تسجيل الانصراف"}</p>
                    <p className="num mt-2 text-3xl font-bold">{doneInfo.t}</p>
                    {!online && <p className="mt-2 text-[12px] font-bold text-butter">حُفظ محليًا — ستتم المزامنة عند عودة الاتصال</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
