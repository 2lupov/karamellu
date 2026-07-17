import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, User } from "lucide-react";

type Category = { id: string; name: string };
type Master = { id: string; name: string; bio: string | null; photo_url: string | null; specialties: string[]; is_active: boolean; order_index: number };

const s = (v: string) => ({ color: `hsl(var(--admin-${v}))` });
const bdr = { borderColor: "hsl(var(--admin-border))" };

const AdminMasters = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);
  const [editing, setEditing] = useState<Master | null>(null);

  const fetchAll = async () => {
    const [c, m] = await Promise.all([
      supabase.from("service_categories").select("id,name").order("order_index"),
      supabase.from("masters").select("*").order("order_index"),
    ]);
    setCategories((c.data as Category[]) || []);
    setMasters((m.data as Master[]) || []);
  };

  useEffect(() => { fetchAll(); }, []);

  const newMaster = () => setEditing({ id: "", name: "", bio: "", photo_url: "", specialties: [], is_active: true, order_index: masters.length });

  const save = async () => {
    if (!editing) return;
    const payload = {
      name: editing.name, bio: editing.bio, photo_url: editing.photo_url,
      specialties: editing.specialties, is_active: editing.is_active, order_index: editing.order_index,
    };
    const { error } = editing.id
      ? await supabase.from("masters").update(payload).eq("id", editing.id)
      : await supabase.from("masters").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Збережено"); setEditing(null); fetchAll(); }
  };

  const del = async (id: string) => {
    if (!confirm("Видалити майстра?")) return;
    const { error } = await supabase.from("masters").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Видалено"); setEditing(null); fetchAll(); }
  };

  const toggleSpec = (catId: string) => {
    if (!editing) return;
    const has = editing.specialties.includes(catId);
    setEditing({ ...editing, specialties: has ? editing.specialties.filter((x) => x !== catId) : [...editing.specialties, catId] });
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-sans text-xl font-medium">Майстри</h1>
          <p className="text-[13px] mt-0.5" style={s("text-muted")}>{masters.length} майстрів</p>
        </div>
        <button onClick={newMaster} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded border" style={bdr}>
          <Plus size={13} /> Новий
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {masters.map((m) => (
          <div
            key={m.id}
            onClick={() => setEditing(m)}
            className="border rounded-md p-4 cursor-pointer hover:bg-white/[0.02]"
            style={bdr}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "hsl(var(--admin-surface-hover))" }}>
                {m.photo_url ? <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover" /> : <User size={16} />}
              </div>
              <div>
                <div className="text-[13px] font-medium">{m.name}</div>
                <div className="text-[11px]" style={s("text-muted")}>{m.is_active ? "Активний" : "Неактивний"}</div>
              </div>
            </div>
            <div className="text-[11px]" style={s("text-muted")}>
              {m.specialties.length} спеціалізацій
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setEditing(null)} />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg p-6 rounded-lg border max-h-[90vh] overflow-y-auto"
            style={{ background: "hsl(var(--admin-surface))", ...bdr, color: "hsl(var(--admin-text))" }}
          >
            <h2 className="font-medium mb-4">{editing.id ? "Редагувати майстра" : "Новий майстер"}</h2>
            <div className="space-y-3 text-[13px]">
              <div>
                <label className="block text-[11px] mb-1" style={s("text-muted")}>Ім'я</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full px-3 py-2 border rounded bg-transparent" style={bdr} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={s("text-muted")}>Біо</label>
                <textarea value={editing.bio || ""} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded bg-transparent" style={bdr} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={s("text-muted")}>Фото URL</label>
                <input value={editing.photo_url || ""} onChange={(e) => setEditing({ ...editing, photo_url: e.target.value })} className="w-full px-3 py-2 border rounded bg-transparent" style={bdr} />
              </div>
              <div>
                <label className="block text-[11px] mb-2" style={s("text-muted")}>Спеціалізації</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => {
                    const on = editing.specialties.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleSpec(c.id)}
                        className="px-3 py-1.5 text-[11px] rounded border"
                        style={{ ...bdr, background: on ? "hsl(var(--admin-surface-hover))" : "transparent" }}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-[12px]">
                <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                Активний
              </label>
            </div>
            <div className="flex justify-between gap-2 mt-5 pt-4 border-t" style={bdr}>
              {editing.id && <button onClick={() => del(editing.id)} className="px-4 py-2 text-[12px] rounded text-red-400 hover:bg-red-500/10">Видалити</button>}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setEditing(null)} className="px-4 py-2 text-[12px] rounded border" style={bdr}>Скасувати</button>
                <button onClick={save} className="px-4 py-2 text-[12px] rounded bg-white text-black hover:opacity-90">Зберегти</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminMasters;
