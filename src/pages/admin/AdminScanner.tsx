import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/context/ShopContext";
import { toast } from "sonner";
import { Loader2, ScanLine, CheckCircle2, PlusCircle, Sparkles, Save, X, Package } from "lucide-react";
import AIProductScanner from "@/components/admin/AIProductScanner";

interface CatalogProduct {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
}

interface ShopInventoryRow {
  id?: string;
  price: number | null;
  cost_price: number | null;
  stock_quantity: number;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
}

const emptyInventory: ShopInventoryRow = {
  price: null,
  cost_price: null,
  stock_quantity: 1,
  is_active: true,
};

const AdminScanner = () => {
  const { activeShop } = useShop();
  const inputRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct | null>(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [inventory, setInventory] = useState<ShopInventoryRow>(emptyInventory);
  const [recent, setRecent] = useState<{ barcode: string; status: "found" | "new" }[]>([]);
  const [showAIScanner, setShowAIScanner] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ name: "", brand: "" });
  const [categories, setCategories] = useState<Category[]>([]);

  // Keep focus on input
  useEffect(() => {
    inputRef.current?.focus();
  }, [catalog, notFoundBarcode]);

  useEffect(() => {
    supabase.from("categories").select("id, name").then(({ data }) => {
      setCategories((data as Category[]) || []);
    });
  }, []);

  const lookupBarcode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed || !activeShop) return;
    setLoading(true);
    setCatalog(null);
    setNotFoundBarcode(null);

    const { data: cp } = await supabase
      .from("catalog_products")
      .select("*")
      .eq("barcode", trimmed)
      .maybeSingle();

    if (cp) {
      setCatalog(cp as CatalogProduct);
      // Load existing inventory if any
      const { data: inv } = await supabase
        .from("shop_inventory")
        .select("*")
        .eq("shop_id", activeShop.id)
        .eq("catalog_product_id", (cp as any).id)
        .maybeSingle();
      if (inv) {
        setInventory({
          id: (inv as any).id,
          price: (inv as any).price,
          cost_price: (inv as any).cost_price,
          stock_quantity: (inv as any).stock_quantity,
          is_active: (inv as any).is_active,
        });
      } else {
        setInventory(emptyInventory);
      }
      setRecent((r) => [{ barcode: trimmed, status: "found" as const }, ...r].slice(0, 8));
    } else {
      setNotFoundBarcode(trimmed);
      setRecent((r) => [{ barcode: trimmed, status: "new" as const }, ...r].slice(0, 8));
    }
    setLoading(false);
    setBarcode("");
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookupBarcode(barcode);
    }
  };

  const saveInventory = async () => {
    if (!catalog || !activeShop) return;
    setLoading(true);
    const payload = {
      shop_id: activeShop.id,
      catalog_product_id: catalog.id,
      barcode: catalog.barcode,
      price: inventory.price,
      cost_price: inventory.cost_price,
      stock_quantity: inventory.stock_quantity,
      is_active: inventory.is_active,
    };
    const { error } = await supabase
      .from("shop_inventory")
      .upsert(payload, { onConflict: "shop_id,catalog_product_id" });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`✓ Збережено у ${activeShop.name}`);
    reset();
  };

  const reset = () => {
    setCatalog(null);
    setNotFoundBarcode(null);
    setInventory(emptyInventory);
    setBarcode("");
    setShowAIScanner(false);
    setShowManualForm(false);
    setManualForm({ name: "", brand: "" });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleManualCreate = async () => {
    if (!notFoundBarcode || !manualForm.name) {
      toast.error("Введіть назву");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("catalog_products")
      .insert({
        barcode: notFoundBarcode,
        name: manualForm.name,
        brand: manualForm.brand || null,
        verified: false,
      })
      .select()
      .single();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCatalog(data as CatalogProduct);
    setNotFoundBarcode(null);
    setShowManualForm(false);
    setInventory(emptyInventory);
    toast.success("Товар створено у спільній базі");
  };

  const handleAIResult = async (data: any, imageUrls: string[]) => {
    if (!notFoundBarcode) return;
    setLoading(true);
    const { data: created, error } = await supabase
      .from("catalog_products")
      .insert({
        barcode: notFoundBarcode,
        name: data.name,
        brand: data.brand,
        description: data.description,
        ingredients: data.ingredients,
        usage_instructions: data.usage_instructions,
        skin_type: data.skin_type,
        category_id: data.category_id || null,
        image_url: imageUrls[0] || null,
        image_hover: imageUrls[1] || null,
        verified: true,
      })
      .select()
      .single();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCatalog(created as CatalogProduct);
    setNotFoundBarcode(null);
    setShowAIScanner(false);
    setInventory(emptyInventory);
    toast.success("AI створив картку товару");
  };

  if (!activeShop) {
    return (
      <div className="text-center py-20" style={{ color: "hsl(var(--admin-text-muted))" }}>
        Оберіть магазин у бічній панелі
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-sans text-xl font-medium" style={{ color: "hsl(var(--admin-text))" }}>
          Сканер товарів
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "hsl(var(--admin-text-muted))" }}>
          Активний магазин: <span style={{ color: "hsl(var(--admin-text))" }}>{activeShop.name}</span>
        </p>
      </div>

      {/* Scan input */}
      <div
        className="rounded-lg p-6 border"
        style={{
          background: "hsl(var(--admin-surface))",
          borderColor: "hsl(var(--admin-border))",
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <ScanLine size={18} style={{ color: "hsl(var(--admin-accent))" }} />
          <span className="text-[13px] font-sans" style={{ color: "hsl(var(--admin-text))" }}>
            Наведіть сканер і натисніть курок — або введіть штрих-код вручну
          </span>
        </div>
        <input
          ref={inputRef}
          autoFocus
          type="text"
          inputMode="numeric"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={handleKey}
          placeholder="0000000000000"
          className="w-full px-4 py-3 rounded-md font-mono text-lg tracking-wider border"
          style={{
            background: "hsl(var(--admin-bg))",
            borderColor: "hsl(var(--admin-border))",
            color: "hsl(var(--admin-text))",
          }}
          disabled={loading}
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[13px]" style={{ color: "hsl(var(--admin-text-muted))" }}>
          <Loader2 size={14} className="animate-spin" /> Пошук...
        </div>
      )}

      {/* FOUND in catalog */}
      {catalog && (
        <div
          className="rounded-lg border p-5"
          style={{
            background: "hsl(var(--admin-surface))",
            borderColor: "hsl(var(--admin-border))",
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-500" />
              <span className="text-[13px] font-sans" style={{ color: "hsl(var(--admin-text-muted))" }}>
                Знайдено у спільній базі
              </span>
            </div>
            <button onClick={reset} className="p-1 rounded hover:bg-white/5">
              <X size={14} style={{ color: "hsl(var(--admin-text-muted))" }} />
            </button>
          </div>

          <div className="flex gap-4 mb-5">
            <div
              className="w-24 h-24 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center"
              style={{ background: "hsl(var(--admin-bg))" }}
            >
              {catalog.image_url ? (
                <img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover" />
              ) : (
                <Package size={28} style={{ color: "hsl(var(--admin-text-muted))" }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-mono" style={{ color: "hsl(var(--admin-text-muted))" }}>
                {catalog.barcode}
              </div>
              <div className="font-sans text-[15px] font-medium mt-0.5" style={{ color: "hsl(var(--admin-text))" }}>
                {catalog.name}
              </div>
              {catalog.brand && (
                <div className="text-[12px] mt-0.5" style={{ color: "hsl(var(--admin-text-muted))" }}>
                  {catalog.brand}
                </div>
              )}
              {catalog.description && (
                <p className="text-[12px] mt-2 line-clamp-2" style={{ color: "hsl(var(--admin-text-muted))" }}>
                  {catalog.description}
                </p>
              )}
            </div>
          </div>

          {/* Inventory form */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "hsl(var(--admin-text-muted))" }}>
                Ціна, ₴
              </label>
              <input
                type="number"
                step="0.01"
                value={inventory.price ?? ""}
                onChange={(e) =>
                  setInventory({ ...inventory, price: e.target.value ? parseFloat(e.target.value) : null })
                }
                className="w-full px-3 py-2 rounded-md border text-[13px]"
                style={{
                  background: "hsl(var(--admin-bg))",
                  borderColor: "hsl(var(--admin-border))",
                  color: "hsl(var(--admin-text))",
                }}
              />
            </div>
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "hsl(var(--admin-text-muted))" }}>
                Закупка, ₴
              </label>
              <input
                type="number"
                step="0.01"
                value={inventory.cost_price ?? ""}
                onChange={(e) =>
                  setInventory({ ...inventory, cost_price: e.target.value ? parseFloat(e.target.value) : null })
                }
                className="w-full px-3 py-2 rounded-md border text-[13px]"
                style={{
                  background: "hsl(var(--admin-bg))",
                  borderColor: "hsl(var(--admin-border))",
                  color: "hsl(var(--admin-text))",
                }}
              />
            </div>
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "hsl(var(--admin-text-muted))" }}>
                Залишок
              </label>
              <input
                type="number"
                value={inventory.stock_quantity}
                onChange={(e) =>
                  setInventory({ ...inventory, stock_quantity: parseInt(e.target.value || "0") })
                }
                className="w-full px-3 py-2 rounded-md border text-[13px]"
                style={{
                  background: "hsl(var(--admin-bg))",
                  borderColor: "hsl(var(--admin-border))",
                  color: "hsl(var(--admin-text))",
                }}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={inventory.is_active}
              onChange={(e) => setInventory({ ...inventory, is_active: e.target.checked })}
            />
            <span className="text-[12px]" style={{ color: "hsl(var(--admin-text-muted))" }}>
              Активний (видимий у магазині)
            </span>
          </label>

          <button
            onClick={saveInventory}
            disabled={loading}
            className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-md font-sans text-[13px] font-medium transition-colors"
            style={{ background: "hsl(var(--admin-accent))", color: "hsl(var(--admin-bg))" }}
          >
            <Save size={14} /> Зберегти у {activeShop.name}
          </button>
        </div>
      )}

      {/* NOT FOUND */}
      {notFoundBarcode && !showAIScanner && !showManualForm && (
        <div
          className="rounded-lg border p-5"
          style={{
            background: "hsl(var(--admin-surface))",
            borderColor: "hsl(var(--admin-border))",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[13px] font-sans" style={{ color: "hsl(var(--admin-text))" }}>
                Товар не знайдено у базі
              </div>
              <div className="text-[11px] font-mono mt-1" style={{ color: "hsl(var(--admin-text-muted))" }}>
                {notFoundBarcode}
              </div>
            </div>
            <button onClick={reset} className="p-1 rounded hover:bg-white/5">
              <X size={14} style={{ color: "hsl(var(--admin-text-muted))" }} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setShowAIScanner(true)}
              className="flex items-center justify-center gap-2 py-3 rounded-md text-[13px] font-medium transition-colors"
              style={{ background: "hsl(var(--admin-accent))", color: "hsl(var(--admin-bg))" }}
            >
              <Sparkles size={14} /> Сканувати фото з AI
            </button>
            <button
              onClick={() => setShowManualForm(true)}
              className="flex items-center justify-center gap-2 py-3 rounded-md border text-[13px] font-medium transition-colors"
              style={{
                borderColor: "hsl(var(--admin-border))",
                color: "hsl(var(--admin-text))",
                background: "transparent",
              }}
            >
              <PlusCircle size={14} /> Ввести вручну
            </button>
          </div>
        </div>
      )}

      {/* AI Scanner */}
      {showAIScanner && notFoundBarcode && (
        <div
          className="rounded-lg border p-1"
          style={{
            background: "hsl(var(--admin-surface))",
            borderColor: "hsl(var(--admin-border))",
          }}
        >
          <AIProductScanner
            categories={categories}
            onResult={handleAIResult}
            onClose={() => setShowAIScanner(false)}
          />
        </div>
      )}

      {/* Manual create */}
      {showManualForm && notFoundBarcode && (
        <div
          className="rounded-lg border p-5"
          style={{
            background: "hsl(var(--admin-surface))",
            borderColor: "hsl(var(--admin-border))",
          }}
        >
          <div className="text-[13px] mb-3" style={{ color: "hsl(var(--admin-text-muted))" }}>
            Створити запис у спільній базі для штрих-коду{" "}
            <span className="font-mono" style={{ color: "hsl(var(--admin-text))" }}>
              {notFoundBarcode}
            </span>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Назва товару"
              value={manualForm.name}
              onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-md border text-[13px]"
              style={{
                background: "hsl(var(--admin-bg))",
                borderColor: "hsl(var(--admin-border))",
                color: "hsl(var(--admin-text))",
              }}
            />
            <input
              type="text"
              placeholder="Бренд"
              value={manualForm.brand}
              onChange={(e) => setManualForm({ ...manualForm, brand: e.target.value })}
              className="w-full px-3 py-2 rounded-md border text-[13px]"
              style={{
                background: "hsl(var(--admin-bg))",
                borderColor: "hsl(var(--admin-border))",
                color: "hsl(var(--admin-text))",
              }}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleManualCreate}
              disabled={loading}
              className="flex-1 py-2 rounded-md text-[13px] font-medium"
              style={{ background: "hsl(var(--admin-accent))", color: "hsl(var(--admin-bg))" }}
            >
              Створити
            </button>
            <button
              onClick={() => setShowManualForm(false)}
              className="px-4 py-2 rounded-md text-[13px] border"
              style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text))" }}
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      {/* Recent */}
      {recent.length > 0 && (
        <div className="pt-4 border-t" style={{ borderColor: "hsl(var(--admin-border))" }}>
          <div className="text-[11px] uppercase tracking-widest mb-2" style={{ color: "hsl(var(--admin-text-muted))" }}>
            Останні скани
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((r, i) => (
              <button
                key={i}
                onClick={() => lookupBarcode(r.barcode)}
                className="px-3 py-1.5 rounded-md text-[11px] font-mono border transition-colors"
                style={{
                  borderColor: "hsl(var(--admin-border))",
                  color: "hsl(var(--admin-text-muted))",
                  background: "transparent",
                }}
              >
                {r.barcode} {r.status === "found" ? "✓" : "+ new"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminScanner;
