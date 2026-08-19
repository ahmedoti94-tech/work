import { useMemo, useState } from "react";
import { addDays, dateKey, fmtDateShort } from "../lib/payroll";
import { LEAVE_AR, useStore } from "../lib/store";
import type { LeaveStatus, LeaveType } from "../lib/types";
import { Avatar, Badge, Btn, Field, Icon, SectionHead, inputCls, type BadgeTone } from "../components/ui";

const STATUS_META: Record<LeaveStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "بانتظار الموافقة", tone: "butter" },
  approved: { label: "مُعتمدة", tone: "sage" },
  rejected: { label: "مرفوضة", tone: "berry" },
};

export default function Leaves() {
  const { user, employees, leaves, applyLeave, decideLeave } = useStore();
  const canApprove = user.role === "hr" || user.role === "super";
  const isSelfService = user.role === "customer";

  const [type, setType] = useState<LeaveType>("annual");
  const [from, setFrom] = useState(dateKey(addDays(new Date(), 1)));
  const [to, setTo] = useState(dateKey(addDays(new Date(), 2)));
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState<"all" | LeaveStatus>("all");

  const visible = useMemo(() => {
    let list = [...leaves].sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1) || b.from.localeCompare(a.from));
    if (isSelfService) list = list.filter((l) => l.empId === user.empId);
    if (filter !== "all") list = list.filter((l) => l.status === filter);
    return list;
  }, [leaves, isSelfService, user.empId, filter]);

  const pending = leaves.filter((l) => l.status === "pending");

  return (
    <div>
      <SectionHead
        title="الإجازات والأذونات"
        desc={canApprove ? `${pending.length} طلب بانتظار قرارك — المرضية والسنوية والإذن مدفوعة، وغير المدفوعة تُخصم من المسير` : "قدّم طلبك وسيراجعه قسم الموارد البشرية"}
        actions={
          <div className="flex gap-1.5">
            {([["all", "الكل"], ["pending", "قيد المراجعة"], ["approved", "مُعتمدة"], ["rejected", "مرفوضة"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`btn-press rounded-full border px-3.5 py-1.5 text-[12px] font-bold ${filter === k ? "border-brand bg-brand text-cream" : "border-line bg-surface text-mute hover:text-ink"}`}>
                {l}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {/* النموذج */}
        <div className="card h-fit p-5">
          <h3 className="font-display text-[15px] font-bold">طلب إجازة جديد</h3>
          <p className="mt-0.5 text-[11.5px] text-mute">
            {isSelfService ? "سيُرسل الطلب باسمك إلى الموارد البشرية" : "يمكنك التقديم نيابة عن أي موظف"}
          </p>
          {!isSelfService && (
            <Field label="الموظف">
              <EmpSelect />
            </Field>
          )}
          <div className="mt-3 space-y-3">
            <Field label="نوع الإجازة">
              <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
                {(Object.keys(LEAVE_AR) as LeaveType[]).map((t) => (
                  <option key={t} value={t}>{LEAVE_AR[t]}{t === "unpaid" ? " (تُخصم من الراتب)" : " (مدفوعة)"}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="من تاريخ"><input type="date" className={`${inputCls} num`} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label="إلى تاريخ"><input type="date" className={`${inputCls} num`} value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
            </div>
            <Field label="السبب"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: ظرف عائلي" /></Field>
            <Btn className="w-full" onClick={() => {
              const empId = isSelfService ? user.empId! : (document.getElementById("leave-emp") as HTMLSelectElement)?.value ?? "e2";
              if (to < from) return;
              applyLeave(empId, type, from, to, reason || "بدون تفاصيل");
              setReason("");
            }}>
              <Icon name="leave" size={16} /> إرسال الطلب للمراجعة
            </Btn>
          </div>
        </div>

        {/* القائمة */}
        <div className="space-y-3 xl:col-span-2">
          {visible.length === 0 && (
            <div className="card p-10 text-center text-[13px] font-semibold text-mute">لا توجد طلبات مطابقة</div>
          )}
          {visible.map((l) => {
            const emp = employees.find((e) => e.id === l.empId)!;
            const meta = STATUS_META[l.status];
            const days = Math.max(1, Math.round((new Date(l.to).getTime() - new Date(l.from).getTime()) / 86400000) + 1);
            return (
              <div key={l.id} className="card flex flex-wrap items-center gap-3 p-4">
                <Avatar name={emp.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-bold">{emp.name}</p>
                    <Badge tone={l.type === "unpaid" ? "berry" : "cocoa"}>{LEAVE_AR[l.type]}</Badge>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <p className="mt-1 text-[12px] font-semibold text-mute">
                    <span className="num">{fmtDateShort(l.from)}</span> ← <span className="num">{fmtDateShort(l.to)}</span> · {days} يوم · {emp.title}
                  </p>
                  <p className="mt-0.5 text-[12px] text-mute">«{l.reason}»</p>
                </div>
                {canApprove && l.status === "pending" && (
                  <div className="flex gap-2">
                    <Btn size="sm" variant="sage" onClick={() => decideLeave(l.id, "approved")}><Icon name="check" size={14} /> موافقة</Btn>
                    <Btn size="sm" variant="danger" onClick={() => decideLeave(l.id, "rejected")}><Icon name="x" size={14} /> رفض</Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EmpSelect() {
  const { employees } = useStore();
  return (
    <select id="leave-emp" className={inputCls} defaultValue="e2">
      {employees.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
    </select>
  );
}
