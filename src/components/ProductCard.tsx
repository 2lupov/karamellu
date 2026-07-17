import { Link } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import type { ProductCompat as Product } from "@/hooks/useProducts";
import { useCart } from "@/context/CartContext";
import { ShoppingBag, Plus } from "lucide-react";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const [hovered, setHovered] = useState(false);
  const { addItem } = useCart();

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product);
  };

  return (
    <motion.div
      className="group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <Link to={`/product/${product.id}`} className="block">
        <div className="aspect-[3/4] overflow-hidden relative bg-secondary">
          {/* Image with crossfade */}
          <motion.img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover absolute inset-0"
            animate={{ opacity: hovered && product.imageHover ? 0 : 1, scale: hovered ? 1.06 : 1 }}
            transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            loading="lazy"
          />
          {product.imageHover && (
            <motion.img
              src={product.imageHover}
              alt=""
              className="w-full h-full object-cover absolute inset-0"
              animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1.06 : 1.1 }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
              loading="lazy"
            />
          )}

          {product.bestSeller && (
            <span className="absolute top-3 left-3 text-[9px] tracking-[0.2em] uppercase font-sans bg-background/90 backdrop-blur-sm px-2.5 py-1 font-medium">
              Бестселер
            </span>
          )}

          {/* Quick add — desktop */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 hidden md:flex"
            initial={false}
            animate={{ y: hovered ? 0 : "100%", opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <button
              onClick={handleAdd}
              className="w-full py-3 bg-foreground/90 backdrop-blur-sm text-background text-[10px] tracking-[0.2em] uppercase font-sans flex items-center justify-center gap-2 hover:bg-foreground transition-colors duration-300"
            >
              <Plus size={12} strokeWidth={1.5} />
              Додати до кошика
            </button>
          </motion.div>

          {/* Quick add — mobile */}
          <button
            onClick={handleAdd}
            className="absolute bottom-3 right-3 w-10 h-10 bg-foreground/90 backdrop-blur-sm text-background flex items-center justify-center rounded-full md:hidden active:scale-90 transition-transform"
            aria-label="Додати до кошика"
          >
            <ShoppingBag size={15} strokeWidth={1.5} />
          </button>
        </div>
      </Link>

      <div className="mt-4 flex flex-col gap-1.5">
        <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground font-sans font-medium">{product.brand}</p>
        <Link to={`/product/${product.id}`} className="block">
          <p className="text-sm font-sans leading-snug line-clamp-2 min-h-[2.5rem] group-hover:opacity-60 transition-all duration-500">{product.name}</p>
        </Link>
        <p className="text-sm font-sans font-medium tracking-wide mt-auto">₴{product.price}</p>
      </div>
    </motion.div>
  );
};

export default ProductCard;
