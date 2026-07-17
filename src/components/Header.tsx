import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search, ShoppingBag, Menu, X, Send, Sun, Moon } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import SearchOverlay from "./SearchOverlay";

const ORDERS_BOT_URL = "https://t.me/karamellu_bot";


const navLinks = [
  { label: "Магазин", path: "/shop" },
  { label: "Бестселери", path: "/shop?filter=bestsellers" },
  { label: "LU Клуб", path: "/loyalty" },
  { label: "Запис", path: "/booking" },
];

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { toggleCart, totalItems } = useCart();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const { scrollY } = useScroll();
  const headerBg = useTransform(scrollY, [0, 100], [0, 1]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    return scrollY.on("change", (v) => setScrolled(v > 50));
  }, [scrollY]);

  return (
    <>
      <motion.header
        className="fixed top-0 left-0 right-0 z-40 border-b transition-colors duration-500"
        style={{
          backgroundColor: scrolled ? "hsl(var(--background) / 0.95)" : "transparent",
          borderColor: scrolled ? "hsl(var(--border))" : "transparent",
        }}
      >
        <div className="container-editorial flex items-center justify-between h-16 md:h-20">
          {/* Left: burger (mobile) + nav (desktop) */}
          <div className="flex items-center gap-5 xl:gap-8">
            <button onClick={() => setMenuOpen(true)} className="lg:hidden p-2 -ml-2 opacity-50 hover:opacity-100 transition-all duration-300" aria-label="Відкрити меню">
              <Menu size={20} strokeWidth={1.2} />
            </button>

            <nav className="hidden lg:flex items-center gap-5 xl:gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-[10px] tracking-[0.15em] uppercase font-sans font-medium transition-all duration-500 relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:h-px after:transition-all after:duration-500 ${
                    location.pathname === link.path || (link.path.includes("?") && location.search.includes(link.path.split("?")[1]))
                      ? "opacity-100 after:w-full after:bg-foreground"
                      : "opacity-50 hover:opacity-100 after:w-0 hover:after:w-full after:bg-foreground/30"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <Link to="/" className="absolute left-1/2 -translate-x-1/2 font-serif text-xl md:text-2xl tracking-[0.1em]">
            <span className="font-light">Карамель</span> <span className="font-medium">LU</span>
          </Link>

          {/* Right: theme + telegram bot link */}
          <div className="flex items-center gap-1 md:gap-2">
            <button onClick={toggleTheme} aria-label="Змінити тему" className="p-2.5 opacity-50 hover:opacity-100 transition-all duration-300">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={theme}
                  initial={{ y: -10, opacity: 0, rotate: -90 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: 10, opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.25 }}
                >
                  {theme === "light" ? <Moon size={17} strokeWidth={1.2} /> : <Sun size={17} strokeWidth={1.2} />}
                </motion.div>
              </AnimatePresence>
            </button>

            <a
              href={ORDERS_BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Замовлення в Telegram"
              className="p-2.5 opacity-50 hover:opacity-100 transition-all duration-300"
            >
              <Send size={16} strokeWidth={1.2} />
            </a>
          </div>
        </div>
      </motion.header>



      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="overlay-menu"
          >
            <button onClick={() => setMenuOpen(false)} className="absolute top-5 right-6 p-2" aria-label="Закрити меню">
              <X size={24} strokeWidth={1} />
            </button>

            <div className="line-accent mb-10" />

            <nav className="flex flex-col items-center gap-6">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.path}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <Link
                    to={link.path}
                    onClick={() => setMenuOpen(false)}
                    className="font-serif text-4xl md:text-5xl tracking-wide font-light hover:opacity-50 transition-all duration-500"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}

              {/* Search & Cart in menu */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.5 }}
                className="flex items-center gap-6 mt-6"
              >
                <button
                  onClick={() => { setMenuOpen(false); setTimeout(() => setSearchOpen(true), 300); }}
                  className="flex flex-col items-center gap-2 opacity-50 hover:opacity-100 transition-all duration-300"
                >
                  <Search size={20} strokeWidth={1} />
                  <span className="text-[9px] tracking-[0.2em] uppercase font-sans font-medium">Пошук</span>
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setTimeout(() => toggleCart(), 300); }}
                  className="flex flex-col items-center gap-2 opacity-50 hover:opacity-100 transition-all duration-300 relative"
                >
                  <ShoppingBag size={20} strokeWidth={1} />
                  <span className="text-[9px] tracking-[0.2em] uppercase font-sans font-medium">
                    Кошик{totalItems > 0 ? ` (${totalItems})` : ""}
                  </span>
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.5 }}
                className="mt-4"
              >
                <a
                  href={ORDERS_BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="btn-editorial text-[10px] inline-flex items-center gap-2"
                >
                  <Send size={12} strokeWidth={1.2} />
                  Замовлення в Telegram
                </a>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};

export default Header;
