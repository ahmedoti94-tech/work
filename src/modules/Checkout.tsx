import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../lib/store";
import type { Order } from "../lib/types";
import { addDays, dateKey, fmtMoney, fmtMoney0 } from "../lib/payroll";
import { Badge, Btn, Field, Icon, inputCls, StageSteps } from "../components/ui";

const WINDOWS = ["09:00 – 13:00", "13:00 – 17:00", "17:00 – 21:00"];
const STEPS = ["Review", "Delivery", "Payment"];

export default function Checkout() {
  const {
    cartOpen, setCartOpen, checkoutOpen, setCheckoutOpen, cartSummary, setCartQty,
    removeCartLine, placeOrder, user,
  } = useStore();
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(dateKey(addDays(new Date(), 2)));
  const [window_, setWindow] = useState(WINDOWS[0]);
  const [payment, setPayment] = useState<Order["payment"]>("cod");
  const [placed, setPlaced] = useState<Order | null>(null);
  const cart = useStore((s) => s.cart);
  const sum = useMemo(() => cartSummary(), [cartSummary, cartOpen, checkoutOpen, cart]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCheckout = () => { setCartOpen(false); setStep(0); setPlaced(null); setCheckoutOpen(true); };
  const closeAll = () => { setCheckoutOpen(false); setPlaced(null); };
  const tomorrow = dateKey(addDays(new Date(), 1));
  const addressOk = address.trim().length > 6 && !!deliveryDate;

  const confirm = () => {
    const o = placeOrder({ payment, deliveryDate, deliveryWindow: window_, address: address.trim() || "On file — " + user.name });
    if (o) { setPlaced(o); }
  };

  return (
    <>
      {/* ── Cart drawer ── */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-sunken/70" onClick={() => setCartOpen(false)} />
            <motion.aside
              initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-surface shadow-lift"
            >
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <div>
                  <h3 className="font-display text-lg font-extrabold">Order crate</h3>
                  <p className="text-[11px] text-mute">{sum.lines.length} line(s) · {sum.count} units</p>
                </div>
                <button onClick={() => setCartOpen(false)} className="btn-press rounded-lg p-1.5 text-mute hover:bg-raise hover:text-ink"><Icon name="x" size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {sum.lines.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <Icon name="cart" size={34} className="text-line" />
                    <p className="mt-3 text-[13.5px] font-bold">Your crate is empty</p>
                    <p className="mt-1 max-w-[240px] text-[12px] text-mute">Browse the bake house and stack a few cartons — volume tiers kick in at 10.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sum.lines.map((l) => (
                      <motion.div key={l.product.id + l.tier} layout className="flex gap-3 rounded-xl border border-line bg-raise p-2.5">
                        <img src={l.product.img} alt={l.product.name} className="h-16 w-16 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-[13px] font-bold">{l.product.name}</p>
                            <button onClick={() => removeCartLine(l.product.id, l.tier)} className="btn-press text-mute hover:text-berry"><Icon name="x" size={14} /></button>
                          </div>
                          <p className="text-[11px] capitalize text-mute">{l.tier} · {fmtMoney(l.unitPrice)}/pack · {Math.round(l.cartons * 10) / 10} ctn</p>
                          <div className="mt-1.5 flex items-center justify-between">
                            <div className="flex items-center rounded-md border border-linestrong bg-surface">
                              <button className="btn-press p-1.5 text-mute hover:text-brand" onClick={() => setCartQty(l.product.id, l.tier, l.qty - 1)}><Icon name="minus" size={13} /></button>
                              <span className="num w-8 text-center text-[12.5px] font-bold">{l.qty}</span>
                              <button className="btn-press p-1.5 text-mute hover:text-brand" onClick={() => setCartQty(l.product.id, l.tier, l.qty + 1)}><Icon name="plus" size={13} /></button>
                            </div>
                            <p className="num text-[13px] font-extrabold">{fmtMoney(l.afterDiscount, 0)}
                              {l.discount > 0 && <span className="ml-1.5 text-[10.5px] font-bold text-sage">−{fmtMoney0(l.discount)}</span>}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {sum.lines.length > 0 && (
                <div className="border-t border-line bg-raise px-5 py-4">
                  <div className="space-y-1 text-[12.5px]">
                    <div className="flex justify-between"><span className="text-mute">Subtotal</span><span className="num font-bold">{fmtMoney(sum.subtotal)}</span></div>
                    <div className="flex justify-between text-sage"><span>Volume discount</span><span className="num font-bold">−{fmtMoney(sum.volumeDiscount)}</span></div>
                    <div className="flex justify-between"><span className="text-mute">Delivery {sum.deliveryFee === 0 && "(free > $400)"}</span><span className="num font-bold">{sum.deliveryFee ? fmtMoney(sum.deliveryFee) : "Free"}</span></div>
                    <div className="mt-1 flex justify-between border-t border-dashed border-linestrong pt-2 font-display text-[16px] font-extrabold"><span>Total</span><span className="num text-brand">{fmtMoney(sum.total)}</span></div>
                  </div>
                  {sum.issues.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {sum.issues.map((iss) => (
                        <p key={iss} className="flex items-start gap-1.5 rounded-md border border-berry/40 bg-berry/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-berry">
                          <Icon name="alert" size={13} className="mt-0.5 shrink-0" /> {iss}
                        </p>
                      ))}
                    </div>
                  )}
                  <Btn size="lg" className="mt-3 w-full py-3" disabled={sum.issues.length > 0} onClick={openCheckout}>
                    Proceed to checkout <Icon name="arrow" size={16} />
                  </Btn>
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Checkout modal ── */}
      <AnimatePresence>
        {checkoutOpen && (
          <motion.div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-sunken/70 backdrop-blur-[2px]" onClick={placed ? closeAll : undefined} />
            <motion.div
              initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-lift sm:rounded-2xl"
            >
              {placed ? (
                /* success */
                <div className="overflow-y-auto p-8 text-center">
                  <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sage text-cream">
                    <Icon name="check" size={30} sw={2.2} />
                  </motion.div>
                  <h3 className="mt-4 font-display text-2xl font-extrabold">Into the ovens it goes.</h3>
                  <p className="mt-1 text-[13px] text-mute">
                    Order <span className="num font-bold text-ink">{placed.ref}</span> · <span className="num font-bold text-brand">{fmtMoney(placed.total)}</span> · delivery {placed.deliveryDate}, {placed.deliveryWindow}
                  </p>
                  <div className="mx-auto mt-6 max-w-md">
                    <StageSteps status={0} timeline={placed.timeline} />
                  </div>
                  <p className="mx-auto mt-5 max-w-sm rounded-lg border border-line bg-raise px-4 py-3 text-[12px] leading-relaxed text-mute">
                    You'll follow it live from <b>Pending → Baking & Packaging → Shipped → Delivered</b>. The plant floor just received the bake ticket.
                  </p>
                  <Btn size="lg" className="mt-5" onClick={closeAll}>Track order in pipeline</Btn>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-line px-6 py-4">
                    <div>
                      <h3 className="font-display text-lg font-extrabold">Checkout</h3>
                      <div className="mt-1 flex items-center gap-1.5">
                        {STEPS.map((s, i) => (
                          <span key={s} className="flex items-center gap-1.5">
                            <span className={`num flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                              i < step ? "bg-sage text-cream" : i === step ? "bg-brand text-cream" : "bg-raise text-mute border border-line"}`}>{i + 1}</span>
                            <span className={`text-[11px] font-bold ${i === step ? "text-ink" : "text-mute"}`}>{s}</span>
                            {i < 2 && <span className="h-px w-5 bg-line" />}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => setCheckoutOpen(false)} className="btn-press rounded-lg p-1.5 text-mute hover:bg-raise hover:text-ink"><Icon name="x" size={18} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    {step === 0 && (
                      <div className="space-y-2.5">
                        {sum.lines.map((l) => (
                          <div key={l.product.id + l.tier} className="flex items-center justify-between rounded-lg border border-line bg-raise px-3.5 py-2.5 text-[12.5px]">
                            <span className="font-bold">{l.qty}× {l.product.name} <span className="font-normal capitalize text-mute">({l.tier})</span></span>
                            <span className="num font-bold">{fmtMoney(l.afterDiscount)}</span>
                          </div>
                        ))}
                        <div className="rounded-lg border border-line bg-cream px-3.5 py-3 text-[12.5px] dark:bg-raise">
                          <div className="flex justify-between"><span className="text-mute">Subtotal</span><span className="num">{fmtMoney(sum.subtotal)}</span></div>
                          <div className="flex justify-between text-sage"><span>Volume discount</span><span className="num">−{fmtMoney(sum.volumeDiscount)}</span></div>
                          <div className="flex justify-between"><span className="text-mute">Delivery</span><span className="num">{sum.deliveryFee ? fmtMoney(sum.deliveryFee) : "Free"}</span></div>
                          <div className="mt-1.5 flex justify-between border-t border-dashed border-linestrong pt-1.5 font-display text-[15px] font-extrabold"><span>Total</span><span className="num text-brand">{fmtMoney(sum.total)}</span></div>
                        </div>
                        <Badge tone="butter"><Icon name="users" size={12} /> Ordering as {user.org ?? user.name} · {user.org ? "B2B contract pricing" : "Retail"}</Badge>
                      </div>
                    )}

                    {step === 1 && (
                      <div className="space-y-4">
                        <Field label="Delivery address">
                          <textarea className={`${inputCls} min-h-[74px]`} placeholder="Warehouse / store address, city, contact phone…" value={address} onChange={(e) => setAddress(e.target.value)} />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Delivery date" hint="Earliest: tomorrow">
                            <input type="date" min={tomorrow} className={`${inputCls} num`} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                          </Field>
                          <Field label="Time window">
                            <select className={inputCls} value={window_} onChange={(e) => setWindow(e.target.value)}>
                              {WINDOWS.map((w) => <option key={w}>{w}</option>)}
                            </select>
                          </Field>
                        </div>
                        <p className="flex items-center gap-2 rounded-lg border border-line bg-raise px-3 py-2.5 text-[11.5px] text-mute">
                          <Icon name="truck" size={15} className="text-brand" /> Refrigerated trucks, GPS-tracked. Pallet orders include free unloading assistance.
                        </p>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-2.5">
                        {([
                          { k: "cod" as const, t: "Cash on delivery", d: "Pay the driver on arrival — cash or card terminal", ic: "wallet" as const },
                          { k: "bank" as const, t: "Bank transfer (invoice)", d: "Pro-forma invoice issued, goods ship after clearance · NET 7 for B2B", ic: "doc" as const },
                          { k: "card" as const, t: "Card — payment gateway", d: "Stripe / Meeza · tokenized, PCI-DSS · 2.9% + 30¢", ic: "shield" as const },
                        ]).map((m) => (
                          <button key={m.k} onClick={() => setPayment(m.k)}
                            className={`btn-press flex w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-all ${
                              payment === m.k ? "border-brand bg-brand/8 shadow-warm" : "border-line bg-surface hover:border-linestrong"}`}>
                            <span className={`rounded-lg border p-2.5 ${payment === m.k ? "border-brand bg-brand text-cream" : "border-line bg-raise text-mute"}`}>
                              <Icon name={m.ic} size={17} />
                            </span>
                            <span className="flex-1">
                              <span className="block text-[13.5px] font-bold">{m.t}</span>
                              <span className="block text-[11.5px] text-mute">{m.d}</span>
                            </span>
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${payment === m.k ? "border-brand" : "border-linestrong"}`}>
                              {payment === m.k && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                            </span>
                          </button>
                        ))}
                        {payment === "bank" && (
                          <p className="rounded-lg border border-line bg-raise px-3.5 py-2.5 text-[11.5px] leading-relaxed text-mute">
                            A pro-forma invoice with IBAN <span className="num font-bold text-ink">EG·80·OWBW·0400·2219·87</span> will be emailed within 15 minutes. Reference it in the transfer.
                          </p>
                        )}
                        {payment === "card" && (
                          <div className="grid grid-cols-3 gap-2 rounded-lg border border-line bg-raise p-3">
                            <div className="col-span-3"><input className={`${inputCls} num`} placeholder="4242 4242 4242 4242" /></div>
                            <input className={`${inputCls} num col-span-1`} placeholder="MM/YY" />
                            <input className={`${inputCls} num col-span-1`} placeholder="CVC" />
                            <input className={`${inputCls} col-span-1`} placeholder="ZIP" />
                            <p className="col-span-3 text-[10.5px] text-mute">Demo only — card data never leaves this page and is never stored.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-line bg-raise px-6 py-4">
                    <Btn variant="ghost" onClick={() => (step === 0 ? setCheckoutOpen(false) : setStep(step - 1))}>
                      {step === 0 ? "Back to cart" : "Back"}
                    </Btn>
                    <div className="flex items-center gap-3">
                      <span className="num text-[13px] font-bold text-mute">{fmtMoney(sum.total)}</span>
                      {step < 2 ? (
                        <Btn onClick={() => setStep(step + 1)} disabled={step === 1 && !addressOk}>
                          Continue <Icon name="arrow" size={15} />
                        </Btn>
                      ) : (
                        <Btn variant="sage" onClick={confirm}><Icon name="check" size={15} /> Place order</Btn>
                      )}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
