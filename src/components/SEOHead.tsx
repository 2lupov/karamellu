import { useEffect } from "react";

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  type?: string;
  image?: string;
}

const SEOHead = ({
  title = "Карамель LU — Студія краси та магазин косметики у Хмельницькому",
  description = "Карамель LU — студія краси та магазин професійної косметики у Хмельницькому. Доглядова й декоративна косметика, перукарські послуги, нігтьовий сервіс, візаж.",
  canonical,
  type = "website",
  image,
}: SEOHeadProps) => {
  useEffect(() => {
    document.title = title;

    const setMeta = (name: string, content: string, attr = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("description", description);
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    setMeta("og:type", type, "property");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);

    if (image) {
      setMeta("og:image", image, "property");
      setMeta("twitter:image", image);
    }

    // Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) {
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", canonical);
    } else if (link) {
      link.remove();
    }
  }, [title, description, canonical, type, image]);

  return null;
};

export default SEOHead;
