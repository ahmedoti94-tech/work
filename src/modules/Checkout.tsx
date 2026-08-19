import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { COMPANY, GOVERNORATES } from "../lib/data";
import { FREE_DELIVERY_MIN, fmtDateShort, fmtMoney, isValidEgyptianPhone, waLink } from "../lib/payroll";
import { PAY_AR, cartSummary, deliveryMinDate, useStore } from "../lib/store";
import type { PaymentMethod } from "../lib/types";
import { Badge, Btn, Field, Icon, Modal, inputCls } from "../components/ui";

const STEPS = ["مراجعة السلة", "التوصيل", "الدفع والحساب"];

export default function Checkout() {
  const {
    cart, cartOpen, setCartOpen, checkoutOpen, setCheckoutOpen, products,
    setLineQty, removeLine, placeOrder, user, toast, setView,
    requestOtp, verifyOtp, registerCustomer,
  } = useStore();

  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState(user.role === "customer" ? user.name : "");
  const [phone, setPhone] = useState(user.role === "customer" ? (user.phone ?? "") : "");
  const [govId, setGovId] = useState("g1");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [date, setDate] = useState(deliveryMinDate());
  const [window_, setWindow_] = useState("08:00 – 12:00");
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [placedId, setPlacedId] = useState<string | null>(null);
  // OTP — إنشاء حساب بنقرة أثناء الطلب
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [otpOk, setOtpOk] = useState(false);
  const [otpError, setOtpError] = useState(false);

  const sum = useMemo(() => cartSummary(cart, products, govId), [cart, products, govId]);
  const gov = GOVERNORATES.find((g) => g.id === govId)!;
  const phoneOk = isValidEgyptianPhone(phone);
  const verifiedAccount = user.role === "customer" && !!user.phone && phone === user.phone;

  const openCheckout = () => { setStep(0); setCheckoutOpen(true); setCartOpen(false); };
  const reset = () => {
    setCheckoutOpen(false); setPlacedId(null); setStep(0);
    setOtpSent(false); setOtpOk(false); setOtpInput(""); setDemoCode(null); setOtpError(false);
  };

  const sendOtp = () => {
    const code = requestOtp(phone);
    setDemoCode(code);
    setOtpSent(true);
    toast(`أُرسل رمز تحقق إلى ${phone} عبر SMS`, "brand");
  };
  const checkOtp = () => {
    if (verifyOtp(otpInput)) {
      setOtpOk(true); setOtpError(false);
      registerCustomer(customer.trim() || user.name, phone, {
        id: `sa-${Date.now()}`, govId, city: city.trim() || gov.name, street: street.trim() || "—", phone,
      });
    } else {
      setOtpError(true);
      toast("رمز التحقق غير صحيح — حاول مجددًا", "berry");
    }
  };

  const canConfirm = customer.trim().length >= 3 && phoneOk && (verifiedAccount || otpOk);

  const confirm = () => {
    const order = placeOrder(customer.trim() || user.name, phone, date, window_, payment, govId, city.trim() || gov.name);
    setPlacedId(order.id);
    setStep(3);
  };

  const sendOrderWhatsApp = () => {
    if (!placedId) return;
    const order = useStore.getState().orders.find((o) => o.id === placedId);
    if (!order) return;
    const text =
      `فاتورة طلب ${order.id} — ${COMPANY.name}\n\nالعميل: ${order.customer}\n` +
      order.lines.map((l) => {
        const p = products.find((x) => x.id === l.productId)!;
        return `• ${p.name} × ${l.qty} (${l.tier === "box" ? "علب" : l.tier === "carton" ? "كراتين" : "طبالي"})`;
      }).join("\n") +
      `\n\nالإجمالي: ${fmtMoney(order.subtotal, 0)}\nخصم الكميات: −${fmtMoney(order.discount, 0)}\nالتوصيل (${order.governorate ?? ""}): ${order.deliveryFee === 0 ? "مجاني" : fmtMoney(order.deliveryFee, 0)}\nالصافي: ${fmtMoney(order.total, 0)}\nالدفع: ${PAY_AR[order.payment]}\nالتوصيل: ${fmtDateShort(order.deliverOn)} (${order.window})\nبطاقة ضريبية: ${COMPANY.taxId}\n\nشكرًا لثقتكم`;
    window.open(waLink(order.customerPhone, text), "_blank");
    toast("جارٍ فتح واتساب لإرسال الفاتورة الضريبية للعميل", "sage");
  };

  return (
    <>
      {/* ── سلة الطلب ── */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-sunken/60 backdrop-blur-[2px]" onClick={() => setCartOpen(false)} />
            <motion.aside
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
              className="fixed inset-y-0 start-0 z-[61] flex w-full max-w-md flex-col border-e border-line bg-surface shadow-lift"
            >
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h3 className="flex items-center gap-2 font-display text-[16px] font-bold">
                  <Icon name="cart" size={18} className="text-brand" /> سلة طلب الجملة
                </h3>
                <button onClick={() => setCartOpen(false)} className="btn-press rounded-lg p-1.5 text-mute hover:bg-raise" aria-label="إغلاق">
                  <Icon name="x" size={17} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {sum.lines.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                    <Icon name="shop" size={40} className="text-line" />
                    <p className="text-[13.5px] font-bold">سلتك فارغة</p>
                    <p className="text-[12px] text-mute">تصفّح الكتالوج وأضف منتجات — الخصومات تُحسب تلقائيًا</p>
                    <Btn variant="outline" onClick={() => { setCartOpen(false); setView("marketplace"); }}>فتح الكتالوج</Btn>
                  </div>
                )}
                <div className="space-y-3">
                  {sum.lines.map(({ line, product, pack, cartons, rate, net }) => (
                    <div key={`${line.productId}-${line.tier}`} className="flex gap-3 rounded-xl border border-line bg-raise p-3">
                      <img src={product.img} alt={product.name} className="h-16 w-16 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-bold leading-tight">{product.name}</p>
                          <button onClick={() => removeLine(line.productId, line.tier)} className="btn-press text-mute hover:text-berry" aria-label="حذف">
                            <Icon name="x" size={14} />
                          </button>
                        </div>
                        <p className="text-[11px] font-semibold text-mute">
                          {pack.tier === "box" ? "علب" : pack.tier === "carton" ? "كراتين" : "طبالي"} × <span className="num">{line.qty}</span> · <span className="num">{Math.round(cartons * 10) / 10}</span> كرتونة
                          {rate > 0 && <Badge tone="sage" className="ms-1.5 py-0.5">خصم −{Math.round(rate * 100)}٪</Badge>}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between">
                          <div className="flex items-center rounded-lg border border-linestrong bg-surface">
                            <button className="btn-press p-1.5 text-mute hover:text-brand" onClick={() => setLineQty(line.productId, line.tier, line.qty - 1)}><Icon name="minus" size={13} /></button>
                            <span className="num w-8 text-center text-[12.5px] font-bold">{line.qty}</span>
                            <button className="btn-press p-1.5 text-mute hover:text-brand" onClick={() => setLineQty(line.productId, line.tier, line.qty + 1)}><Icon name="plus" size={13} /></button>
                          </div>
                          <span className="num text-[13.5px] font-extrabold">{fmtMoney(net, 0)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {sum.lines.length > 0 && (
                <div className="border-t border-line p-4">
                  {sum.issues.map((iss, i) => (
                    <p key={i} className="mb-2 flex items-center gap-1.5 rounded-md border border-berry/40 bg-berry/8 px-2.5 py-1.5 text-[11.5px] font-bold text-berry">
                      <Icon name="alert" size={13} /> {iss}
                    </p>
                  ))}
                  <div className="space-y-1 text-[12.5px] font-semibold">
                    <p className="flex justify-between text-mute"><span>المجموع</span><span className="num">{fmtMoney(sum.subtotal, 0)}</span></p>
                    <p className="flex justify-between text-sage"><span>خصم الكميات</span><span className="num">−{fmtMoney(sum.discount, 0)}</span></p>
                    <p className="flex justify-between text-mute"><span>التوصيل ({gov.name})</span><span className="num">{sum.deliveryFee === 0 ? "مجاني" : fmtMoney(sum.deliveryFee, 0)}</span></p>
                    <p className="flex justify-between border-t border-line pt-2 text-[15px] font-extrabold"><span>الإجمالي</span><span className="num text-brand">{fmtMoney(sum.total, 0)}</span></p>
                  </div>
                  <Btn size="lg" className="mt-3 w-full py-3" disabled={sum.issues.length > 0} onClick={openCheckout}>
                    إتمام الطلب <Icon name="chevron" size={16} className="rotate-180" />
                  </Btn>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── إتمام الطلب ── */}
      <Modal open={checkoutOpen} onClose={reset} title={placedId ? "تم استلام الطلب" : "إتمام الطلب"} wide>
        {placedId ? (
          <div className="text-center">
            <span className="pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sage/15 text-sage">
              <Icon name="check" size={30} strokeWidth={2.2} />
            </span>
            <h3 className="mt-4 font-display text-2xl font-bold">شكرًا لك! طلبك <span className="num text-brand">{placedId}</span> قيد المراجعة</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-mute">
              سيتواصل معك فريق المبيعات للتأكيد على واتساب، ويمكنك متابعة الحالة لحظة بلحظة من «تتبع الطلبات».
              التوصيل إلى <b className="text-ink">{gov.name}</b>: <b className="text-ink">{fmtDateShort(date)} ({window_})</b>
              {otpOk && <> · <b className="text-sage">أُنشئ حسابك وحُفظ العنوان والفاتورة فيه</b></>}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Btn variant="whatsapp" onClick={sendOrderWhatsApp}><Icon name="whatsapp" size={16} /> استلام الفاتورة واتساب</Btn>
              <Btn onClick={() => { reset(); setView("orders"); }}><Icon name="truck" size={16} /> تتبّع الطلب</Btn>
            </div>
          </div>
        ) : (
          <>
            {/* الخطوات */}
            <div className="mb-5 flex items-center gap-1">
              {STEPS.map((s, i) => (
                <div key={s} className="flex flex-1 items-center gap-1">
                  <span className={`num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${i < step ? "bg-sage text-cream" : i === step ? "bg-brand text-cream" : "bg-raise text-mute"}`}>
                    {i < step ? <Icon name="check" size={13} /> : i + 1}
                  </span>
                  <span className={`hidden text-[11.5px] font-bold sm:block ${i === step ? "text-brand" : "text-mute"}`}>{s}</span>
                  {i < STEPS.length - 1 && <span className={`h-0.5 flex-1 rounded ${i < step ? "bg-sage" : "bg-line"}`} />}
                </div>
              ))}
            </div>

            {step === 0 && (
              <div className="space-y-3">
                {sum.lines.map(({ line, product, rate, net }) => (
                  <div key={`${line.productId}-${line.tier}`} className="flex items-center justify-between rounded-lg border border-line bg-raise px-3.5 py-2.5">
                    <span className="text-[13px] font-bold">{product.name} <span className="text-mute">× {line.qty} ({line.tier === "box" ? "علب" : line.tier === "carton" ? "كراتين" : "طبالي"})</span></span>
                    <span className="flex items-center gap-2">
                      {rate > 0 && <Badge tone="sage">−{Math.round(rate * 100)}٪</Badge>}
                      <span className="num text-[13px] font-extrabold">{fmtMoney(net, 0)}</span>
                    </span>
                  </div>
                ))}
                <p className="text-[12px] font-semibold text-mute">
                  إجمالي الكمية: <b className="num">{Math.round(sum.cartons)}</b> كرتونة · بعد الخصم: <b className="num text-brand">{fmtMoney(sum.total, 0)}</b>
                </p>
                <Btn className="w-full" onClick={() => setStep(1)}>متابعة إلى بيانات التوصيل <Icon name="chevron" size={15} className="rotate-180" /></Btn>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3.5">
                {/* العناوين المحفوظة */}
                {user.savedAddresses && user.savedAddresses.length > 0 && (
                  <div>
                    <p className="label-xs mb-1.5">عناوينك المحفوظة</p>
                    <div className="flex flex-wrap gap-1.5">
                      {user.savedAddresses.map((a) => {
                        const g = GOVERNORATES.find((x) => x.id === a.govId);
                        return (
                          <button key={a.id} onClick={() => { setGovId(a.govId); setCity(a.city); setStreet(a.street); }}
                            className={`btn-press rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${govId === a.govId && city === a.city ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface text-mute hover:text-ink"}`}>
                            <Icon name="pin" size={12} className="me-1 inline" /> {g?.name} — {a.city}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label="المحافظة" hint={`رسوم التوصيل ${fmtMoney(gov.fee, 0)} · مدة ${gov.days} — مجاني للطلبات فوق ${fmtMoney(FREE_DELIVERY_MIN, 0)}`}>
                    <select className={inputCls} value={govId} onChange={(e) => setGovId(e.target.value)}>
                      {GOVERNORATES.map((g) => <option key={g.id} value={g.id}>{g.name} — {fmtMoney(g.fee, 0)}</option>)}
                    </select>
                  </Field>
                  <Field label="المدينة / المنطقة">
                    <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="مثال: مدينة نصر" />
                  </Field>
                  <Field label="العنوان التفصيلي">
                    <input className={inputCls} value={street} onChange={(e) => setStreet(e.target.value)} placeholder="الشارع، رقم العقار، علامة مميزة" />
                  </Field>
                  <Field label="تاريخ التوصيل" hint="لا توصيل يوم الجمعة — أقرب موعد بعد يومين">
                    <input type="date" min={deliveryMinDate()} className={`${inputCls} num`} value={date} onChange={(e) => setDate(e.target.value)} />
                  </Field>
                  <Field label="الفترة الزمنية">
                    <select className={inputCls} value={window_} onChange={(e) => setWindow_(e.target.value)}>
                      {["08:00 – 12:00", "12:00 – 16:00", "16:00 – 20:00"].map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </Field>
                  <div className="flex items-end">
                    <div className="w-full rounded-xl border border-dashed border-line bg-raise/70 px-3.5 py-2.5 text-[11.5px] font-bold text-mute">
                      <Icon name="truck" size={14} className="me-1 inline text-brand" />
                      التوصيل إلى {gov.name}: {sum.deliveryFee === 0 ? "مجاني (طلب كبير)" : fmtMoney(sum.deliveryFee, 0)} · خلال {gov.days}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Btn variant="outline" onClick={() => setStep(0)}><Icon name="chevron" size={15} /> رجوع</Btn>
                  <Btn className="flex-1" onClick={() => setStep(2)}>متابعة إلى الدفع والحساب <Icon name="chevron" size={15} className="rotate-180" /></Btn>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3.5">
                <p className="label-xs">طريقة الدفع</p>
                {(Object.keys(PAY_AR) as PaymentMethod[]).map((m) => (
                  <button key={m} onClick={() => setPayment(m)}
                    className={`btn-press flex w-full items-center justify-between rounded-xl border px-4 py-3 text-start ${payment === m ? "border-brand bg-brand/8 shadow-warm" : "border-line bg-surface hover:border-linestrong"}`}>
                    <span className="flex items-center gap-3">
                      <Icon name={m === "cod" ? "truck" : m === "transfer" ? "sheet" : "shield"} size={19} className={payment === m ? "text-brand" : "text-mute"} />
                      <span>
                        <span className="block text-[13.5px] font-bold">{PAY_AR[m]}</span>
                        <span className="block text-[11px] text-mute">
                          {m === "cod" ? "نقدًا أو بشبكة الدفع عند الاستلام" : m === "transfer" ? "فاتورة برقم الحساب البنكي — التحويل خلال ٤٨ ساعة" : "ميزة / فيزا / ماستركارد عبر بوابة آمنة"}
                        </span>
                      </span>
                    </span>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${payment === m ? "border-brand bg-brand text-cream" : "border-linestrong"}`}>
                      {payment === m && <Icon name="check" size={11} />}
                    </span>
                  </button>
                ))}

                {/* الحساب: OTP بنقرة */}
                <div className="rounded-xl border border-line bg-raise/70 p-4">
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="font-display text-[14px] font-bold">بيانات العميل وحسابك</p>
                    {verifiedAccount ? (
                      <Badge tone="sage"><Icon name="check" size={11} /> حساب موثّق</Badge>
                    ) : otpOk ? (
                      <Badge tone="sage"><Icon name="check" size={11} /> تم التحقق وإنشاء الحساب</Badge>
                    ) : (
                      <Badge tone="butter">تفعيل بالـOTP</Badge>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="اسم العميل / المنشأة">
                      <input className={inputCls} value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="مثال: أسواق النخيل" disabled={verifiedAccount} />
                    </Field>
                    <Field label="رقم الموبايل المصري (واتساب)">
                      <input dir="ltr" className={`${inputCls} num text-start ${phone && !phoneOk ? "border-berry" : phoneOk ? "border-sage" : ""}`}
                        value={phone} onChange={(e) => { setPhone(e.target.value); setOtpSent(false); setOtpOk(false); }} placeholder="2010XXXXXXXX" disabled={verifiedAccount} />
                      <p className={`mt-1 text-[10.5px] font-bold ${phoneOk ? "text-sage" : "text-mute"}`}>
                        {phoneOk ? "✓ رقم مصري صحيح — ستصلك تحديثات الطلب واتساب" : "الصيغة: 2010 / 2011 / 2012 / 2015 + ٨ أرقام"}
                      </p>
                    </Field>
                  </div>

                  {!verifiedAccount && phoneOk && !otpOk && (
                    <div className="mt-3 rounded-lg border border-butter/40 bg-butter/8 p-3">
                      {!otpSent ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[12px] font-bold leading-relaxed">
                            <Icon name="user" size={14} className="me-1 inline text-brand" />
                            أنشئ حسابك بنقرة — يُحفظ عنوانك وسجل فواتيرك، وتتبع طلباتك يصبح فوريًا.
                          </p>
                          <Btn variant="butter" size="sm" onClick={sendOtp}><Icon name="phone" size={14} /> إرسال رمز التحقق SMS</Btn>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[12px] font-bold">أدخل الرمز المكوّن من ٤ أرقام المرسل إلى <span className="num" dir="ltr">+{phone}</span></p>
                          {demoCode && (
                            <p className="num mt-1.5 inline-block rounded-md border border-dashed border-brand/50 bg-surface px-2.5 py-1 text-[11px] font-bold text-brand" dir="ltr">
                              تجريبي (بلا بوابة SMS): {demoCode}
                            </p>
                          )}
                          <div className="mt-2 flex gap-2">
                            <input dir="ltr" maxLength={4} value={otpInput}
                              onChange={(e) => { setOtpInput(e.target.value.replace(/\D/g, "")); setOtpError(false); }}
                              className={`${inputCls} num w-28 text-center text-[18px] font-bold tracking-[0.4em] ${otpError ? "shake border-berry" : ""}`} placeholder="0000" />
                            <Btn size="sm" onClick={checkOtp} disabled={otpInput.length !== 4}><Icon name="check" size={14} /> تحقق وفعّل</Btn>
                          </div>
                          {otpError && <p className="mt-1.5 text-[11px] font-bold text-berry">الرمز غير صحيح — أعد المحاولة</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-line bg-raise p-3.5 text-[12.5px] font-semibold">
                  <div className="flex justify-between"><span className="text-mute">الإجمالي بعد الخصم</span><span className="num">{fmtMoney(sum.subtotal - sum.discount, 0)}</span></div>
                  <div className="flex justify-between"><span className="text-mute">التوصيل — {gov.name}</span><span className="num">{sum.deliveryFee === 0 ? "مجاني" : fmtMoney(sum.deliveryFee, 0)}</span></div>
                  <div className="mt-1.5 flex justify-between border-t border-line pt-2 text-[15px] font-extrabold"><span>المستحق</span><span className="num text-brand">{fmtMoney(sum.total, 0)}</span></div>
                </div>
                <div className="flex gap-2">
                  <Btn variant="outline" onClick={() => setStep(1)}><Icon name="chevron" size={15} /> رجوع</Btn>
                  <Btn variant="sage" size="lg" className="flex-1 py-3" onClick={confirm} disabled={!canConfirm}>
                    <Icon name="stamp" size={17} /> تأكيد الطلب — {fmtMoney(sum.total, 0)}
                  </Btn>
                </div>
                <p className="text-center text-[11px] text-mute">
                  {canConfirm ? "جاهز للتأكيد — بياناتك صحيحة" : "أكمل الاسم ورقم الموبايل وتحقق بالـOTP للتأكيد"} · فاتورة ببطاقة ضريبية {COMPANY.taxId}
                </p>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
