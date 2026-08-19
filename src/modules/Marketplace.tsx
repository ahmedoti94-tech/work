import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../lib/store";
import type { PackTier, Product } from "../lib/types";
import { cartonsOf, fmtMoney, volumeRate } from "../lib/payroll";
import { Badge, Btn, Card, Icon, inputCls, Modal } from "../components/ui";

const FAMILIES = ["All", "Chocolate", "Sesame", "Dates", "Butter", "Oat", "Fruit", "Coconut"] as const;

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1 text-[11px] font-bold text-butter">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9L12 2.5Z" /></svg>
      {rating.toFixed(1)}
    </span>
  );
}

export default function Marketplace() {
  const { products, addToCart } = useStore();
  const [family, setFamily] = useState<string>("All");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"popular" | "priceAsc" | "priceDesc">("popular");
  const [detail, setDetail] = useState<Product | null>(null);

  const list = useMemo(() => {
    let l = products.filter((p) => (family === "All" || p.family === family) &&
      (p.name + p.flavor + p.arabicName).toLowerCase().includes(q.toLowerCase()));
    const price = (p: Product) => p.packs[0].price;
    if (sort === "priceAsc") l = [...l].sort((a, b) => price(a) - price(b));
    if (sort === "priceDesc") l = [...l].sort((a, b) => price(b) - price(a));
    if (sort === "popular") l = [...l].sort((a, b) => a.soldRank - b.soldRank);
    return l;
  }, [products, family, q, sort]);

  return (
    <div>
      {/* shop head — today's bake board */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-line bg-ink text-bg dark:bg-cream dark:text-sunken">
        <div className="dotgrid absolute inset-0 opacity-25" />
        <div className="relative flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="max-w-xl">
            <p className="label-xs text-butter">Wholesale & retail · baked at 05:40 this morning</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-[40px]">
              Straight from<br />the tunnel ovens.
            </h2>
            <p className="mt-2.5 text-[13px] leading-relaxed opacity-75">
              Eight family recipes, three pack scales. Volume tiers unlock automatically:
              <span className="font-bold text-butter"> −5% at 10 cartons</span>,
              <span className="font-bold text-butter"> −9% at 20</span>,
              <span className="font-bold text-butter"> −14% at 50</span>. Same-day dispatch before 11:00.
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            {[["8", "recipes"], ["60 ct", "per pallet"], ["11:00", "dispatch cutoff"]].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-linestrong/40 bg-sunken/30 px-4 py-3 text-center dark:bg-sunken/60">
                <p className="num font-display text-xl font-extrabold text-butter">{v}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap gap-1.5">
          {FAMILIES.map((f) => (
            <button key={f} onClick={() => setFamily(f)}
              className={`btn-press rounded-full border px-3.5 py-1.5 text-[12px] font-bold ${
                family === f ? "border-brand bg-brand text-cream shadow-warm" : "border-line bg-surface text-mute hover:border-linestrong hover:text-ink"
              }`}>
              {f}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bakes…"
              className={`${inputCls} w-44 py-1.5 pl-8 text-[12.5px]`} />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
            className={`${inputCls} w-auto py-1.5 text-[12.5px] font-semibold`}>
            <option value="popular">Most popular</option>
            <option value="priceAsc">Price ↑</option>
            <option value="priceDesc">Price ↓</option>
          </select>
        </div>
      </div>

      {/* product grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {list.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.35 }}>
            <Card hover className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl" >
              <div onClick={() => setDetail(p)}>
                <div className="relative overflow-hidden">
                  <img src={p.img} alt={p.name} loading="lazy"
                    className="aspect-square w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] group-hover:rotate-[0.6deg]" />
                  {p.badge && (
                    <span className="absolute left-3 top-3 rounded-md bg-ink/85 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-butter">
                      {p.badge}
                    </span>
                  )}
                  <span className={`absolute right-3 top-3 chip border-0 ${p.stock < 100 ? "bg-berry text-cream" : "bg-surface/90"}`}>
                    {p.stock} ctn
                  </span>
                  <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-sunken/50 to-transparent" />
                </div>
                <div className="p-3.5 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-[15px] font-bold leading-tight">{p.name}</h3>
                      <p className="text-[11.5px] text-mute">{p.arabicName} · {p.flavor} · {p.weight}</p>
                    </div>
                    <Stars rating={p.rating} />
                  </div>
                </div>
              </div>
              <div className="mt-auto flex items-end justify-between px-3.5 pb-3.5">
                <div className="leading-tight">
                  <p className="label-xs text-[9.5px]">From · box of {p.packs[0].units}</p>
                  <p className="num font-display text-lg font-extrabold text-brand">{fmtMoney(p.packs[0].price * p.packs[0].units)}</p>
                  <p className="text-[10px] text-mute">MOQ {p.moqCartons} cartons</p>
                </div>
                <Btn size="sm" onClick={() => setDetail(p)}>
                  <Icon name="plus" size={14} /> Add
                </Btn>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
      {list.length === 0 && (
        <p className="py-16 text-center text-[13px] text-mute">No bakes match “{q}” in {family}. Try clearing the filters.</p>
      )}

      <ProductModal product={detail} onClose={() => setDetail(null)}
        onAdd={(p, tier, qty) => { addToCart(p.id, tier, qty); setDetail(null); }} />
    </div>
  );
}

function ProductModal({ product, onClose, onAdd }: {
  product: Product | null; onClose: () => void;
  onAdd: (p: Product, tier: PackTier, qty: number) => void;
}) {
  const [tier, setTier] = useState<PackTier>("carton");
  const [qty, setQty] = useState(5);
  const [showNutrition, setShowNutrition] = useState(false);
  if (!product) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const pack = product.packs.find((p) => p.tier === tier)!;
  const cartons = cartonsOf(tier, qty);
  const rate = volumeRate(cartons);
  const gross = pack.price * pack.units * qty;
  const net = gross * (1 - rate);

  return (
    <Modal open={!!product} onClose={onClose} title={null} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-xl border border-line">
          <img src={product.img} alt={product.name} className="aspect-square h-full w-full object-cover" />
          {product.badge && (
            <span className="absolute left-3 top-3 rounded-md bg-ink/85 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-butter">{product.badge}</span>
          )}
        </div>
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-xs">{product.family} family · {product.weight}</p>
              <h3 className="mt-1 font-display text-2xl font-extrabold leading-tight">{product.name}</h3>
              <p className="text-[13px] text-mute">{product.arabicName} — {product.flavor}</p>
            </div>
            <Stars rating={product.rating} />
          </div>

          {/* pack tier selector */}
          <div className="mt-4 space-y-2">
            {product.packs.map((p) => (
              <button key={p.tier} onClick={() => setTier(p.tier)}
                className={`btn-press flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition-all ${
                  tier === p.tier ? "border-brand bg-brand/8 shadow-warm" : "border-line bg-surface hover:border-linestrong"
                }`}>
                <span>
                  <span className="block text-[13px] font-bold capitalize">{p.tier}</span>
                  <span className="block text-[11px] text-mute">{p.label}</span>
                </span>
                <span className="num text-[13.5px] font-extrabold text-brand">{fmtMoney(p.price * p.units)}</span>
              </button>
            ))}
          </div>

          {/* qty + price */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-linestrong">
              <button className="btn-press p-2.5 text-mute hover:text-brand" onClick={() => setQty(Math.max(1, qty - 1))}><Icon name="minus" size={15} /></button>
              <span className="num w-10 text-center text-[14px] font-bold">{qty}</span>
              <button className="btn-press p-2.5 text-mute hover:text-brand" onClick={() => setQty(qty + 1)}><Icon name="plus" size={15} /></button>
            </div>
            <div className="flex-1 rounded-lg border border-line bg-raise px-3 py-2 text-right">
              <p className="label-xs text-[9.5px]">{Math.round(cartons * 10) / 10} cartons</p>
              <p className="num font-display text-lg font-extrabold leading-tight">
                {rate > 0 && <span className="mr-2 text-[12px] font-bold text-mute line-through">{fmtMoney(gross, 0)}</span>}
                {fmtMoney(net, 0)}
              </p>
            </div>
          </div>
          {rate > 0 ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] font-bold text-sage"><Icon name="check" size={13} /> B2B volume tier active: −{Math.round(rate * 100)}% on this line</p>
          ) : (
            <p className="mt-2 text-[11.5px] text-mute">Add {Math.max(0, 10 - Math.round(cartons))} more cartons of any pack to unlock −5%.</p>
          )}
          {cartons < product.moqCartons && (
            <p className="mt-1.5 flex items-center gap-1.5 rounded-md border border-butter/50 bg-butter/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-butter">
              <Icon name="alert" size={13} /> MOQ is {product.moqCartons} cartons — checkout will block smaller orders.
            </p>
          )}

          {/* ingredients + nutrition */}
          <div className="mt-4">
            <p className="label-xs mb-1.5">Ingredients</p>
            <div className="flex flex-wrap gap-1.5">
              {product.ingredients.map((ing) => <span key={ing} className="chip">{ing}</span>)}
            </div>
            <button onClick={() => setShowNutrition(!showNutrition)}
              className="btn-press mt-3 flex items-center gap-1.5 text-[12px] font-bold text-brand">
              <Icon name="chevron" size={14} className={`transition-transform ${showNutrition ? "rotate-180" : ""}`} />
              Nutrition per 100 g
            </button>
            {showNutrition && (
              <div className="mt-2 grid grid-cols-2 gap-x-4 rounded-lg border border-line bg-raise p-3 text-[12px]">
                {product.nutrition.map((n) => (
                  <div key={n.label} className="flex justify-between border-b border-dashed border-line py-1">
                    <span className="text-mute">{n.label}</span><span className="num font-bold">{n.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Btn size="lg" className="mt-5 w-full py-3" onClick={() => onAdd(product, tier, qty)}>
            <Icon name="cart" size={16} /> Add to order — {fmtMoney(net, 0)}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
