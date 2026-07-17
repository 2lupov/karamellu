import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import SEOHead from "@/components/SEOHead";
import { ArrowRight } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import ValuesRow from "@/components/ValuesRow";
import categoryFace from "@/assets/category-face.jpg";
import categoryBody from "@/assets/category-body.jpg";
import categoryHair from "@/assets/category-hair.jpg";
import categorySun from "@/assets/category-sun.jpg";

const HomePage = () => {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <main>
      <SEOHead
        title="Карамель LU — Магазин розкішної косметики"
        description="Відкрийте найкращий розкішний догляд за шкірою, підібраний з любов'ю. Саме для Вас у Карамель LU."
        canonical="https://karamellu.online/"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "@id": "https://karamellu.online/#business",
            name: "Карамель LU",
            description: "Студія краси та магазин професійної косметики у Хмельницькому.",
            url: "https://karamellu.online",
            telephone: "+380936283837",
            email: "karamellu.studio@gmail.com",
            image: "https://storage.googleapis.com/gpt-engineer-file-uploads/Pfgtd12cNIbb4AKhQZ7UZMjGFGL2/social-images/social-1775389654147-karamellu_fullnew_logo.webp",
            address: { "@type": "PostalAddress", streetAddress: "вул. Проскурівська, 49", addressLocality: "Хмельницький", postalCode: "29000", addressCountry: "UA" },
            geo: { "@type": "GeoCoordinates", latitude: 49.4225, longitude: 26.9815 },
            openingHoursSpecification: { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], opens: "09:00", closes: "20:00" },
            sameAs: ["https://www.instagram.com/karamellu_studio__/"],
            priceRange: "₴₴",
          }),
        }}
      />

      {/* === HERO === */}
      <section ref={heroRef} className="relative h-[100svh] flex items-center justify-center overflow-hidden">
        {/* Ambient gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-background to-accent" />

        {/* Floating decorative circles */}
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, hsl(var(--foreground)), transparent 70%)", top: "10%", right: "-10%" }}
          animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, hsl(var(--foreground)), transparent 70%)", bottom: "15%", left: "-5%" }}
          animate={{ y: [0, 15, 0], x: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 10, ease: "easeInOut", delay: 2 }}
        />

        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.03 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="font-serif text-[35vw] md:text-[30vw] leading-none tracking-tight font-light"
          >
            LU
          </motion.span>
        </div>

        <motion.div style={{ opacity: heroOpacity, scale: heroScale, y: heroY }} className="text-center z-10 px-6 max-w-3xl mx-auto">

          <motion.h1
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif text-[clamp(2.5rem,8vw,6rem)] leading-[1.05] mb-6 tracking-tight"
          >
            Розкішна краса,
            <br />
            <em className="font-light italic">з любов'ю</em>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="text-muted-foreground font-sans text-sm md:text-base tracking-wide max-w-lg mx-auto mb-12 leading-relaxed"
          >
            Відкрийте найкращий догляд за шкірою, підібраний для тих,
            хто цінує мистецтво турботи про себе.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link to="/shop" className="btn-editorial-filled group">
              Відкрити магазин
              <ArrowRight size={14} className="ml-2 transition-transform duration-500 group-hover:translate-x-1.5" />
            </Link>
            <Link to="/loyalty" className="btn-editorial">
              LU Клуб
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 2, duration: 0.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
        >
          <span className="text-[9px] tracking-[0.3em] uppercase font-sans">Scroll</span>
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="w-px h-10 bg-foreground/30"
          />
        </motion.div>
      </section>




      {/* === PHILOSOPHY === */}
      <section className="section-padding relative overflow-hidden">
        {/* Background texture */}
        <div className="absolute inset-0 bg-gradient-to-b from-secondary via-secondary to-background" />
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none">
          <span className="font-serif text-[45vw] leading-none font-light">LU</span>
        </div>

        <div className="container-editorial relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <ScrollReveal>
              <div className="line-accent mb-6" />
              <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground font-sans mb-5 font-medium">Наша філософія</p>
              <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-8 leading-[1.1] font-light">
                Краса — це не про досконалість.
                <br />
                <em className="italic">Це про намір.</em>
              </h2>
              <p className="text-muted-foreground font-sans text-sm md:text-base leading-[1.8] mb-10 max-w-lg mx-auto">
                У Карамель LU ми віримо, що кожен ритуал догляду за собою має бути розкішним.
                Наша підібрана колекція об'єднує найкращі формули світу — чисті, ефективні та створені з турботою.
              </p>
              <Link to="/shop" className="btn-editorial group">
                Відкрити наш світ
                <ArrowRight size={13} className="ml-2 transition-transform duration-500 group-hover:translate-x-1.5" />
              </Link>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* === VALUES === */}
      <section className="section-padding">
        <div className="container-editorial">
          <ScrollReveal className="text-center mb-16">
            <div className="line-accent mb-6" />
            <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground font-sans mb-3 font-medium">Чому ми</p>
            <h2 className="font-serif text-4xl md:text-5xl font-light">Наші цінності</h2>
          </ScrollReveal>

          <ValuesRow />
        </div>
      </section>

      {/* === CATEGORIES === */}
      <section className="section-padding bg-secondary">
        <div className="container-editorial">
          <ScrollReveal className="text-center mb-14">
            <div className="line-accent mb-6" />
            <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground font-sans mb-3 font-medium">Категорії</p>
            <h2 className="font-serif text-4xl md:text-5xl font-light">Обирайте за потребою</h2>
          </ScrollReveal>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              { title: "Догляд за обличчям", subtitle: "Сироватки, зволожувачі, тонери", img: categoryFace },
              { title: "Догляд за тілом", subtitle: "Олії, скраби, масла", img: categoryBody },
              { title: "Догляд за волоссям", subtitle: "Шампуні, маски, олії", img: categoryHair },
              { title: "Захист від сонця", subtitle: "SPF та після засмаги", img: categorySun },
            ].map((cat, i) => (
              <ScrollReveal key={cat.title} delay={i * 0.1}>
                <Link to="/shop" className="group block relative overflow-hidden">
                  <div className="aspect-[3/4] overflow-hidden">
                    <img
                      src={cat.img}
                      alt={cat.title}
                      className="w-full h-full object-cover transition-transform duration-[800ms] ease-out group-hover:scale-110"
                      loading="lazy"
                    />
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5 transition-opacity duration-500" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
                    <h3 className="font-serif text-lg md:text-2xl text-white mb-1 font-light">{cat.title}</h3>
                    <p className="text-[10px] md:text-xs text-white/70 font-sans tracking-wider">{cat.subtitle}</p>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* === CTA === */}
      <section className="section-padding relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1412] via-[#2a1f1a] to-[#0f0d0b]" />
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.3), transparent 70%)", top: "-20%", right: "-10%" }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 60, ease: "linear" }}
        />

        <div className="container-editorial text-center relative z-10">
          <ScrollReveal>
            <div className="w-12 h-px mx-auto mb-8 bg-white/20" />
            <p className="text-[10px] tracking-[0.3em] uppercase opacity-40 font-sans mb-5 text-white font-medium">Залишайтесь з нами</p>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-5 text-white font-light leading-tight">
              Ваша краса —<br />наша місія
            </h2>
            <p className="text-sm md:text-base font-sans opacity-40 max-w-md mx-auto mb-10 text-white leading-relaxed">
              Приєднуйтесь до LU Клубу та отримуйте ексклюзивні пропозиції, знижки та персоналізовані рекомендації.
            </p>
            <Link to="/loyalty" className="btn-editorial-filled group !bg-gradient-to-r !from-[#c4a882] !to-[#d4b896] !text-[#1a1412] !border-[#c4a882] hover:!shadow-lg hover:!shadow-[#c4a882]/30 hover:!scale-[1.02] transition-all duration-500">
              Приєднатися до LU Клубу
              <ArrowRight size={13} className="ml-2 transition-transform duration-500 group-hover:translate-x-1.5" />
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
};

export default HomePage;
