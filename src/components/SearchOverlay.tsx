import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search as SearchIcon, ArrowRight } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { Link } from "react-router-dom";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchOverlay = ({ isOpen, onClose }: SearchOverlayProps) => {
  const [query, setQuery] = useState("");
  const { products } = useProducts();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [query, products]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 bg-background/[0.97] backdrop-blur-md flex flex-col overflow-y-auto"
        >
          {/* Decorative watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.015] pointer-events-none select-none">
            <span className="font-serif text-[40vw] leading-none font-light">LU</span>
          </div>

          <div className="container-editorial relative z-10 pt-24 md:pt-32 pb-12">
            {/* Close button */}
            <motion.button
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              onClick={onClose}
              className="absolute top-6 right-6 md:top-8 md:right-8 w-12 h-12 flex items-center justify-center border border-border hover:border-foreground/30 transition-all duration-300"
              aria-label="Закрити пошук"
            >
              <X size={18} strokeWidth={1} />
            </motion.button>

            {/* Search header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground font-sans mb-4 font-medium">Пошук</p>
              <div className="flex items-center gap-4 border-b-2 border-foreground pb-4 mb-2">
                <SearchIcon size={22} strokeWidth={1} className="text-foreground flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Що ви шукаєте?"
                  className="flex-1 bg-transparent outline-none font-serif text-2xl md:text-4xl placeholder:text-muted-foreground/30 min-w-0"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground transition-colors p-2">
                    <X size={16} />
                  </button>
                )}
              </div>
              {query.length >= 2 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[10px] text-muted-foreground font-sans tracking-wide mt-3"
                >
                  {results.length > 0
                    ? `Знайдено ${results.length} ${results.length === 1 ? "товар" : results.length < 5 ? "товари" : "товарів"}`
                    : "Нічого не знайдено"}
                </motion.p>
              )}
            </motion.div>

            {/* Results grid */}
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-8"
              >
                {results.slice(0, 8).map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.4 }}
                  >
                    <Link to={`/product/${product.id}`} onClick={onClose} className="group block">
                      <div className="aspect-[3/4] overflow-hidden mb-4 bg-secondary">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      </div>
                      <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-1.5 font-sans font-medium">{product.brand}</p>
                      <p className="text-sm font-sans leading-snug line-clamp-2 group-hover:opacity-60 transition-opacity duration-300">{product.name}</p>
                      <p className="text-sm font-sans font-medium mt-1.5 tracking-wide">₴{product.price}</p>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Show all link */}
            {results.length > 8 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-10 text-center"
              >
                <Link
                  to="/shop"
                  onClick={onClose}
                  className="inline-flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase font-sans font-medium border-b border-foreground/30 hover:border-foreground pb-1 transition-all duration-300"
                >
                  Переглянути всі результати
                  <ArrowRight size={12} />
                </Link>
              </motion.div>
            )}

            {/* Empty state */}
            {query.length >= 2 && results.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mt-20 text-center"
              >
                <p className="font-serif text-2xl mb-3 font-light">Нічого не знайдено</p>
                <p className="text-sm text-muted-foreground font-sans">
                  Спробуйте інший запит або{" "}
                  <Link to="/shop" onClick={onClose} className="underline underline-offset-4 hover:text-foreground transition-colors">
                    перегляньте весь каталог
                  </Link>
                </p>
              </motion.div>
            )}

            {/* Initial state suggestions */}
            {query.length < 2 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="mt-16 md:mt-20"
              >
                <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-sans mb-6 font-medium">Популярні запити</p>
                <div className="flex flex-wrap gap-3">
                  {["Сироватка", "SPF", "Крем", "Олія", "Маска"].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setQuery(suggestion)}
                      className="px-5 py-2.5 border border-border text-sm font-sans hover:border-foreground/30 hover:bg-secondary/50 transition-all duration-300"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchOverlay;
