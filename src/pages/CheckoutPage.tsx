import { useState } from "react";
import { motion } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Truck, MapPin, Package, Banknote, CreditCard, Tag, X } from "lucide-react";
import NovaPoshtaPicker from "@/components/checkout/NovaPoshtaPicker";

type DeliveryMethod = "nova_poshta" | "pickup" | "khmelnytskyi";
type PaymentMethod = "cod" | "card";

interface AppliedPromo { id: string; code: string; discount_type: string; value: number; }

const inputClass =
  "w-full bg-transparent border border-border px-4 py-3 text-sm font-sans outline-none focus:border-foreground transition-colors";

const CheckoutPage = () => {
  const { items, subtotal, clearCart } = useCart();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  // Contact
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneDigits, setPhoneDigits] = useState(""); // 9 digits after +380

  // Delivery
  const [delivery, setDelivery] = useState<DeliveryMethod>("nova_poshta");
  const [npCity, setNpCity] = useState<{ ref: string; name: string } | null>(null);
  const [npWarehouseType, setNpWarehouseType] = useState<"branch" | "postomat">("branch");
  const [npWarehouse, setNpWarehouse] = useState<{ ref: string; description: string } | null>(null);
  const [khmAddress, setKhmAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Payment
  const [payment, setPayment] = useState<PaymentMethod>("cod");

  // Promo
  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

  const discount = appliedPromo
    ? appliedPromo.discount_type === "percent"
      ? Math.round(subtotal * appliedPromo.value) / 100
      : Math.min(appliedPromo.value, subtotal)
    : 0;
  const total = Math.max(0, subtotal - discount);

  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoLoading(true);
    const { data, error } = await supabase
      .from("promo_codes").select("*").eq("code", code).eq("is_active", true).single();
    setPromoLoading(false);
    if (error || !data) { toast.error("Промокод не знайдено або неактивний"); return; }
    if (data.expires_at && new Date(data.expires_at) < new Date()) { toast.error("Промокод прострочений"); return; }
    if (data.max_uses && data.current_uses >= data.max_uses) { toast.error("Промокод вичерпав ліміт"); return; }
    if (data.min_order && subtotal < data.min_order) { toast.error(`Мін. замовлення: ₴${data.min_order}`); return; }
    setAppliedPromo({ id: data.id, code: data.code, discount_type: data.discount_type, value: data.value });
    setPromoInput("");
    toast.success(`Промокод ${data.code} застосовано`);
  };

  if (items.length === 0) {
    return (
      <main className="pt-24 container-editorial section-padding text-center">
        <h1 className="font-serif text-3xl mb-4">Ваш кошик порожній</h1>
        <Link to="/shop" className="btn-editorial">Продовжити покупки</Link>
      </main>
    );
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
    setPhoneDigits(digits);
  };

  const formattedPhone = () => {
    // (XX) XXX XX XX
    const d = phoneDigits;
    let out = "";
    if (d.length > 0) out += d.slice(0, 2);
    if (d.length > 2) out = `${d.slice(0, 2)} ${d.slice(2, 5)}`;
    if (d.length > 5) out = `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)}`;
    if (d.length > 7) out = `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
    return out;
  };

  const validate = (): string | null => {
    if (!firstName.trim()) return "Введіть ім'я";
    if (!lastName.trim()) return "Введіть прізвище";
    if (phoneDigits.length !== 9) return "Телефон має містити 9 цифр після +380";
    if (delivery === "nova_poshta") {
      if (!npCity) return "Оберіть місто";
      if (!npWarehouse) return `Оберіть ${npWarehouseType === "postomat" ? "поштомат" : "відділення"}`;
    }
    if (delivery === "khmelnytskyi" && !khmAddress.trim()) return "Введіть адресу доставки";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }

    setLoading(true);
    try {
      if (appliedPromo) {
        try {
          const { data: current } = await supabase.from("promo_codes")
            .select("current_uses").eq("id", appliedPromo.id).single();
          if (current) {
            await supabase.from("promo_codes")
              .update({ current_uses: (current.current_uses || 0) + 1 })
              .eq("id", appliedPromo.id);
          }
        } catch { /* non-blocking */ }
      }

      const orderItems = items.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        brand: item.product.brand,
        image: item.product.image,
        price: item.product.price,
        quantity: item.quantity,
      }));

      const phone = `+380${phoneDigits}`;
      const city =
        delivery === "nova_poshta" ? npCity!.name :
        "Хмельницький";
      const address =
        delivery === "nova_poshta" ? npWarehouse!.description :
        delivery === "pickup" ? "Самовивіз" :
        khmAddress;

      const commonBody = {
        items: orderItems,
        firstName, lastName, phone,
        city, address,
        novaPoshtaWarehouse: delivery === "nova_poshta" ? npWarehouse!.description : undefined,
        npCityRef: delivery === "nova_poshta" ? npCity!.ref : undefined,
        npWarehouseType: delivery === "nova_poshta" ? npWarehouseType : undefined,
        deliveryMethod: delivery,
        notes,
        discount,
        promoCode: appliedPromo?.code || null,
      };

      if (payment === "card") {
        const { data, error } = await supabase.functions.invoke("create-monobank-invoice", { body: commonBody });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        clearCart();
        if (data?.pageUrl) { window.location.href = data.pageUrl; }
        else { navigate(`/order-success?order=${data.orderId}`); }
      } else {
        const { data, error } = await supabase.functions.invoke("create-cod-order", { body: commonBody });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        clearCart();
        navigate(`/order-success?order=${data.orderId}`);
      }
    } catch (e: any) {
      console.error("checkout error:", e);
      toast.error(e?.message || "Помилка оформлення. Спробуйте ще раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pt-20 md:pt-24">
      <div className="container-editorial section-padding">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="font-serif text-3xl md:text-4xl mb-8">Оформлення замовлення</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Form */}
            <div className="md:col-span-2 space-y-10">
              {/* Contact */}
              <section className="space-y-4">
                <h2 className="text-xs tracking-[0.2em] uppercase font-sans">Контактна інформація</h2>
                <div className="grid grid-cols-2 gap-4">
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ім'я" className={inputClass} required />
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Прізвище" className={inputClass} required />
                </div>
                {/* Phone with fixed +380 prefix */}
                <div className="flex">
                  <span className="border border-r-0 border-border px-4 py-3 text-sm font-sans text-muted-foreground select-none flex items-center">
                    +380
                  </span>
                  <input
                    value={formattedPhone()}
                    onChange={handlePhoneChange}
                    placeholder="XX XXX XX XX"
                    inputMode="tel"
                    autoComplete="tel-national"
                    className={`${inputClass} tracking-wider`}
                    required
                  />
                </div>
              </section>

              {/* Delivery */}
              <section className="space-y-4">
                <h2 className="text-xs tracking-[0.2em] uppercase font-sans">Спосіб доставки</h2>

                {/* Nova Poshta — top big button */}
                <button
                  type="button"
                  onClick={() => setDelivery("nova_poshta")}
                  className={`w-full border px-6 py-5 text-left transition-colors flex items-center gap-4 ${
                    delivery === "nova_poshta"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground"
                  }`}
                >
                  <Truck size={22} strokeWidth={1.5} />
                  <div>
                    <div className="font-serif text-lg">Нова Пошта</div>
                    <div className="text-xs opacity-70 font-sans mt-0.5">Відділення або поштомат по всій Україні</div>
                  </div>
                </button>

                {/* Pickup + Khmelnytskyi delivery */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDelivery("pickup")}
                    className={`border px-4 py-3 text-left transition-colors flex items-center gap-3 ${
                      delivery === "pickup"
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground"
                    }`}
                  >
                    <Package size={16} strokeWidth={1.5} />
                    <div>
                      <div className="text-sm font-sans">Самовивіз</div>
                      <div className="text-[10px] opacity-70 font-sans">Хмельницький</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDelivery("khmelnytskyi")}
                    className={`border px-4 py-3 text-left transition-colors flex items-center gap-3 ${
                      delivery === "khmelnytskyi"
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground"
                    }`}
                  >
                    <MapPin size={16} strokeWidth={1.5} />
                    <div>
                      <div className="text-sm font-sans">Доставка Хмельницький</div>
                      <div className="text-[10px] opacity-70 font-sans">Безкоштовно</div>
                    </div>
                  </button>
                </div>

                {/* Delivery details */}
                {delivery === "nova_poshta" && (
                  <div className="pt-2">
                    <NovaPoshtaPicker
                      city={npCity}
                      warehouseType={npWarehouseType}
                      warehouse={npWarehouse}
                      onCityChange={setNpCity}
                      onWarehouseTypeChange={setNpWarehouseType}
                      onWarehouseChange={setNpWarehouse}
                    />
                  </div>
                )}
                {delivery === "khmelnytskyi" && (
                  <input
                    value={khmAddress}
                    onChange={(e) => setKhmAddress(e.target.value)}
                    placeholder="Вулиця, будинок, квартира"
                    className={inputClass}
                    required
                  />
                )}
                {delivery === "pickup" && (
                  <p className="text-xs text-muted-foreground font-sans">
                    Адресу та час самовивозу узгодимо після оформлення в Telegram.
                  </p>
                )}

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Коментар до замовлення (необов'язково)"
                  className={`${inputClass} h-20 resize-none`}
                />
              </section>

              {/* Payment */}
              <section className="space-y-4">
                <h2 className="text-xs tracking-[0.2em] uppercase font-sans">Спосіб оплати</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPayment("cod")}
                    className={`border px-4 py-4 text-left transition-colors flex items-center gap-3 ${
                      payment === "cod"
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground"
                    }`}
                  >
                    <Banknote size={18} strokeWidth={1.5} />
                    <div>
                      <div className="text-sm font-sans">Готівкою</div>
                      <div className="text-[10px] opacity-70 font-sans">Наложений платіж при отриманні</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayment("card")}
                    className={`border px-4 py-4 text-left transition-colors flex items-center gap-3 ${
                      payment === "card"
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground"
                    }`}
                  >
                    <CreditCard size={18} strokeWidth={1.5} />
                    <div>
                      <div className="text-sm font-sans">Карткою онлайн</div>
                      <div className="text-[10px] opacity-70 font-sans">Monobank, Visa / MasterCard</div>
                    </div>
                  </button>
                </div>
              </section>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="btn-editorial-filled w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Обробка...</>
                ) : payment === "card" ? (
                  `Оплатити — ₴${total.toFixed(2)}`
                ) : (
                  `Підтвердити замовлення — ₴${total.toFixed(2)}`
                )}
              </button>
            </div>

            {/* Order summary */}
            <div className="border border-border p-6 h-fit md:sticky md:top-24">
              <h2 className="text-xs tracking-[0.2em] uppercase font-sans mb-6">Підсумок замовлення</h2>
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={item.product.id} className="flex gap-3">
                    <div className="w-14 h-16 border border-border overflow-hidden flex-shrink-0">
                      <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-sans">{item.product.brand}</p>
                      <p className="text-xs font-sans truncate">{item.product.name}</p>
                      <p className="text-xs font-sans text-muted-foreground">× {item.quantity}</p>
                    </div>
                    <p className="text-sm font-sans">₴{(item.product.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4 mb-4">
                {appliedPromo ? (
                  <div className="flex items-center justify-between bg-accent/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Tag size={14} />
                      <span className="text-sm font-sans font-medium">{appliedPromo.code}</span>
                      <span className="text-xs text-muted-foreground font-sans">
                        (−{appliedPromo.discount_type === "percent" ? `${appliedPromo.value}%` : `₴${appliedPromo.value}`})
                      </span>
                    </div>
                    <button onClick={() => setAppliedPromo(null)} className="p-1 hover:bg-accent rounded"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="Промокод"
                      className="flex-1 bg-transparent border border-border px-3 py-2 text-sm font-sans outline-none focus:border-foreground"
                      onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                    />
                    <button
                      onClick={handleApplyPromo}
                      disabled={promoLoading || !promoInput.trim()}
                      className="border border-foreground px-4 py-2 text-xs tracking-[0.1em] uppercase font-sans hover:bg-foreground hover:text-background transition-colors disabled:opacity-40"
                    >
                      {promoLoading ? "..." : "OK"}
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm font-sans">
                  <span className="text-muted-foreground">Товари</span>
                  <span>₴{subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm font-sans text-emerald-600 dark:text-emerald-400">
                    <span>Знижка</span>
                    <span>−₴{discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-sans">
                  <span className="text-muted-foreground">Доставка</span>
                  <span>Безкоштовно</span>
                </div>
                <div className="flex justify-between font-sans border-t border-border pt-2 mt-2">
                  <span className="text-sm">Разом</span>
                  <span className="font-serif text-lg">₴{total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
};

export default CheckoutPage;
