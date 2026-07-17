import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/context/ShopContext";
import { toast } from "sonner";
import { Store, UserPlus, Trash2, Plus } from "lucide-react";

interface Member {
  id: string;
  user_id: string;
  role: string;
}

const AdminShops = () => {
  const { shops, refresh, activeShop } = useShop();
  const [members, setMembers] = useState<Record<string, Member[]>>({});
  const [newShopName, setNewShopName] = useState("");
  const [newMemberId, setNewMemberId] = useState<Record<string, string>>({});

  const loadMembers = async () => {
    if (shops.length === 0) return;
    const { data } = await supabase
      .from("shop_members")
      .select("id, user_id, role, shop_id")
      .in(
        "shop_id",
        shops.map((s) => s.id)
      );
    const grouped: Record<string, Member[]> = {};
    (data || []).forEach((m: any) => {
      if (!grouped[m.shop_id]) grouped[m.shop_id] = [];
      grouped[m.shop_id].push({ id: m.id, user_id: m.user_id, role: m.role });
    });
    setMembers(grouped);
  };

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shops.length]);

  const createShop = async () => {
    if (!newShopName.trim()) return;
    const slug = newShopName.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("shops").insert({
      name: newShopName.trim(),
      slug,
      owner_user_id: userData.user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Магазин створено");
    setNewShopName("");
    refresh();
  };

  const addMember = async (shopId: string) => {
    const uid = (newMemberId[shopId] || "").trim();
    if (!uid) return;
    const { error } = await supabase.from("shop_members").insert({
      shop_id: shopId,
      user_id: uid,
      role: "staff",
    });
    if (error) return toast.error(error.message);
    toast.success("Додано");
    setNewMemberId({ ...newMemberId, [shopId]: "" });
    loadMembers();
  };

  const removeMember = async (id: string) => {
    if (!confirm("Видалити члена?")) return;
    const { error } = await supabase.from("shop_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadMembers();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-sans text-xl font-medium" style={{ color: "hsl(var(--admin-text))" }}>
          Магазини
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "hsl(var(--admin-text-muted))" }}>
          Каталог товарів спільний; ціни та залишки — окремі для кожного магазину.
        </p>
      </div>

      {/* New shop */}
      <div
        className="rounded-lg border p-4 flex gap-2"
        style={{ background: "hsl(var(--admin-surface))", borderColor: "hsl(var(--admin-border))" }}
      >
        <input
          type="text"
          placeholder="Назва нового магазину"
          value={newShopName}
          onChange={(e) => setNewShopName(e.target.value)}
          className="flex-1 px-3 py-2 rounded-md border text-[13px]"
          style={{
            background: "hsl(var(--admin-bg))",
            borderColor: "hsl(var(--admin-border))",
            color: "hsl(var(--admin-text))",
          }}
        />
        <button
          onClick={createShop}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium"
          style={{ background: "hsl(var(--admin-accent))", color: "hsl(var(--admin-bg))" }}
        >
          <Plus size={14} /> Створити
        </button>
      </div>

      {/* Shops list */}
      <div className="space-y-4">
        {shops.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border p-5"
            style={{ background: "hsl(var(--admin-surface))", borderColor: "hsl(var(--admin-border))" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Store size={16} style={{ color: "hsl(var(--admin-accent))" }} />
              <span className="font-sans text-[15px] font-medium" style={{ color: "hsl(var(--admin-text))" }}>
                {s.name}
              </span>
              {activeShop?.id === s.id && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded"
                  style={{ background: "hsl(var(--admin-accent-soft))", color: "hsl(var(--admin-accent))" }}
                >
                  активний
                </span>
              )}
              <span className="ml-auto text-[11px] font-mono" style={{ color: "hsl(var(--admin-text-muted))" }}>
                /{s.slug}
              </span>
            </div>

            <div className="text-[11px] uppercase tracking-widest mb-2" style={{ color: "hsl(var(--admin-text-muted))" }}>
              Члени ({members[s.id]?.length || 0})
            </div>
            <div className="space-y-1.5">
              {(members[s.id] || []).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-[12px] px-3 py-2 rounded border"
                  style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text))" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px]">{m.user_id.slice(0, 8)}...</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: "hsl(var(--admin-surface-hover))", color: "hsl(var(--admin-text-muted))" }}
                    >
                      {m.role}
                    </span>
                  </div>
                  <button onClick={() => removeMember(m.id)} className="p-1 rounded hover:bg-white/5">
                    <Trash2 size={12} style={{ color: "hsl(var(--admin-text-muted))" }} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="User ID (UUID)"
                value={newMemberId[s.id] || ""}
                onChange={(e) => setNewMemberId({ ...newMemberId, [s.id]: e.target.value })}
                className="flex-1 px-3 py-1.5 rounded-md border text-[12px] font-mono"
                style={{
                  background: "hsl(var(--admin-bg))",
                  borderColor: "hsl(var(--admin-border))",
                  color: "hsl(var(--admin-text))",
                }}
              />
              <button
                onClick={() => addMember(s.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] border"
                style={{
                  borderColor: "hsl(var(--admin-border))",
                  color: "hsl(var(--admin-text))",
                  background: "transparent",
                }}
              >
                <UserPlus size={12} /> Додати
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminShops;
