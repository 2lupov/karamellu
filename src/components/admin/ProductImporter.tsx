import { useMemo, useRef, useState } from "react";
import { Upload, Download, X, Check, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Category { id: string; name: string; }
interface Props {
  categories: Category[];
  onClose: () => void;
  onDone: () => void;
}

interface Row {
  barcode: string;
  brand: string;
  name: string;
  stock_quantity: number;
  cost_price: number;
  price: number;
  category_hint: string;
  category_id: string | null;
  error?: string;
}

const CSV_HEADERS = ["barcode", "brand", "name", "stock_quantity", "cost_price", "price", "category_hint"];
const TEMPLATE = `${CSV_HEADERS.join(",")}
8005610606781,Londa,Окисник Londa 9%,4,160,260,Окисники
4064666217314,Wella,Фарба Koleston Perfect 5/75,2,210,460,Фарби
`;

// Simple keyword → category mapper. Falls back to "category_hint" exact match.
const KEYWORD_MAP: Array<[RegExp, string]> = [
  [/фарб|koleston|igora|majirel|inoa|color|кольор/i, "Фарби"],
  [/окисник|оксид|oxydant|developer|peroxide/i, "Окисники"],
  [/шампун|shampoo/i, "Шампуні"],
  [/бальзам|кондиц|conditioner/i, "Бальзами"],
  [/маск|mask/i, "Маски"],
  [/спрей|spray|термозах|fluid|флюїд|олі|oil|сироват|serum/i, "Догляд"],
  [/мус|пінк|віск|wax|гел|gel|лак|hairspray|стайл/i, "Стайлінг"],
  [/крем|cream|hand|кр\.\s*рук/i, "Догляд за тілом"],
  [/тон|toner|пігмент|pigment/i, "Тонування"],
  [/пенюар|рукав|мисочк|пензл|щіт|гребін|резинк|крабік|заколк|пов\u2019яз|спонж|пилоч|шарф|пакет|акс/i, "Аксесуари"],
];

const findCategoryId = (cats: Category[], row: { name: string; brand: string; category_hint: string }): string | null => {
  // Exact match on hint
  if (row.category_hint) {
    const exact = cats.find((c) => c.name.toLowerCase() === row.category_hint.toLowerCase());
    if (exact) return exact.id;
  }
  const haystack = `${row.category_hint} ${row.name} ${row.brand}`;
  for (const [re, catName] of KEYWORD_MAP) {
    if (re.test(haystack)) {
      const match = cats.find((c) => c.name.toLowerCase() === catName.toLowerCase());
      if (match) return match.id;
    }
  }
  return null;
};

// Minimal CSV parser supporting quoted fields and commas
const parseCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (field !== "" || cur.length) { cur.push(field); rows.push(cur); cur = []; field = ""; }
        if (ch === "\r" && text[i + 1] === "\n") i++;
      } else field += ch;
    }
  }
  if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
};

