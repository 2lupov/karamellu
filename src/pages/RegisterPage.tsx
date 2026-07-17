import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const BOT_USERNAME = "karamellu_bot";

const RegisterPage = () => {
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
            <h1 className="font-serif text-3xl md:text-4xl mb-2">Реєстрація</h1>
            <p className="text-sm text-muted-foreground font-sans">Створіть акаунт через Telegram бота</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-4 text-sm text-muted-foreground font-sans">
              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-medium">1</span>
                <p>Перейдіть до бота <b className="text-foreground">@{BOT_USERNAME}</b></p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-medium">2</span>
                <p>Придумайте <b className="text-foreground">нікнейм</b> та <b className="text-foreground">пароль</b></p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-medium">3</span>
                <p>Натисніть кнопку <b className="text-foreground">"Перейти на сайт"</b> — і ви на сайті!</p>
              </div>
            </div>

            <a
              href={`https://t.me/${BOT_USERNAME}?start=register`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-3 px-8 py-3 border border-border bg-transparent text-foreground font-sans text-xs tracking-[0.15em] uppercase transition-all duration-300 hover:border-foreground"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Зареєструватися через Telegram
            </a>
          </div>

          <p className="text-center text-sm text-muted-foreground font-sans mt-10">
            Вже є акаунт?{" "}
            <Link to="/login" className="text-foreground border-b border-foreground pb-px">
              Увійти
            </Link>
          </p>
        </motion.div>
      </div>
    </main>
  );
};

export default RegisterPage;
