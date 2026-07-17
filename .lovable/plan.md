## Що будуємо

Спільна база товарів між магазинами **Підземка** і **Салон**. Скануєш штрих-код апаратним сканером → якщо товар уже є в базі (фото, назва, бренд, опис) → лише вводиш ціну та залишок для свого магазину. Якщо немає — створюєш через AI-сканер фото, і він автоматично стає доступним обом магазинам.

---

## Структура БД

**Нові таблиці:**

1. **`shops`** — `name`, `slug`, `owner_user_id`. Засіємо двома: Підземка, Салон.
2. **`shop_members`** — `shop_id`, `user_id`, `role` (owner / admin / staff). Визначає, до яких магазинів має доступ адмін.
3. **`catalog_products`** — СПІЛЬНА база, ключ `barcode` (унікальний). Поля: `name`, `brand`, `category_id`, `description`, `ingredients`, `usage_instructions`, `skin_type`, `image_url`, `image_hover`, `created_by_shop_id`, `verified` (bool).
4. **`shop_inventory`** — те, що конкретний магазин продає: `(shop_id, barcode)` унікальний ключ → `price`, `cost_price`, `stock_quantity`, `is_active`, `custom_name` (необовʼязковий override).

**Існуюча таблиця `products`** наразі НЕ чіпається — публічна вітрина Karamellu продовжує працювати з неї. На наступному кроці (окремо) перенесемо публічний каталог на `shop_inventory + catalog_products`.

**RLS:**
- `catalog_products`: SELECT для всіх автентифікованих (база спільна), INSERT/UPDATE для будь-якого `shop_member`.
- `shop_inventory`: SELECT/INSERT/UPDATE/DELETE лише для members свого `shop_id` (security definer функція `is_shop_member(user_id, shop_id)`).
- `shops` / `shop_members`: SELECT для членів магазину, керування — для owner/admin.

---

## UI: нова сторінка `/admin/scanner`

```text
┌───────────────────────────────────────────────┐
│  Магазин: [ Підземка ▼ ]                      │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │  📷  Наведіть сканер і натисніть курок  │  │
│  │       [_________________________]       │  │  ← autofocus input
│  └─────────────────────────────────────────┘  │
│                                               │
│  Останні: 4820...891 ✓  | 5901...123 + new   │
└───────────────────────────────────────────────┘
```

Поведінка:
- Hardware-сканер працює як клавіатура: вводить цифри + Enter. Input з autofocus, при Enter викликає lookup.
- **Знайдено в catalog** → картка з фото/назвою/брендом + форма: `Ціна`, `Закупка`, `Залишок`. Кнопка **«Додати в [Підземка/Салон]»** → upsert у `shop_inventory`. Якщо вже є — показую поточні значення, можна оновити.
- **НЕ знайдено** → дві кнопки:
  - **«Сканувати фото з AI»** — відкриває існуючий `AIProductScanner`, після аналізу зберігає в `catalog_products` (з цим barcode) + одразу в `shop_inventory` поточного магазину.
  - **«Ввести вручну»** — мінімальна форма (назва, бренд) + збереження в `catalog_products`.

Перемикач магазину в хедері адмінки — глобальний стейт `active_shop_id` (zustand або context, зберігається в localStorage).

---

## Сторінки адмінки (нові/оновлені)

- **`/admin/scanner`** — основний робочий екран (нова).
- **`/admin/inventory`** — таблиця інвентарю активного магазину: barcode, фото, назва, ціна, залишок, дії (нова, замість поточної `AdminProducts` для нової логіки; стара лишається доступною).
- **`/admin/shops`** — лише для owner: список магазинів, додавання співробітників за email/Telegram (нова).
- **Хедер AdminLayout** — селектор `active_shop_id`.

---

## Backend

- **Edge function `barcode-lookup`** (verify_jwt=true): `GET ?barcode=...&shop_id=...` → `{ catalog: {...} | null, inventory: {...} | null }`. Один round-trip замість двох клієнтських запитів.
- CSV-імпорт (`ProductImporter`) оновимо: тепер пише в `catalog_products` + `shop_inventory` поточного магазину.

---

## Сід-дані

Міграція засіває:
- `shops`: «Підземка» (slug: `pidzemka`), «Салон» (slug: `salon`).
- `shop_members`: поточного admin-користувача додає owner до обох.

---

## Що НЕ робимо в цьому кроці

- Публічна вітрина Karamellu (ShopPage, ProductPage) залишається на старій `products`. Міграцію зробимо окремим завданням після того, як ви наповните `catalog_products` через сканер.
- Жодного SaaS-онбордингу/білінгу — магазини додаються вручну.
- Telegram-бот не чіпається.

---

## Файли (орієнтовно)

**Створити:**
- Міграція: `shops`, `shop_members`, `catalog_products`, `shop_inventory`, `is_shop_member()`, RLS, сід.
- `supabase/functions/barcode-lookup/index.ts`
- `src/context/ShopContext.tsx` (active_shop_id)
- `src/pages/admin/AdminScanner.tsx`
- `src/pages/admin/AdminInventory.tsx`
- `src/pages/admin/AdminShops.tsx`
- `src/components/admin/ShopSwitcher.tsx`
- `src/components/admin/BarcodeInput.tsx`
- `src/components/admin/CatalogProductCard.tsx`

**Оновити:**
- `src/pages/admin/AdminLayout.tsx` — додати ShopSwitcher + пункти меню.
- `src/components/admin/AIProductScanner.tsx` — після аналізу записувати в `catalog_products` (з barcode-параметром).
- `src/App.tsx` — нові роути.

---

## Прийняття

Готово, коли:
1. У хедері адмінки можна перемикати Підземка ↔ Салон.
2. На `/admin/scanner` натискання курка апаратного сканера за <1 сек показує картку товару (якщо є) або пропонує створити.
3. Один товар з одним barcode може мати РІЗНУ ціну та залишок у Підземці й Салоні.
4. AI-сканер фото створює запис у спільному каталозі, видимому обом магазинам.
