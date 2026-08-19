import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../lib/store";
import {
  addDays, dateKey, dayStats, fmtClock, fmtDateShort, fmtDur, fmtMin, GRACE_MIN,
  isWorkday, nowMin, SHIFTS, todayKey,
} from "../lib/payroll";
import { Avatar, Badge, Btn, Card, Field, Icon, inputCls, Modal, SectionHead } from "../components/ui";
import type { PunchSource } from "../lib/types";

function FakeQR({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 9973;
    const arr: boolean[] = [];
    for (let i = 0; i < 121; i++) { h = (h * 137 + 71) % 9973; arr.push(h % 3 !== 0); }
    return arr;
  }, [seed]);
  return (
    <svg viewBox="0 0 11 11" className="h-20 w-20 rounded-md bg-cream p-1.5 text-ink dark:bg-sunken" shapeRendering="crispEdges">
      {cells.map((on, i) => on && <rect key={i} x={i % 11} y={Math.floor(i / 11)} width="1" height="1" fill="currentColor" />)}
      <rect x="0" y="0" width="3" height="3" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="8" y="0" width="3" height="3" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="0" y="8" width="3" height="3" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

const SOURCE_LABEL: Record<PunchSource, string> = { qr: "QR gate", manual: "Manual", supervisor: "Supervisor" };

export default function Attendance() {
  const { employees, attendance, checkIn, checkOut, manualPunch, user } = useStore();
  const [selEmp, setSelEmp] = useState(employees[0].id);
  const [viewDate, setViewDate] = useState(todayKey());
  const [stamp, setStamp] = useState<{ kind: "in" | "out"; time: string } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [clock, setClock] = useState(new Date());
  // keep the clock ticking
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const tk = todayKey();
  const isToday = viewDate === tk;
  const emp = employees.find((e) => e.id === selEmp)!;
  const myRec = attendance.find((a) => a.empId === selEmp && a.date === tk);

  const doPunch = (kind: "in" | "out") => {
    if (kind === "in") checkIn(selEmp); else checkOut(selEmp);
    setStamp({ kind, time: fmtMin(nowMin()) });
    setTimeout(() => setStamp(null), 2200);
  };

  const roster = useMemo(() => {
    const rows = employees.map((e) => {
      const rec = attendance.find((a) => a.empId === e.id && a.date === viewDate);
      const st = dayStats(rec, e.shift);
      return { e, rec, st };
    });
    return rows.sort((a, b) => (a.rec?.in ?? 9999) - (b.rec?.in ?? 9999));
  }, [employees, attendance, viewDate]);

  const presentCount = roster.filter((r) => r.rec?.in != null).length;
  const lateCount = roster.filter((r) => r.st.late > 0 && (isToday ? r.rec?.in != null : true)).length;

  const dateStrip = useMemo(() => {
    const out: string[] = [];
    let d = new Date();
    while (out.length < 6) {
      if (isWorkday(d)) out.unshift(dateKey(d));
      d = addDays(d, -1);
    }
    return out;
  }, []);

  const canManage = user.role !== "sales" && user.role !== "customer";

  return (
    <div>
      <div className="grid gap-4 xl:grid-cols-5">
        {/* ── Gate terminal ── */}
        <Card className="relative overflow-hidden p-5 xl:col-span-2">
          <div className="hatch pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="label-xs">Gate G-2 · badge & QR terminal</p>
                <p className="num mt-2 font-display text-[44px] font-extrabold leading-none tracking-tight">
                  {fmtClock(clock)}
                </p>
                <p className="mt-1 text-[12px] font-semibold text-mute">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <FakeQR seed={emp.code + tk} />
            </div>

            <div className="mt-5">
              <Field label="Simulate badge scan — select employee">
                <select className={inputCls} value={selEmp} onChange={(e) => setSelEmp(e.target.value)}>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.code} · {e.name} — {SHIFTS[e.shift].label} shift</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Btn size="lg" variant="sage" disabled={!isToday || (myRec?.in != null)} onClick={() => doPunch("in")} className="py-3.5 text-[14px]">
                <Icon name="stamp" size={17} /> Check in
              </Btn>
              <Btn size="lg" variant="berry" disabled={!isToday || myRec?.in == null || myRec?.out != null} onClick={() => doPunch("out")} className="py-3.5 text-[14px]">
                <Icon name="arrow" size={17} /> Check out
              </Btn>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-line bg-raise px-2 py-2.5">
                <p className="label-xs">Shift</p>
                <p className="num mt-1 text-[12.5px] font-bold">{SHIFTS[emp.shift].window}</p>
              </div>
              <div className="rounded-lg border border-line bg-raise px-2 py-2.5">
                <p className="label-xs">In / Out</p>
                <p className="num mt-1 text-[12.5px] font-bold">{fmtMin(myRec?.in ?? null)} / {fmtMin(myRec?.out ?? null)}</p>
              </div>
              <div className="rounded-lg border border-line bg-raise px-2 py-2.5">
                <p className="label-xs">Grace</p>
                <p className="num mt-1 text-[12.5px] font-bold">{GRACE_MIN} min · OT ×1.5</p>
              </div>
            </div>

            <p className="mt-3 text-[11px] leading-snug text-mute">
              Punches write an exact minute-precision timestamp. Overtime accrues past 8h worked; arrivals after
              +{GRACE_MIN} min trigger the late-deduction formula in payroll.
            </p>
          </div>

          {/* stamp overlay */}
          <AnimatePresence>
            {stamp && (
              <motion.div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className={`stamp-in rounded-xl border-4 px-6 py-3 font-display text-2xl font-extrabold tracking-widest ${
                  stamp.kind === "in" ? "border-sage text-sage bg-sage/10" : "border-berry text-berry bg-berry/10"
                }`}>
                  {stamp.kind === "in" ? "CHECKED IN" : "CHECKED OUT"}
                  <span className="num block text-center text-base font-bold">{stamp.time}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* ── Roster ── */}
        <Card className="p-4 xl:col-span-3">
          <SectionHead
            title="Daily roster"
            sub={`${presentCount}/${employees.length} punched · ${lateCount} late · grace ${GRACE_MIN} min`}
            right={
              <div className="flex items-center gap-2">
                {canManage && (
                  <Btn variant="outline" size="sm" onClick={() => setManualOpen(true)}>
                    <Icon name="plus" size={14} /> Manual entry
                  </Btn>
                )}
              </div>
            }
          />
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {dateStrip.map((d) => (
              <button key={d} onClick={() => setViewDate(d)}
                className={`btn-press whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11.5px] font-bold ${
                  d === viewDate ? "border-ink bg-ink text-bg dark:border-cream dark:bg-cream dark:text-sunken" : "border-line bg-surface text-mute hover:text-ink"
                }`}>
                {fmtDateShort(d)}
              </button>
            ))}
          </div>

          <div className="max-h-[430px] overflow-y-auto rounded-lg border border-line">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 z-[1] bg-raise text-[10.5px] uppercase tracking-[0.12em] text-mute">
                <tr>
                  <th className="px-3 py-2.5 font-bold">Employee</th>
                  <th className="px-2 py-2.5 font-bold">Shift</th>
                  <th className="px-2 py-2.5 font-bold">In</th>
                  <th className="px-2 py-2.5 font-bold">Out</th>
                  <th className="hidden px-2 py-2.5 font-bold sm:table-cell">Worked</th>
                  <th className="px-2 py-2.5 font-bold">Status</th>
                  <th className="hidden px-2 py-2.5 font-bold md:table-cell">Source</th>
                </tr>
              </thead>
              <tbody>
                {roster.map(({ e, rec, st }, i) => (
                  <motion.tr key={e.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.025 }}
                    className={`border-t border-line transition-colors hover:bg-raise ${e.id === selEmp ? "bg-brand/6" : ""}`}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={e.name} hue={e.hue} size={28} />
                        <div className="leading-tight">
                          <p className="font-bold">{e.name}</p>
                          <p className="num text-[10.5px] text-mute">{e.code} · {e.dept}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-mute">{SHIFTS[e.shift].label}</td>
                    <td className="num px-2 py-2.5 font-semibold">{fmtMin(rec?.in ?? null)}</td>
                    <td className="num px-2 py-2.5 font-semibold">{fmtMin(rec?.out ?? null)}</td>
                    <td className="num hidden px-2 py-2.5 text-mute sm:table-cell">{rec?.in != null ? (rec.out != null ? fmtDur(st.worked) : "on shift") : "—"}</td>
                    <td className="px-2 py-2.5">
                      {rec?.in == null ? <Badge tone="berry">Absent</Badge>
                        : rec.out == null ? <Badge tone="amber"><span className="tick-dot h-1.5 w-1.5 rounded-full bg-brand" />On shift</Badge>
                        : st.late > 0 ? <Badge tone="butter">Late {Math.round(st.late)}m</Badge>
                        : <Badge tone="sage">Present</Badge>}
                    </td>
                    <td className="hidden px-2 py-2.5 text-[11px] text-mute md:table-cell">{rec ? SOURCE_LABEL[rec.source] : "—"}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <ManualEntryModal open={manualOpen} onClose={() => setManualOpen(false)} onSave={(...a) => { manualPunch(...a); setManualOpen(false); }} />
    </div>
  );
}

function ManualEntryModal({ open, onClose, onSave }: {
  open: boolean; onClose: () => void;
  onSave: (empId: string, cin: number, cout: number | null, note: string) => void;
}) {
  const { employees, attendance } = useStore();
  const [empId, setEmpId] = useState(employees[0].id);
  const [cin, setCin] = useState("06:02");
  const [cout, setCout] = useState("");
  const [note, setNote] = useState("Gate reader offline — verified from CCTV");
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const existing = attendance.find((a) => a.empId === empId && a.date === todayKey());
  return (
    <Modal open={open} onClose={onClose} title="Supervisor manual entry — today"
      footer={
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => onSave(empId, toMin(cin), cout ? toMin(cout) : null, note)}>
            <Icon name="stamp" size={15} /> Log punch
          </Btn>
        </div>
      }>
      <div className="space-y-4">
        <Field label="Employee">
          <select className={inputCls} value={empId} onChange={(e) => setEmpId(e.target.value)}>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.code} · {e.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in time"><input type="time" className={`${inputCls} num`} value={cin} onChange={(e) => setCin(e.target.value)} /></Field>
          <Field label="Check-out time" hint="Optional — leave empty if still on shift">
            <input type="time" className={`${inputCls} num`} value={cout} onChange={(e) => setCout(e.target.value)} />
          </Field>
        </div>
        <Field label="Justification note (written to audit trail)">
          <textarea className={`${inputCls} min-h-[70px]`} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {existing?.in != null && (
          <p className="flex items-center gap-2 rounded-lg border border-butter/50 bg-butter/10 px-3 py-2 text-[12px] font-semibold text-butter">
            <Icon name="alert" size={14} /> This employee already has a punch today — saving will override it.
          </p>
        )}
      </div>
    </Modal>
  );
}
