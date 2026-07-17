import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Mail, Phone, Clock } from "lucide-react";
import { toast } from "sonner";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import SEOHead from "@/components/SEOHead";
import ScrollReveal from "@/components/ScrollReveal";

const ContactPage = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const { settings, loading } = useSiteSettings();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    toast.success("Повідомлення надіслано! Ми зв'яжемося з вами.");
    setForm({ name: "", email: "", message: "" });
  };

  const contactJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://karamellu.online/#business",
    name: settings.site_name,
    description: settings.about_text || "Студія краси та магазин професійної косметики у Хмельницькому.",
    url: "https://karamellu.online/contact",
    telephone: settings.site_phone.replace(/\s/g, ""),
    email: settings.site_email,
    address: { "@type": "PostalAddress", streetAddress: "вул. Проскурівська, 49", addressLocality: "Хмельницький", postalCode: "29000", addressCountry: "UA" },
    geo: { "@type": "GeoCoordinates", latitude: 49.4225, longitude: 26.9815 },
    openingHoursSpecification: { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], opens: "09:00", closes: "20:00" },
    sameAs: [settings.instagram_url, settings.telegram_url, settings.tiktok_url].filter(Boolean),
  };

  const contactItems = [
    { icon: MapPin, label: "Адреса", text: settings.site_address },
    { icon: Mail, label: "Пошта", text: settings.site_email },
    { icon: Phone, label: "Телефон", text: settings.site_phone },
    { icon: Clock, label: "Графік", text: settings.working_hours },
  ];

  return (
    <main className="pt-20 md:pt-24">
      <SEOHead title="Контакти — Карамель LU" description="Зв'яжіться з нами. Студія краси та магазин косметики Карамель LU у Хмельницькому." canonical="https://karamellu.online/contact" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }} />

      <div className="container-editorial section-padding">
        <ScrollReveal>
          <div className="line-accent mb-6 !mx-0" />
          <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground font-sans mb-3 font-medium">Зв'язатися з нами</p>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-14 font-light">Контакти</h1>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 lg:gap-24">
          <ScrollReveal delay={0.1}>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label-premium">Ім'я</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-premium" required />
              </div>
              <div>
                <label className="label-premium">Електронна пошта</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-premium" required />
              </div>
              <div>
                <label className="label-premium">Повідомлення</label>
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} className="input-premium resize-none" required />
              </div>
              <button type="submit" className="btn-editorial-filled w-full md:w-auto">Надіслати повідомлення</button>
            </form>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="space-y-10">
              <div className="space-y-6">
                {contactItems.map((item) => (
                  <div key={item.label} className="flex items-start gap-4 group">
                    <div className="w-10 h-10 border border-border flex items-center justify-center flex-shrink-0 transition-all duration-500 group-hover:border-foreground">
                      <item.icon size={16} strokeWidth={1} className="text-muted-foreground transition-colors duration-500 group-hover:text-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-sans mb-1 font-medium">{item.label}</p>
                      <span className="text-sm font-sans">{loading ? "..." : item.text}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="aspect-[4/3] border border-border overflow-hidden">
                <iframe
                  title="Розташування"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2543.5!2d26.9815!3d49.4225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47320657bf7a2591%3A0x23d539a05eb5cdab!2z0JrQsNGA0LDQvNC10LvRjCBMVQ!5e0!3m2!1suk!2sua!4v1700000000000"
                  width="100%" height="100%"
                  style={{ border: 0, filter: "grayscale(100%) contrast(1.1)" }}
                  allowFullScreen loading="lazy"
                />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </main>
  );
};

export default ContactPage;
