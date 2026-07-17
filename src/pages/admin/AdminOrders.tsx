import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_LABELS: Record<string, string> = {
  new: "Нове", confirmed: "Підтверджено", processing: "В обробці",
  shipped: "Відправлено", delivered: "Доставлено", returned: "Повернення", cancelled: "Скасовано",
};
const PAYMENT_LABELS: Record<string, string> = {
  pending: "Очікує", paid: "Оплачено", failed: "Помилка", refunded: "Повернено",
};
const STATUS_DOT: Record<string, string> = {
  new: "hsl(220 80% 60%)", confirmed: "hsl(142 60% 45%)", processing: "hsl(38 90% 55%)",
  shipped: "hsl(270 60% 55%)", delivered: "hsl(142 70% 40%)", returned: "hsl(0 70% 55%)", cancelled: "hsl(220 6% 48%)",
};
const PAYMENT_DOT: Record<string, string> = {
  pending: "hsl(38 90% 55%)", paid: "hsl(142 60% 45%)", failed: "hsl(0 70% 55%)", refunded: "hsl(220 6% 48%)",
};
const STATUS_FLOW = ["new", "confirmed", "processing", "shipped", "delivered"];

interface Order {
  id: string; order_number: number; status: string; payment_status: string;
  first_name: string; last_name: string; email: string; phone: string;
  city: string; address: string; delivery_method: string;
  subtotal: number; shipping_cost: number; total: number; notes: string | null; created_at: string;
}
interface OrderItem {
  id: string; product_name: string; product_brand: string; product_image: string | null;
  quantity: number; price: number; total: number;
}

const s = (v: string) => ({ color: `hsl(var(--admin-${v}))` });
const bg = (v: string) => ({ background: `hsl(var(--admin-${v}))` });
const bdr = { borderColor: "hsl(var(--admin-border))" };

const AdminOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchOrders = async () => {
    const query = supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (statusFilter !== "all") query.eq("status", statusFilter as any);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setOrders((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [statusFilter]);

  const openOrder = async (order: Order) => {
    setSelectedOrder(order);
    const { data } = await supabase.from("order_items").select("*").eq("order_id", order.id);
    setOrderItems((data as any[]) || []);
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase.from("orders").update({ status: newStatus as any }).eq("id", orderId);
    if (error) toast.error(error.message);
    else {
      toast.success(`Статус: "${STATUS_LABELS[newStatus]}"`);
      fetchOrders();
      if (selectedOrder?.id === orderId) setSelectedOrder((p) => p ? { ...p, status: newStatus } : null);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-sans text-xl font-medium">Замовлення</h1>
        <p className="text-[13px] mt-0.5" style={s("text-muted")}>{orders.length} замовлень</p>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {[{ key: "all", label: "Усі" }, ...Object.entries(STATUS_LABELS).map(([key, label]) => ({ key, label }))].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className="px-3 py-1.5 text-[12px] font-sans rounded-md transition-colors"
            style={{
              background: statusFilter === key ? "hsl(var(--admin-accent-soft))" : "transparent",
              color: statusFilter === key ? "hsl(var(--admin-accent))" : "hsl(var(--admin-text-muted))",
              border: "1px solid",
              borderColor: statusFilter === key ? "hsl(var(--admin-accent) / 0.3)" : "hsl(var(--admin-border))",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[13px] font-sans" style={s("text-muted")}>Завантаження...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-[13px] font-sans" style={s("text-muted")}>Замовлень немає</div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ ...bg("surface"), ...bdr }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={bdr}>
                  {["№", "Клієнт", "Статус", "Оплата", "Сума", "Дата", ""].map((h, i) => (
                    <th key={i} className={`${i === 6 ? "w-10" : "text-left"} px-4 py-3 text-[10px] uppercase tracking-widest font-sans font-medium`} style={s("text-muted")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0 transition-colors cursor-pointer" style={bdr}
                    onClick={() => openOrder(order)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--admin-surface-hover))")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="px-4 py-3 text-[13px] font-sans font-medium" style={s("text-muted")}>#{order.order_number}</td>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-sans">{order.first_name} {order.last_name}</p>
                      <p className="text-[11px] font-sans" style={s("text-muted")}>{order.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-[12px] font-sans">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[order.status] }} />
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-[12px] font-sans">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PAYMENT_DOT[order.payment_status] }} />
                        {PAYMENT_LABELS[order.payment_status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-sans font-medium">₴{Number(order.total).toFixed(0)}</td>
                    <td className="px-4 py-3 text-[12px] font-sans" style={s("text-muted")}>{fmt(order.created_at)}</td>
                    <td className="px-4 py-3">
                      <Eye size={14} style={s("text-muted")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order detail drawer */}
      <AnimatePresence>
        {selectedOrder && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.6)" }}
              onClick={() => setSelectedOrder(null)} />
            <motion.div
              initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 overflow-y-auto border-l"
              style={{ ...bg("surface"), ...bdr }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-sans text-base font-medium">Замовлення #{selectedOrder.order_number}</h2>
                  <button onClick={() => setSelectedOrder(null)} className="p-1.5 rounded-md transition-colors"
                    style={s("text-muted")}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--admin-surface-hover))")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  ><X size={16} /></button>
                </div>

                {/* Status pipeline */}
                <div className="mb-6">
                  <p className="text-[10px] uppercase tracking-widest font-sans mb-2.5" style={s("text-muted")}>Статус</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {STATUS_FLOW.map((st) => (
                      <button key={st} onClick={() => updateStatus(selectedOrder.id, st)}
                        className="px-3 py-1.5 text-[11px] font-sans rounded-md border transition-colors"
                        style={{
                          background: selectedOrder.status === st ? "hsl(var(--admin-accent-soft))" : "transparent",
                          color: selectedOrder.status === st ? "hsl(var(--admin-accent))" : "hsl(var(--admin-text-muted))",
                          borderColor: selectedOrder.status === st ? "hsl(var(--admin-accent) / 0.3)" : "hsl(var(--admin-border))",
                        }}
                      >{STATUS_LABELS[st]}</button>
                    ))}
                  </div>
                </div>

                {/* Info sections */}
                {[
                  { title: "Клієнт", lines: [`${selectedOrder.first_name} ${selectedOrder.last_name}`, selectedOrder.email, selectedOrder.phone] },
                  { title: "Доставка", lines: [`${selectedOrder.city}, ${selectedOrder.address}`, selectedOrder.notes ? `"${selectedOrder.notes}"` : null].filter(Boolean) as string[] },
                ].map((sec) => (
                  <div key={sec.title} className="mb-4 rounded-lg p-4 border" style={{ ...bg("bg"), ...bdr }}>
                    <p className="text-[10px] uppercase tracking-widest font-sans mb-2" style={s("text-muted")}>{sec.title}</p>
                    {sec.lines.map((l, i) => <p key={i} className="text-[13px] font-sans" style={i > 0 ? s("text-muted") : undefined}>{l}</p>)}
                  </div>
                ))}

                {/* Items */}
                <div className="mb-4 rounded-lg p-4 border" style={{ ...bg("bg"), ...bdr }}>
                  <p className="text-[10px] uppercase tracking-widest font-sans mb-3" style={s("text-muted")}>Товари</p>
                  <div className="space-y-3">
                    {orderItems.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        {item.product_image && (
                          <div className="w-10 h-12 rounded-md border overflow-hidden flex-shrink-0" style={bdr}>
                            <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-sans" style={s("text-muted")}>{item.product_brand}</p>
                          <p className="text-[13px] font-sans">{item.product_name}</p>
                          <p className="text-[11px] font-sans" style={s("text-muted")}>{item.quantity} × ₴{Number(item.price).toFixed(0)}</p>
                        </div>
                        <p className="text-[13px] font-sans font-medium">₴{Number(item.total).toFixed(0)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="rounded-lg p-4 border space-y-2" style={{ ...bg("bg"), ...bdr }}>
                  {[
                    { l: "Товари", v: selectedOrder.subtotal },
                    { l: "Доставка", v: selectedOrder.shipping_cost },
                  ].map((r) => (
                    <div key={r.l} className="flex justify-between text-[13px] font-sans">
                      <span style={s("text-muted")}>{r.l}</span>
                      <span>₴{Number(r.v).toFixed(0)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-sans pt-2 border-t" style={bdr}>
                    <span className="text-[13px] font-medium">Разом</span>
                    <span className="text-base font-semibold">₴{Number(selectedOrder.total).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[12px] font-sans pt-1">
                    <span style={s("text-muted")}>Оплата</span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: PAYMENT_DOT[selectedOrder.payment_status] }} />
                      {PAYMENT_LABELS[selectedOrder.payment_status]}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] font-sans mt-4" style={s("text-muted")}>Створено: {fmt(selectedOrder.created_at)}</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminOrders;
