import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a recovery session
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    } else {
      // Listen for recovery event
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setReady(true);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Пароль має містити щонайменше 6 символів");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Пароль успішно змінено!");
      navigate("/");
    }
  };

  if (!ready) {
    return (
      <main className="pt-24 min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground font-sans text-sm">Завантаження...</p>
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
            <h1 className="font-serif text-3xl md:text-4xl mb-2">Новий пароль</h1>
            <p className="text-sm text-muted-foreground font-sans">Введіть ваш новий пароль</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-sans block mb-2">Новий пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border border-border px-4 py-3 text-sm font-sans outline-none focus:border-foreground transition-colors"
                placeholder="Мінімум 6 символів"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-editorial-filled w-full disabled:opacity-50">
              {loading ? "Збереження..." : "Зберегти пароль"}
            </button>
          </form>
        </motion.div>
      </div>
    </main>
  );
};

export default ResetPasswordPage;
