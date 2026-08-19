import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../lib/store";
import { ORDER_STAGES } from "../lib/types";
import { fmtMoney } from "../lib/payroll";
import { Badge, Btn, Card, Icon, SectionHead, StageSteps } from "../components/ui";

export default function Orders() {
  const { orders, advanceOrder, user } = useStore();
  const [filter, setFilter] = useState<number>(-1); // -1 = all
  const [openId, setOpenId] = useState<string | null>(orders[0]?.id ?? null);
  const canAdvance = user.role === "super_admin" || user.role === "sales" || user.role === "production";

  const list = useMemo(
    () => (filter === -1 ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter]
  );
  const counts = useMemo(() => {
    const c = [0, 0, 0, 0];
    orders.forEach((o) => c[o.status]++);
    return c;
  }, [orders]);

  const payLabel = { cod: "Cash on delivery", bank: "Bank transfer", card: "Card gateway" } as const;

  return (
    <div>
      <SectionHead
        title="Order pipeline"
        sub="Every order walks the same oven-to-dock journey — statuses advance live and are written to the audit trail"
        right={
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFilter(-1)}
              className={`btn-press rounded-lg border px-3 py-1.5 text-[11.5px] font-bold ${filter === -1 ? "border-ink bg-ink text-bg dark:border-cream dark:bg-cream dark:text-sunken" : "border-line bg-surface text-mute hover:text-ink"}`}>
              All · {orders.length}
            </button>
            {ORDER_STAGES.map((s, i) => (
              <button key={s} onClick={() => setFilter(i)}
                className={`btn-press rounded-lg border px-3 py-1.5 text-[11.5px] font-bold ${filter === i ? "border-brand bg-brand text-cream" : "border-line bg-surface text-mute hover:text-ink"}`}>
                {s} · {counts[i]}
              </button>
            ))}
          </div>
        }
      />

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {list.map((o) => {
            const open = openId === o.id;
            return (
              <motion.div key={o.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <Card className={`overflow-hidden transition-colors ${open ? "border-linestrong" : "hover:border-linestrong"}`}>
                  <button className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left sm:px-5" onClick={() => setOpenId(open ? null : o.id)}>
                    <div className="min-w-[150px]">
                      <p className="num font-display text-[15px] font-extrabold">{o.ref}</p>
                      <p className="text-[11px] text-mute">{new Date(o.placedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold">{o.customer}</p>
                      <p className="text-[11px] text-mute">{o.items.length} line(s) · {o.items.reduce((s, i) => s + i.qty, 0)} units · {payLabel[o.payment]}</p>
                    </div>
                    <Badge tone={o.kind === "B2B" ? "ink" : "butter"}>{o.kind}</Badge>
                    <span className="num font-display text-[16px] font-extrabold text-brand">{fmtMoney(o.total)}</span>
                    <Icon name="chevron" size={16} className={`text-mute transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {open && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }}>
                        <div className="border-t border-line bg-raise px-4 py-4 sm:px-5">
                          <div className="mx-auto mb-4 max-w-xl">
                            <StageSteps status={o.status} timeline={o.timeline} />
                          </div>
                          <div className="grid gap-4 lg:grid-cols-3">
                            <div className="lg:col-span-2">
                              <p className="label-xs mb-2">Items</p>
                              <div className="overflow-hidden rounded-lg border border-line bg-surface">
                                {o.items.map((it) => (
                                  <div key={it.productId + it.tier} className="flex items-center justify-between border-b border-line px-3 py-2 text-[12.5px] last:border-0">
                                    <span className="font-bold">{it.qty}× {it.name} <span className="font-normal capitalize text-mute">· {it.tierLabel}</span></span>
                                    <span className="num font-bold">{fmtMoney(it.lineTotal)}</span>
                                  </div>
                                ))}
                                <div className="space-y-0.5 bg-cream px-3 py-2 text-[12px] dark:bg-sunken">
                                  <div className="flex justify-between text-mute"><span>Subtotal</span><span className="num">{fmtMoney(o.subtotal)}</span></div>
                                  {o.volumeDiscount > 0 && <div className="flex justify-between text-sage"><span>Volume discount</span><span className="num">−{fmtMoney(o.volumeDiscount)}</span></div>}
                                  <div className="flex justify-between text-mute"><span>Delivery</span><span className="num">{o.deliveryFee ? fmtMoney(o.deliveryFee) : "Free"}</span></div>
                                  <div className="flex justify-between pt-0.5 font-display text-[13.5px] font-extrabold text-ink"><span>Total</span><span className="num text-brand">{fmtMoney(o.total)}</span></div>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2.5 text-[12.5px]">
                              <div className="rounded-lg border border-line bg-surface p-3">
                                <p className="label-xs mb-1.5">Delivery slot</p>
                                <p className="num font-bold">{o.deliveryDate} · {o.deliveryWindow}</p>
                                <p className="mt-1 text-[11.5px] leading-snug text-mute">{o.address}</p>
                              </div>
                              <div className="rounded-lg border border-line bg-surface p-3">
                                <p className="label-xs mb-1.5">Timeline</p>
                                <div className="space-y-1">
                                  {o.timeline.map((t) => (
                                    <p key={t.stage} className="flex justify-between gap-2 text-[11.5px]">
                                      <span className="font-semibold">{ORDER_STAGES[t.stage]}</span>
                                      <span className="num text-mute">{new Date(t.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                    </p>
                                  ))}
                                </div>
                              </div>
                              {canAdvance && o.status < 3 && (
                                <Btn className="w-full" onClick={() => advanceOrder(o.id)}>
                                  <Icon name="flame" size={15} /> Advance → {ORDER_STAGES[o.status + 1]}
                                </Btn>
                              )}
                              {o.status === 3 && (
                                <p className="flex items-center justify-center gap-1.5 rounded-lg border border-sage/40 bg-sage/10 px-3 py-2 text-[12px] font-bold text-sage">
                                  <Icon name="check" size={14} /> Delivered & signed
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {list.length === 0 && (
          <p className="py-14 text-center text-[13px] text-mute">No orders in “{filter === -1 ? "all" : ORDER_STAGES[filter]}” right now.</p>
        )}
      </div>
    </div>
  );
}
