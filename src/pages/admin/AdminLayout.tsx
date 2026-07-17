import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LayoutDashboard, Package, Tags, Settings, LogOut, Menu, X, ExternalLink, Shield, ShoppingBag, Ticket, Users, CalendarCheck, Scissors, UserCog, ScanLine, Boxes, Store,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ShopProvider } from "@/context/ShopContext";
import ShopSwitcher from "@/components/admin/ShopSwitcher";

const sidebarLinks = [
  { label: "Дашборд", path: "/admin", icon: LayoutDashboard },
  { label: "Сканер", path: "/admin/scanner", icon: ScanLine },
  { label: "Інвентар", path: "/admin/inventory", icon: Boxes },
  { label: "Магазини", path: "/admin/shops", icon: Store },
  { label: "Записи", path: "/admin/bookings", icon: CalendarCheck },
  { label: "Послуги", path: "/admin/services", icon: Scissors },
  { label: "Майстри", path: "/admin/masters", icon: UserCog },
  { label: "Замовлення", path: "/admin/orders", icon: ShoppingBag },
  { label: "Продукти", path: "/admin/products", icon: Package },
  { label: "Категорії", path: "/admin/categories", icon: Tags },
  { label: "Промокоди", path: "/admin/promo-codes", icon: Ticket },
  { label: "Налаштування", path: "/admin/settings", icon: Settings },
];

const AdminLayout = () => {
  const { user, signOut, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) { navigate("/admin/login"); return; }
    if (user) {
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
    }
  }, [user, loading, navigate]);

  const handleBootstrapAdmin = async () => {
    const { data, error } = await supabase.rpc("make_first_admin");
    if (error) { toast.error(error.message); return; }
    if (data) { toast.success("Ви стали адміністратором!"); setIsAdmin(true); }
    else toast.error("Адмін вже існує.");
  };

  if (loading || isAdmin === null) {
    return (
      <div className="admin-dark min-h-screen flex items-center justify-center" style={{ background: "hsl(var(--admin-bg))" }}>
        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "hsl(var(--admin-text-muted))", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-dark min-h-screen flex items-center justify-center" style={{ background: "hsl(var(--admin-bg))", color: "hsl(var(--admin-text))" }}>
        <div className="text-center max-w-md px-6">
          <Shield size={40} className="mx-auto mb-4" style={{ color: "hsl(var(--admin-text-muted))" }} />
          <h1 className="font-sans text-xl font-medium mb-2">404</h1>
          <p className="text-sm mb-6" style={{ color: "hsl(var(--admin-text-muted))" }}>
            Сторінку не знайдено.
          </p>
          <Link to="/" className="admin-btn-ghost">На головну</Link>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div className="h-14 flex items-center px-5 border-b" style={{ borderColor: "hsl(var(--admin-border))" }}>
        <Link to="/admin" className="flex items-center gap-2.5" onClick={onNavigate}>
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "hsl(var(--admin-accent-soft))" }}>
            <Shield size={14} style={{ color: "hsl(var(--admin-accent))" }} />
          </div>
          <span className="font-sans text-sm font-medium" style={{ color: "hsl(var(--admin-text))" }}>Карамель LU</span>
        </Link>
      </div>

      <div className="px-3 pt-3">
        <ShopSwitcher />
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5">
        <p className="text-[10px] font-sans uppercase tracking-widest px-3 pt-2 pb-2" style={{ color: "hsl(var(--admin-text-muted))" }}>Меню</p>
        {sidebarLinks.map((link) => {
          const active = location.pathname === link.path;
          return (
            <Link
              key={link.path}
              to={link.path}
              onClick={onNavigate}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-sans transition-colors"
              style={{
                background: active ? "hsl(var(--admin-surface-hover))" : "transparent",
                color: active ? "hsl(var(--admin-text))" : "hsl(var(--admin-text-muted))",
              }}
              onMouseEnter={(e) => !active && (e.currentTarget.style.background = "hsl(var(--admin-surface-hover))")}
              onMouseLeave={(e) => !active && (e.currentTarget.style.background = "transparent")}
            >
              <link.icon size={15} strokeWidth={1.5} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t space-y-0.5" style={{ borderColor: "hsl(var(--admin-border))" }}>
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-sans transition-colors"
          style={{ color: "hsl(var(--admin-text-muted))" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--admin-surface-hover))")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <ExternalLink size={15} strokeWidth={1.5} />
          На сайт
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-sans transition-colors w-full"
          style={{ color: "hsl(var(--admin-text-muted))" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--admin-surface-hover))")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <LogOut size={15} strokeWidth={1.5} />
          Вийти
        </button>
      </div>
    </>
  );

  return (
    <ShopProvider>
    <div className="admin-dark min-h-screen flex" style={{ background: "hsl(var(--admin-bg))", color: "hsl(var(--admin-text))" }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-60 fixed inset-y-0 left-0 z-30 border-r"
        style={{ background: "hsl(var(--admin-surface))", borderColor: "hsl(var(--admin-border))" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 h-13 z-40 flex items-center px-4 justify-between border-b"
        style={{ background: "hsl(var(--admin-surface))", borderColor: "hsl(var(--admin-border))" }}
      >
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-md transition-colors" style={{ color: "hsl(var(--admin-text-muted))" }}>
          <Menu size={18} strokeWidth={1.5} />
        </button>
        <span className="font-sans text-sm font-medium">Адмін</span>
        <div className="w-9" />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.6)" }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="lg:hidden fixed inset-y-0 left-0 w-60 z-50 flex flex-col border-r"
              style={{ background: "hsl(var(--admin-surface))", borderColor: "hsl(var(--admin-border))" }}
            >
              <SidebarContent onNavigate={() => setSidebarOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 lg:ml-60 pt-13 lg:pt-0 min-h-screen">
        <div className="p-5 md:p-8 max-w-[1200px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
    </ShopProvider>
  );
};

export default AdminLayout;
