import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, X, Check, GripVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Category { id: string; name: string; slug: string; description: string | null; image_url: string | null; sort_order: number; }

const inputClass = "w-full rounded-md border px-3 py-2 text-[13px] font-sans outline-none transition-colors bg-transparent";
const labelClass = "text-[10px] font-sans uppercase tracking-widest block mb-1.5";
const bdr = { borderColor: "hsl(var(--admin-border))" };
const clr = { color: "hsl(var(--admin-text))" };
const muted = { color: "hsl(var(--admin-text-muted))" };

const AdminCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "", image_url: "", sort_order: 0 });
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => { setLoading(true); const { data } = await supabase.from("categories").select("*").order("sort_order"); setCategories((data as Category[]) || []); setLoading(false); };
  useEffect(() => { fetchCategories(); }, []);

  const generateSlug = (name: string) => name.toLowerCase().replace(/[^a-zа-яіїєґ0-9\s]/g, "").replace(/\s+/g, "-").slice(0, 60);
  const openNew = () => { setForm({ name: "", slug: "", description: "", image_url: "", sort_order: categories.length }); setEditingId(null); setShowForm(true); };
  const openEdit = (c: Category) => { setForm({ name: c.name, slug: c.slug, description: c.description || "", image_url: c.image_url || "", sort_order: c.sort_order }); setEditingId(c.id); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Назва обов'язкова"); return; }
    const slug = form.slug.trim() || generateSlug(form.name); setSaving(true);
    if (editingId) {
      const { error } = await supabase.from("categories").update({ ...form, slug }).eq("id", editingId);
      if (error) toast.error(error.message); else { toast.success("Оновлено"); closeForm(); fetchCategories(); }
    } else {
      const { error } = await supabase.from("categories").insert({ ...form, slug });
      if (error) toast.error(error.message); else { toast.success("Створено"); closeForm(); fetchCategories(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Видалити?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Видалено"); fetchCategories(); }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-sans text-xl font-medium">Категорії</h1>
          <p className="text-[13px] mt-0.5" style={muted}>{categories.length} категорій</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-md font-sans self-start" style={{ background: "hsl(var(--admin-accent))", color: "#fff" }}>
          <Plus size={13} /> Додати
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={closeForm}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-lg w-full max-w-lg mx-4 p-6 border"
              style={{ background: "hsl(var(--admin-surface))", ...bdr }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-sans text-base font-medium">{editingId ? "Редагувати" : "Нова категорія"}</h2>
                <button onClick={closeForm} style={muted}><X size={16} /></button>
              </div>
              <div className="space-y-4">
                <div><label className={labelClass} style={muted}>Назва *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: generateSlug(e.target.value) })} className={inputClass} style={{ ...bdr, ...clr }} /></div>
                <div><label className={labelClass} style={muted}>Slug</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={inputClass} style={{ ...bdr, ...clr }} /></div>
                <div><label className={labelClass} style={muted}>Опис</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputClass} resize-none`} style={{ ...bdr, ...clr }} /></div>
                <div><label className={labelClass} style={muted}>Зображення</label><input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." className={inputClass} style={{ ...bdr, ...clr }} /></div>
                <div><label className={labelClass} style={muted}>Порядок</label><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} className={inputClass} style={{ ...bdr, ...clr }} /></div>
                <div className="flex gap-3 pt-4 border-t" style={bdr}>
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 text-[12px] px-4 py-2 rounded-md font-sans" style={{ background: "hsl(var(--admin-accent))", color: "#fff" }}>
                    <Check size={13} /> {saving ? "..." : "Зберегти"}
                  </button>
                  <button onClick={closeForm} className="text-[12px] px-4 py-2 rounded-md font-sans border" style={{ ...bdr, ...muted }}>Скасувати</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="text-center py-12 text-[13px] font-sans" style={muted}>Завантаження...</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 rounded-lg border" style={{ background: "hsl(var(--admin-surface))", ...bdr }}>
          <p className="text-[13px] font-sans" style={muted}>Категорій ще немає</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="rounded-lg px-4 py-3.5 flex items-center justify-between border transition-colors"
              style={{ background: "hsl(var(--admin-surface))", ...bdr }}>
              <div className="flex items-center gap-3">
                <GripVertical size={14} style={{ color: "hsl(var(--admin-border))" }} />
                {cat.image_url && <img src={cat.image_url} alt="" className="w-9 h-9 object-cover rounded-md border" style={bdr} />}
                <div>
                  <p className="font-sans text-[13px] font-medium">{cat.name}</p>
                  <p className="text-[11px] font-sans" style={muted}>{cat.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => openEdit(cat)} className="p-1.5 rounded-md transition-colors" style={muted}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--admin-surface-hover))")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}><Pencil size={13} /></button>
                <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded-md transition-colors" style={{ color: "hsl(var(--admin-danger))" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(0 70% 55% / 0.1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminCategories;
