import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const COOKIE_KEY = "karamellu-cookies-accepted";

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(COOKIE_KEY);
    if (!accepted) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, "true");
    setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem(COOKIE_KEY, "true");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="fixed bottom-5 left-5 right-5 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-50 bg-background border border-border shadow-2xl p-6"
        >
          <button
            onClick={dismiss}
            className="absolute top-3.5 right-3.5 p-1 opacity-30 hover:opacity-100 transition-opacity duration-300"
            aria-label="Закрити"
          >
            <X size={13} strokeWidth={1.5} />
          </button>

          <p className="text-sm font-sans leading-relaxed mb-4">
            Ми використовуємо cookies для покращення вашого досвіду.{" "}
            <Link to="/privacy-policy" className="underline underline-offset-2 decoration-foreground/30 hover:decoration-foreground transition-colors duration-300">
              Дізнатися більше
            </Link>
          </p>
          <div className="flex gap-3">
            <button onClick={accept} className="btn-editorial-filled text-[10px] px-6 py-2.5">Прийняти</button>
            <button onClick={dismiss} className="btn-editorial text-[10px] px-6 py-2.5">Відхилити</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieBanner;
