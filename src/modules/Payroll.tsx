import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import type { Employee, PayrollResult } from "../lib/types";
import {
  computePayroll, fmtMoney, fmtMoney0, monthKeyNow, monthLabel, OT_RATE,
  prevMonthKey, SHIFTS, todayKey,
} from "../lib/payroll";
import { Avatar, Badge, Btn, Card, Field, Icon, inputCls, Modal, SectionHead } from "../components/ui";

export default function Payroll() {
  const { employees, attendance, leaves, advances, finalizedMonths, finalizePayroll, user, grantAdvance, adjustSalary } = useStore();
  const now = monthKeyNow();
  const [month, setMonth] = useState(now);
  const [slip, setSlip] = useState<{ emp: Employee; res: PayrollResult } | null>(null);
  const [advOpen, setAdvOpen] = useState(false);
  const finalized = finalizedMonths.includes(month);

  const results = useMemo(
    () => employees.map((emp) => ({ emp, res: computePayroll(emp, month, attendance, leaves, advances) })),
    [employees, month, attendance, leaves, advances]
  );
  const totals = useMemo(() => ({
    net: results.reduce((s, r) => s + r.res.net, 0),
    ot: results.reduce((s, r) => s + r.res.otPay, 0),
    ded: results.reduce((s, r) => s + r.res.lateDeduction, 0),
    adv: results.reduce((s, r) => s + r.res.advancesTotal, 0),
  }), [results]);

  const openAdvances = advances.filter((a) => !a.settledMonth);
  const canManage = user.role === "hr" || user.role === "super_admin";
  const isSuper = user.role === "super_admin";

  return (
    <div>
      {/* control strip */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-linestrong">
          {[now, prevMonthKey(now)].map((m) => (
            <button key={m} onClick={() => setMonth(m)}
              className={`btn-press px-4 py-2 text-[12.5px] font-bold ${month === m ? "bg-ink text-bg dark:bg-cream dark:text-sunken" : "bg-surface text-mute hover:text-ink"}`}>
              {monthLabel(m)}
            </button>
          ))}
        </div>
        {finalized ? (
          <Badge tone="sage" className="py-1.5"><Icon name="check" size={13} /> Run finalized · payslips issued</Badge>
        ) : month === now ? (
          <Badge tone="butter" className="py-1.5"><Icon name="clock" size={13} /> Draft — month in progress</Badge>
        ) : (
          <Badge tone="mute" className="py-1.5">Historical preview</Badge>
        )}
        <div className="ml-auto flex gap-2">
          {canManage && <Btn variant="outline" onClick={() => setAdvOpen(true)}><Icon name="plus" size={15} /> Record advance</Btn>}
          {canManage && (
            <Btn disabled={finalized || month !== now} onClick={() => finalizePayroll(month)}>
              <Icon name="stamp" size={15} /> Finalize payroll run
            </Btn>
          )}
        </div>
      </div>

      {/* totals */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: "Net payroll", v: fmtMoney0(totals.net), tone: "text-brand" },
          { l: `Overtime paid ×${OT_RATE}`, v: fmtMoney0(totals.ot), tone: "text-sage" },
          { l: "Late deductions", v: fmtMoney0(totals.ded), tone: "text-butter" },
          { l: "Advances settled (سلف)", v: fmtMoney0(totals.adv), tone: "text-berry" },
        ].map((t) => (
          <Card key={t.l} className="p-4">
            <p className="label-xs">{t.l}</p>
            <p className={`num mt-1.5 font-display text-2xl font-bold ${t.tone}`}>{t.v}</p>
          </Card>
        ))}
      </div>

      {/* payroll table */}
      <Card className="p-4">
        <SectionHead title="Payroll worksheet" sub={`Formula: (base ÷ work days) × days present + OT − late − unpaid leave − advances · click a row for the payslip`} />
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[760px] text-left text-[12.5px]">
            <thead className="bg-raise text-[10.5px] uppercase tracking-[0.12em] text-mute">
              <tr>
                <th className="px-3 py-2.5 font-bold">Employee</th>
                <th className="px-2 py-2.5 font-bold">Base</th>
                <th className="px-2 py-2.5 font-bold">Days</th>
                <th className="px-2 py-2.5 font-bold">OT hrs</th>
                <th className="px-2 py-2.5 font-bold">Late min</th>
                <th className="px-2 py-2.5 font-bold">Advance</th>
                <th className="px-2 py-2.5 text-right font-bold">Net pay</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {results.map(({ emp, res }) => (
                <tr key={emp.id} onClick={() => setSlip({ emp, res })}
                  className="cursor-pointer border-t border-line transition-colors hover:bg-brand/6">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={emp.name} hue={emp.hue} size={28} />
                      <div className="leading-tight">
                        <p className="font-bold">{emp.name}</p>
                        <p className="text-[10.5px] text-mute">{emp.title} · {SHIFTS[emp.shift].label}</p>
                      </div>
                    </div>
                  </td>
                  <td className="num px-2 py-2.5">{fmtMoney0(emp.baseSalary)}</td>
                  <td className="num px-2 py-2.5">
                    {res.presentDays + res.paidLeaveDays}<span className="text-mute">/{res.workDays}</span>
                    {res.absentDays > 0 && <span className="ml-1 text-berry">·{res.absentDays}abs</span>}
                  </td>
                  <td className="num px-2 py-2.5 text-sage">{res.otHours.toFixed(1)}</td>
                  <td className="num px-2 py-2.5 text-butter">{res.lateMinutes}</td>
                  <td className="num px-2 py-2.5 text-berry">{res.advancesTotal ? fmtMoney0(res.advancesTotal) : "—"}</td>
                  <td className="num px-2 py-2.5 text-right font-display text-[14px] font-bold">{fmtMoney(res.net)}</td>
                  <td className="px-2 py-2.5 text-mute"><Icon name="arrow" size={14} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* advances panel */}
      <Card className="mt-4 p-4">
        <SectionHead title="Open advances — السلف" sub="Deducted automatically in the next finalized payroll run, then settled" />
        {openAdvances.length === 0 ? (
          <p className="rounded-lg border border-dashed border-linestrong px-4 py-6 text-center text-[13px] text-mute">No open advances. Every salfa has been settled. ✦</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {openAdvances.map((a) => {
              const emp = employees.find((e) => e.id === a.empId);
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-line bg-raise px-3 py-2.5">
                  <Avatar name={emp?.name ?? "?"} hue={emp?.hue ?? 0} size={30} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-[12.5px] font-bold">{emp?.name}</p>
                    <p className="truncate text-[11px] text-mute">{a.note} · {a.date}</p>
                  </div>
                  <span className="num font-display text-[15px] font-bold text-berry">{fmtMoney0(a.amount)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <AdvanceModal open={advOpen} onClose={() => setAdvOpen(false)} onSave={(e, amt, note) => { grantAdvance(e, amt, note); setAdvOpen(false); }} />

      {/* payslip */}
      <Modal open={!!slip} onClose={() => setSlip(null)} title={slip ? `Payslip — ${slip.emp.name}` : ""} wide
        footer={slip && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {isSuper ? (
              <div className="flex items-center gap-1.5">
                <span className="label-xs mr-1">Adjust base (audit-logged)</span>
                {[-50, -10, +10, +50].map((d) => (
                  <Btn key={d} size="sm" variant={d > 0 ? "sage" : "berry"} onClick={() => adjustSalary(slip.emp.id, d)}>
                    {d > 0 ? `+${d}` : d}
                  </Btn>
                ))}
              </div>
            ) : <span className="label-xs">Read-only · salary adjustments require Super Admin</span>}
            <Btn onClick={() => window.print()}><Icon name="printer" size={15} /> Export PDF</Btn>
          </div>
        )}>
        {slip && <Payslip emp={slip.emp} res={slip.res} />}
      </Modal>
    </div>
  );
}

function Payslip({ emp, res }: { emp: Employee; res: PayrollResult }) {
  return (
    <div id="print-area" className="rounded-xl border border-line bg-cream p-5 text-[#241609] dark:bg-cream dark:text-[#241609]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#c0761f] text-[#fff8ea]">
            <Icon name="logo" size={26} sw={1.6} />
          </span>
          <div>
            <p className="font-display text-lg font-extrabold leading-tight">Ovenwright Biscuit Works</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a7355]">Employee payslip · {monthLabel(res.monthKey)}</p>
          </div>
        </div>
        <div className="num text-right text-[11px] leading-relaxed text-[#8a7355]">
          Slip ID OW-{res.empId.toUpperCase()}-{res.monthKey.replace("-", "")}<br />
          Issued {todayKey()}<br />Plant #1 · 6th of October City
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg bg-[#f4ecdd] p-3.5 text-[12px] sm:grid-cols-4">
        {[
          ["Employee", emp.name], ["Badge", emp.code], ["Title", emp.title],
          ["Department", emp.dept], ["Shift", `${SHIFTS[emp.shift].label} (${SHIFTS[emp.shift].window})`],
          ["Base salary", fmtMoney(emp.baseSalary)], ["Daily rate", fmtMoney(res.perDay)], ["Hourly", fmtMoney(res.hourly)],
        ].map(([k, v]) => (
          <div key={k}><p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#8a7355]">{k}</p><p className="num font-bold">{v}</p></div>
        ))}
      </div>

      <div className="perf mt-6 pt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="label-xs mb-2 text-[#8a7355]">Attendance summary</p>
            <div className="space-y-1 text-[12.5px]">
              {[
                ["Work days in month", `${res.workDays}`], ["Days present", `${res.presentDays}`],
                ["Paid leave days", `${res.paidLeaveDays}`], ["Unpaid leave days", `${res.unpaidLeaveDays}`],
                ["Unexcused absences", `${res.absentDays}`], ["Overtime hours", `${res.otHours.toFixed(1)}`],
                ["Late minutes", `${res.lateMinutes}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-dashed border-[#e0d2b6] py-1"><span>{k}</span><span className="num font-bold">{v}</span></div>
              ))}
            </div>
          </div>
          <div>
            <p className="label-xs mb-2 text-[#8a7355]">Earnings & deductions</p>
            <div className="space-y-1 text-[12.5px]">
              {res.rows.map((r) => (
                <div key={r.label}>
                  <div className="flex justify-between py-1">
                    <span>{r.label}</span>
                    <span className={`num font-bold ${r.kind === "deduct" ? "text-[#b0432a]" : "text-[#241609]"}`}>
                      {r.value < 0 ? `(${fmtMoney(Math.abs(r.value))})` : fmtMoney(r.value)}
                    </span>
                  </div>
                  <p className="-mt-1 pb-1 text-[10.5px] text-[#8a7355]">{r.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between rounded-lg bg-[#241609] px-4 py-3 text-[#f4ecdd]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c9b58d]">Net pay</p>
            <p className="num font-display text-3xl font-extrabold">{fmtMoney(res.net)}</p>
          </div>
          <div className="num text-right text-[10.5px] leading-relaxed text-[#c9b58d]">
            Gross {fmtMoney(res.gross)}<br />Deductions {fmtMoney(res.lateDeduction + res.advancesTotal)}<br />Paid via bank transfer · Day 1
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between text-[11px] text-[#8a7355]">
          <div className="w-40 border-t border-dashed border-[#8a7355] pt-1 text-center">HR Manager</div>
          <div className="w-40 border-t border-dashed border-[#8a7355] pt-1 text-center">Employee signature</div>
        </div>
      </div>
    </div>
  );
}

function AdvanceModal({ open, onClose, onSave }: {
  open: boolean; onClose: () => void; onSave: (empId: string, amount: number, note: string) => void;
}) {
  const { employees } = useStore();
  const [empId, setEmpId] = useState(employees[0].id);
  const [amount, setAmount] = useState(100);
  const [note, setNote] = useState("Emergency advance");
  return (
    <Modal open={open} onClose={onClose} title="Record salary advance (سلفة)"
      footer={
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn disabled={amount <= 0} onClick={() => onSave(empId, amount, note)}>
            <Icon name="check" size={15} /> Record {fmtMoney0(amount)}
          </Btn>
        </div>
      }>
      <div className="space-y-4">
        <Field label="Employee">
          <select className={inputCls} value={empId} onChange={(e) => setEmpId(e.target.value)}>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name} · net base {fmtMoney0(e.baseSalary)}</option>)}
          </select>
        </Field>
        <Field label="Amount (USD)">
          <input type="number" min={10} step={10} className={`${inputCls} num`} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </Field>
        <Field label="Reason note (written to audit trail)">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <p className="rounded-lg border border-line bg-raise px-3 py-2 text-[11.5px] leading-snug text-mute">
          The advance is deducted from the employee's net pay when the current payroll run is finalized, then marked settled — no double deduction is possible.
        </p>
      </div>
    </Modal>
  );
}
