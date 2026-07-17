import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const VerifyEmailPage = () => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string })?.email || "";

  const handleVerify = async () => {
    if (code.length < 6) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "signup",
    });
    setLoading(false);
    if (error) {
      toast.error("Невірний код підтвердження. Спробуйте ще раз.");
    } else {
      toast.success("Акаунт підтверджено! Ласкаво просимо!");
      navigate("/");
    }
  };

  const handleResend = async () => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    if (error) {
      toast.error("Не вдалося надіслати код повторно");
    } else {
      toast.success("Код надіслано повторно на " + email);
    }
  };

  if (!email) {
    return (
      <main className="pt-24 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground font-sans text-sm mb-4">Електронна пошта не знайдена.</p>
          <button onClick={() => navigate("/register")} className="btn-editorial">
            Повернутися до реєстрації
          </button>
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
          className="max-w-sm mx-auto text-center"
        >
          <div className="mb-10">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-accent flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <h1 className="font-serif text-3xl md:text-4xl mb-2">Підтвердження</h1>
            <p className="text-sm text-muted-foreground font-sans">
              Ми надіслали 6-значний код на
            </p>
            <p className="text-sm font-sans font-medium mt-1">{email}</p>
          </div>

          <div className="flex justify-center mb-8">
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <button
            onClick={handleVerify}
            disabled={loading || code.length < 6}
            className="btn-editorial-filled w-full disabled:opacity-50 mb-4"
          >
            {loading ? "Перевірка..." : "Підтвердити"}
          </button>

          <p className="text-sm text-muted-foreground font-sans">
            Не отримали код?{" "}
            <button
              onClick={handleResend}
              className="text-foreground border-b border-foreground pb-px"
            >
              Надіслати повторно
            </button>
          </p>
        </motion.div>
      </div>
    </main>
  );
};

export default VerifyEmailPage;
