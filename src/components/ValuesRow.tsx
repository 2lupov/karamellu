import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Shield, Leaf } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

const values = [
  { icon: Sparkles, title: "Преміальна якість", desc: "Ретельно підібрані формули від найкращих світових брендів, перевірені часом та результатом." },
  { icon: Leaf, title: "Натуральність", desc: "Безпечні інгредієнти, відсутність шкідливих компонентів. Краса у гармонії з природою." },
  { icon: Shield, title: "Довіра", desc: "100% оригінальна продукція з гарантією автентичності та індивідуальний підхід до кожного клієнта." },
];

const ValuesRow = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const toggle = (i: number) => setActiveIndex(activeIndex === i ? null : i);

  return (
    <div className="flex flex-col gap-0">
      {/* Horizontal row of value items */}
      <div className="flex items-stretch border border-border divide-x divide-border">
        {values.map((item, i) => {
          const isActive = activeIndex === i;
          return (
            <ScrollReveal key={item.title} delay={i * 0.1} className="flex-1">
              <button
                onClick={() => toggle(i)}
                className={`w-full py-6 md:py-8 px-4 md:px-6 flex flex-col items-center gap-3 transition-all duration-500 ${
                  isActive
                    ? "bg-secondary"
                    : "hover:bg-secondary/50"
                }`}
              >
                <item.icon
                  size={22}
                  strokeWidth={0.8}
                  className={`transition-colors duration-500 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                />
                <span className={`font-serif text-sm md:text-lg font-light text-center transition-colors duration-500 ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                  {item.title}
                </span>
                <motion.div
                  className="w-4 h-px bg-foreground/30"
                  animate={{ rotate: isActive ? 0 : 90, opacity: isActive ? 1 : 0.4 }}
                  transition={{ duration: 0.3 }}
                />
              </button>
            </ScrollReveal>
          );
        })}
      </div>

      {/* Expandable description */}
      <AnimatePresence mode="wait">
        {activeIndex !== null && (
          <motion.div
            key={activeIndex}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden border border-t-0 border-border"
          >
            <div className="py-6 md:py-8 px-6 md:px-12 text-center">
              <p className="text-sm md:text-base text-muted-foreground font-sans leading-relaxed max-w-md mx-auto">
                {values[activeIndex].desc}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ValuesRow;
