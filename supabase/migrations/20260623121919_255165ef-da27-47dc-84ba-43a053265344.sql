
-- Enum для статусу запису
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

-- Категорії послуг
CREATE TABLE public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  image_url text,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.service_categories TO anon, authenticated;
GRANT ALL ON public.service_categories TO service_role;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read categories" ON public.service_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.service_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Послуги
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_minutes int NOT NULL DEFAULT 60,
  price_variants jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{label:"1-ша", price:500}, ...] або [{label:null, price:500}]
  order_index int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read services" ON public.services FOR SELECT USING (is_active);
CREATE POLICY "Admins manage services" ON public.services FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Майстри
CREATE TABLE public.masters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  photo_url text,
  bio text,
  specialties uuid[] NOT NULL DEFAULT '{}', -- масив category_id
  order_index int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.masters TO anon, authenticated;
GRANT ALL ON public.masters TO service_role;
ALTER TABLE public.masters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read masters" ON public.masters FOR SELECT USING (is_active);
CREATE POLICY "Admins manage masters" ON public.masters FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Графік роботи майстра
CREATE TABLE public.master_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES public.masters(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '20:00',
  is_working boolean NOT NULL DEFAULT true,
  UNIQUE (master_id, weekday)
);

GRANT SELECT ON public.master_schedule TO anon, authenticated;
GRANT ALL ON public.master_schedule TO service_role;
ALTER TABLE public.master_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read schedule" ON public.master_schedule FOR SELECT USING (true);
CREATE POLICY "Admins manage schedule" ON public.master_schedule FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Записи клієнтів
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  master_id uuid NOT NULL REFERENCES public.masters(id) ON DELETE RESTRICT,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL,
  price_variant_label text,
  price numeric(10,2),
  status booking_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_master_date ON public.bookings (master_id, scheduled_at);
CREATE INDEX idx_bookings_status ON public.bookings (status);

