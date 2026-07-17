import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, X, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ProductConsultantProps {
  product: {
    name: string;
    brand: string;
    description: string;
    ingredients: string;
    usage: string;
    price: number;
    skinType: string;
  };
}

const QUICK_QUESTIONS = [
  "Які інгредієнти в складі?",
  "Чи підходить для чутливої шкіри?",
  "Як правильно використовувати?",
];

const ProductConsultant = ({ product }: ProductConsultantProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("product-consultant", {
        body: {
          message: text.trim(),
          product: {
            name: product.name,
            brand: product.brand,
            description: product.description,
            ingredients: product.ingredients,
            usage: product.usage,
            price: product.price,
            skinType: product.skinType,
          },
          history: messages,
        },
      });

      if (error) throw error;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data?.reply || "Вибачте, не вдалося отримати відповідь." },
      ]);
    } catch (err: any) {
      console.error("Consultant error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Вибачте, сталася помилка. Спробуйте ще раз." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-20 md:bottom-8 right-4 md:right-8 z-40 bg-foreground text-background rounded-full p-3.5 shadow-lg hover:scale-105 transition-all duration-300 ${open ? "hidden" : ""}`}
        aria-label="AI-консультант"
      >
        <MessageCircle size={22} strokeWidth={1.5} />
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-50 w-[340px] max-h-[480px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
            <div className="flex items-center gap-2">
              <Sparkles size={14} strokeWidth={1.5} className="text-primary" />
              <span className="text-[11px] tracking-[0.15em] uppercase font-sans font-medium">
                AI-консультант
              </span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-secondary rounded-full transition-colors">
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[320px]">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                  Привіт! 👋 Я AI-асистент. Запитайте у мене все про <strong>{product.name}</strong>!
                </p>
                <div className="space-y-1.5">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="block w-full text-left text-[11px] font-sans px-3 py-2 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-[12px] font-sans leading-relaxed ${
                    msg.role === "user"
                      ? "bg-foreground text-background rounded-br-sm"
                      : "bg-secondary/60 text-foreground rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-secondary/60 rounded-xl rounded-bl-sm px-3 py-2">
                  <Loader2 size={14} className="animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2.5 border-t border-border">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ваше питання..."
              disabled={loading}
              className="flex-1 text-[12px] font-sans bg-transparent outline-none placeholder:text-muted-foreground/50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2 rounded-full hover:bg-secondary transition-colors disabled:opacity-30"
            >
              <Send size={14} strokeWidth={1.5} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ProductConsultant;
