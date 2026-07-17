import { useState } from "react";
import { Sparkles, Camera, Download, Upload, Loader2, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ProductPromoGeneratorProps {
  product: {
    id: string;
    name: string;
    brand: string;
    description: string;
    image: string;
  };
  isAdmin: boolean;
}

const ProductPromoGenerator = ({ product, isAdmin }: ProductPromoGeneratorProps) => {
  const [promoPhoto, setPromoPhoto] = useState<string | null>(null);
  const [generatingPhoto, setGeneratingPhoto] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  if (!isAdmin) return null;

  const uploadToStorage = async (base64OrUrl: string): Promise<string> => {
    const res = await fetch(base64OrUrl);
    const blob = await res.blob();
    const path = `promo/${product.id}/photo-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, blob, { contentType: "image/png" });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const generatePhoto = async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("generate-promo-content", {
      body: {
        type: "photo",
        productName: product.name,
        productBrand: product.brand,
        productDescription: product.description,
        productImage: product.image,
      },
    });
    if (error) throw error;
    if (!data?.image) throw new Error("Не вдалося згенерувати фото");
    return data.image;
  };

  const handleGeneratePhoto = async () => {
    setGeneratingPhoto(true);
    try {
      const photoBase64 = await generatePhoto();
      setPromoPhoto(photoBase64);
      toast({ title: "✨ Рекламне фото згенеровано!" });
    } catch (err: any) {
      console.error("Photo gen error:", err);
      toast({ title: "Помилка", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingPhoto(false);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({ title: "📥 Файл завантажено!" });
    } catch {
      toast({ title: "Помилка завантаження", variant: "destructive" });
    }
  };

  const handleUploadToSite = async (base64OrUrl: string) => {
    setUploadingPhoto(true);
    try {
      const publicUrl = await uploadToStorage(base64OrUrl);
      await supabase.from("products").update({ promo_photo: publicUrl }).eq("id", product.id);
      toast({ title: "✅ Рекламне фото додано до товару!" });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({ title: "Помилка завантаження", description: err.message, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const isBusy = generatingPhoto || uploadingPhoto;

  return (
    <div className="mt-10 border-t border-border pt-8">
      <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground font-sans mb-5 font-medium">
        🎨 AI-генерація рекламного фото
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={handleGeneratePhoto}
          disabled={isBusy}
          className="btn-editorial text-[10px] inline-flex items-center gap-2 disabled:opacity-40"
        >
          {generatingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} strokeWidth={1.2} />}
          {generatingPhoto ? "Генерую фото..." : "Згенерувати промо-фото"}
        </button>
      </div>

      {promoPhoto && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-sans font-medium text-muted-foreground">📸 Рекламне фото</p>
            <button onClick={() => setPromoPhoto(null)} className="p-1 hover:bg-secondary rounded">
              <X size={14} strokeWidth={1.2} />
            </button>
          </div>
          <div className="relative group max-w-md">
            <img src={promoPhoto} alt="Рекламне фото" className="w-full rounded border border-border" />
            <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleDownload(promoPhoto, `${product.name}-promo.png`)}
                className="bg-background/90 backdrop-blur-sm border border-border rounded-full p-2.5 hover:bg-background transition-colors"
                title="Завантажити"
              >
                <Download size={14} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => handleUploadToSite(promoPhoto)}
                disabled={uploadingPhoto}
                className="bg-background/90 backdrop-blur-sm border border-border rounded-full p-2.5 hover:bg-background transition-colors disabled:opacity-50"
                title="Завантажити на сайт"
              >
                {uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} strokeWidth={1.5} />}
              </button>
              <button
                onClick={handleGeneratePhoto}
                disabled={generatingPhoto}
                className="bg-background/90 backdrop-blur-sm border border-border rounded-full p-2.5 hover:bg-background transition-colors disabled:opacity-50"
                title="Згенерувати інше"
              >
                {generatingPhoto ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} strokeWidth={1.5} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPromoGenerator;
