import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Loader2 } from "lucide-react";

const AdminLogin = () => {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
        if (data) navigate("/admin");
      });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !password.trim()) return;
    setLoading(true);
    const email = `${nickname.toLowerCase().trim()}@karamellu.local`;
    const { error } = await signIn(email, password);
    if (error) {
      setLoading(false);
      toast.error("Невірний нікнейм або пароль");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLoading(false);
      toast.error("Помилка сесії");
      return;
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: u.user.id,
      _role: "admin",
    });
    setLoading(false);
    if (!isAdmin) {
      await supabase.auth.signOut();
      toast.error("Доступ заборонено");
      return;
    }
    toast.success("Вхід виконано");
    navigate("/admin");
  };

  return (
    <div
      className="admin-dark min-h-screen flex items-center justify-center px-4"
      style={{ background: "hsl(var(--admin-bg))", color: "hsl(var(--admin-text))" }}
    >
      <div
        className="w-full max-w-sm rounded-lg border p-8"
        style={{ background: "hsl(var(--admin-surface))", borderColor: "hsl(var(--admin-border))" }}
      >
        <div className="flex flex-col items-center mb-7">
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center mb-3"
            style={{ background: "hsl(var(--admin-accent-soft))" }}
          >
            <Shield size={18} style={{ color: "hsl(var(--admin-accent))" }} />
          </div>
          <h1 className="font-sans text-base font-medium" style={{ color: "hsl(var(--admin-text))" }}>
            Вхід в адмін-панель
          </h1>
          <p className="text-[12px] mt-1" style={{ color: "hsl(var(--admin-text-muted))" }}>
            Тільки для адміністраторів
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest block mb-1.5" style={{ color: "hsl(var(--admin-text-muted))" }}>
              Нікнейм
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 rounded-md border text-[13px]"
              style={{
                background: "hsl(var(--admin-bg))",
                borderColor: "hsl(var(--admin-border))",
                color: "hsl(var(--admin-text))",
              }}
              required
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest block mb-1.5" style={{ color: "hsl(var(--admin-text-muted))" }}>
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-md border text-[13px]"
              style={{
                background: "hsl(var(--admin-bg))",
                borderColor: "hsl(var(--admin-border))",
                color: "hsl(var(--admin-text))",
              }}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-[13px] font-medium mt-2"
            style={{ background: "hsl(var(--admin-accent))", color: "hsl(var(--admin-bg))" }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Увійти"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
