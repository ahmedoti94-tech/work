/* ─────────────────────────────────────────────────────────────────────────────
 * مركز تصدير GitHub — يقرأ ملفات المشروع الفعلية وقت البناء
 * (import.meta.glob بصيغة raw) ويحزمها ZIP جاهزًا للرفع إلى مستودع GitHub.
 * يشمل أيضًا README عربي كامل ورخصة MIT وملف .gitignore.
 * ──────────────────────────────────────────────────────────────────────────── */
import JSZip from "jszip";
import { COMPANY } from "./data";

// ملفات المصدر والإعدادات الفعلية — تُقرأ نصيًا وقت البناء
const SRC_FILES = import.meta.glob("/src/**/*.{ts,tsx,css}", {
  query: "?raw", import: "default", eager: true,
}) as Record<string, string>;

const ROOT_FILES = import.meta.glob(
  ["/package.json", "/vite.config.js", "/tsconfig.json", "/index.html", "/.gitignore", "/public/**/*"],
  { query: "?raw", import: "default", eager: true }
) as Record<string, string>;

export const REPO_NAME = "misr-food-industries-erp";

export function repoFiles(): { path: string; content: string }[] {
  const out: { path: string; content: string }[] = [];
  for (const [path, content] of Object.entries({ ...ROOT_FILES, ...SRC_FILES })) {
    out.push({ path: path.replace(/^\//, ""), content });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function repoStats() {
  const files = repoFiles();
  const bytes = files.reduce((s, f) => s + new Blob([f.content]).size, 0);
  return {
    count: files.length,
    sizeKb: Math.round(bytes / 1024),
    tsx: files.filter((f) => f.path.endsWith(".tsx")).length,
    ts: files.filter((f) => f.path.endsWith(".ts")).length,
  };
}

/* ─── ملفات إضافية تُضاف لجذر المستودع ─── */
export const README_AR = `# ${COMPANY.name} — منصة ERP & متجر الجملة

> منصة تشغيل متكاملة لمصنع بسكويت: **بوابة عمال، حضور وانصراف بـQR موقّع، مسير رواتب بالجنيه المصري،
> كتالوج جملة B2B بشرائح خصم تلقائية، توصيل بمصفوفة المحافظات، ومركز أمان وتدقيق** — عربية بالكامل RTL-first.

## التشغيل السريع

\`\`\`bash
npm install
npm run dev        # بيئة التطوير
npm run build      # نسخة الإنتاج (dist/)
npm run preview    # معاينة نسخة الإنتاج
\`\`\`

## التقنيات

- **الواجهة**: React 18 + TypeScript + Vite + Tailwind CSS (RTL) + Framer Motion + Recharts
- **الحالة**: Zustand · **التخزين المحلي**: IndexedDB-جاهز (طابور حضور دون اتصال)
- **PWA**: Service Worker + Manifest — يعمل دون إنترنت ويزامن تلقائيًا
- **المرجع الإنتاجي** (موثّق داخل التطبيق → «النظام والتدقيق»): Node.js + Express + MongoDB (Mongoose)
  + Redis للفهارس المركّبة وحدود المعدل وجلسات JWT

## أبرز الوحدات

| الوحدة | الوصف |
|---|---|
| بوابة العمال | إضافة/تعديل/أرشفة + بطاقة عمل وQR موقّع HMAC فوري |
| سجل الحضور | كشك بوابات بأزرار ضخمة + PIN + ماسح أمني + Geo-fence |
| مسير الرواتب | الصيغة المصرية (شهري/يومية) + إضافي ×١٫٥ − خصومات وسلف |
| كتالوج الجملة | ٨ خطوط بسكويت + محرك توصيات مفسَّر + بطاقات تفاعلية 3D |
| السداد | محافظات مصر (رسوم ومدة) + تحقق ‎+20‎ + إنشاء حساب بـOTP |
| مركز الأمان | JWT قصير العمر + Redis rate-limits + سجل تهديدات + RBAC |
| التدقيق | سلسلة تجزئة ملحق-فقط + IP وجهاز لكل إجراء |

## الأدوار (للتجربة)

| الدور | اسم الدخول التجريبي |
|---|---|
| المالك (Super Admin) | أيمن الكردي |
| الموارد البشرية | هالة عبد العظيم |
| مشرف الوردية | سيد رمضان |
| مندوب مبيعات | مصطفى حسان |
| تاجر جملة (B2B) | شركة النور للتوزيع |

> رمز PIN العمال للكشك: **1234**

## الترخيص

MIT © ${COMPANY.owner} — ${COMPANY.name}
`;

export const GIT_COMMANDS = `# 1) أنشئ مستودعًا جديدًا على github.com/new باسم ${REPO_NAME}

# 2) من مجلد المشروع بعد فك الضغط:
git init
git branch -M main
git add .
git commit -m "feat: ${COMPANY.name} — منصة ERP ومتجر الجملة (نسخة أولية)"

# 3) اربط المستودع وارفع:
git remote add origin https://github.com/الاسم/${REPO_NAME}.git
git push -u origin main`;

const LICENSE_TEXT = `MIT License

Copyright (c) ${new Date().getFullYear()} ${COMPANY.owner} — ${COMPANY.name}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

/* ─── بناء الـZIP ─── */
export async function buildRepoZip(
  onProgress?: (pct: number) => void
): Promise<{ blob: Blob; count: number }> {
  const zip = new JSZip();
  const root = zip.folder(REPO_NAME)!;
  const files = repoFiles();
  for (const f of files) root.file(f.path, f.content);
  root.file("README.md", README_AR);
  root.file("LICENSE", LICENSE_TEXT);
  if (!files.some((f) => f.path === ".gitignore")) {
    root.file(".gitignore", "node_modules/\ndist/\n.env\n.env.local\n*.log\n.DS_Store\n");
  }
  onProgress?.(15);
  const blob = await zip.generateAsync(
    { type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } },
    (meta) => onProgress?.(15 + Math.round(meta.percent * 0.85))
  );
  return { blob, count: files.length + 3 };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  downloadBlob(new Blob([content], { type: mime }), filename);
}
