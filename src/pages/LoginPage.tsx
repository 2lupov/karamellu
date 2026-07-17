import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

const LoginPage = () => {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoLogging, setAutoLogging] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-login from Telegram magic link
  useEffect(() => {
    const tgCode = searchParams.get("tg_code");
    if (tgCode && tgCode.length === 6) {
      setAutoLogging(true);
      searchParams.delete("tg_code");
      setSearchParams(searchParams, { replace: true });
      verifyTelegramCode(tgCode);
    }
  }, []);

  const verifyTelegramCode = async (code: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("telegram-verify-code", {
        body: { code },
      });

      if (error || !data?.session) {
        toast.error(data?.error || "Невірний або прострочений код");
        setAutoLogging(false);
        return;
      }

      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      toast.success("Ви увійшли!");
      navigate("/");
    } catch {
      toast.error("Помилка підключення до сервера");
      setAutoLogging(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !password.trim()) return;

    setLoading(true);
    // Convert nickname to internal email format
    const email = `${nickname.toLowerCase().trim()}@karamellu.local`;
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast.error("Невірний нікнейм або пароль");
    } else {
      toast.success("Ви увійшли!");
      navigate("/");
    }
  };

  if (autoLogging) {
    return (
      <main className="pt-20 md:pt-24 min-h-screen flex items-center">
        <div className="container-editorial">
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 size={24} className="animate-spin text-foreground" />
            <p className="text-sm text-muted-foreground font-sans">Виконуємо вхід...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-20 md:pt-24 min-h-screen flex items-center">
      <div className="container-editorial">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-sm mx-auto"
        >
          <div className="text-center mb-10">
            <h1 className="font-serif text-3xl md:text-4xl mb-2">Вхід</h1>
            <p className="text-sm text-muted-foreground font-sans">Введіть дані вашого акаунта</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-sans block mb-2">
                Нікнейм
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ваш нікнейм"
                className="w-full bg-transparent border border-border px-4 py-3 text-sm font-sans outline-none focus:border-foreground transition-colors"
                required
              />
            </div>
            <div>
              <label className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-sans block mb-2">
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ваш пароль"
                className="w-full bg-transparent border border-border px-4 py-3 text-sm font-sans outline-none focus:border-foreground transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-editorial-filled w-full disabled:opacity-50"
            >
              {loading ? "Завантаження..." : "Увійти"}
            </button>
          </form>

          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-sans">або</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <a
            href="https://t.me/karamellu_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-editorial w-full group"
          >
            <Send size={14} strokeWidth={1.2} className="mr-2" />
            Увійти через Telegram
          </a>

          <p className="text-center text-sm text-muted-foreground font-sans mt-10">
            Немає акаунта?{" "}
            <Link to="/register" className="text-foreground border-b border-foreground pb-px">
              Зареєструватися
            </Link>
          </p>
        </motion.div>
      </div>
    </main>
  );
};

export default LoginPage;
