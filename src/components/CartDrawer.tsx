import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Link } from "react-router-dom";

const CartDrawer = () => {
  const { items, isOpen, closeCart, removeItem, updateQuantity, subtotal } = useCart();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="fixed inset-0 z-50 bg-foreground/20" onClick={closeCart} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }} className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-background border-l border-border flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="font-serif text-lg">Кошик</h2>
              <button onClick={closeCart} aria-label="Закрити кошик" className="p-1"><X size={18} strokeWidth={1} /></button>
            </div>
            {items.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-muted-foreground font-sans text-sm">Ваш кошик порожній</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex gap-4">
                      <div className="w-20 h-24 overflow-hidden flex-shrink-0">
                        <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-xs tracking-wider uppercase opacity-50 font-sans">{item.product.brand}</p>
                          <p className="text-sm font-sans mt-0.5">{item.product.name}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 border border-border">
                            <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="p-1.5" aria-label="Зменшити"><Minus size={12} strokeWidth={1} /></button>
                            <span className="text-xs font-sans w-4 text-center">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="p-1.5" aria-label="Збільшити"><Plus size={12} strokeWidth={1} /></button>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-sans">₴{item.product.price * item.quantity}</span>
                            <button onClick={() => removeItem(item.product.id)} className="opacity-40 hover:opacity-100 transition-opacity" aria-label="Видалити"><X size={14} strokeWidth={1} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border px-6 py-5 space-y-4">
                  <div className="flex justify-between text-sm font-sans">
                    <span>Підсумок</span>
                    <span>₴{subtotal}</span>
                  </div>
                  <Link to="/checkout" onClick={closeCart} className="btn-editorial-filled w-full text-center block">Оформити замовлення</Link>
                  <button onClick={closeCart} className="btn-editorial w-full">Продовжити покупки</button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
