import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X, Search, ArrowUpDown, Sparkles, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import ProductCard from "@/components/ProductCard";
import SEOHead from "@/components/SEOHead";
import ScrollReveal from "@/components/ScrollReveal";

const skinTypes = ["Усі", "Для всіх типів шкіри", "Суха", "Жирна", "Чутлива", "Зріла"];

const priceRanges = [
  { label: "Усі", min: 0, max: Infinity },
  { label: "До ₴500", min: 0, max: 500 },
  { label: "₴500 – ₴1000", min: 500, max: 1000 },
  { label: "₴1000 – ₴2000", min: 1000, max: 2000 },
  { label: "Від ₴2000", min: 2000, max: Infinity },
];

const sortOptions = [
  { label: "За замовчуванням", value: "default" },
  { label: "Ціна: від дешевих", value: "price_asc" },
  { label: "Ціна: від дорогих", value: "price_desc" },
  { label: "За назвою: А-Я", value: "name_asc" },
  { label: "За рейтингом", value: "rating_desc" },
];

const ShopPage = () => {
  const { products, categories: dbCategories, loading } = useProducts();
  const [searchParams] = useSearchParams();
  const isBestsellers = searchParams.get("filter") === "bestsellers";

  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("Усі");
  const [brand, setBrand] = useState("Усі");
  const [skinType, setSkinType] = useState("Усі");
  const [priceRange, setPriceRange] = useState("Усі");
  const [sortBy, setSortBy] = useState("default");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const categories = useMemo(() => {
    return ["Усі", ...dbCategories.map((c) => c.name)];
  }, [dbCategories]);

  const brands = useMemo(() => {
    const b = new Set(products.map((p) => p.brand).filter(Boolean));
    return ["Усі", ...Array.from(b)];
  }, [products]);

  const filtered = useMemo(() => {
    let result = isBestsellers ? products.filter((p) => p.bestSeller) : products;
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    if (category !== "Усі") result = result.filter((p) => p.category === category);
    if (brand !== "Усі") result = result.filter((p) => p.brand === brand);
    if (skinType !== "Усі") result = result.filter((p) => p.skinType === skinType);
    if (priceRange !== "Усі") {
      const range = priceRanges.find((r) => r.label === priceRange);
      if (range) result = result.filter((p) => p.price >= range.min && p.price < range.max);
    }
    switch (sortBy) {
      case "price_asc": result = [...result].sort((a, b) => a.price - b.price); break;
      case "price_desc": result = [...result].sort((a, b) => b.price - a.price); break;
      case "name_asc": result = [...result].sort((a, b) => a.name.localeCompare(b.name, "uk")); break;
      case "rating_desc": result = [...result].sort((a, b) => b.rating - a.rating); break;
    }
    return result;
  }, [products, category, brand, skinType, priceRange, isBestsellers, searchQuery, sortBy]);

  const hasFilters = category !== "Усі" || brand !== "Усі" || skinType !== "Усі" || priceRange !== "Усі" || searchQuery.length >= 2;

  const clearFilters = () => {
    setSearchQuery("");
    setCategory("Усі");
    setBrand("Усі");
    setSkinType("Усі");
    setPriceRange("Усі");
  };

  const activeFilterCount = [category, brand, skinType, priceRange].filter((v) => v !== "Усі").length;

  // Pagination — 10 items per page
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Reset to page 1 when filters/search/sort change
  useEffect(() => {
    setPage(1);
  }, [category, brand, skinType, priceRange, searchQuery, sortBy, isBestsellers]);

  // Clamp page if total shrinks
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const goToPage = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages);
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const FilterChip = ({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) => (
    <div className="relative">
      <label className="text-[9px] tracking-[0.2em] uppercase font-sans text-muted-foreground font-medium mb-2 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-secondary/80 border border-border hover:border-foreground/20 text-sm font-sans px-4 py-2.5 outline-none transition-all duration-300 focus:border-foreground/40 focus:shadow-sm appearance-none cursor-pointer"
      >
        {options.map((o) => (<option key={o} value={o}>{o}</option>))}
      </select>
    </div>
  );

  return (
    <main className="pt-20 md:pt-24">
      <SEOHead
        title={isBestsellers ? "Бестселери — Карамель LU" : "Магазин — Карамель LU"}
        description="Каталог розкішної косметики та засобів догляду за шкірою. Найкращі бренди зі всього світу в Карамель LU."
        canonical={`https://karamellu.online/shop${isBestsellers ? "?filter=bestsellers" : ""}`}
      />

      {/* Hero header with ambient bg */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-secondary via-secondary/50 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.015] pointer-events-none select-none">
          <span className="font-serif text-[30vw] leading-none font-light">LU</span>
        </div>

        <div className="container-editorial relative z-10 pt-4 pb-6 md:pt-6 md:pb-8">
          <ScrollReveal>
            <div className="max-w-2xl">
              <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-light mb-4">
                {isBestsellers ? "Бестселери" : "Магазин"}
              </h1>
              <p className="text-sm text-muted-foreground font-sans leading-relaxed max-w-md">
                Відкрийте колекцію професійної косметики, підібраної з любов'ю та увагою до деталей.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <div className="container-editorial pb-20 md:pb-28">
        {/* Search bar — elevated design */}
        <ScrollReveal delay={0.1}>
          <div className={`relative mb-8 transition-all duration-500 ${searchFocused ? "scale-[1.01]" : ""}`}>
            <div className={`flex items-center gap-4 bg-secondary/60 border px-5 py-4 transition-all duration-500 ${searchFocused ? "border-foreground/20 shadow-lg shadow-foreground/[0.03]" : "border-border"}`}>
              <Search size={18} strokeWidth={1} className={`flex-shrink-0 transition-colors duration-300 ${searchFocused ? "text-foreground" : "text-muted-foreground"}`} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Шукати за назвою, брендом або категорією..."
                className="flex-1 bg-transparent outline-none font-sans text-sm placeholder:text-muted-foreground/40 min-w-0 tracking-wide"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                  <X size={14} />
                </button>
              )}
              <div className="hidden sm:flex items-center gap-3 border-l border-border pl-4">
                <ArrowUpDown size={13} strokeWidth={1.2} className="text-muted-foreground flex-shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-xs font-sans outline-none text-muted-foreground hover:text-foreground cursor-pointer tracking-wide"
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Controls row */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-2.5 text-[10px] tracking-[0.2em] uppercase font-sans font-medium px-4 py-2.5 border transition-all duration-300 ${filtersOpen ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/30"}`}
            >
              <SlidersHorizontal size={13} strokeWidth={1.2} />
              Фільтри
              {activeFilterCount > 0 && (
                <span className={`w-5 h-5 flex items-center justify-center text-[9px] font-medium ${filtersOpen ? "bg-background/20 text-background" : "bg-foreground text-background"}`}>
                  {activeFilterCount}
                </span>
              )}
            </button>
            {hasFilters && (
              <button onClick={clearFilters} className="text-[10px] font-sans font-medium text-muted-foreground hover:text-foreground transition-all duration-300 flex items-center gap-1.5 tracking-wide underline underline-offset-4 decoration-border hover:decoration-foreground">
                Скинути все
              </button>
            )}
          </div>
          {!loading && (
            <p className="text-[10px] text-muted-foreground font-sans tracking-[0.15em] uppercase">
              {filtered.length} {filtered.length === 1 ? "товар" : filtered.length < 5 ? "товари" : "товарів"}
            </p>
          )}
        </div>

        {/* Sort on mobile */}
        <div className="flex sm:hidden items-center gap-2 mb-6 border-b border-border pb-4">
          <ArrowUpDown size={13} strokeWidth={1.2} className="text-muted-foreground flex-shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent text-xs font-sans outline-none text-muted-foreground hover:text-foreground cursor-pointer tracking-wide"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Filters panel */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              className="overflow-hidden"
            >
              <div className="mb-10 p-6 md:p-8 bg-secondary/40 border border-border">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
                  <FilterChip label="Категорія" value={category} options={categories} onChange={setCategory} />
                  <FilterChip label="Бренд" value={brand} options={brands} onChange={setBrand} />
                  <FilterChip label="Тип шкіри" value={skinType} options={skinTypes} onChange={setSkinType} />
                  <FilterChip label="Ціна" value={priceRange} options={priceRanges.map((r) => r.label)} onChange={setPriceRange} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Product grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-secondary" />
                <div className="mt-4 space-y-2">
                  <div className="h-2.5 bg-secondary w-1/3" />
                  <div className="h-3.5 bg-secondary w-2/3" />
                  <div className="h-3 bg-secondary w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-8">
              {paginated.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-14 md:mt-20">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  aria-label="Попередня сторінка"
                  className="p-2.5 border border-border hover:border-foreground/30 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} strokeWidth={1.2} />
                </button>

                {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === "…" ? (
                      <span key={`dots-${idx}`} className="px-2 text-xs text-muted-foreground font-sans">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => goToPage(p)}
                        aria-label={`Сторінка ${p}`}
                        aria-current={p === page ? "page" : undefined}
                        className={`min-w-[40px] h-10 text-[11px] font-sans font-medium tracking-wide border transition-all duration-300 ${
                          p === page
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:border-foreground/30"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}

                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                  aria-label="Наступна сторінка"
                  className="p-2.5 border border-border hover:border-foreground/30 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} strokeWidth={1.2} />
                </button>
              </div>
            )}
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center py-24 md:py-32"
          >
            <div className="w-20 h-20 mx-auto mb-8 border border-border flex items-center justify-center">
              <Package size={28} strokeWidth={0.8} className="text-muted-foreground" />
            </div>
            <p className="font-serif text-2xl md:text-3xl mb-3 font-light">Нічого не знайдено</p>
            <p className="text-sm text-muted-foreground font-sans mb-8 max-w-sm mx-auto leading-relaxed">
              Спробуйте змінити параметри пошуку або скинути фільтри.
            </p>
            <button onClick={clearFilters} className="btn-editorial">Скинути фільтри</button>
          </motion.div>
        )}
      </div>
    </main>
  );
};

export default ShopPage;
