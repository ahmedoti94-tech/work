import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  GIT_COMMANDS, README_AR, REPO_NAME, buildRepoZip, downloadBlob, downloadTextFile, repoStats,
} from "../lib/repo";
import { useStore } from "../lib/store";
import { Badge, Btn, Icon, SectionHead } from "../components/ui";

export default function GithubExport() {
  const { user, toast, auditLog } = useStore();
  const [progress, setProgress] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const stats = useMemo(() => repoStats(), []);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch { /* clipboard unavailable */ }
  };

  const exportZip = async () => {
    setProgress(0);
    try {
      const { blob, count } = await buildRepoZip(setProgress);
      downloadBlob(blob, `${REPO_NAME}.zip`);
      auditLog(user.name, user.role, "تصدير المشروع إلى GitHub", `حزمة ZIP — ${count} ملفًا (${stats.sizeKb} ك.ب) جاهزة للرفع`);
      toast(`نُزّلت الحزمة الكاملة (${count} ملفًا) — ارفعها أو ادفعها إلى GitHub`, "sage");
    } finally {
      setTimeout(() => setProgress(null), 900);
    }
  };

  const steps = [
    { n: "١", t: "نزّل المصدر", d: "حزمة ZIP تحتوي كل ملفات المشروع الفعلية + README عربي ورخصة MIT و.gitignore" },
    { n: "٢", t: "أنشئ المستودع", d: `افتح github.com/new وسمِّه ${REPO_NAME} (خاص أو عام)` },
    { n: "٣", t: "ارفع الأوامر", d: "فك الضغط وشغّل أوامر git الجاهزة — نُسخة أدناه بنقرة" },
  ];

  return (
    <div>
      <SectionHead
        title="تصدير المشروع إلى GitHub"
        desc="حزمة كاملة لمصدر المنصة — جاهزة للنشر على مستودع GitHub خلال دقائق"
        actions={
          <a href={`https://github.com/new?name=${REPO_NAME}`} target="_blank" rel="noreferrer">
            <Btn variant="outline"><Icon name="download" size={15} /> إنشاء مستودع على GitHub</Btn>
          </a>
        }
      />

      {/* خطوات سريعة */}
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div key={s.n} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="card relative overflow-hidden p-4">
            <span className="font-display absolute -top-3 end-2 select-none text-[64px] font-bold leading-none text-brand/10">{s.n}</span>
            <p className="font-display text-[15px] font-bold">{s.t}</p>
            <p className="mt-1 text-[11.5px] font-semibold leading-relaxed text-mute">{s.d}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* بطاقة التنزيل */}
        <div className="card flex flex-col p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[16px] font-bold">حزمة المصدر الكاملة</h3>
            <Badge tone="sage"><Icon name="check" size={11} /> محدّثة لحظيًا</Badge>
          </div>
          <p className="mt-1 text-[12px] font-semibold text-mute">
            تُقرأ الملفات الفعلية للمشروع وقت البناء — ما تنزّله هو ما يعمل الآن بالضبط.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { v: stats.count, l: "ملف" },
              { v: `${stats.sizeKb} ك.ب`, l: "قبل الضغط" },
              { v: `${stats.tsx + stats.ts}`, l: "TS / TSX" },
            ].map((c) => (
              <div key={c.l} className="rounded-xl border border-line bg-raise/70 py-3">
                <p className="num font-display text-[18px] font-bold text-brand">{c.v}</p>
                <p className="text-[10.5px] font-bold text-mute">{c.l}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5 rounded-xl border border-line bg-raise/60 p-3.5 text-[11.5px] font-bold text-mute">
            <p className="flex items-center gap-2"><Icon name="check" size={13} className="text-sage" /> src/ كامل: المنطق والمكونات والوحدات</p>
            <p className="flex items-center gap-2"><Icon name="check" size={13} className="text-sage" /> الإعدادات: package.json · vite · tsconfig · index.html</p>
            <p className="flex items-center gap-2"><Icon name="check" size={13} className="text-sage" /> PWA: manifest + service worker</p>
            <p className="flex items-center gap-2"><Icon name="check" size={13} className="text-sage" /> README.md عربي + LICENSE (MIT) + ‎.gitignore</p>
          </div>

          <div className="mt-auto pt-4">
            {progress != null ? (
              <div>
                <div className="mb-1.5 flex justify-between text-[11.5px] font-bold">
                  <span className="text-brand">جارٍ الضغط…</span>
                  <span className="num text-mute">{progress}٪</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-sunken">
                  <motion.div className="h-full rounded-full bg-brand" animate={{ width: `${progress}%` }} transition={{ duration: 0.25 }} />
                </div>
              </div>
            ) : (
              <Btn size="lg" className="w-full py-3.5 text-[15px]" onClick={exportZip}>
                <Icon name="download" size={18} /> تنزيل {REPO_NAME}.zip
              </Btn>
            )}
            <div className="mt-2.5 flex gap-2">
              <Btn variant="outline" size="sm" className="flex-1" onClick={() => { downloadTextFile("README.md", README_AR); toast("نُزّل README.md العربي", "sage"); }}>
                <Icon name="sheet" size={14} /> README.md
              </Btn>
              <Btn variant="outline" size="sm" className="flex-1" onClick={() => copy("readme", README_AR)}>
                <Icon name={copied === "readme" ? "check" : "edit"} size={14} /> {copied === "readme" ? "نُسخ" : "نسخ README"}
              </Btn>
            </div>
          </div>
        </div>

        {/* الأوامر + المعاينة */}
        <div className="space-y-4 lg:col-span-3">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="font-display text-[15px] font-bold">أوامر الرفع الجاهزة</h3>
              <Btn size="sm" variant="outline" onClick={() => copy("git", GIT_COMMANDS)}>
                <Icon name={copied === "git" ? "check" : "sheet"} size={14} /> {copied === "git" ? "نُسخ" : "نسخ الكل"}
              </Btn>
            </div>
            <div dir="ltr" className="bg-[#17120c] p-4">
              <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed text-[#f1e5cf]">
                {GIT_COMMANDS.split("\n").map((line, i) => (
                  <div key={i} className={line.startsWith("#") ? "text-[#a08a69]" : ""}>
                    <span className="me-3 inline-block w-5 select-none text-end text-[#57432b]">{i + 1}</span>
                    {line.startsWith("git") && <span className="text-[#e39b3a]">$ </span>}
                    {line}
                  </div>
                ))}
              </pre>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="font-display text-[15px] font-bold">معاينة README.md</h3>
              <Badge tone="mute">عربي · يظهر في صفحة المستودع</Badge>
            </div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap p-4 text-[12px] font-semibold leading-relaxed text-ink/90">
              {README_AR}
            </pre>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-mute">
        بعد الرفع فعّل GitHub Pages أو استضف dist/ على أي CDN — المشروع يعمل ثابتًا بدون خادم. المخطط الإنتاجي (Express + MongoDB + Redis) موثّق في «المخطط المعماري».
      </p>
    </div>
  );
}
