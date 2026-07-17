import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Package, ArrowRight } from "lucide-react";

const OrderSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order");

  return (
    <main className="pt-20 md:pt-24">
      <div className="container-editorial section-padding">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-lg mx-auto text-center py-16"
        >
          <div className="w-16 h-16 mx-auto mb-6 border border-border rounded-full flex items-center justify-center">
            <CheckCircle2 size={32} strokeWidth={1} className="text-foreground" />
          </div>

          <h1 className="font-serif text-3xl md:text-4xl mb-4">Дякуємо за замовлення!</h1>
          <p className="text-sm text-muted-foreground font-sans mb-8 leading-relaxed">
            Ваше замовлення успішно оформлено. Ми надішлемо підтвердження на вашу електронну пошту.
          </p>

          {orderId && (
            <div className="border border-border p-4 mb-8">
              <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-sans mb-1">Номер замовлення</p>
              <p className="font-serif text-lg">{orderId.slice(0, 8).toUpperCase()}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/shop" className="btn-editorial-filled flex items-center justify-center gap-2">
              <Package size={14} />
              Продовжити покупки
            </Link>
            {orderId && (
              <Link to="/profile" className="btn-editorial flex items-center justify-center gap-2">
                Мої замовлення <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </motion.div>
      </div>
    </main>
  );
};

export default OrderSuccessPage;
