import { Link } from "react-router-dom";
import karamelLogo from "@/assets/karamel_logo.png";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Instagram } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

const Footer = () => {
  const { settings } = useSiteSettings();

  return (
    <footer className="border-t border-border">
      {/* Mobile: ultra-compact horizontal layout */}
      <div className="md:hidden bg-secondary">
        <div className="container-editorial py-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <img
              src={karamelLogo}
              alt={`${settings.site_name}`}
              className="max-h-10 w-auto object-contain opacity-60"
            />
            <div className="flex items-center gap-4">
              {settings.instagram_url && (
                <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Instagram size={16} strokeWidth={1.2} />
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[10px] font-sans text-muted-foreground tracking-wide">
            <Link to="/shop" className="hover:text-foreground transition-colors">Магазин</Link>
            <Link to="/loyalty" className="hover:text-foreground transition-colors">LU Клуб</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Контакти</Link>
            <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Конфіденційність</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Умови</Link>
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
            <p className="text-[9px] text-muted-foreground/60 font-sans">
              © {new Date().getFullYear()} {settings.site_name}
            </p>
            <p className="text-[9px] text-muted-foreground/60 font-sans">{settings.site_phone}</p>
          </div>
        </div>
      </div>

      {/* Desktop: full layout */}
      <div className="hidden md:block bg-secondary">
        <div className="container-editorial py-14">
          <div className="grid grid-cols-12 gap-8">
            <ScrollReveal className="col-span-4">
              <img
                src={karamelLogo}
                alt={`${settings.site_name} — Студія краси`}
                className="max-h-24 w-auto object-contain opacity-60 mb-5"
              />
              <p className="text-sm text-muted-foreground font-sans leading-[1.8] max-w-xs">
                Студія краси та магазин професійної косметики у Хмельницькому.
              </p>
              {settings.instagram_url && (
                <a
                  href={settings.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-5 text-[10px] tracking-[0.2em] uppercase font-sans text-muted-foreground hover:text-foreground transition-colors duration-500 font-medium"
                >
                  <Instagram size={14} strokeWidth={1.2} /> Instagram
                </a>
              )}
            </ScrollReveal>

            <ScrollReveal delay={0.1} className="col-span-2 col-start-6">
              <h4 className="text-[10px] tracking-[0.25em] uppercase font-sans mb-5 font-medium">Магазин</h4>
              <nav className="space-y-3">
                {[
                  { label: "Усі продукти", path: "/shop" },
                  { label: "Бестселери", path: "/shop?filter=bestsellers" },
                  { label: "LU Клуб", path: "/loyalty" },
                ].map((item) => (
                  <Link key={item.label} to={item.path} className="block text-sm text-muted-foreground hover:text-foreground transition-colors duration-500 font-sans">{item.label}</Link>
                ))}
              </nav>
            </ScrollReveal>

            <ScrollReveal delay={0.2} className="col-span-2">
              <h4 className="text-[10px] tracking-[0.25em] uppercase font-sans mb-5 font-medium">Інформація</h4>
              <nav className="space-y-3">
                {[
                  { label: "Контакти", path: "/contact" },
                  { label: "Конфіденційність", path: "/privacy-policy" },
                  { label: "Умови", path: "/terms" },
                ].map((item) => (
                  <Link key={item.label} to={item.path} className="block text-sm text-muted-foreground hover:text-foreground transition-colors duration-500 font-sans">{item.label}</Link>
                ))}
              </nav>
            </ScrollReveal>

            <ScrollReveal delay={0.3} className="col-span-2">
              <h4 className="text-[10px] tracking-[0.25em] uppercase font-sans mb-5 font-medium">Контакти</h4>
              <div className="space-y-3 text-sm text-muted-foreground font-sans">
                <p>{settings.site_phone}</p>
                <p className="leading-relaxed">{settings.site_address}</p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>

      {/* Bottom bar — desktop only */}
      <div className="hidden md:flex container-editorial py-4 justify-between items-center">
        <p className="text-[10px] text-muted-foreground font-sans tracking-wide">
          © {new Date().getFullYear()} {settings.site_name}. Усі права захищені.
        </p>
        <div className="flex gap-8">
          <Link to="/privacy-policy" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors duration-500 font-sans tracking-wide">Конфіденційність</Link>
          <Link to="/terms" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors duration-500 font-sans tracking-wide">Умови</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
