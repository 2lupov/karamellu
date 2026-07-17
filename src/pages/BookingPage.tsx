import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar } from "@/components/ui/calendar";
import { Check, ChevronLeft, Clock, User, Phone, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { uk } from "date-fns/locale";
import SEOHead from "@/components/SEOHead";

type Category = { id: string; name: string; slug: string; image_url: string | null; order_index: number };
type PriceVariant = { label: string | null; price: number };
type Service = { id: string; category_id: string; name: string; description: string | null; duration_minutes: number; price_variants: PriceVariant[]; order_index: number };
type Master = { id: string; name: string; photo_url: string | null; bio: string | null; specialties: string[] };

const STEPS = ["Категорія", "Послуга", "Час", "Дані"];

// Generate 30-min slots from 09:00 to 20:00
const SLOT_START_MIN = 9 * 60;
const SLOT_END_MIN = 20 * 60;
const SLOT_STEP = 30;

const fmtTime = (totalMin: number) => {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const formatPhone = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  let s = digits;
  if (!s.startsWith("380")) s = "380" + s.replace(/^380?/, "");
  s = s.slice(0, 12);
  const rest = s.slice(3);
  let out = "+380";
  if (rest.length) out += " " + rest.slice(0, 2);
  if (rest.length > 2) out += " " + rest.slice(2, 5);
  if (rest.length > 5) out += " " + rest.slice(5, 7);
  if (rest.length > 7) out += " " + rest.slice(7, 9);
  return out;
};

const BookingPage = () => {
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [variant, setVariant] = useState<PriceVariant | null>(null);
  const [masterId, setMasterId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [slot, setSlot] = useState<number | null>(null);
  const [busy, setBusy] = useState<Array<{ start_at: string; end_at: string }>>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+380 ");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const [cats, svs, mas] = await Promise.all([
        supabase.from("service_categories").select("*").order("order_index"),
        supabase.from("services").select("*").eq("is_active", true).order("order_index"),
        supabase.from("masters").select("*").eq("is_active", true).order("order_index"),
      ]);
      setCategories((cats.data as Category[]) || []);
      setServices(((svs.data as any[]) || []).map((s) => ({ ...s, price_variants: s.price_variants || [] })));
      setMasters((mas.data as Master[]) || []);
      setLoading(false);
    })();
  }, []);

  // Load busy intervals when master + date selected
  useEffect(() => {
    if (!masterId || !date) { setBusy([]); return; }
    const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    supabase.rpc("get_busy_intervals", { _master_id: masterId, _date: d }).then(({ data }) => {
      setBusy(((data as any[]) || []).map((r) => ({ start_at: r.start_at, end_at: r.end_at })));
    });
  }, [masterId, date]);

  const categoryServices = useMemo(
    () =>
      services
        .filter((s) => s.category_id === categoryId)
        .slice()
        .sort((a, b) => {
          const ap = a.price_variants.length ? Math.min(...a.price_variants.map((v) => v.price)) : Infinity;
          const bp = b.price_variants.length ? Math.min(...b.price_variants.map((v) => v.price)) : Infinity;
          return ap - bp;
        }),
    [services, categoryId]
  );


  // Auto-select master when service chosen (client no longer picks)
  useEffect(() => {
    if (!service) { setMasterId(null); return; }
    const eligible = masters.filter((m) => m.specialties.includes(service.category_id));
    const chosen = eligible[0] || masters[0] || null;
    setMasterId(chosen?.id || null);
  }, [service, masters]);


  const availableSlots = useMemo(() => {
    if (!service || !date) return [];
    const slots: number[] = [];
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const minNow = now.getHours() * 60 + now.getMinutes();
    for (let m = SLOT_START_MIN; m + service.duration_minutes <= SLOT_END_MIN; m += SLOT_STEP) {
      if (isToday && m <= minNow) continue;
      const slotStart = new Date(date);
      slotStart.setHours(0, 0, 0, 0);
      slotStart.setMinutes(m);
      const slotEnd = new Date(slotStart.getTime() + service.duration_minutes * 60000);
      const conflict = busy.some((b) => {
        const bs = new Date(b.start_at).getTime();
        const be = new Date(b.end_at).getTime();
        return bs < slotEnd.getTime() && be > slotStart.getTime();
      });
      if (!conflict) slots.push(m);
    }
    return slots;
  }, [service, date, busy]);

  const go = (n: number) => setStep(Math.max(0, Math.min(STEPS.length - 1, n)));

  const canSubmit = service && masterId && date && slot !== null && name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 11;

  const submit = async () => {
    if (!canSubmit || !service || !masterId || !date || slot === null) return;
    setSubmitting(true);
    try {
      const scheduled = new Date(date);
      scheduled.setHours(0, 0, 0, 0);
      scheduled.setMinutes(slot);
      const { data, error } = await supabase.functions.invoke("create-booking", {
        body: {
          service_id: service.id,
          master_id: masterId,
          scheduled_at: scheduled.toISOString(),
          client_name: name.trim(),
          client_phone: phone.trim(),
          price_variant_label: variant?.label || null,
        },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "Помилка");
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  const slideVariants = {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  };

  return (
    <>
      <SEOHead title="Запис на процедуру — Карамель LU" description="Онлайн-запис до салону краси Карамель LU. Оберіть послугу, майстра і зручний час." />
      <main className="min-h-screen pt-20 md:pt-24 pb-20 bg-background">
        <div className="container-editorial max-w-5xl">



          {!done && (
            <>



              <div className="relative min-h-[400px]">
                <AnimatePresence mode="wait">
                  {step === 0 && (
                    <motion.div key="step0" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                        {loading
                          ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] bg-secondary/40 animate-pulse" />)
                          : categories.map((cat, i) => (
                              <motion.button
                                key={cat.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                                whileHover={{ y: -4 }}
                                onClick={() => { setCategoryId(cat.id); go(1); }}
                                className="group relative aspect-[3/4] border border-border overflow-hidden bg-secondary/30 transition-colors duration-500 hover:border-foreground/40"
                              >
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                                  <span className="font-serif text-base md:text-xl font-light text-center leading-tight group-hover:scale-105 transition-transform duration-500">
                                    {cat.name}
                                  </span>
                                  <span className="mt-3 h-px w-6 bg-foreground/30 group-hover:w-12 transition-all duration-500" />
                                  <span className="mt-3 text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-sans opacity-0 group-hover:opacity-100 transition-opacity duration-500">Обрати</span>
                                </div>
                              </motion.button>
                            ))}
                      </div>
                    </motion.div>
                  )}

                  {step === 1 && (
                    <motion.div key="step1" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
                      <div className="divide-y divide-border border-y border-border">
                        {categoryServices.map((s, i) => {
                          const isMulti = s.price_variants.length > 1 && s.price_variants.some((v) => v.label);
                          const minPrice = Math.min(...s.price_variants.map((v) => v.price));
                          const maxPrice = Math.max(...s.price_variants.map((v) => v.price));
                          return (
                            <motion.div
                              key={s.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04, duration: 0.4 }}
                            >
                              {isMulti ? (
                                <div className="py-5 md:py-6">
                                  <div className="flex items-start justify-between gap-4 mb-3">
                                    <div>
                                      <h3 className="font-serif text-lg md:text-xl font-light">{s.name}</h3>
                                      {s.description && <p className="text-xs text-muted-foreground mt-1 font-sans">{s.description}</p>}
                                      <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground font-sans">
                                        <Clock size={12} strokeWidth={1.2} />
                                        {s.duration_minutes} хв
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {s.price_variants.map((v) => (
                                      <button
                                        key={v.label || "x"}
                                        onClick={() => { setService(s); setVariant(v); go(2); }}
                                        className="border border-border px-4 py-2.5 text-left hover:border-foreground transition-all duration-300 hover:bg-secondary/40 group"
                                      >
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans">{v.label}</div>
                                        <div className="font-serif text-base mt-0.5">{v.price} грн</div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setService(s); setVariant(s.price_variants[0] || null); go(2); }}
                                  className="w-full py-5 md:py-6 flex items-center justify-between gap-4 hover:bg-secondary/30 transition-colors duration-300 px-2 -mx-2 group"
                                >
                                  <div className="text-left">
                                    <h3 className="font-serif text-lg md:text-xl font-light group-hover:translate-x-1 transition-transform duration-300">{s.name}</h3>
                                    {s.description && <p className="text-xs text-muted-foreground mt-1 font-sans">{s.description}</p>}
                                    <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground font-sans">
                                      <Clock size={12} strokeWidth={1.2} />
                                      {s.duration_minutes} хв
                                    </div>
                                  </div>
                                  <div className="font-serif text-lg md:text-xl">
                                    {minPrice === maxPrice ? `${minPrice}` : `${minPrice}–${maxPrice}`} <span className="text-xs text-muted-foreground">грн</span>
                                  </div>
                                </button>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && service && (
                    <motion.div key="step2" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
                      <div className="grid md:grid-cols-2 gap-8">
                        <div>
                          <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-4 font-sans">Дата</h3>
                          <div className="border border-border p-2 inline-block">
                            <Calendar
                              mode="single"
                              selected={date}
                              onSelect={(d) => { setDate(d); setSlot(null); }}
                              disabled={(d) => {
                                const t = new Date(); t.setHours(0,0,0,0);
                                const max = new Date(); max.setDate(max.getDate() + 60);
                                return d < t || d > max;
                              }}
                              locale={uk}
                              className="pointer-events-auto"
                            />
                          </div>
                        </div>
                        <div>
                          <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-4 font-sans">Час</h3>
                          {!date && <p className="text-sm text-muted-foreground">Оберіть спочатку дату</p>}
                          {date && availableSlots.length === 0 && <p className="text-sm text-muted-foreground">На цю дату немає вільних слотів</p>}
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            <AnimatePresence>
                              {availableSlots.map((m, i) => (
                                <motion.button
                                  key={m}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: i * 0.015 }}
                                  onClick={() => setSlot(m)}
                                  className={`py-2.5 text-sm font-sans border transition-all duration-200 ${
                                    slot === m
                                      ? "bg-foreground text-background border-foreground"
                                      : "border-border hover:border-foreground"
                                  }`}
                                >
                                  {fmtTime(m)}
                                </motion.button>
                              ))}
                            </AnimatePresence>
                          </div>
                          {slot !== null && (
                            <motion.button
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              onClick={() => go(3)}
                              className="mt-6 w-full md:w-auto px-8 py-3 bg-foreground text-background text-[11px] uppercase tracking-[0.25em] font-sans hover:opacity-90 transition-opacity"
                            >
                              Далі →
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && service && masterId && date && slot !== null && (
                    <motion.div key="step3" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
                      <div className="grid md:grid-cols-2 gap-10 max-w-3xl mx-auto">
                        {/* Summary */}
                        <div className="border border-border p-6 bg-secondary/20">
                          <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-4 font-sans">Ваш запис</h3>
                          <dl className="space-y-3 text-sm font-sans">
                            <div><dt className="text-muted-foreground text-xs">Послуга</dt><dd className="font-serif text-base">{service.name}{variant?.label && ` (${variant.label})`}</dd></div>
                            
                            <div><dt className="text-muted-foreground text-xs">Дата і час</dt><dd>{date.toLocaleDateString("uk-UA", { day: "2-digit", month: "long", year: "numeric" })} о {fmtTime(slot)}</dd></div>
                            <div><dt className="text-muted-foreground text-xs">Тривалість</dt><dd>{service.duration_minutes} хв</dd></div>
                            {variant?.price && <div><dt className="text-muted-foreground text-xs">Ціна</dt><dd className="font-serif text-lg">{variant.price} грн</dd></div>}
                          </dl>
                        </div>

                        {/* Form */}
                        <div className="space-y-5">
                          <div>
                            <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 block font-sans">Ваше ім'я</label>
                            <div className="relative">
                              <User size={14} strokeWidth={1.2} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                              <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Як до вас звертатися"
                                className="w-full pl-10 pr-3 py-3 bg-transparent border border-border focus:border-foreground outline-none font-sans text-sm transition-colors"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 block font-sans">Телефон</label>
                            <div className="relative">
                              <Phone size={14} strokeWidth={1.2} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                              <input
                                value={phone}
                                onChange={(e) => setPhone(formatPhone(e.target.value))}
                                placeholder="+380 __ ___ __ __"
                                className="w-full pl-10 pr-3 py-3 bg-transparent border border-border focus:border-foreground outline-none font-sans text-sm transition-colors"
                              />
                            </div>
                          </div>
                          <button
                            disabled={!canSubmit || submitting}
                            onClick={submit}
                            className="w-full py-4 bg-foreground text-background text-[11px] uppercase tracking-[0.3em] font-sans hover:opacity-90 disabled:opacity-40 transition-opacity"
                          >
                            {submitting ? "Відправляємо…" : "Підтвердити запис"}
                          </button>
                          <p className="text-[10px] text-muted-foreground text-center font-sans">Натискаючи кнопку, ви погоджуєтесь на обробку даних</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {step > 0 && (
                <button
                  onClick={() => go(step - 1)}
                  className="mt-10 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground font-sans transition-colors"
                >
                  <ChevronLeft size={14} strokeWidth={1.2} /> Назад
                </button>
              )}
            </>
          )}

          {done && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-lg mx-auto py-10"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
                className="w-20 h-20 rounded-full border border-foreground flex items-center justify-center mx-auto mb-8"
              >
                <Check size={32} strokeWidth={1} />
              </motion.div>
              <h2 className="font-serif text-3xl md:text-4xl font-light mb-4">Дякуємо!</h2>
              <p className="text-muted-foreground font-sans mb-2">Ваш запис прийнято. Ми зателефонуємо для підтвердження.</p>
              <p className="text-sm font-sans mb-8">
                <span className="text-muted-foreground">Деталі:</span> {service?.name} {variant?.label && `(${variant.label})`} — {date?.toLocaleDateString("uk-UA")} о {slot !== null && fmtTime(slot)}
              </p>
              <button
                onClick={() => {
                  setDone(false); setStep(0); setCategoryId(null); setService(null); setVariant(null);
                  setMasterId(null); setDate(undefined); setSlot(null); setName(""); setPhone("+380 ");
                }}
                className="px-8 py-3 border border-foreground text-[11px] uppercase tracking-[0.3em] font-sans hover:bg-foreground hover:text-background transition-all"
              >
                Новий запис
              </button>
            </motion.div>
          )}
        </div>
      </main>
    </>
  );
};

export default BookingPage;