GRANT INSERT ON public.bookings TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create booking" ON public.bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins read all bookings" ON public.bookings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update bookings" ON public.bookings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete bookings" ON public.bookings FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER set_service_categories_updated_at BEFORE UPDATE ON public.service_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_services_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_masters_updated_at BEFORE UPDATE ON public.masters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Функція для пошуку зайнятих інтервалів майстра на дату
CREATE OR REPLACE FUNCTION public.get_busy_intervals(_master_id uuid, _date date)
RETURNS TABLE (start_at timestamptz, end_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT scheduled_at, scheduled_at + (duration_minutes || ' minutes')::interval
  FROM public.bookings
  WHERE master_id = _master_id
    AND status IN ('pending', 'confirmed')
    AND scheduled_at::date = _date;
$$;

GRANT EXECUTE ON FUNCTION public.get_busy_intervals(uuid, date) TO anon, authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

-- Сідимо категорії
INSERT INTO public.service_categories (slug, name, order_index) VALUES
  ('farbuvannya', 'Фарбування', 1),
  ('stryzhky', 'Стрижки', 2),
  ('doglyad', 'Догляд за волоссям', 3),
  ('brovy', 'Брови', 4),
  ('viyi', 'Вії', 5),
  ('zachisky', 'Зачіски', 6),
  ('makiyazh', 'Макіяж', 7),
  ('cholovichi', 'Чоловічі послуги', 8);

-- Сідимо послуги
WITH cat AS (SELECT id, slug FROM public.service_categories)
INSERT INTO public.services (category_id, name, description, duration_minutes, price_variants, order_index) VALUES
  -- Фарбування
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Складне фарбування', 'Air touch / розтяжка кольору / Soft blond / балаяж', 180,
    '[{"label":"1-ша довжина","price":2000},{"label":"2-га довжина","price":2800},{"label":"3-тя довжина","price":4000}]', 1),
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Total blond', 'Повне освітлення + тонування', 180,
    '[{"label":"1-ша довжина","price":1800},{"label":"2-га довжина","price":2500},{"label":"3-тя довжина","price":3000}]', 2),
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Тонування', NULL, 90,
    '[{"label":"1-ша","price":500},{"label":"2-га","price":700},{"label":"3-тя","price":800},{"label":"від 4-ї","price":1000}]', 3),
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Фарбування коренів', NULL, 90,
    '[{"label":"1-ша","price":500},{"label":"2-га","price":600},{"label":"3-тя","price":700},{"label":"від 4-ї","price":800}]', 4),
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Освітлення коренів', NULL, 90,
    '[{"label":"1-ша","price":600},{"label":"2-га","price":700},{"label":"3-тя","price":800},{"label":"від 4-ї","price":900}]', 5),
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Фарбування коренів + тонування', NULL, 120,
    '[{"label":"1-ша","price":1000},{"label":"2-га","price":1200},{"label":"3-тя","price":1300},{"label":"від 4-ї","price":1400}]', 6),
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Вихід з чорного', NULL, 240,
    '[{"label":"1-ша","price":3500},{"label":"2-га","price":4000},{"label":"3-тя","price":4500},{"label":"від 4-ї","price":5000}]', 7),
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Контуринг', NULL, 90,
    '[{"label":"1-ша","price":1500},{"label":"2-га","price":1700},{"label":"3-тя","price":2000},{"label":"від 4-ї","price":2500}]', 8),

  -- Стрижки
  ((SELECT id FROM cat WHERE slug='stryzhky'), 'Стрижка жіноча', NULL, 60,
    '[{"label":"1-ша","price":500},{"label":"2-га","price":600},{"label":"3-тя","price":700}]', 1),
  ((SELECT id FROM cat WHERE slug='stryzhky'), 'Стрижка + експрес зволоження', NULL, 75,
    '[{"label":null,"price":800}]', 2),
  ((SELECT id FROM cat WHERE slug='stryzhky'), 'Стрижка чілки', NULL, 20,
    '[{"label":null,"price":200}]', 3),
  ((SELECT id FROM cat WHERE slug='stryzhky'), 'Стрижка дитяча', NULL, 30,
    '[{"label":null,"price":400}]', 4),

  -- Догляд за волоссям
  ((SELECT id FROM cat WHERE slug='doglyad'), 'Реконструкція Cold', NULL, 90,
    '[{"label":null,"price":1700}]', 1),
  ((SELECT id FROM cat WHERE slug='doglyad'), 'Протеїнове відновлення', NULL, 90,
    '[{"label":null,"price":2100}]', 2),
  ((SELECT id FROM cat WHERE slug='doglyad'), 'Відновлення IR-праскою', NULL, 90,
    '[{"label":null,"price":1700}]', 3),
  ((SELECT id FROM cat WHERE slug='doglyad'), 'Глибоке живлення + зволоження', NULL, 60,
    '[{"label":null,"price":1700}]', 4),
  ((SELECT id FROM cat WHERE slug='doglyad'), 'Холодний ботокс', NULL, 90,
    '[{"label":null,"price":1800}]', 5),
  ((SELECT id FROM cat WHERE slug='doglyad'), 'Пілінг шкіри голови', NULL, 60,
    '[{"label":"1-ша","price":450},{"label":"2-га","price":550},{"label":"3-тя","price":650}]', 6),
  ((SELECT id FROM cat WHERE slug='doglyad'), '3-етапне відновлення + пілінг', NULL, 120,
    '[{"label":"1-ша","price":1700},{"label":"2-га","price":2100},{"label":"3-тя","price":2400}]', 7),

  -- Брови
  ((SELECT id FROM cat WHERE slug='brovy'), 'Корекція + фарбування', NULL, 45,
    '[{"label":null,"price":500}]', 1),
  ((SELECT id FROM cat WHERE slug='brovy'), 'Корекція форми брів / Чоловіча', NULL, 30,
    '[{"label":null,"price":350}]', 2),
  ((SELECT id FROM cat WHERE slug='brovy'), 'Моделювання форми брів', NULL, 30,
    '[{"label":null,"price":300}]', 3),
  ((SELECT id FROM cat WHERE slug='brovy'), 'Фарбування брів', NULL, 30,
    '[{"label":null,"price":300}]', 4),
  ((SELECT id FROM cat WHERE slug='brovy'), 'Ламінування брів + фарбування + корекція', NULL, 60,
    '[{"label":null,"price":700}]', 5),

  -- Вії
  ((SELECT id FROM cat WHERE slug='viyi'), 'Фарбування вій', NULL, 30,
    '[{"label":null,"price":300}]', 1),
  ((SELECT id FROM cat WHERE slug='viyi'), 'Фарбування + ламінування', NULL, 60,
    '[{"label":null,"price":600}]', 2),

  -- Зачіски
  ((SELECT id FROM cat WHERE slug='zachisky'), 'Укладка на браш', 'Миття + догляд', 60,
    '[{"label":"1-ша","price":400},{"label":"2-га","price":500},{"label":"3-тя","price":600}]', 1),
  ((SELECT id FROM cat WHERE slug='zachisky'), 'Накрутка локони', 'Без миття волосся', 60,
    '[{"label":"1-ша","price":400},{"label":"2-га","price":500},{"label":"3-тя","price":600}]', 2),
  ((SELECT id FROM cat WHERE slug='zachisky'), 'Накрутка афро-локони', NULL, 75,
    '[{"label":"1-ша","price":600},{"label":"2-га","price":700},{"label":"3-тя","price":800}]', 3),
  ((SELECT id FROM cat WHERE slug='zachisky'), 'Зачіска', NULL, 60,
    '[{"label":"1-ша","price":600},{"label":"2-га","price":700},{"label":"3-тя","price":800}]', 4),
  ((SELECT id FROM cat WHERE slug='zachisky'), 'Зачіска Весільна', NULL, 90,
    '[{"label":"1-ша","price":1200},{"label":"2-га","price":1400},{"label":"3-тя","price":1500}]', 5),

  -- Макіяж
  ((SELECT id FROM cat WHERE slug='makiyazh'), 'Макіяж-Експрес', NULL, 30,
    '[{"label":null,"price":500}]', 1),
  ((SELECT id FROM cat WHERE slug='makiyazh'), 'Макіяж Денний', NULL, 60,
    '[{"label":null,"price":600}]', 2),
  ((SELECT id FROM cat WHERE slug='makiyazh'), 'Макіяж Вечірній', NULL, 60,
    '[{"label":null,"price":800}]', 3),
  ((SELECT id FROM cat WHERE slug='makiyazh'), 'Макіяж Випускний', NULL, 60,
    '[{"label":null,"price":800}]', 4),
  ((SELECT id FROM cat WHERE slug='makiyazh'), 'Макіяж Весільний', NULL, 90,
    '[{"label":null,"price":1000}]', 5),
  ((SELECT id FROM cat WHERE slug='makiyazh'), 'Макіяж до 10:00 години', NULL, 60,
    '[{"label":null,"price":1000}]', 6),

  -- Чоловічі
  ((SELECT id FROM cat WHERE slug='cholovichi'), 'Стрижка однією насадкою', NULL, 20,
    '[{"label":null,"price":300}]', 1),
  ((SELECT id FROM cat WHERE slug='cholovichi'), 'Стрижка модельна', NULL, 40,
    '[{"label":null,"price":400}]', 2),
  ((SELECT id FROM cat WHERE slug='cholovichi'), 'Стрижка бороди', NULL, 20,
    '[{"label":null,"price":200}]', 3),
  ((SELECT id FROM cat WHERE slug='cholovichi'), 'Камуфляж сивини', NULL, 30,
    '[{"label":null,"price":200}]', 4),
  ((SELECT id FROM cat WHERE slug='cholovichi'), 'Чоловіча корекція воском', NULL, 15,
    '[{"label":null,"price":100}]', 5);

-- Майстер за замовчуванням з усіма категоріями
INSERT INTO public.masters (name, bio, specialties, order_index)
SELECT 'Майстер салону', 'Майстер з широким спектром послуг', ARRAY_AGG(id), 1
FROM public.service_categories;

-- Графік: щодня 9-20 для всіх майстрів
INSERT INTO public.master_schedule (master_id, weekday, start_time, end_time, is_working)
SELECT m.id, g.day, '09:00'::time, '20:00'::time, true
FROM public.masters m
CROSS JOIN generate_series(0, 6) AS g(day);