const ProductImporter = ({ categories, onClose, onDone }: Props) => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF" + TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const data = parseCSV(text);
    if (!data.length) { toast.error("Файл порожній"); return; }
    const headers = data[0].map((h) => h.trim().toLowerCase());
    const idx = (k: string) => headers.indexOf(k);
    const required = ["barcode", "name"];
    for (const r of required) {
      if (idx(r) === -1) { toast.error(`Немає колонки "${r}"`); return; }
    }
    const parsed: Row[] = data.slice(1).map((cols) => {
      const get = (k: string) => (idx(k) === -1 ? "" : (cols[idx(k)] || "").trim());
      const barcode = get("barcode");
      const name = get("name");
      const brand = get("brand");
      const category_hint = get("category_hint");
      const stock_quantity = parseInt(get("stock_quantity") || "0", 10) || 0;
      const cost_price = parseFloat(get("cost_price") || "0") || 0;
      const price = parseFloat(get("price") || "0") || 0;
      const row: Row = {
        barcode, brand, name, stock_quantity, cost_price, price, category_hint,
        category_id: findCategoryId(categories, { name, brand, category_hint }),
      };
      if (!barcode) row.error = "немає штрих-коду";
      else if (!name) row.error = "немає назви";
      return row;
    });
    setRows(parsed);
  };

  const valid = useMemo(() => rows?.filter((r) => !r.error) ?? [], [rows]);
  const invalid = useMemo(() => rows?.filter((r) => r.error) ?? [], [rows]);

  const runImport = async () => {
    if (!valid.length) return;
    setImporting(true);
    setProgress(0);
    const chunkSize = 50;
    let done = 0;
    for (let i = 0; i < valid.length; i += chunkSize) {
      const chunk = valid.slice(i, i + chunkSize).map((r) => ({
        barcode: r.barcode,
        brand: r.brand,
        name: r.name,
        price: r.price,
        cost_price: r.cost_price,
        stock_quantity: r.stock_quantity,
        category_id: r.category_id,
        is_active: false,
        skin_type: "Для всіх типів шкіри",
      }));
      const { error } = await supabase
        .from("products")
        .upsert(chunk, { onConflict: "barcode", ignoreDuplicates: false });
      if (error) {
        toast.error(`Помилка на партії ${i / chunkSize + 1}: ${error.message}`);
        setImporting(false);
        return;
      }
      done += chunk.length;
      setProgress(done);
    }
    toast.success(`Імпортовано ${done} товарів (приховані)`);
    setImporting(false);
    onDone();
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8"
      style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-lg w-full max-w-3xl mx-4 p-6 md:p-8 border"
        style={{ background: "hsl(var(--admin-surface))", borderColor: "hsl(var(--admin-border))" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-sans text-base font-medium">Імпорт товарів (CSV)</h2>
          <button onClick={onClose} className="p-1" style={{ color: "hsl(var(--admin-text-muted))" }}><X size={16} /></button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={downloadTemplate} className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-md border" style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text-muted))" }}>
              <Download size={13} /> Шаблон CSV
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-md font-sans" style={{ background: "hsl(var(--admin-accent))", color: "#fff" }}>
              <Upload size={13} /> Обрати файл
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            {fileName && <span className="text-[12px]" style={{ color: "hsl(var(--admin-text-muted))" }}>{fileName}</span>}
          </div>

          <p className="text-[11px] leading-relaxed" style={{ color: "hsl(var(--admin-text-muted))" }}>
            Колонки: <code>barcode, brand, name, stock_quantity, cost_price, price, category_hint</code>. Імпортовані товари створюються <b>прихованими</b> (is_active=false). Дублікати оновлюються за штрих-кодом. Категорія підбирається автоматично за ключовими словами; якщо не знайдено — лишається порожньою.
          </p>

          {rows && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-[12px] font-sans">
                <div className="rounded-md border px-3 py-2" style={{ borderColor: "hsl(var(--admin-border))" }}>
                  Всього: <b>{rows.length}</b>
                </div>
                <div className="rounded-md border px-3 py-2" style={{ borderColor: "hsl(var(--admin-success) / 0.4)", color: "hsl(var(--admin-success))" }}>
                  Готові: <b>{valid.length}</b>
                </div>
                <div className="rounded-md border px-3 py-2" style={{ borderColor: invalid.length ? "hsl(var(--admin-danger) / 0.4)" : "hsl(var(--admin-border))", color: invalid.length ? "hsl(var(--admin-danger))" : "inherit" }}>
                  Помилки: <b>{invalid.length}</b>
                </div>
              </div>

              <div className="rounded-md border overflow-hidden max-h-80 overflow-y-auto" style={{ borderColor: "hsl(var(--admin-border))" }}>
                <table className="w-full text-[12px] font-sans">
                  <thead className="sticky top-0" style={{ background: "hsl(var(--admin-surface))" }}>
                    <tr className="border-b" style={{ borderColor: "hsl(var(--admin-border))" }}>
                      {["Штрих-код", "Бренд", "Назва", "К-сть", "Ціна", "Категорія", ""].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-[10px] uppercase tracking-widest font-medium" style={{ color: "hsl(var(--admin-text-muted))" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 200).map((r, i) => (
                      <tr key={i} className="border-b last:border-0" style={{ borderColor: "hsl(var(--admin-border))" }}>
                        <td className="px-3 py-1.5 font-mono text-[11px]">{r.barcode || "—"}</td>
                        <td className="px-3 py-1.5">{r.brand}</td>
                        <td className="px-3 py-1.5 max-w-[260px] truncate">{r.name}</td>
                        <td className="px-3 py-1.5">{r.stock_quantity}</td>
                        <td className="px-3 py-1.5">{r.price ? `₴${r.price}` : "—"}</td>
                        <td className="px-3 py-1.5" style={{ color: r.category_id ? "inherit" : "hsl(var(--admin-text-muted))" }}>
                          {categories.find((c) => c.id === r.category_id)?.name || "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          {r.error
                            ? <span className="flex items-center gap-1 text-[11px]" style={{ color: "hsl(var(--admin-danger))" }}><AlertTriangle size={11} />{r.error}</span>
                            : <Check size={12} style={{ color: "hsl(var(--admin-success))" }} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 200 && (
                  <div className="px-3 py-2 text-[11px] text-center" style={{ color: "hsl(var(--admin-text-muted))" }}>
                    …показано перші 200 з {rows.length}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-3 border-t" style={{ borderColor: "hsl(var(--admin-border))" }}>
            <button
              onClick={runImport}
              disabled={!valid.length || importing}
              className="flex items-center gap-2 text-[12px] px-4 py-2 rounded-md font-sans disabled:opacity-50"
              style={{ background: "hsl(var(--admin-accent))", color: "#fff" }}>
              <Check size={13} />
              {importing ? `Імпорт... ${progress}/${valid.length}` : `Імпортувати ${valid.length}`}
            </button>
            <button onClick={onClose} className="text-[12px] px-4 py-2 rounded-md font-sans border" style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text-muted))" }}>Скасувати</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ProductImporter;
