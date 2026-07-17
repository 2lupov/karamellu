import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <main className="pt-20 md:pt-24 min-h-screen flex items-center">
      <div className="container-editorial">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-sm mx-auto text-center"
        >
          <h1 className="font-serif text-3xl md:text-4xl mb-2">Відновлення пароля</h1>

          {sent ? (
            <div className="mt-8">
              <p className="text-sm text-muted-foreground font-sans mb-6">
                Перевірте вашу пошту. Ми надіслали посилання для відновлення пароля на <strong>{email}</strong>.
              </p>
              <Link to="/login" className="btn-editorial">Повернутися до входу</Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground font-sans mb-8">
                Введіть вашу електронну пошту і ми надішлемо посилання для відновлення пароля.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                <div>
                  <label className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-sans block mb-2">Електронна пошта</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent border border-border px-4 py-3 text-sm font-sans outline-none focus:border-foreground transition-colors"
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-editorial-filled w-full disabled:opacity-50">
                  {loading ? "Надсилання..." : "Надіслати посилання"}
                </button>
              </form>
              <p className="text-center text-sm text-muted-foreground font-sans mt-6">
                <Link to="/login" className="text-foreground border-b border-foreground pb-px">Повернутися до входу</Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </main>
  );
};

export default ForgotPasswordPage;
