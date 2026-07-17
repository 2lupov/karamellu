import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, TrendingUp, ShoppingBag, CreditCard, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    products: 0, categories: 0, bestSellers: 0, avgPrice: 0,
    totalOrders: 0, pendingOrders: 0, totalRevenue: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const [prodRes, catRes, ordersRes, recentRes] = await Promise.all([
        supabase.from("products").select("price, best_seller"),
        supabase.from("categories").select("id"),
        supabase.from("orders").select("status, payment_status, total"),
        supabase.from("orders").select("id, order_number, first_name, last_name, total, status, payment_status, created_at").order("created_at", { ascending: false }).limit(5),
      ]);
      const products = prodRes.data || [];
      const orders = ordersRes.data || [];
      const paidOrders = orders.filter((o: any) => o.payment_status === "paid");

      setStats({
        products: products.length,
        categories: (catRes.data || []).length,
        bestSellers: products.filter((p: any) => p.best_seller).length,
        avgPrice: products.length ? Math.round(products.reduce((s: number, p: any) => s + Number(p.price), 0) / products.length) : 0,
        totalOrders: orders.length,
        pendingOrders: orders.filter((o: any) => o.status === "new" || o.status === "confirmed").length,
        totalRevenue: paidOrders.reduce((s: number, o: any) => s + Number(o.total), 0),
      });
      setRecentOrders(recentRes.data || []);
    };
    fetchStats();
  }, []);

  const STATUS_LABELS: Record<string, string> = {
    new: "Нове", confirmed: "Підтверджено", processing: "В обробці",
    shipped: "Відправлено", delivered: "Доставлено", returned: "Повернення", cancelled: "Скасовано",
  };

  const STATUS_DOT: Record<string, string> = {
    new: "hsl(var(--admin-accent))",
    confirmed: "hsl(var(--admin-success))",
    processing: "hsl(var(--admin-warning))",
    shipped: "hsl(142 60% 45%)",
    delivered: "hsl(142 70% 40%)",
    returned: "hsl(var(--admin-danger))",
    cancelled: "hsl(var(--admin-text-muted))",
  };

  const cards = [
    { label: "Замовлення", value: stats.totalOrders, icon: ShoppingBag, change: null },
    { label: "Очікують", value: stats.pendingOrders, icon: CreditCard, change: null },
    { label: "Виручка", value: `₴${stats.totalRevenue.toLocaleString("uk-UA")}`, icon: TrendingUp, change: null },
    { label: "Продукти", value: stats.products, icon: Package, change: null },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-sans text-xl font-medium">Дашборд</h1>
        <p className="text-[13px] mt-0.5" style={{ color: "hsl(var(--admin-text-muted))" }}>Огляд магазину Карамель LU</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg p-4 border"
            style={{ background: "hsl(var(--admin-surface))", borderColor: "hsl(var(--admin-border))" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-sans uppercase tracking-wider" style={{ color: "hsl(var(--admin-text-muted))" }}>{card.label}</span>
              <card.icon size={15} strokeWidth={1.5} style={{ color: "hsl(var(--admin-text-muted))" }} />
            </div>
            <p className="font-sans text-2xl font-semibold tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <div className="rounded-lg border" style={{ background: "hsl(var(--admin-surface))", borderColor: "hsl(var(--admin-border))" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "hsl(var(--admin-border))" }}>
            <h2 className="font-sans text-sm font-medium">Останні замовлення</h2>
            <Link to="/admin/orders" className="text-[12px] font-sans flex items-center gap-1 transition-colors" style={{ color: "hsl(var(--admin-text-muted))" }}>
              Усі <ArrowUpRight size={12} />
            </Link>
          </div>
          <div>
            {recentOrders.map((order: any, i: number) => (
              <div
                key={order.id}
                className="flex items-center justify-between px-5 py-3.5 border-b last:border-0"
                style={{ borderColor: "hsl(var(--admin-border))" }}
              >
                <div className="flex items-center gap-3">
                  <span className="font-sans text-[13px] font-medium" style={{ color: "hsl(var(--admin-text-muted))" }}>#{order.order_number}</span>
                  <span className="font-sans text-[13px]">{order.first_name} {order.last_name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_DOT[order.status] || "hsl(var(--admin-text-muted))" }} />
                    <span className="text-[12px] font-sans" style={{ color: "hsl(var(--admin-text-muted))" }}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                  <span className="font-sans text-[13px] font-medium min-w-[80px] text-right">₴{Number(order.total).toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
