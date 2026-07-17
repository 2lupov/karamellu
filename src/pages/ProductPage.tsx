import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Star, Minus, Plus, X, Send } from "lucide-react";
import { useProduct } from "@/hooks/useProducts";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/SEOHead";
import ProductPromoGenerator from "@/components/ProductPromoGenerator";
import ProductConsultant from "@/components/ProductConsultant";

const tabs = ["Опис", "Інгредієнти", "Використання", "Відгуки"];

const ProductPage = () => {
  const { id } = useParams();
  const { product, loading } = useProduct(id);
  const { addItem } = useCart();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("Опис");
  const [qty, setQty] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lightbox, setLightbox] = useState<{ type: "image" | "video"; src: string } | null>(null);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  if (loading) {
    return (
      <main className="pt-24 container-editorial section-padding">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20">
          <div className="animate-pulse">
            <div className="aspect-[3/4] bg-secondary" />
          </div>
          <div className="animate-pulse space-y-4 pt-4">
            <div className="h-3 bg-secondary w-1/4" />
            <div className="h-8 bg-secondary w-3/4" />
            <div className="h-5 bg-secondary w-1/4" />
            <div className="h-12 bg-secondary w-1/2 mt-8" />
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="pt-24 container-editorial section-padding text-center">
        <p className="font-sans text-muted-foreground">Продукт не знайдено.</p>
        <Link to="/shop" className="btn-editorial mt-6 inline-block">Повернутися до магазину</Link>
      </main>
    );
  }

  const hasPromoPhoto = !!product.promoPhoto;

  const tabContent: Record<string, string> = {
    "Опис": product.description,
    "Інгредієнти": product.ingredients,
    "Використання": product.usage,
    "Відгуки": `${product.rating} з 5 зірок на основі ${product.reviewCount} відгуків.`,
  };

  const handleAddToCart = () => {
    for (let i = 0; i < qty; i++) addItem(product);
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.image,
    description: product.description,
    brand: { "@type": "Brand", name: product.brand },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "UAH",
      availability: "https://schema.org/InStock",
      url: `https://karamellu.online/product/${product.id}`,
    },
    aggregateRating: product.reviewCount > 0
      ? { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviewCount }
      : undefined,
  };

  return (
    <main className="pt-20 md:pt-24">
      <SEOHead
        title={`${product.name} — ${product.brand} | Карамель LU`}
        description={product.description?.slice(0, 155) || `Купити ${product.name} від ${product.brand} в Карамель LU`}
        canonical={`https://karamellu.online/product/${product.id}`}
        type="product"
        image={product.image}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="container-editorial pt-4 md:pt-6 pb-16 md:pb-24">
        <Link to="/shop" className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase font-sans font-medium opacity-40 hover:opacity-100 transition-all duration-500 mb-5 md:mb-6">
          <ChevronLeft size={13} strokeWidth={1.2} /> Назад до магазину
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
            {/* Product photos: main + promo side by side */}
            <div className={`grid gap-3 mb-3 ${hasPromoPhoto ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {/* Main product photo (white background) */}
              <div
                className="aspect-[3/4] overflow-hidden bg-secondary cursor-pointer"
                onClick={() => setLightbox({ type: "image", src: product.image || "/placeholder.svg" })}
              >
                <img
                  src={product.image || "/placeholder.svg"}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>

              {/* Promo photo */}
              {hasPromoPhoto && (
                <div
                  className="aspect-[3/4] overflow-hidden bg-secondary cursor-pointer"
                  onClick={() => setLightbox({ type: "image", src: product.promoPhoto! })}
                >
                  <img
                    src={product.promoPhoto!}
                    alt={`${product.name} — рекламне фото`}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>
              )}
            </div>


          </motion.div>

          <motion.div initial={{ opacity: 0, x: 25 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
            <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground font-sans mb-2 font-medium">{product.brand}</p>
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl mb-4 font-light leading-tight">{product.name}</h1>

            <div className="flex items-center gap-2.5 mb-8">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={13} fill={i < Math.round(product.rating) ? "hsl(var(--foreground))" : "none"} stroke={i < Math.round(product.rating) ? "hsl(var(--foreground))" : "hsl(var(--border))"} strokeWidth={1} />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground font-sans tracking-wide">({product.reviewCount})</span>
            </div>

            <p className="font-serif text-2xl md:text-3xl mb-10 font-light">₴{product.price}</p>

            {/* Quantity */}
            <div className="flex items-center gap-5 mb-8">
              <span className="text-[10px] tracking-[0.2em] uppercase font-sans text-muted-foreground font-medium">Кількість</span>
              <div className="flex items-center border border-border">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3 hover:bg-secondary transition-colors duration-300" aria-label="Зменшити">
                  <Minus size={13} strokeWidth={1.2} />
                </button>
                <span className="px-5 text-sm font-sans min-w-[2.5rem] text-center font-medium">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="p-3 hover:bg-secondary transition-colors duration-300" aria-label="Збільшити">
                  <Plus size={13} strokeWidth={1.2} />
                </button>
              </div>
            </div>

            <button onClick={handleAddToCart} className="btn-editorial-filled w-full md:w-auto mb-6">
              Додати до кошика — ₴{product.price * qty}
            </button>

            {/* Mobile sticky bar */}
            <div className="fixed bottom-0 left-0 right-0 z-30 glass border-t border-border p-4 md:hidden safe-area-bottom">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-sans truncate font-medium">{product.name}</p>
                  <p className="font-serif text-lg">₴{product.price * qty}</p>
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <div className="flex items-center border border-border">
                    <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-2" aria-label="Зменшити">
                      <Minus size={11} strokeWidth={1.2} />
                    </button>
                    <span className="px-2.5 text-xs font-sans font-medium">{qty}</span>
                    <button onClick={() => setQty(qty + 1)} className="p-2" aria-label="Збільшити">
                      <Plus size={11} strokeWidth={1.2} />
                    </button>
                  </div>
                  <button onClick={handleAddToCart} className="btn-editorial-filled text-[10px] whitespace-nowrap px-5 py-2.5">Додати</button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-12 border-t border-border pt-10">
              <div className="flex gap-5 md:gap-8 mb-8 overflow-x-auto scrollbar-none">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-[10px] tracking-[0.2em] uppercase font-sans font-medium pb-1.5 transition-all duration-500 whitespace-nowrap relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:h-px after:transition-all after:duration-500 ${
                      activeTab === tab
                        ? "opacity-100 after:w-full after:bg-foreground"
                        : "opacity-35 hover:opacity-70 after:w-0"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground font-sans leading-[1.8]">{tabContent[activeTab]}</p>
            </div>

            {/* AI Promo Generator (admin only) */}
            <ProductPromoGenerator
              product={{
                id: product.id,
                name: product.name,
                brand: product.brand,
                description: product.description,
                image: product.image,
              }}
              isAdmin={isAdmin}
            />

            {/* Admin: open in Telegram bot to edit */}
            {isAdmin && (
              <a
                href={`https://t.me/karamellu_bot?start=admin_prod_${product.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 px-5 py-3 border border-border text-[10px] tracking-[0.2em] uppercase font-sans font-medium hover:bg-secondary transition-colors duration-300"
              >
                <Send size={13} strokeWidth={1.4} />
                Відкрити в боті (редагування)
              </a>
            )}
          </motion.div>
        </div>
      </div>

      {/* AI Consultant for customers */}
      <ProductConsultant
        product={{
          name: product.name,
          brand: product.brand,
          description: product.description,
          ingredients: product.ingredients,
          usage: product.usage,
          price: product.price,
          skinType: product.skinType || "Для всіх типів шкіри",
        }}
      />

      {/* Lightbox overlay */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10"
            onClick={() => setLightbox(null)}
          >
            {/* Blurred dark backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
              className="absolute top-5 right-5 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Закрити"
            >
              <X size={22} strokeWidth={1.5} className="text-white" />
            </button>

            {/* Content */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative max-w-5xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {lightbox.type === "video" ? (
                <video
                  src={lightbox.src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                  className="w-full max-h-[90vh] object-contain rounded-sm"
                />
              ) : (
                <img
                  src={lightbox.src}
                  alt={product?.name || ""}
                  className="w-full max-h-[90vh] object-contain rounded-sm"
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};

export default ProductPage;
