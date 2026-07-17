import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  category_id: string | null;
  category_name?: string;
  skin_type: string | null;
  image: string | null;
  image_hover: string | null;
  promo_photo: string | null;
  
  description: string | null;
  ingredients: string | null;
  usage_instructions: string | null;
  best_seller: boolean | null;
  is_active: boolean | null;
  rating: number | null;
  review_count: number | null;
}

// Compat layer for components that use old field names
export interface ProductCompat {
  id: string;
  name: string;
  brand: string;
  price: number;
  category: string;
  skinType: string;
  image: string;
  imageHover: string;
  promoPhoto: string | null;
  
  description: string;
  ingredients: string;
  usage: string;
  bestSeller: boolean;
  rating: number;
  reviewCount: number;
}

export function toCompat(p: Product, categoryName?: string): ProductCompat {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: p.price,
    category: categoryName || p.category_name || "",
    skinType: p.skin_type || "Для всіх типів шкіри",
    image: p.image || "/placeholder.svg",
    imageHover: p.image_hover || p.image || "/placeholder.svg",
    promoPhoto: p.promo_photo || null,
    
    description: p.description || "",
    ingredients: p.ingredients || "",
    usage: p.usage_instructions || "",
    bestSeller: p.best_seller || false,
    rating: p.rating || 0,
    reviewCount: p.review_count || 0,
  };
}

interface Category {
  id: string;
  name: string;
}

export function useProducts() {
  const [products, setProducts] = useState<ProductCompat[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [prodRes, catRes] = await Promise.all([
        supabase.from("products").select("*").eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("categories").select("id, name").order("sort_order", { ascending: true }),
      ]);

      const cats: Category[] = (catRes.data as Category[]) || [];
      setCategories(cats);
      const catMap = new Map(cats.map((c) => [c.id, c.name]));

      const raw = (prodRes.data as Product[]) || [];
      setProducts(raw.map((p) => toCompat(p, p.category_id ? catMap.get(p.category_id) : undefined)));
      setLoading(false);
    };
    fetch();
  }, []);

  return { products, categories, loading };
}

export function useProduct(id: string | undefined) {
  const [product, setProduct] = useState<ProductCompat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    const fetch = async () => {
      const { data } = await supabase.from("products").select("*").eq("id", id).single();
      if (data) {
        let categoryName = "";
        if (data.category_id) {
          const { data: cat } = await supabase.from("categories").select("name").eq("id", data.category_id).single();
          categoryName = cat?.name || "";
        }
        setProduct(toCompat(data as Product, categoryName));
      }
      setLoading(false);
    };
    fetch();
  }, [id]);

  return { product, loading };
}
