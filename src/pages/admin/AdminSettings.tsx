import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Save } from "lucide-react";
import { toast } from "sonner";

const settingsKeys = [
  { key: "site_name", label: "Назва сайту", placeholder: "Карамель LU" },
  { key: "site_email", label: "Email", placeholder: "info@karamellu.com" },
  { key: "site_phone", label: "Телефон", placeholder: "+380 XX XXX XX XX" },
  { key: "site_address", label: "Адреса", placeholder: "м. Київ, вул. ..." },
  { key: "instagram_url", label: "Instagram", placeholder: "https://instagram.com/..." },
  { key: "tiktok_url", label: "TikTok", placeholder: "https://tiktok.com/..." },
  { key: "telegram_url", label: "Telegram", placeholder: "https://t.me/..." },
  { key: "working_hours", label: "Графік роботи", placeholder: "Пн-Пт: 9:00-18:00" },
  { key: "about_text", label: "Про нас", placeholder: "Опис бренду..." },
  { key: "telegram_admin_chat_ids", label: "Telegram Chat ID адмінів", placeholder: "123456789, 987654321" },
];

const inputClass = "w-full rounded-md border px-3 py-2.5 text-[13px] font-sans outline-none transition-colors bg-transparent";
const labelClass = "text-[10px] font-sans uppercase tracking-widest block mb-1.5";
const bdr = { borderColor: "hsl(var(--admin-border))" };
const clr = { color: "hsl(var(--admin-text))" };
const muted = { color: "hsl(var(--admin-text-muted))" };

const AdminSettings = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("site_settings").select("key, value");
      const map: Record<string, string> = {};
      (data || []).forEach((row: any) => { map[row.key] = row.value || ""; });
      setSettings(map); setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    for (const item of settingsKeys) {
      const val = settings[item.key] || "";
      const { data: existing } = await supabase.from("site_settings").select("id").eq("key", item.key).maybeSingle();
      if (existing) await supabase.from("site_settings").update({ value: val }).eq("key", item.key);
      else await supabase.from("site_settings").insert({ key: item.key, value: val });
    }
    toast.success("Збережено"); setSaving(false);
  };

  if (loading) return <div className="text-center py-12 text-[13px] font-sans" style={muted}>Завантаження...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-sans text-xl font-medium">Налаштування</h1>
          <p className="text-[13px] mt-0.5" style={muted}>Контактна інформація та соцмережі</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 text-[12px] px-4 py-2 rounded-md font-sans self-start" style={{ background: "hsl(var(--admin-accent))", color: "#fff" }}>
          <Save size={13} /> {saving ? "..." : "Зберегти"}
        </button>
      </div>

      <div className="rounded-lg border p-6 md:p-8 space-y-5" style={{ background: "hsl(var(--admin-surface))", ...bdr }}>
        {settingsKeys.map((s) => (
          <div key={s.key}>
            <label className={labelClass} style={muted}>{s.label}</label>
            {s.key === "about_text" ? (
              <textarea rows={3} value={settings[s.key] || ""} onChange={(e) => setSettings({ ...settings, [s.key]: e.target.value })} placeholder={s.placeholder} className={`${inputClass} resize-none`} style={{ ...bdr, ...clr }} />
            ) : (
              <input value={settings[s.key] || ""} onChange={(e) => setSettings({ ...settings, [s.key]: e.target.value })} placeholder={s.placeholder} className={inputClass} style={{ ...bdr, ...clr }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminSettings;
