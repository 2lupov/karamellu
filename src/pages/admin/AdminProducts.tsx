import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Search, X, Check, Sparkles, RefreshCw, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import AIProductScanner from "@/components/admin/AIProductScanner";
import ProductImporter from "@/components/admin/ProductImporter";

interface Category { id: string; name: string; }
interface Product {
  id: string; name: string; brand: string; price: number; category_id: string | null;
  skin_type: string; image: string; image_hover: string; description: string;
  ingredients: string; usage_instructions: string; best_seller: boolean; is_active: boolean;
  rating: number; review_count: number;
  barcode: string | null; stock_quantity: number; cost_price: number;
}

const emptyProduct: Omit<Product, "id"> = {
  name: "", brand: "", price: 0, category_id: null, skin_type: "Для всіх типів шкіри",
  image: "", image_hover: "", description: "", ingredients: "", usage_instructions: "",
  best_seller: false, is_active: true, rating: 0, review_count: 0,
  barcode: null, stock_quantity: 0, cost_price: 0,
};
const skinTypes = ["Для всіх типів шкіри", "Суха", "Жирна", "Чутлива", "Зріла"];

const inputClass = "w-full rounded-md border px-3 py-2 text-[13px] font-sans outline-none transition-colors bg-transparent";
const labelClass = "text-[10px] font-sans uppercase tracking-widest block mb-1.5";

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formData, setFormData] = useState<Omit<Product, "id">>(emptyProduct);
  const [priceInput, setPriceInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [aiSuggestedCategoryId, setAiSuggestedCategoryId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showImporter, setShowImporter] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [prodRes, catRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("id, name").order("sort_order"),
    ]);
    setProducts((prodRes.data as Product[]) || []);
    setCategories((catRes.data as Category[]) || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const openNew = () => {
    setFormData(emptyProduct);
    setPriceInput("");
    setAiSuggestedCategoryId(null);
    setShowCategoryPicker(false);
    setEditing(null);
    setIsNew(true);
    setShowScanner(false);
  };

  const handleScanResult = (data: any, imageUrls: string[]) => {
    let detectedCategoryId: string | null = null;
    if (data.category_id) {
      detectedCategoryId = data.category_id;
    } else if (data.category_name || data.category) {
      const catName = (data.category_name || data.category || "").toLowerCase();
      const match = categories.find((c) => c.name.toLowerCase() === catName);
      if (match) detectedCategoryId = match.id;
    }
    const price = data.price || 0;
    setFormData({
      ...emptyProduct,
      name: data.name || "", brand: data.brand || "", description: data.description || "",
      ingredients: data.ingredients || "", usage_instructions: data.usage_instructions || "",
      skin_type: data.skin_type || "Для всіх типів шкіри", price,
      image: imageUrls[0] || "", image_hover: imageUrls[1] || "",
      category_id: detectedCategoryId,
    });
    setPriceInput(price > 0 ? String(price) : "");
    setAiSuggestedCategoryId(detectedCategoryId);
    setShowCategoryPicker(false);
    setEditing(null); setIsNew(true); setShowScanner(false);
  };

  const openEdit = (p: Product) => {
    setFormData({
      name: p.name, brand: p.brand, price: p.price, category_id: p.category_id,
      skin_type: p.skin_type, image: p.image || "", image_hover: p.image_hover || "",
      description: p.description, ingredients: p.ingredients, usage_instructions: p.usage_instructions,
      best_seller: p.best_seller, is_active: p.is_active, rating: p.rating, review_count: p.review_count,
      barcode: p.barcode ?? null, stock_quantity: p.stock_quantity ?? 0, cost_price: p.cost_price ?? 0,
    });
    setPriceInput(p.price > 0 ? String(p.price) : "");
    setAiSuggestedCategoryId(null);
    setShowCategoryPicker(false);
    setEditing(p); setIsNew(false);
  };

  const closeForm = () => { setEditing(null); setIsNew(false); setAiSuggestedCategoryId(null); setShowCategoryPicker(false); };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error("Назва обов'язкова"); return; }
    const saveData = { ...formData, price: priceInput === "" ? 0 : parseFloat(priceInput) || 0 };
    setSaving(true);
    if (isNew) {
      const { error } = await supabase.from("products").insert(saveData);
      if (error) toast.error(error.message); else { toast.success("Створено"); closeForm(); fetchData(); }
    } else if (editing) {
      const { error } = await supabase.from("products").update(saveData).eq("id", editing.id);
      if (error) toast.error(error.message); else { toast.success("Оновлено"); closeForm(); fetchData(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Видалити?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Видалено"); fetchData(); }
  };

  const filtered = search.length >= 2 ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase())) : products;
  const getCategoryName = (id: string | null) => categories.find((c) => c.id === id)?.name || "—";
  const showForm = isNew || editing !== null;

  // Category display logic: if AI suggested and user hasn't opened picker, show chip + change button
  const isAiCategorySuggested = aiSuggestedCategoryId !== null && !showCategoryPicker;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-sans text-xl font-medium">Продукти</h1>
          <p className="text-[13px] mt-0.5" style={{ color: "hsl(var(--admin-text-muted))" }}>{products.length} товарів</p>
        </div>
        <div className="flex gap-2 self-start">
          <button onClick={() => setShowImporter(true)} className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-md border" style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text-muted))" }}>
            <Upload size={13} /> Імпорт CSV
          </button>
          <button onClick={() => setShowScanner(!showScanner)} className="admin-btn-ghost flex items-center gap-2 text-[12px] px-3 py-2 rounded-md border" style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text-muted))" }}>
            <Sparkles size={13} /> AI-сканер
          </button>
          <button onClick={openNew} className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-md font-sans" style={{ background: "hsl(var(--admin-accent))", color: "#fff" }}>
            <Plus size={13} /> Додати
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showImporter && (
          <ProductImporter categories={categories} onClose={() => setShowImporter(false)} onDone={fetchData} />
        )}
        {showScanner && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-6 overflow-hidden">
            <AIProductScanner categories={categories} onResult={handleScanResult} onClose={() => setShowScanner(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8"
            style={{ background: "rgba(0,0,0,0.6)" }} onClick={closeForm}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="rounded-lg w-full max-w-2xl mx-4 p-6 md:p-8 border"
              style={{ background: "hsl(var(--admin-surface))", borderColor: "hsl(var(--admin-border))" }}
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-sans text-base font-medium">{isNew ? "Новий продукт" : "Редагувати"}</h2>
                <button onClick={closeForm} className="p-1 rounded-md transition-colors" style={{ color: "hsl(var(--admin-text-muted))" }}><X size={16} /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className={labelClass} style={{ color: "hsl(var(--admin-text-muted))" }}>Назва *</label><input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputClass} style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text))" }} /></div>
                  <div><label className={labelClass} style={{ color: "hsl(var(--admin-text-muted))" }}>Бренд</label><input value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className={inputClass} style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text))" }} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Price input - uses string state for proper clearing */}
                  <div>
                    <label className={labelClass} style={{ color: "hsl(var(--admin-text-muted))" }}>Ціна (₴)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={priceInput}
                      placeholder="Вкажіть ціну"
                      onChange={(e) => {
                        setPriceInput(e.target.value);
                        setFormData({ ...formData, price: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 });
                      }}
                      className={inputClass}
                      style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text))" }}
                    />
                  </div>

                  {/* Category - AI suggestion mode or regular select */}
                  <div>
                    <label className={labelClass} style={{ color: "hsl(var(--admin-text-muted))" }}>Категорія</label>
                    {isAiCategorySuggested ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="flex-1 rounded-md border px-3 py-2 text-[13px] font-sans truncate"
                          style={{ borderColor: "hsl(var(--admin-accent) / 0.5)", color: "hsl(var(--admin-text))", background: "hsl(var(--admin-accent) / 0.08)" }}
                        >
                          ✨ {getCategoryName(formData.category_id)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowCategoryPicker(true)}
                          className="p-2 rounded-md border transition-colors hover:bg-accent/10"
                          style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text-muted))" }}
                          title="Обрати іншу"
                        >
                          <RefreshCw size={13} />
                        </button>
                      </div>
                    ) : (
                      <select
                        value={formData.category_id || ""}
                        onChange={(e) => {
                          setFormData({ ...formData, category_id: e.target.value || null });
                          setAiSuggestedCategoryId(null);
                        }}
                        className={inputClass}
                        style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text))" }}
                      >
                        <option value="">—</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>

                  <div><label className={labelClass} style={{ color: "hsl(var(--admin-text-muted))" }}>Тип шкіри</label><select value={formData.skin_type} onChange={(e) => setFormData({ ...formData, skin_type: e.target.value })} className={inputClass} style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text))" }}>{skinTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className={labelClass} style={{ color: "hsl(var(--admin-text-muted))" }}>Штрих-код</label><input value={formData.barcode ?? ""} onChange={(e) => setFormData({ ...formData, barcode: e.target.value || null })} placeholder="8005610..." className={`${inputClass} font-mono`} style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text))" }} /></div>
                  <div><label className={labelClass} style={{ color: "hsl(var(--admin-text-muted))" }}>Залишок (шт)</label><input type="number" value={formData.stock_quantity} onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })} className={inputClass} style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text))" }} /></div>
                  <div><label className={labelClass} style={{ color: "hsl(var(--admin-text-muted))" }}>Закупка ₴ (внутр.)</label><input type="number" step="0.01" value={formData.cost_price} onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })} className={inputClass} style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text))" }} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className={labelClass} style={{ color: "hsl(var(--admin-text-muted))" }}>Зображення</label><input value={formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} placeholder="https://..." className={inputClass} style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text))" }} /></div>
                  <div><label className={labelClass} style={{ color: "hsl(var(--admin-text-muted))" }}>Hover зображення</label><input value={formData.image_hover} onChange={(e) => setFormData({ ...formData, image_hover: e.target.value })} placeholder="https://..." className={inputClass} style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text))" }} /></div>
                </div>
                {[{ k: "description", l: "Опис", r: 3 }, { k: "ingredients", l: "Інгредієнти", r: 2 }, { k: "usage_instructions", l: "Використання", r: 2 }].map((f) => (
                  <div key={f.k}><label className={labelClass} style={{ color: "hsl(var(--admin-text-muted))" }}>{f.l}</label><textarea rows={f.r} value={(formData as any)[f.k]} onChange={(e) => setFormData({ ...formData, [f.k]: e.target.value })} className={`${inputClass} resize-none`} style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text))" }} /></div>
                ))}
                <div className="flex items-center gap-6">
                  {[{ k: "best_seller", l: "Бестселер" }, { k: "is_active", l: "Активний" }].map((c) => (
                    <label key={c.k} className="flex items-center gap-2 cursor-pointer text-[13px] font-sans">
                      <input type="checkbox" checked={(formData as any)[c.k]} onChange={(e) => setFormData({ ...formData, [c.k]: e.target.checked })} className="w-3.5 h-3.5 accent-blue-500" />
                      {c.l}
                    </label>
                  ))}
                </div>
                <div className="flex gap-3 pt-4 border-t" style={{ borderColor: "hsl(var(--admin-border))" }}>
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 text-[12px] px-4 py-2 rounded-md font-sans" style={{ background: "hsl(var(--admin-accent))", color: "#fff" }}>
                    <Check size={13} /> {saving ? "..." : "Зберегти"}
                  </button>
                  <button onClick={closeForm} className="text-[12px] px-4 py-2 rounded-md font-sans border" style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text-muted))" }}>Скасувати</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="flex items-center gap-3 rounded-md px-3 py-2 mb-5 border" style={{ background: "hsl(var(--admin-surface))", borderColor: "hsl(var(--admin-border))" }}>
        <Search size={14} style={{ color: "hsl(var(--admin-text-muted))" }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Шукати..." className="flex-1 bg-transparent outline-none text-[13px] font-sans" style={{ color: "hsl(var(--admin-text))" }} />
        {search && <button onClick={() => setSearch("")}><X size={13} style={{ color: "hsl(var(--admin-text-muted))" }} /></button>}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-[13px] font-sans" style={{ color: "hsl(var(--admin-text-muted))" }}>Завантаження...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-lg border" style={{ background: "hsl(var(--admin-surface))", borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text-muted))" }}>
          <p className="text-[13px] font-sans">{products.length === 0 ? "Продуктів ще немає" : "Нічого не знайдено"}</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ background: "hsl(var(--admin-surface))", borderColor: "hsl(var(--admin-border))" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] font-sans">
              <thead>
                <tr className="border-b" style={{ borderColor: "hsl(var(--admin-border))" }}>
                  {["Продукт", "Категорія", "Ціна", "Статус", ""].map((h, i) => (
                    <th key={i} className={`${i === 4 ? "text-right" : "text-left"} px-4 py-3 text-[10px] uppercase tracking-widest font-medium ${i === 1 ? "hidden md:table-cell" : ""} ${i === 3 ? "hidden sm:table-cell" : ""}`} style={{ color: "hsl(var(--admin-text-muted))" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 transition-colors" style={{ borderColor: "hsl(var(--admin-border))" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--admin-surface-hover))")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.image && <img src={p.image} alt="" className="w-9 h-9 object-cover rounded-md border" style={{ borderColor: "hsl(var(--admin-border))" }} />}
                        <div><p className="font-medium">{p.name}</p><p className="text-[11px]" style={{ color: "hsl(var(--admin-text-muted))" }}>{p.brand}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell" style={{ color: "hsl(var(--admin-text-muted))" }}>{getCategoryName(p.category_id)}</td>
                    <td className="px-4 py-3 font-medium">₴{Number(p.price).toFixed(0)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.is_active ? "hsl(var(--admin-success))" : "hsl(var(--admin-text-muted))" }} />
                        {p.is_active ? "Активний" : "Прихований"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-md transition-colors" style={{ color: "hsl(var(--admin-text-muted))" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--admin-surface-hover))")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-md transition-colors" style={{ color: "hsl(var(--admin-danger))" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(0 70% 55% / 0.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;