import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/context/ShopContext";
import { toast } from "sonner";
import { Package, Search, Trash2 } from "lucide-react";

interface InventoryItem {
  id: string;
  barcode: string;
  price: number | null;
  cost_price: number | null;
  stock_quantity: number;
  is_active: boolean;
  catalog_product_id: string;
  catalog_products: {
    name: string;
    brand: string | null;
    image_url: string | null;
  };
}

const AdminInventory = () => {
  const { activeShop } = useShop();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!activeShop) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("shop_inventory")
      .select(
        "id, barcode, price, cost_price, stock_quantity, is_active, catalog_product_id, catalog_products(name, brand, image_url)"
      )
      .eq("shop_id", activeShop.id)
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShop?.id]);

  const updateField = async (id: string, field: string, value: any) => {
    setItems((curr) => curr.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
    const { error } = await supabase.from("shop_inventory").update({ [field]: value } as any).eq("id", id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    if (!confirm("Видалити з інвентарю?")) return;
    const { error } = await supabase.from("shop_inventory").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((curr) => curr.filter((it) => it.id !== id));
    toast.success("Видалено");
  };

  const filtered = items.filter((it) => {
    const q = search.toLowerCase();
    return (
      it.barcode.includes(q) ||
      it.catalog_products.name.toLowerCase().includes(q) ||
      (it.catalog_products.brand || "").toLowerCase().includes(q)
    );
  });

  if (!activeShop) return <div style={{ color: "hsl(var(--admin-text-muted))" }}>Оберіть магазин</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-sans text-xl font-medium" style={{ color: "hsl(var(--admin-text))" }}>
          Інвентар — {activeShop.name}
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "hsl(var(--admin-text-muted))" }}>
          {items.length} {items.length === 1 ? "товар" : "товарів"}
        </p>
      </div>

      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "hsl(var(--admin-text-muted))" }}
        />
        <input
          type="text"
          placeholder="Пошук за назвою, брендом або штрих-кодом"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-md border text-[13px]"
          style={{
            background: "hsl(var(--admin-surface))",
            borderColor: "hsl(var(--admin-border))",
            color: "hsl(var(--admin-text))",
          }}
        />
      </div>

      {loading ? (
        <div style={{ color: "hsl(var(--admin-text-muted))" }}>Завантаження...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: "hsl(var(--admin-text-muted))" }}>
          {items.length === 0 ? "Інвентар порожній — додайте товари через Сканер" : "Нічого не знайдено"}
        </div>
      ) : (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ background: "hsl(var(--admin-surface))", borderColor: "hsl(var(--admin-border))" }}
        >
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "hsl(var(--admin-bg))" }}>
                <th className="text-left p-3 font-sans font-medium" style={{ color: "hsl(var(--admin-text-muted))" }}>
                  Товар
                </th>
                <th className="text-left p-3 font-sans font-medium" style={{ color: "hsl(var(--admin-text-muted))" }}>
                  Штрих-код
                </th>
                <th className="text-left p-3 font-sans font-medium w-28" style={{ color: "hsl(var(--admin-text-muted))" }}>
                  Ціна
                </th>
                <th className="text-left p-3 font-sans font-medium w-24" style={{ color: "hsl(var(--admin-text-muted))" }}>
                  Залишок
                </th>
                <th className="text-left p-3 font-sans font-medium w-20" style={{ color: "hsl(var(--admin-text-muted))" }}>
                  Акт.
                </th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id} className="border-t" style={{ borderColor: "hsl(var(--admin-border))" }}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-9 h-9 rounded flex-shrink-0 flex items-center justify-center"
                        style={{ background: "hsl(var(--admin-bg))" }}
                      >
                        {it.catalog_products.image_url ? (
                          <img src={it.catalog_products.image_url} className="w-full h-full object-cover rounded" />
                        ) : (
                          <Package size={14} style={{ color: "hsl(var(--admin-text-muted))" }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate" style={{ color: "hsl(var(--admin-text))" }}>
                          {it.catalog_products.name}
                        </div>
                        {it.catalog_products.brand && (
                          <div className="text-[11px] truncate" style={{ color: "hsl(var(--admin-text-muted))" }}>
                            {it.catalog_products.brand}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-[11px]" style={{ color: "hsl(var(--admin-text-muted))" }}>
                    {it.barcode}
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      step="0.01"
                      value={it.price ?? ""}
                      onChange={(e) => {
                        const v = e.target.value ? parseFloat(e.target.value) : null;
                        setItems((curr) => curr.map((x) => (x.id === it.id ? { ...x, price: v } : x)));
                      }}
                      onBlur={(e) =>
                        updateField(it.id, "price", e.target.value ? parseFloat(e.target.value) : null)
                      }
                      className="w-full px-2 py-1 rounded border text-[12px]"
                      style={{
                        background: "hsl(var(--admin-bg))",
                        borderColor: "hsl(var(--admin-border))",
                        color: "hsl(var(--admin-text))",
                      }}
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={it.stock_quantity}
                      onChange={(e) => {
                        const v = parseInt(e.target.value || "0");
                        setItems((curr) =>
                          curr.map((x) => (x.id === it.id ? { ...x, stock_quantity: v } : x))
                        );
                      }}
                      onBlur={(e) => updateField(it.id, "stock_quantity", parseInt(e.target.value || "0"))}
                      className="w-full px-2 py-1 rounded border text-[12px]"
                      style={{
                        background: "hsl(var(--admin-bg))",
                        borderColor: "hsl(var(--admin-border))",
                        color: "hsl(var(--admin-text))",
                      }}
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={it.is_active}
                      onChange={(e) => updateField(it.id, "is_active", e.target.checked)}
                    />
                  </td>
                  <td className="p-3">
                    <button onClick={() => remove(it.id)} className="p-1 rounded hover:bg-white/5">
                      <Trash2 size={14} style={{ color: "hsl(var(--admin-text-muted))" }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminInventory;
