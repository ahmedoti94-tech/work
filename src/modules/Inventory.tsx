import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { dateKey } from "../lib/payroll";
import { Badge, Btn, Card, Field, Icon, inputCls, Modal, SectionHead } from "../components/ui";

export default function Inventory() {
  const { rawMaterials, receiveStock, batches, products } = useStore();
  const [tab, setTab] = useState<"raw" | "batches">("raw");
  const [receiving, setReceiving] = useState<string | null>(null);
  const [qty, setQty] = useState(1000);

  const lowCount = rawMaterials.filter((r) => r.stock <= r.reorderAt).length;
  const rm = rawMaterials.find((r) => r.id === receiving);

  const batchRows = useMemo(() => batches.map((b) => {
    const product = products.find((p) => p.id === b.productId);
    const produced = new Date(b.producedAt);
    const expiry = new Date(produced); expiry.setDate(expiry.getDate() + b.shelfLifeDays);
    const daysLeft = Math.round((expiry.getTime() - Date.now()) / 86400000);
    return { b, product, expiryKey: dateKey(expiry), daysLeft };
  }).sort((a, b) => a.daysLeft - b.daysLeft), [batches, products]);

  const expiring = batchRows.filter((r) => r.daysLeft <= 21).length;
  const inventoryValue = rawMaterials.reduce((s, r) => s + r.stock * r.costPerUnit, 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-linestrong">
          {([["raw", "Raw materials"], ["batches", "Finished batches"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`btn-press px-4 py-2 text-[12.5px] font-bold ${tab === k ? "bg-ink text-bg dark:bg-cream dark:text-sunken" : "bg-surface text-mute hover:text-ink"}`}>
              {l}
            </button>
          ))}
        </div>
        {tab === "raw" ? (
          <Badge tone={lowCount ? "berry" : "sage"}>{lowCount ? `${lowCount} under reorder point` : "All materials healthy"}</Badge>
        ) : (
          <Badge tone={expiring ? "butter" : "sage"}>{expiring ? `${expiring} batch(es) expire within 21 days` : "No expiry alerts"}</Badge>
        )}
        <span className="ml-auto chip">Raw stock value <b className="num text-ink">${Math.round(inventoryValue).toLocaleString()}</b></span>
      </div>

      {tab === "raw" ? (
        <Card className="p-4">
          <SectionHead title="Raw material silos & stores" sub="Live stock levels against reorder points — receiving writes a goods-received note to the audit trail" />
          <div className="grid gap-3 md:grid-cols-2">
            {rawMaterials.map((r) => {
              const pct = Math.min(100, Math.round((r.stock / (r.reorderAt * 2.5)) * 100));
              const low = r.stock <= r.reorderAt;
              return (
                <div key={r.id} className={`rounded-xl border p-3.5 transition-colors ${low ? "border-berry/50 bg-berry/5" : "border-line bg-raise hover:border-linestrong"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13.5px] font-bold">{r.name}</p>
                      <p className="text-[11px] text-mute">{r.supplier} · last delivery {r.lastDelivery}</p>
                    </div>
                    {low ? <Badge tone="berry"><Icon name="alert" size={11} /> Reorder</Badge> : <Badge tone="sage">OK</Badge>}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-line">
                      <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${low ? "bg-berry" : "bg-sage"}`} style={{ width: `${pct}%` }} />
                      <div className="absolute inset-y-0 w-0.5 bg-ink/50 dark:bg-cream/60" style={{ left: `${Math.round((r.reorderAt / (r.reorderAt * 2.5)) * 100)}%` }} title="Reorder point" />
                    </div>
                    <span className="num text-[12.5px] font-extrabold">{r.stock.toLocaleString()} {r.unit}</span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-mute">
                    <span>Reorder at <span className="num font-bold text-ink">{r.reorderAt.toLocaleString()}</span> · <span className="num">${r.costPerUnit}/{r.unit}</span></span>
                    <Btn size="sm" variant="outline" onClick={() => { setReceiving(r.id); setQty(r.reorderAt); }}>
                      <Icon name="truck" size={13} /> Receive
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div>
          <SectionHead title="Finished-goods batch tracking" sub="Every LOT carries a production line, bake date and shelf-life countdown — FIFO dispatch enforced" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {batchRows.map(({ b, product, expiryKey, daysLeft }) => (
              <Card key={b.id} hover className="p-4">
                <div className="flex items-center gap-3">
                  <img src={product?.img} alt={product?.name} className="h-12 w-12 rounded-lg object-cover" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{product?.name}</p>
                    <p className="num text-[11px] text-mute">{b.batchNo} · {b.line}</p>
                  </div>
                  <span className={`num rounded-lg px-2 py-1 text-[11px] font-extrabold ${
                    daysLeft <= 7 ? "bg-berry text-cream" : daysLeft <= 21 ? "bg-butter text-[#5c430c]" : "bg-sage/15 text-sage"}`}>
                    {daysLeft}d left
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11.5px]">
                  <div className="rounded-md border border-line bg-raise py-1.5"><p className="label-xs text-[9px]">Qty</p><p className="num font-bold">{b.qty} ctn</p></div>
                  <div className="rounded-md border border-line bg-raise py-1.5"><p className="label-xs text-[9px]">Baked</p><p className="num font-bold">{b.producedAt.slice(5)}</p></div>
                  <div className="rounded-md border border-line bg-raise py-1.5"><p className="label-xs text-[9px]">Expires</p><p className="num font-bold">{expiryKey.slice(5)}</p></div>
                </div>
                {daysLeft <= 7 && (
                  <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-bold text-berry">
                    <Icon name="alert" size={13} /> Critical — prioritize for dispatch or donate before {expiryKey}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      <Modal open={!!receiving} onClose={() => setReceiving(null)} title={`Receive delivery — ${rm?.name ?? ""}`}
        footer={
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setReceiving(null)}>Cancel</Btn>
            <Btn disabled={qty <= 0} onClick={() => { if (receiving) receiveStock(receiving, qty); setReceiving(null); }}>
              <Icon name="check" size={15} /> Book into stock
            </Btn>
          </div>
        }>
        <div className="space-y-4">
          <p className="rounded-lg border border-line bg-raise px-3.5 py-2.5 text-[12.5px] text-mute">
            Supplier <b className="text-ink">{rm?.supplier}</b> · current stock <b className="num text-ink">{rm?.stock.toLocaleString()} {rm?.unit}</b> · reorder point <b className="num text-ink">{rm?.reorderAt.toLocaleString()}</b>
          </p>
          <Field label={`Quantity received (${rm?.unit})`}>
            <input type="number" min={1} className={`${inputCls} num`} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
