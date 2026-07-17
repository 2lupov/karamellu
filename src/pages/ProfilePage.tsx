import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { Package, ChevronRight } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  new: "Нове", confirmed: "Підтверджено", processing: "В обробці",
  shipped: "Відправлено", delivered: "Доставлено", returned: "Повернення", cancelled: "Скасовано",
};
const PAYMENT_LABELS: Record<string, string> = {
  pending: "Очікує", paid: "Оплачено", failed: "Помилка", refunded: "Повернено",
};
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800", confirmed: "bg-emerald-100 text-emerald-800",
  processing: "bg-amber-100 text-amber-800", shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800", returned: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

interface Order {
  id: string;
  order_number: number;
  status: string;
  payment_status: string;
  total: number;
  created_at: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  product_brand: string;
  product_image: string | null;
  quantity: number;
  price: number;
  total: number;
}

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "orders">("profile");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [profile, setProfile] = useState({
    full_name: "",
    phone: "",
    address: "",
    city: "",
    postal_code: "",
    country: "",
  });

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setProfile({
          full_name: data.full_name || "",
          phone: data.phone || "",
          address: data.address || "",
          city: data.city || "",
          postal_code: data.postal_code || "",
          country: data.country || "",
        });
      }
    };
    fetchProfile();
  }, [user, navigate]);

  useEffect(() => {
    if (activeTab === "orders" && user) {
      setOrdersLoading(true);
      supabase
        .from("orders")
        .select("id, order_number, status, payment_status, total, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setOrders((data as any[]) || []);
          setOrdersLoading(false);
        });
    }
  }, [activeTab, user]);

  const toggleOrderItems = async (orderId: string) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      return;
    }
    setExpandedOrder(orderId);
    if (!orderItems[orderId]) {
      const { data } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);
      setOrderItems((prev) => ({ ...prev, [orderId]: (data as any[]) || [] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update(profile)
      .eq("user_id", user.id);
    setLoading(false);
    if (error) {
      toast.error("Помилка збереження");
    } else {
      toast.success("Профіль оновлено!");
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("uk-UA", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });

  if (!user) return null;

  // Build display identity: nickname@karamellu.online instead of raw email
  const isTelegramUser = user.email?.includes('@telegram.karamellu.local');
  const displayName = profile.full_name
    || user.user_metadata?.full_name
    || (isTelegramUser ? user.email?.split('@')[0]?.replace('tg_', '') : undefined)
    || '';
  
  // Show nickname@karamellu.online for telegram users, or actual email for regular users
  const displayEmail = isTelegramUser
    ? `${displayName || 'user'}@karamellu.online`
    : user.email;

  const inputClass = "w-full bg-transparent border border-border px-4 py-3 text-sm font-sans outline-none focus:border-foreground transition-colors";

  return (
    <main className="pt-20 md:pt-24">
      <div className="container-editorial section-padding">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          <h1 className="font-serif text-3xl md:text-4xl mb-2">{displayName || 'Мій профіль'}</h1>
          <p className="text-sm text-muted-foreground font-sans mb-8">{displayEmail}</p>

          {/* Tabs */}
          <div className="flex gap-6 border-b border-border mb-8">
            {(["profile", "orders"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-xs tracking-[0.15em] uppercase font-sans transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "profile" ? "Особисті дані" : "Мої замовлення"}
              </button>
            ))}
          </div>

          {activeTab === "profile" && (
            <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
              <div>
                <label className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-sans block mb-2">Повне ім'я</label>
                <input type="text" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-sans block mb-2">Телефон</label>
                <input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className={inputClass} />
              </div>

              <h2 className="text-xs tracking-[0.2em] uppercase font-sans pt-4">Адреса доставки</h2>
              <div>
                <label className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-sans block mb-2">Адреса</label>
                <input type="text" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-sans block mb-2">Місто</label>
                  <input type="text" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-sans block mb-2">Індекс</label>
                  <input type="text" value={profile.postal_code} onChange={(e) => setProfile({ ...profile, postal_code: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-sans block mb-2">Країна</label>
                  <input type="text" value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value })} className={inputClass} />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-editorial-filled disabled:opacity-50">
                {loading ? "Збереження..." : "Зберегти зміни"}
              </button>
            </form>
          )}

          {activeTab === "orders" && (
            <div>
              {ordersLoading ? (
                <p className="text-sm text-muted-foreground font-sans py-8 text-center">Завантаження...</p>
              ) : orders.length === 0 ? (
                <div className="text-center py-12">
                  <Package size={40} strokeWidth={1} className="mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground font-sans text-sm mb-4">У вас ще немає замовлень</p>
                  <Link to="/shop" className="btn-editorial">Перейти до магазину</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="border border-border">
                      <button
                        onClick={() => toggleOrderItems(order.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-sm font-sans font-medium">Замовлення #{order.order_number}</p>
                            <p className="text-xs text-muted-foreground font-sans">{formatDate(order.created_at)}</p>
                          </div>
                          <span className={`text-[10px] tracking-wider uppercase font-sans px-2 py-1 rounded-sm ${STATUS_COLORS[order.status] || ""}`}>
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-sans">₴{Number(order.total).toFixed(2)}</span>
                          <ChevronRight
                            size={14}
                            className={`text-muted-foreground transition-transform ${expandedOrder === order.id ? "rotate-90" : ""}`}
                          />
                        </div>
                      </button>

                      {expandedOrder === order.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          className="border-t border-border px-4 py-4"
                        >
                          <div className="space-y-3">
                            {(orderItems[order.id] || []).map((item) => (
                              <div key={item.id} className="flex gap-3">
                                {item.product_image && (
                                  <div className="w-12 h-14 border border-border overflow-hidden flex-shrink-0">
                                    <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] text-muted-foreground font-sans">{item.product_brand}</p>
                                  <p className="text-xs font-sans">{item.product_name}</p>
                                  <p className="text-xs text-muted-foreground font-sans">{item.quantity} × ₴{Number(item.price).toFixed(2)}</p>
                                </div>
                                <p className="text-sm font-sans">₴{Number(item.total).toFixed(2)}</p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 pt-3 border-t border-border flex justify-between text-xs font-sans text-muted-foreground">
                            <span>Оплата: {PAYMENT_LABELS[order.payment_status] || order.payment_status}</span>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
};

export default ProfilePage;
