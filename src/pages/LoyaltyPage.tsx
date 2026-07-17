import { motion } from "framer-motion";
import { Crown, Sparkles } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import SEOHead from "@/components/SEOHead";

const LoyaltyPage = () => {
  return (
    <main className="pt-20 md:pt-24">
      <SEOHead title="LU Клуб — Програма лояльності | Карамель LU" description="Ексклюзивний клуб лояльності Карамель LU — скоро відкриття." />

      <section className="section-padding relative overflow-hidden min-h-[60vh] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-background to-accent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none">
          <span className="font-serif text-[40vw] leading-none font-light">LU</span>
        </div>

        <div className="container-editorial relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="max-w-lg mx-auto text-center"
          >
            <div className="line-accent mb-6" />

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="w-20 h-20 mx-auto mb-8 border border-border flex items-center justify-center"
            >
              <Crown size={32} strokeWidth={0.8} className="text-muted-foreground" />
            </motion.div>

            <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground font-sans mb-5 font-medium flex items-center justify-center gap-2">
              <Sparkles size={12} strokeWidth={1.2} />
              В розробці
              <Sparkles size={12} strokeWidth={1.2} />
            </p>

            <h1 className="font-serif text-5xl md:text-6xl mb-5 font-light">LU Клуб</h1>

            <p className="text-muted-foreground font-sans text-sm leading-[1.8] mb-4">
              Ми створюємо ексклюзивний клуб лояльності для наших клієнтів.
            </p>
            <p className="text-muted-foreground/60 font-sans text-sm leading-[1.8]">
              Персоналізовані знижки, подарунки на день народження, ранній доступ до новинок та багато іншого — скоро.
            </p>

            <ScrollReveal delay={0.5}>
              <div className="mt-12 inline-flex items-center gap-2 px-6 py-3 border border-border text-[10px] tracking-[0.2em] uppercase font-sans text-muted-foreground font-medium">
                Скоро відкриття
              </div>
            </ScrollReveal>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default LoyaltyPage;
