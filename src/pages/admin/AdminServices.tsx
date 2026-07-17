import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";

type Category = { id: string; name: string; slug: string; order_index: number };
type Variant = { label: string | null; price: number };
type Service = { id: string; category_id: string; name: string; description: string | null; duration_minutes: number; price_variants: Variant[]; is_active: boolean; order_index: number };

const s = (v: string) => ({ color: `hsl(var(--admin-${v}))` });
const bdr = { borderColor: "hsl(var(--admin-border))" };

const AdminServices = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [draftVariants, setDraftVariants] = useState<Variant[]>([]);

  const fetchAll = async () => {
    const [c, sv] = await Promise.all([
      supabase.from("service_categories").select("*").order("order_index"),
      supabase.from("services").select("*").order("order_index"),
    ]);
    setCategories((c.data as Category[]) || []);
    setServices(((sv.data as any[]) || []).map((x) => ({ ...x, price_variants: x.price_variants || [] })));
  };

  useEffect(() => { fetchAll(); }, []);

  const startEdit = (svc: Service) => {
    setEditingService(svc);
    setDraftVariants(svc.price_variants.length ? svc.price_variants : [{ label: null, price: 0 }]);
  };

  const newService = (categoryId: string) => {
    const blank: Service = {
      id: "", category_id: categoryId, name: "", description: null, duration_minutes: 60,
      price_variants: [{ label: null, price: 0 }], is_active: true, order_index: 99,
    };
    setEditingService(blank);
    setDraftVariants(blank.price_variants);
  };

  const saveService = async () => {
    if (!editingService) return;
    const payload = {
      category_id: editingService.category_id,
      name: editingService.name,
      description: editingService.description,
      duration_minutes: editingService.duration_minutes,
      price_variants: draftVariants.filter((v) => v.price > 0),
      is_active: editingService.is_active,
      order_index: editingService.order_index,
    };
    const { error } = editingService.id
      ? await supabase.from("services").update(payload).eq("id", editingService.id)
      : await supabase.from("services").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Збережено"); setEditingService(null); fetchAll(); }
  };

  const deleteService = async (id: string) => {
    if (!confirm("Видалити послугу?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Видалено"); fetchAll(); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-sans text-xl font-medium">Послуги салону</h1>
        <p className="text-[13px] mt-0.5" style={s("text-muted")}>{services.length} послуг у {categories.length} категоріях</p>
      </div>

      <div className="space-y-2">
        {categories.map((cat) => {
          const items = services.filter((s) => s.category_id === cat.id);
          const open = openCat === cat.id;
          return (
            <div key={cat.id} className="border rounded-md overflow-hidden" style={bdr}>
              <button
                onClick={() => setOpenCat(open ? null : cat.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-2">
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="font-medium text-[13px]">{cat.name}</span>
                  <span className="text-[11px]" style={s("text-muted")}>({items.length})</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); newService(cat.id); }}
                  className="text-[11px] flex items-center gap-1 px-2 py-1 rounded border" style={bdr}
                >
                  <Plus size={12} /> Додати
                </button>
              </button>
              {open && (
                <div className="border-t" style={bdr}>
                  {items.map((svc) => (
                    <div
                      key={svc.id}
                      onClick={() => startEdit(svc)}
                      className="px-4 py-3 border-b last:border-b-0 cursor-pointer hover:bg-white/[0.02] flex justify-between items-center"
                      style={bdr}
                    >
                      <div>
                        <div className="text-[13px]">{svc.name}</div>
                        <div className="text-[11px]" style={s("text-muted")}>{svc.duration_minutes} хв</div>
                      </div>
                      <div className="text-[12px]" style={s("text-muted")}>
                        {svc.price_variants.length === 1
                          ? `${svc.price_variants[0].price} грн`
                          : `${Math.min(...svc.price_variants.map((v) => v.price))}–${Math.max(...svc.price_variants.map((v) => v.price))} грн`}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <div className="px-4 py-3 text-[12px]" style={s("text-muted")}>Немає послуг</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingService && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setEditingService(null)} />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg p-6 rounded-lg border max-h-[90vh] overflow-y-auto"
            style={{ background: "hsl(var(--admin-surface))", ...bdr, color: "hsl(var(--admin-text))" }}
          >
            <h2 className="font-medium mb-4">{editingService.id ? "Редагувати" : "Нова послуга"}</h2>
            <div className="space-y-3 text-[13px]">
              <div>
                <label className="block text-[11px] mb-1" style={s("text-muted")}>Назва</label>
                <input value={editingService.name} onChange={(e) => setEditingService({ ...editingService, name: e.target.value })} className="w-full px-3 py-2 border rounded bg-transparent" style={bdr} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={s("text-muted")}>Опис</label>
                <input value={editingService.description || ""} onChange={(e) => setEditingService({ ...editingService, description: e.target.value })} className="w-full px-3 py-2 border rounded bg-transparent" style={bdr} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={s("text-muted")}>Тривалість (хв)</label>
                <input type="number" value={editingService.duration_minutes} onChange={(e) => setEditingService({ ...editingService, duration_minutes: parseInt(e.target.value) || 60 })} className="w-full px-3 py-2 border rounded bg-transparent" style={bdr} />
              </div>
              <div>
                <label className="block text-[11px] mb-2" style={s("text-muted")}>Варіанти цін</label>
                {draftVariants.map((v, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      placeholder="Назва (1-ша / null)"
                      value={v.label || ""}
                      onChange={(e) => setDraftVariants(draftVariants.map((x, j) => (j === i ? { ...x, label: e.target.value || null } : x)))}
                      className="flex-1 px-2 py-1.5 border rounded bg-transparent text-[12px]" style={bdr}
                    />
                    <input
                      type="number" placeholder="Ціна"
                      value={v.price}
                      onChange={(e) => setDraftVariants(draftVariants.map((x, j) => (j === i ? { ...x, price: parseInt(e.target.value) || 0 } : x)))}
                      className="w-24 px-2 py-1.5 border rounded bg-transparent text-[12px]" style={bdr}
                    />
                    <button onClick={() => setDraftVariants(draftVariants.filter((_, j) => j !== i))} className="px-2 opacity-60 hover:opacity-100"><Trash2 size={12} /></button>
                  </div>
                ))}
                <button onClick={() => setDraftVariants([...draftVariants, { label: null, price: 0 }])} className="text-[11px] flex items-center gap-1 px-2 py-1 border rounded" style={bdr}>
                  <Plus size={11} /> Варіант
                </button>
              </div>
              <label className="flex items-center gap-2 text-[12px]">
                <input type="checkbox" checked={editingService.is_active} onChange={(e) => setEditingService({ ...editingService, is_active: e.target.checked })} />
                Активна
              </label>
            </div>
            <div className="flex justify-between gap-2 mt-5 pt-4 border-t" style={bdr}>
              {editingService.id && <button onClick={() => deleteService(editingService.id)} className="px-4 py-2 text-[12px] rounded text-red-400 hover:bg-red-500/10">Видалити</button>}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setEditingService(null)} className="px-4 py-2 text-[12px] rounded border" style={bdr}>Скасувати</button>
                <button onClick={saveService} className="px-4 py-2 text-[12px] rounded bg-white text-black hover:opacity-90">Зберегти</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminServices;
