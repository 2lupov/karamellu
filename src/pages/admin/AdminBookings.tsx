import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, X, Phone, User as UserIcon, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Booking = {
  id: string;
  service_id: string;
  master_id: string;
  client_name: string;
  client_phone: string;
  scheduled_at: string;
  duration_minutes: number;
  price: number | null;
  price_variant_label: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  notes: string | null;
  created_at: string;
};

const STATUS_LABELS = {
  pending: "Очікує",
  confirmed: "Підтверджено",
  completed: "Виконано",
  cancelled: "Скасовано",
} as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(38 90% 55%)",
  confirmed: "hsl(220 80% 60%)",
  completed: "hsl(142 60% 45%)",
  cancelled: "hsl(220 6% 48%)",
};

const s = (v: string) => ({ color: `hsl(var(--admin-${v}))` });
const bdr = { borderColor: "hsl(var(--admin-border))" };

const fmt = (d: string) =>
  new Date(d).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const AdminBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Record<string, { name: string }>>({});
  const [masters, setMasters] = useState<Record<string, { name: string }>>({});
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const fetchAll = async () => {
    const [b, sv, m] = await Promise.all([
      supabase.from("bookings").select("*").order("scheduled_at", { ascending: false }),
      supabase.from("services").select("id,name"),
      supabase.from("masters").select("id,name"),
    ]);
    setBookings((b.data as Booking[]) || []);
    setServices(Object.fromEntries(((sv.data as any[]) || []).map((x) => [x.id, { name: x.name }])));
    setMasters(Object.fromEntries(((m.data as any[]) || []).map((x) => [x.id, { name: x.name }])));
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const ch = supabase
      .channel("admin-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  const openEdit = (b: Booking) => {
    setSelected(b);
    const d = new Date(b.scheduled_at);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditScheduledAt(local);
    setEditNotes(b.notes || "");
  };

  const updateStatus = async (id: string, status: Booking["status"]) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Статус: ${STATUS_LABELS[status]}`); fetchAll(); if (selected?.id === id) setSelected({ ...selected, status }); }
  };

  const saveEdits = async () => {
    if (!selected) return;
    const iso = new Date(editScheduledAt).toISOString();
    const { error } = await supabase.from("bookings").update({ scheduled_at: iso, notes: editNotes }).eq("id", selected.id);
    if (error) toast.error(error.message);
    else { toast.success("Збережено"); fetchAll(); setSelected(null); }
  };

  const deleteBooking = async (id: string) => {
    if (!confirm("Видалити запис?")) return;
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Видалено"); setSelected(null); fetchAll(); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-sans text-xl font-medium">Записи на процедури</h1>
        <p className="text-[13px] mt-0.5" style={s("text-muted")}>{bookings.length} записів</p>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {(["all", "pending", "confirmed", "completed", "cancelled"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 text-[12px] rounded-md border transition-colors"
            style={{
              ...bdr,
              background: filter === f ? "hsl(var(--admin-surface-hover))" : "transparent",
              color: filter === f ? "hsl(var(--admin-text))" : "hsl(var(--admin-text-muted))",
            }}
          >
            {f === "all" ? "Усі" : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm" style={s("text-muted")}>Завантаження…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm py-12 text-center" style={s("text-muted")}>Немає записів</div>
      ) : (
        <div className="border rounded-md overflow-hidden" style={bdr}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b" style={bdr}>
                <th className="text-left p-3 font-medium" style={s("text-muted")}>Дата</th>
                <th className="text-left p-3 font-medium" style={s("text-muted")}>Клієнт</th>
                <th className="text-left p-3 font-medium" style={s("text-muted")}>Послуга</th>
                <th className="text-left p-3 font-medium" style={s("text-muted")}>Майстер</th>
                <th className="text-left p-3 font-medium" style={s("text-muted")}>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b hover:bg-white/[0.02] cursor-pointer" style={bdr} onClick={() => openEdit(b)}>
                  <td className="p-3 whitespace-nowrap">{fmt(b.scheduled_at)}</td>
                  <td className="p-3">
                    <div>{b.client_name}</div>
                    <div className="text-[11px]" style={s("text-muted")}>{b.client_phone}</div>
                  </td>
                  <td className="p-3">
                    {services[b.service_id]?.name || "?"}
                    {b.price_variant_label && <span className="text-[11px] ml-1" style={s("text-muted")}>({b.price_variant_label})</span>}
                  </td>
                  <td className="p-3">{masters[b.master_id]?.name || "?"}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[b.status] }} />
                      {STATUS_LABELS[b.status]}
                    </span>
                  </td>
                  <td className="p-3 text-right">{b.price ? `${b.price} грн` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.6)" }}
              onClick={() => setSelected(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg p-6 rounded-lg border"
              style={{ background: "hsl(var(--admin-surface))", borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text))" }}
            >
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="font-medium">{services[selected.service_id]?.name}</h2>
                  <p className="text-[12px] mt-0.5" style={s("text-muted")}>Створено {fmt(selected.created_at)}</p>
                </div>
                <button onClick={() => setSelected(null)} className="opacity-60 hover:opacity-100"><X size={16} /></button>
              </div>

              <div className="space-y-4 text-[13px]">
                <div className="flex items-center gap-2"><UserIcon size={14} /> {selected.client_name}</div>
                <div className="flex items-center gap-2"><Phone size={14} /> <a href={`tel:${selected.client_phone}`} className="hover:underline">{selected.client_phone}</a></div>
                <div className="flex items-center gap-2"><Clock size={14} /> {selected.duration_minutes} хв · Майстер: {masters[selected.master_id]?.name}</div>
                {selected.price && <div>Ціна: <b>{selected.price} грн</b> {selected.price_variant_label && `(${selected.price_variant_label})`}</div>}

                <div>
                  <label className="block text-[11px] mb-1.5" style={s("text-muted")}>Дата і час</label>
                  <input
                    type="datetime-local"
                    value={editScheduledAt}
                    onChange={(e) => setEditScheduledAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border bg-transparent text-[13px]"
                    style={bdr}
                  />
                </div>

                <div>
                  <label className="block text-[11px] mb-1.5" style={s("text-muted")}>Нотатка</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-md border bg-transparent text-[13px]"
                    style={bdr}
                  />
                </div>

                <div>
                  <label className="block text-[11px] mb-1.5" style={s("text-muted")}>Статус</label>
                  <div className="flex gap-2 flex-wrap">
                    {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((st) => (
                      <button
                        key={st}
                        onClick={() => updateStatus(selected.id, st)}
                        className="px-3 py-1.5 text-[12px] rounded-md border"
                        style={{ ...bdr, background: selected.status === st ? "hsl(var(--admin-surface-hover))" : "transparent" }}
                      >
                        {STATUS_LABELS[st]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between gap-2 mt-6 pt-5 border-t" style={bdr}>
                <button onClick={() => deleteBooking(selected.id)} className="px-4 py-2 text-[12px] rounded-md text-red-400 hover:bg-red-500/10">Видалити</button>
                <button onClick={saveEdits} className="px-4 py-2 text-[12px] rounded-md bg-white text-black hover:opacity-90">Зберегти зміни</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminBookings;
