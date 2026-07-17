import { useState, useRef } from "react";
import { Camera, Upload, Sparkles, X, Loader2, ImagePlus, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductData {
  name: string;
  brand: string;
  category_id?: string;
  category_name?: string;
  description: string;
  ingredients: string;
  usage_instructions: string;
  skin_type: string;
  price: number;
}

interface Category {
  id: string;
  name: string;
}

interface AIProductScannerProps {
  categories?: Category[];
  onResult: (data: ProductData, imageUrls: string[]) => void;
  onClose: () => void;
}

const AIProductScanner = ({ categories, onResult, onClose }: AIProductScannerProps) => {
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingPhotos, setGeneratingPhotos] = useState(false);
  const [generateCleanPhotos, setGenerateCleanPhotos] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const newImages = Array.from(files).slice(0, 4 - images.length).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...newImages].slice(0, 4));
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const uploadToStorage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      contentType: file.type,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadBase64ToStorage = async (base64: string): Promise<string> => {
    // Extract the actual base64 data and mime type
    const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) throw new Error("Invalid base64 image");
    const mimeType = match[1];
    const ext = mimeType.split("/")[1] || "png";
    const raw = atob(match[2]);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const path = `generated/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, bytes.buffer, {
      contentType: mimeType,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const generateCleanPhoto = async (base64Image: string, productName?: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("generate-product-photo", {
      body: { image: base64Image, productName },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.image; // base64 generated image
  };

  const handleAnalyze = async () => {
    if (images.length === 0) {
      toast.error("Додайте хоча б одне фото");
      return;
    }

    setAnalyzing(true);
    try {
      const base64Images = await Promise.all(images.map((img) => toBase64(img.file)));

      // Step 1: Analyze product info
      const { data, error } = await supabase.functions.invoke("analyze-product", {
        body: { images: base64Images, categories: categories || [] },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const productInfo = data.product;
      let finalImageUrls: string[];

      // Step 2: Generate clean photos if enabled
      if (generateCleanPhotos) {
        setAnalyzing(false);
        setGeneratingPhotos(true);
        toast.info("Генерую красиві фото товару...");

        const cleanPhotos: string[] = [];
        // Generate for first 2 images (front & back)
        for (let i = 0; i < Math.min(base64Images.length, 2); i++) {
          try {
            const generated = await generateCleanPhoto(base64Images[i], productInfo.name);
            cleanPhotos.push(generated);
          } catch (err) {
            console.error(`Failed to generate photo ${i + 1}:`, err);
            // Fallback: upload original
            const originalUrl = await uploadToStorage(images[i].file);
            cleanPhotos.push(originalUrl);
          }
        }

        // Upload generated base64 images to storage
        finalImageUrls = [];
        for (const photo of cleanPhotos) {
          if (photo.startsWith("data:")) {
            const url = await uploadBase64ToStorage(photo);
            finalImageUrls.push(url);
          } else {
            finalImageUrls.push(photo);
          }
        }
      } else {
        // Just upload originals
        finalImageUrls = await Promise.all(images.map((img) => uploadToStorage(img.file)));
      }

      toast.success("Товар проаналізовано!");
      onResult(productInfo, finalImageUrls);
    } catch (err: any) {
      console.error("Analysis error:", err);
      toast.error(err.message || "Помилка аналізу");
    } finally {
      setAnalyzing(false);
      setGeneratingPhotos(false);
    }
  };

  const isProcessing = analyzing || generatingPhotos;

  return (
    <div className="border border-border rounded-lg p-5 bg-accent/20 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h3 className="font-serif text-base">AI-сканер товару</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-accent rounded-md transition-colors">
          <X size={16} />
        </button>
      </div>

      <p className="text-xs text-muted-foreground font-sans">
        Сфотографуйте товар спереду та ззаду — AI автоматично розпізнає назву, бренд, склад та створить опис.
      </p>

      {/* Image previews */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {images.map((img, idx) => (
          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-background">
            <img src={img.preview} alt={`Фото ${idx + 1}`} className="w-full h-full object-cover" />
            <button
              onClick={() => removeImage(idx)}
              className="absolute top-1 right-1 w-5 h-5 bg-foreground/80 text-background rounded-full flex items-center justify-center"
            >
              <X size={10} />
            </button>
          </div>
        ))}

        {images.length < 4 && (
          <div className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 bg-background hover:bg-accent/30 transition-colors">
            <div className="flex gap-2">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="p-2 rounded-md hover:bg-accent transition-colors"
                title="Камера"
              >
                <Camera size={18} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-md hover:bg-accent transition-colors"
                title="Завантажити"
              >
                <Upload size={18} strokeWidth={1.5} />
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground">Додати фото</span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      {/* AI Photo Generation Toggle */}
      <label className="flex items-center gap-3 p-3 border border-border rounded-lg bg-background cursor-pointer hover:bg-accent/20 transition-colors">
        <input
          type="checkbox"
          checked={generateCleanPhotos}
          onChange={(e) => setGenerateCleanPhotos(e.target.checked)}
          className="w-4 h-4 accent-foreground"
        />
        <div className="flex items-center gap-2 flex-1">
          <Wand2 size={14} className="text-muted-foreground" />
          <div>
            <span className="text-sm font-sans font-medium">AI-обробка фото</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Створити професійне фото товару</p>
          </div>
        </div>
      </label>


      <button
        onClick={handleAnalyze}
        disabled={isProcessing || images.length === 0}
        className="btn-editorial-filled w-full flex items-center justify-center gap-2"
      >
        {analyzing ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Аналізую товар...
          </>
        ) : generatingPhotos ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Генерую фото...
          </>
        ) : (
          <>
            <Sparkles size={14} /> Проаналізувати з AI
          </>
        )}
      </button>
    </div>
  );
};

export default AIProductScanner;
