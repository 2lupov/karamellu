import { useShop } from "@/context/ShopContext";
import { Store, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const ShopSwitcher = () => {
  const { shops, activeShop, setActiveShopId } = useShop();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (shops.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-sans transition-colors w-full"
        style={{
          background: "hsl(var(--admin-surface-hover))",
          color: "hsl(var(--admin-text))",
        }}
      >
        <Store size={14} strokeWidth={1.5} />
        <span className="flex-1 text-left truncate">{activeShop?.name || "Магазин"}</span>
        <ChevronDown size={12} strokeWidth={1.5} />
      </button>
      {open && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-md shadow-lg z-50 overflow-hidden border"
          style={{
            background: "hsl(var(--admin-surface))",
            borderColor: "hsl(var(--admin-border))",
          }}
        >
          {shops.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveShopId(s.id);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-[13px] font-sans transition-colors"
              style={{
                background: s.id === activeShop?.id ? "hsl(var(--admin-surface-hover))" : "transparent",
                color: "hsl(var(--admin-text))",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--admin-surface-hover))")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = s.id === activeShop?.id ? "hsl(var(--admin-surface-hover))" : "transparent")
              }
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShopSwitcher;
