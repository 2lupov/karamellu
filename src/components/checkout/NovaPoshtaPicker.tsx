import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search } from "lucide-react";

interface City { ref: string; name: string; area: string; present: string; }
interface Warehouse { ref: string; number: string; description: string; shortAddress: string; }

interface NovaPoshtaPickerProps {
  city: { ref: string; name: string } | null;
  warehouseType: "branch" | "postomat";
  warehouse: { ref: string; description: string } | null;
  onCityChange: (c: { ref: string; name: string } | null) => void;
  onWarehouseTypeChange: (t: "branch" | "postomat") => void;
  onWarehouseChange: (w: { ref: string; description: string } | null) => void;
}

const inputClass =
  "w-full bg-transparent border border-border px-4 py-3 text-sm font-sans outline-none focus:border-foreground transition-colors";

export default function NovaPoshtaPicker({
  city, warehouseType, warehouse,
  onCityChange, onWarehouseTypeChange, onWarehouseChange,
}: NovaPoshtaPickerProps) {
  const [cityQuery, setCityQuery] = useState(city?.name || "");
  const [cities, setCities] = useState<City[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);

  const [whQuery, setWhQuery] = useState(warehouse?.description || "");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [whLoading, setWhLoading] = useState(false);
  const [whOpen, setWhOpen] = useState(false);

  const cityBox = useRef<HTMLDivElement>(null);
  const whBox = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (cityBox.current && !cityBox.current.contains(e.target as Node)) setCityOpen(false);
      if (whBox.current && !whBox.current.contains(e.target as Node)) setWhOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // City search debounce
  useEffect(() => {
    if (city && cityQuery === city.name) return;
    if (cityQuery.trim().length < 2) { setCities([]); return; }
    const t = setTimeout(async () => {
      setCityLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("nova-poshta-search", {
          body: { type: "cities", query: cityQuery.trim() },
        });
        if (!error) setCities(data?.data || []);
      } finally { setCityLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [cityQuery, city]);

  // Warehouse search debounce — fires when city selected or filter changes
  useEffect(() => {
    if (!city) { setWarehouses([]); return; }
    const t = setTimeout(async () => {
      setWhLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("nova-poshta-search", {
          body: {
            type: "warehouses",
            cityRef: city.ref,
            query: whQuery.trim() || undefined,
            warehouseType,
          },
        });
        if (!error) setWarehouses(data?.data || []);
      } finally { setWhLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [city, whQuery, warehouseType]);

  return (
    <div className="space-y-4">
      {/* City */}
      <div ref={cityBox} className="relative">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={cityQuery}
            onChange={(e) => {
              setCityQuery(e.target.value);
              setCityOpen(true);
              if (city && e.target.value !== city.name) {
                onCityChange(null);
                onWarehouseChange(null);
                setWhQuery("");
              }
            }}
            onFocus={() => setCityOpen(true)}
            placeholder="Місто доставки"
            className={`${inputClass} pl-9`}
            required
          />
          {cityLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin opacity-50" />}
        </div>
        {cityOpen && cities.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-background border border-border shadow-lg">
            {cities.map((c) => (
              <button
                key={c.ref}
                type="button"
                onClick={() => {
                  onCityChange({ ref: c.ref, name: c.present || c.name });
                  setCityQuery(c.present || c.name);
                  setCityOpen(false);
                  onWarehouseChange(null);
                  setWhQuery("");
                }}
                className="w-full text-left px-4 py-2.5 text-sm font-sans hover:bg-accent border-b border-border last:border-b-0"
              >
                <div>{c.present || c.name}</div>
                {c.area && <div className="text-[10px] text-muted-foreground">{c.area}</div>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Branch / Postomat toggle */}
      {city && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(["branch", "postomat"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { onWarehouseTypeChange(t); onWarehouseChange(null); setWhQuery(""); }}
                className={`border px-3 py-2.5 text-xs tracking-[0.1em] uppercase font-sans transition-colors ${
                  warehouseType === t
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground"
                }`}
              >
                {t === "branch" ? "Відділення" : "Поштомат"}
              </button>
            ))}
          </div>

          {/* Warehouse */}
          <div ref={whBox} className="relative">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={whQuery}
                onChange={(e) => { setWhQuery(e.target.value); setWhOpen(true); if (warehouse) onWarehouseChange(null); }}
                onFocus={() => setWhOpen(true)}
                placeholder={warehouseType === "postomat" ? "Поштомат (номер або адреса)" : "Відділення (номер або адреса)"}
                className={`${inputClass} pl-9`}
                required
              />
              {whLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin opacity-50" />}
            </div>
            {whOpen && warehouses.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-background border border-border shadow-lg">
                {warehouses.map((w) => (
                  <button
                    key={w.ref}
                    type="button"
                    onClick={() => {
                      onWarehouseChange({ ref: w.ref, description: w.description });
                      setWhQuery(w.description);
                      setWhOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-sans hover:bg-accent border-b border-border last:border-b-0"
                  >
                    <div>№{w.number} — {w.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
