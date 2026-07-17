import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface Shop {
  id: string;
  name: string;
  slug: string;
}

interface ShopContextValue {
  shops: Shop[];
  activeShop: Shop | null;
  setActiveShopId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ShopContext = createContext<ShopContextValue | undefined>(undefined);
const STORAGE_KEY = "active_shop_id";

export const ShopProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [activeShopId, setActiveShopIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) {
      setShops([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("shops")
      .select("id, name, slug")
      .order("name");
    const list = (data as Shop[]) || [];
    setShops(list);
    if (list.length > 0 && (!activeShopId || !list.find((s) => s.id === activeShopId))) {
      setActiveShopIdState(list[0].id);
      localStorage.setItem(STORAGE_KEY, list[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setActiveShopId = (id: string) => {
    setActiveShopIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const activeShop = shops.find((s) => s.id === activeShopId) || null;

  return (
    <ShopContext.Provider value={{ shops, activeShop, setActiveShopId, loading, refresh: load }}>
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within ShopProvider");
  return ctx;
};
