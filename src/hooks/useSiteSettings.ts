import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteSettings {
  site_name: string;
  site_email: string;
  site_phone: string;
  site_address: string;
  working_hours: string;
  about_text: string;
  instagram_url: string;
  telegram_url: string;
  tiktok_url: string;
}

const defaults: SiteSettings = {
  site_name: "Карамель LU",
  site_email: "karamellu.studio@gmail.com",
  site_phone: "+380 93 628 3837",
  site_address: "вул. Проскурівська, 49, м. Хмельницький, 29000",
  working_hours: "Щодня: 9:00–20:00",
  about_text: "",
  instagram_url: "",
  telegram_url: "",
  tiktok_url: "",
};

let cachedSettings: SiteSettings | null = null;
let fetchPromise: Promise<SiteSettings> | null = null;

const fetchSettings = async (): Promise<SiteSettings> => {
  const { data } = await supabase.from("site_settings").select("key, value");
  const settings = { ...defaults };
  if (data) {
    for (const row of data) {
      if (row.key in settings) {
        (settings as Record<string, string>)[row.key] = row.value ?? "";
      }
    }
  }
  cachedSettings = settings;
  return settings;
};

export const useSiteSettings = () => {
  const [settings, setSettings] = useState<SiteSettings>(cachedSettings ?? defaults);
  const [loading, setLoading] = useState(!cachedSettings);

  useEffect(() => {
    if (cachedSettings) {
      setSettings(cachedSettings);
      setLoading(false);
      return;
    }
    if (!fetchPromise) {
      fetchPromise = fetchSettings();
    }
    fetchPromise.then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  return { settings, loading };
};
