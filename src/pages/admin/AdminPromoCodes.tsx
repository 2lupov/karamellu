import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Percent, DollarSign, Copy } from "lucide-react";

interface PromoCode {
  id: string; code: string; discount_type: string; value: number; min_order: number;
  max_uses: number | null; current_uses: number; is_active: boolean; expires_at: string | null; created_at: string;
}

const emptyForm = { code: "", discount_type: "percent" as string, value: 0, min_order: 0, max_uses: null as number | null, is_active: true, expires_at: "" };

const inputClass = "w-full rounded-md border px-3 py-2 text-[13px] font-sans outline-none transition-colors bg-transparent";
const labelClass = "text-[10px] font-sans uppercase tracking-widest block mb-1.5";
const bdr = { borderColor: "hsl(var(--admin-border))" };
const clr = { color: "hsl(var(--admin-text))" };
const muted = { color: "hsl(var(--admin-text-muted))" };

const AdminPromoCodes = () => {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchCodes = async () => { const { data, error } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false }); if (error) toast.error(error.message); else setCodes((data as any[]) || []); setLoading(false); };
  useEffect(() => { fetchCodes(); }, []);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (c: PromoCode) => { setEditingId(c.id); setForm({ code: c.code, discount_type: c.discount_type, value: c.value, min_order: c.min_order, max_uses: c.max_uses, is_active: c.is_active, expires_at: c.expires_at ? c.expires_at.slice(0, 16) : "" }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.code.trim()) { toast.error("Введіть код"); return; }
    if (form.value <= 0) { toast.error("Значення > 0"); return; }
    const payload = { code: form.code.toUpperCase().trim(), discount_type: form.discount_type, value: form.value, min_order: form.min_order || 0, max_uses: form.max_uses || null, is_active: form.is_active, expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null };
    if (editingId) {
      const { error } = await supabase.from("promo_codes").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; } toast.success("Оновлено");
    } else {
      const { error } = await supabase.from("promo_codes").insert(payload);
      if (error) { toast.error(error.message.includes("duplicate") ? "Такий код є" : error.message); return; } toast.success("Створено");
    }
    setShowForm(false); fetchCodes();
  };

  const handleDelete = async (id: string) => { if (!confirm("Видалити?")) return; const { error } = await supabase.from("promo_codes").delete().eq("id", id); if (error) toast.error(error.message); else { toast.success("Видалено"); fetchCodes(); } };
  const toggleActive = async (c: PromoCode) => { await supabase.from("promo_codes").update({ is_active: !c.is_active }).eq("id", c.id); fetchCodes(); };
  const copyCode = (code: string) => { navigator.clipboard.writeText(code); toast.success(`Скопійовано: ${code}`); };
  const isExpired = (d: string | null) => d ? new Date(d) < new Date() : false;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-sans text-xl font-medium">Промокоди</h1>
        <button onClick={openCreate} className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-md font-sans" style={{ background: "hsl(var(--admin-accent))", color: "#fff" }}>
          <Plus size={13} /> Створити
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowForm(false)}>
          <div className="rounded-lg p-6 w-full max-w-md mx-4 border" style={{ background: "hsl(var(--admin-surface))", ...bdr }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-sans text-base font-medium">{editingId ? "Редагувати" : "Новий промокод"}</h2>
              <button onClick={() => setShowForm(false)} style={muted}><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div><label className={labelClass} style={muted}>Код</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SPRING20" className={inputClass} style={{ ...bdr, ...clr }} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={muted}>Тип</label>
                  <div className="flex rounded-md overflow-hidden border" style={bdr}>
                    {[{ t: "percent", icon: Percent, l: "%" }, { t: "fixed", icon: DollarSign, l: "₴" }].map(({ t, icon: I, l }) => (
                      <button key={t} onClick={() => setForm({ ...form, discount_type: t })}
                        className="flex-1 flex items-center justify-center gap-1 py-2 text-[12px] font-sans transition-colors"
                        style={{ background: form.discount_type === t ? "hsl(var(--admin-accent-soft))" : "transparent", color: form.discount_type === t ? "hsl(var(--admin-accent))" : "hsl(var(--admin-text-muted))" }}>
                        <I size={11} /> {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div><label className={labelClass} style={muted}>Значення</label><input type="number" value={form.value || ""} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className={inputClass} style={{ ...bdr, ...clr }} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelClass} style={muted}>Мін. замовлення</label><input type="number" value={form.min_order || ""} onChange={(e) => setForm({ ...form, min_order: Number(e.target.value) })} className={inputClass} style={{ ...bdr, ...clr }} /></div>
                <div><label className={labelClass} style={muted}>Макс. використань</label><input type="number" value={form.max_uses ?? ""} onChange={(e) => setForm({ ...form, max_uses: e.target.value ? Number(e.target.value) : null })} placeholder="∞" className={inputClass} style={{ ...bdr, ...clr }} /></div>
              </div>
              <div><label className={labelClass} style={muted}>Дійсний до</label><input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className={inputClass} style={{ ...bdr, ...clr }} /></div>
              <label className="flex items-center gap-2 cursor-pointer text-[13px] font-sans"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-3.5 h-3.5 accent-blue-500" /> Активний</label>
              <button onClick={handleSave} className="w-full text-[12px] py-2.5 rounded-md font-sans" style={{ background: "hsl(var(--admin-accent))", color: "#fff" }}>{editingId ? "Зберегти" : "Створити"}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[13px] font-sans" style={muted}>Завантаження...</p>
      ) : codes.length === 0 ? (
        <div className="text-center py-16 rounded-lg border" style={{ background: "hsl(var(--admin-surface))", ...bdr }}>
          <p className="text-[13px] font-sans mb-4" style={muted}>Промокодів немає</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ background: "hsl(var(--admin-surface))", ...bdr }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={bdr}>
                  {["Код", "Знижка", "Мін.", "Використано", "Термін", "Статус", ""].map((h, i) => (
                    <th key={i} className={`${i === 6 ? "text-right" : "text-left"} px-4 py-3 text-[10px] uppercase tracking-widest font-sans font-medium`} style={muted}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 transition-colors" style={bdr}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--admin-surface-hover))")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td className="px-4 py-3">
                      <button onClick={() => copyCode(c.code)} className="flex items-center gap-1.5 font-mono text-[13px] font-medium" style={clr}>
                        {c.code} <Copy size={11} style={muted} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-sans">{c.discount_type === "percent" ? `${c.value}%` : `₴${c.value}`}</td>
                    <td className="px-4 py-3 text-[13px] font-sans" style={muted}>{c.min_order > 0 ? `₴${c.min_order}` : "—"}</td>
                    <td className="px-4 py-3 text-[13px] font-sans" style={muted}>{c.current_uses}{c.max_uses ? ` / ${c.max_uses}` : ""}</td>
                    <td className="px-4 py-3 text-[13px] font-sans" style={isExpired(c.expires_at) ? { color: "hsl(var(--admin-danger))" } : muted}>
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString("uk-UA") : "∞"}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(c)} className="flex items-center gap-1.5 text-[11px] font-sans px-2 py-1 rounded-md border" style={{
                        background: c.is_active && !isExpired(c.expires_at) ? "hsl(142 60% 45% / 0.1)" : "transparent",
                        color: c.is_active && !isExpired(c.expires_at) ? "hsl(var(--admin-success))" : "hsl(var(--admin-text-muted))",
                        borderColor: c.is_active && !isExpired(c.expires_at) ? "hsl(142 60% 45% / 0.2)" : "hsl(var(--admin-border))",
                      }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.is_active && !isExpired(c.expires_at) ? "hsl(var(--admin-success))" : "hsl(var(--admin-text-muted))" }} />
                        {isExpired(c.expires_at) ? "Прострочений" : c.is_active ? "Активний" : "Вимкнений"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded-md transition-colors" style={muted}><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-md transition-colors" style={{ color: "hsl(var(--admin-danger))" }}><Trash2 size={13} /></button>
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

export default AdminPromoCodes;
