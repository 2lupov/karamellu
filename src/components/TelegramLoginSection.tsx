import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2 } from "lucide-react";

const BOT_USERNAME = "karamellu_bot";

const TelegramLoginSection = () => {
  const [step, setStep] = useState<"initial" | "code" | "auto-verifying">("initial");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Auto-verify if code is in URL (from Telegram bot link)
  useEffect(() => {
    const tgCode = searchParams.get("tg_code");
    if (tgCode && tgCode.length === 6) {
      setStep("auto-verifying");
      setCode(tgCode);
      // Clean URL
      searchParams.delete("tg_code");
      setSearchParams(searchParams, { replace: true });
      // Auto verify
      verifyCode(tgCode);
    }
  }, []);

  const verifyCode = async (codeToVerify: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-verify-code", {
        body: { code: codeToVerify },
      });

      if (error || !data?.session) {
        toast.error(data?.error || "Невірний або прострочений код");
        setStep("code");
        setLoading(false);
        return;
      }

      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      toast.success("Ви увійшли через Telegram!");
      navigate("/");
    } catch (err) {
      toast.error("Помилка підключення до сервера");
      setStep("code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = () => {
    if (code.length < 6) return;
    verifyCode(code);
  };

  // Auto-verifying state (from link click)
  if (step === "auto-verifying") {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <Loader2 size={24} className="animate-spin text-foreground" />
        <p className="text-sm text-muted-foreground font-sans">Виконуємо вхід...</p>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground font-sans mb-1">
            Надішліть <span className="font-medium text-foreground">/login</span> боту
          </p>
          <a
            href={`https://t.me/${BOT_USERNAME}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-sans font-medium text-foreground border-b border-foreground pb-px"
          >
            @{BOT_USERNAME}
          </a>
          <p className="text-sm text-muted-foreground font-sans mt-3">
            Натисніть кнопку в боті або введіть код:
          </p>
        </div>

        <div className="flex justify-center">
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
          onClick={handleVerifyCode}
          disabled={loading || code.length < 6}
          className="btn-editorial-filled w-full disabled:opacity-50"
        >
          {loading ? "Перевірка..." : "Підтвердити"}
        </button>

        <button
          onClick={() => { setStep("initial"); setCode(""); }}
          className="w-full text-center text-xs text-muted-foreground font-sans hover:text-foreground transition-colors"
        >
          Назад
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <a
        href={`https://t.me/${BOT_USERNAME}?start=login`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full inline-flex items-center justify-center gap-3 px-8 py-3 border border-border bg-transparent text-foreground font-sans text-xs tracking-[0.15em] uppercase transition-all duration-300 hover:border-foreground"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
        Увійти через Telegram
      </a>
      <button
        onClick={() => setStep("code")}
        className="w-full text-center text-[10px] text-muted-foreground font-sans opacity-50 hover:opacity-80 transition-opacity"
      >
        Вже маєте код? Введіть вручну
      </button>
    </div>
  );
};

export default TelegramLoginSection;
