import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../lib/store";
import type { LeaveStatus, LeaveType } from "../lib/types";
import { fmtDateShort } from "../lib/payroll";
import { Avatar, Badge, Btn, Card, Icon, SectionHead } from "../components/ui";

const TYPE_TONE: Record<LeaveType, "berry" | "sage" | "mute" | "butter"> = {
  sick: "berry", annual: "sage", unpaid: "mute", permission: "butter",
};
const TYPE_LABEL: Record<LeaveType, string> = {
  sick: "Sick leave", annual: "Annual leave", unpaid: "Unpaid", permission: "Permission (hours)",
};
const STATUS_TONE: Record<LeaveStatus, "amber" | "sage" | "berry"> = {
  pending: "amber", approved: "sage", rejected: "berry",
};

export default function Leaves() {
  const { leaves, employees, decideLeave, user } = useStore();
  const [filter, setFilter] = useState<"all" | LeaveStatus>("all");
  const canDecide = user.role === "hr" || user.role === "super_admin";

  const pending = leaves.filter((l) => l.status === "pending");
  const list = useMemo(
    () => (filter === "all" ? leaves : leaves.filter((l) => l.status === filter))
      .slice().sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1) || b.from.localeCompare(a.from)),
    [leaves, filter]
  );
  const empOf = (id: string) => employees.find((e) => e.id === id);

  return (
    <div>
      {/* pending queue */}
      <SectionHead
        title="Approval queue"
        sub={pending.length ? `${pending.length} request(s) awaiting decision — approvals feed straight into the payroll engine` : "Queue is clear. Nothing waiting on you."}
      />
      {pending.length === 0 ? (
        <Card className="mb-5 p-6 text-center">
          <Icon name="check" size={26} className="mx-auto text-sage" />
          <p className="mt-2 text-[13px] font-semibold text-mute">All caught up — the factory floor is fully staffed.</p>
        </Card>
      ) : (
        <div className="mb-6 grid gap-3 lg:grid-cols-2">
          <AnimatePresence>
            {pending.map((l) => {
              const emp = empOf(l.empId);
              return (
                <motion.div key={l.id} layout exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.22 }}>
                  <Card className="flex flex-col gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={emp?.name ?? "?"} hue={emp?.hue ?? 0} size={38} />
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="text-[13.5px] font-bold">{emp?.name} <span className="num text-[10.5px] font-normal text-mute">{emp?.code}</span></p>
                        <p className="text-[11.5px] text-mute">{emp?.title} · {emp?.dept}</p>
                      </div>
                      <Badge tone={TYPE_TONE[l.type]}>{TYPE_LABEL[l.type]}</Badge>
                    </div>
                    <div className="flex items-center gap-4 rounded-lg border border-line bg-raise px-3 py-2 text-[12px]">
                      <span className="num font-bold">{fmtDateShort(l.from)}</span>
                      <Icon name="arrow" size={13} className="text-mute" />
                      <span className="num font-bold">{fmtDateShort(l.to)}</span>
                      <span className="ml-auto chip">{l.days} day{l.days > 1 ? "s" : ""}</span>
                    </div>
                    <p className="text-[12.5px] italic text-mute">“{l.reason}”</p>
                    {canDecide && (
                      <div className="flex gap-2">
                        <Btn variant="sage" size="sm" className="flex-1" onClick={() => decideLeave(l.id, true)}>
                          <Icon name="check" size={14} /> Approve
                        </Btn>
                        <Btn variant="berry" size="sm" className="flex-1" onClick={() => decideLeave(l.id, false)}>
                          <Icon name="x" size={14} /> Reject
                        </Btn>
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* history */}
      <Card className="p-4">
        <SectionHead
          title="All requests"
          right={
            <div className="flex gap-1.5">
              {(["all", "pending", "approved", "rejected"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`btn-press rounded-lg border px-3 py-1.5 text-[11.5px] font-bold capitalize ${
                    filter === f ? "border-ink bg-ink text-bg dark:border-cream dark:bg-cream dark:text-sunken" : "border-line bg-surface text-mute hover:text-ink"
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          }
        />
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[640px] text-left text-[12.5px]">
            <thead className="bg-raise text-[10.5px] uppercase tracking-[0.12em] text-mute">
              <tr>
                <th className="px-3 py-2.5 font-bold">Employee</th>
                <th className="px-2 py-2.5 font-bold">Type</th>
                <th className="px-2 py-2.5 font-bold">Period</th>
                <th className="px-2 py-2.5 font-bold">Days</th>
                <th className="px-2 py-2.5 font-bold">Reason</th>
                <th className="px-2 py-2.5 font-bold">Status</th>
                <th className="px-2 py-2.5 font-bold">Decided by</th>
              </tr>
            </thead>
            <tbody>
              {list.map((l) => {
                const emp = empOf(l.empId);
                return (
                  <tr key={l.id} className="border-t border-line transition-colors hover:bg-raise">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={emp?.name ?? "?"} hue={emp?.hue ?? 0} size={24} />
                        <span className="font-bold">{emp?.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5"><Badge tone={TYPE_TONE[l.type]}>{TYPE_LABEL[l.type]}</Badge></td>
                    <td className="num px-2 py-2.5 text-mute">{l.from} → {l.to}</td>
                    <td className="num px-2 py-2.5 font-bold">{l.days}</td>
                    <td className="max-w-[220px] truncate px-2 py-2.5 text-mute" title={l.reason}>{l.reason}</td>
                    <td className="px-2 py-2.5"><Badge tone={STATUS_TONE[l.status]} className="capitalize">{l.status}</Badge></td>
                    <td className="px-2 py-2.5 text-mute">{l.decidedBy ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
