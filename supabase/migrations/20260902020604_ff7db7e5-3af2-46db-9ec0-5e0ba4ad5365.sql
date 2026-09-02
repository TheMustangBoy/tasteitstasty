-- =========================================================
-- Tasty Truck Orders – zentrale Datenhaltung
-- =========================================================

-- updated_at Trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ---------- Kategorien ----------
CREATE TABLE public.categories (
  id text PRIMARY KEY,
  label text NOT NULL,
  note text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories offen (kein auth vorhanden)" ON public.categories
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Zutaten ----------
CREATE TABLE public.ingredients (
  id text PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredients TO anon, authenticated;
GRANT ALL ON public.ingredients TO service_role;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingredients offen (kein auth vorhanden)" ON public.ingredients
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER ingredients_updated_at BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Extras ----------
CREATE TABLE public.extras (
  id text PRIMARY KEY,
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extras TO anon, authenticated;
GRANT ALL ON public.extras TO service_role;
ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "extras offen (kein auth vorhanden)" ON public.extras
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER extras_updated_at BEFORE UPDATE ON public.extras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Produkte ----------
CREATE TABLE public.products (
  id text PRIMARY KEY,
  name text NOT NULL,
  category_id text NOT NULL REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  description text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sold_out boolean NOT NULL DEFAULT false,
  patties integer,
  ingredients text[] NOT NULL DEFAULT '{}',
  removable text[] NOT NULL DEFAULT '{}',
  extra_ids text[] NOT NULL DEFAULT '{}',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  tag text NOT NULL DEFAULT '',
  vegetarian boolean NOT NULL DEFAULT false,
  ingredients_placeholder boolean NOT NULL DEFAULT false,
  sort_order numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_sort_idx ON public.products (category_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products offen (kein auth vorhanden)" ON public.products
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Shop-Einstellungen (Einzelzeile) ----------
CREATE TABLE public.shop_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  orders_paused boolean NOT NULL DEFAULT false,
  wheel_sound_on boolean NOT NULL DEFAULT true,
  min_lead_minutes integer NOT NULL DEFAULT 15,
  max_orders_per_slot integer NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.shop_settings TO anon, authenticated;
GRANT ALL ON public.shop_settings TO service_role;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings offen (kein auth vorhanden)" ON public.shop_settings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER shop_settings_updated_at BEFORE UPDATE ON public.shop_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Öffnungszeiten ----------
CREATE TABLE public.opening_hours (
  weekday integer PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
  open_time text NOT NULL DEFAULT '11:00',
  close_time text NOT NULL DEFAULT '18:00',
  closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.opening_hours TO anon, authenticated;
GRANT ALL ON public.opening_hours TO service_role;
ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hours offen (kein auth vorhanden)" ON public.opening_hours
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER opening_hours_updated_at BEFORE UPDATE ON public.opening_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Bestellungen ----------
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  pickup_at timestamptz NOT NULL,
  pickup_label text NOT NULL DEFAULT '',
  payment text NOT NULL DEFAULT '',
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'neu'
    CHECK (status IN ('neu','angenommen','zubereitung','abholbereit','abgeschlossen','abgelehnt','storniert')),
  note text NOT NULL DEFAULT '',
  internal_note text NOT NULL DEFAULT '',
  cancel_reason text,
  cancel_note text,
  status_timestamps jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_pickup_idx ON public.orders (pickup_at);
CREATE INDEX orders_status_idx ON public.orders (status);
CREATE INDEX orders_created_idx ON public.orders (created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.orders TO anon, authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders offen (kein auth vorhanden)" ON public.orders
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Atomare Slot-Reservierung ----------
CREATE OR REPLACE FUNCTION public.place_order(
  p_reference text,
  p_customer_name text,
  p_phone text,
  p_pickup_at timestamptz,
  p_pickup_label text,
  p_payment text,
  p_lines jsonb,
  p_total numeric,
  p_note text DEFAULT ''
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer;
  v_paused boolean;
  v_count integer;
  v_row public.orders;
BEGIN
  SELECT max_orders_per_slot, orders_paused INTO v_max, v_paused
    FROM public.shop_settings WHERE id = 1;
  v_max := COALESCE(v_max, 4);

  IF COALESCE(v_paused, false) THEN
    RAISE EXCEPTION 'ORDERS_PAUSED';
  END IF;

  -- Sperre pro Abholzeitpunkt, damit parallele Bestellungen serialisiert werden.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_pickup_at::text, 0));

  SELECT count(*) INTO v_count FROM public.orders
   WHERE pickup_at = p_pickup_at
     AND status NOT IN ('abgelehnt','storniert');

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'SLOT_FULL';
  END IF;

  INSERT INTO public.orders (reference, customer_name, phone, pickup_at, pickup_label,
                             payment, lines, total, note)
  VALUES (p_reference, p_customer_name, p_phone, p_pickup_at, p_pickup_label,
          p_payment, p_lines, p_total, COALESCE(p_note, ''))
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.place_order(text,text,text,timestamptz,text,text,jsonb,numeric,text) FROM public;
GRANT EXECUTE ON FUNCTION public.place_order(text,text,text,timestamptz,text,text,jsonb,numeric,text) TO anon, authenticated, service_role;

-- =========================================================
-- Startdaten
-- =========================================================
INSERT INTO public.shop_settings (id) VALUES (1);

INSERT INTO public.opening_hours (weekday, open_time, close_time, closed) VALUES
  (0,'11:00','18:00',true),
  (1,'11:00','18:00',false),
  (2,'11:00','18:00',false),
  (3,'11:00','18:00',false),
  (4,'11:00','18:00',false),
  (5,'11:00','18:00',false),
  (6,'11:00','18:00',false);

INSERT INTO public.categories (id, label, note, sort_order) VALUES
  ('burger','Burger','Alle Fleischburger standardmäßig mit Double Patty – Tripple Smash mit drei Patties.',0),
  ('beilagen','Beilagen','Frisch frittiert, immer knusprig.',1);

INSERT INTO public.ingredients (id, name, sort_order) VALUES
  ('geschmorte-zwiebeln','Geschmorte Zwiebeln',0),
  ('gurke','Gurke',1),
  ('jalapenos','Jalapeños',2),
  ('kaese','Käse',3),
  ('ketchup','Ketchup',4),
  ('salat','Salat',5),
  ('senf','Senf',6),
  ('sosse','Soße',7),
  ('tomate','Tomate',8),
  ('zwiebel','Zwiebel',9);

INSERT INTO public.extras (id, name, price, sort_order) VALUES
  ('bacon','Bacon',1.00,0),
  ('extra-cheese','Extra Käse',1.00,1),
  ('extra-jalapenos','Extra Jalapeños',0.50,2),
  ('extra-patty','Extra Patty',2.50,3);

INSERT INTO public.products
  (id, name, category_id, description, price, patties, ingredients, removable, extra_ids, tag, vegetarian, ingredients_placeholder, sort_order) VALUES
  ('smash-burger','Smash Burger','burger','',7.50,2,ARRAY['Zwiebel','Tomate','Gurke'],ARRAY['Zwiebel','Tomate','Gurke'],ARRAY['bacon','extra-cheese','extra-patty'],'Klassiker',false,false,0),
  ('tripple-smash','Tripple Smash','burger','',10.50,3,ARRAY['Zwiebel','Tomate','Gurke'],ARRAY['Zwiebel','Tomate','Gurke'],ARRAY['bacon','extra-cheese','extra-patty'],'3 Patties',false,false,1),
  ('chili-cheese','Chili Cheese','burger','',8.50,2,ARRAY['Gurke','Tomate','Zwiebel','Jalapeños'],ARRAY['Gurke','Tomate','Zwiebel','Jalapeños'],ARRAY['bacon','extra-cheese','extra-patty'],'Scharf',false,false,2),
  ('oklahoma-smash','Oklahoma Smash','burger','',8.50,2,ARRAY['Gurke','Ketchup','Senf','Geschmorte Zwiebeln'],ARRAY['Gurke'],ARRAY['bacon','extra-cheese','extra-patty'],'',false,false,3),
  ('bbq-smash','BBQ Smash','burger','',7.50,2,ARRAY['Zwiebel','Tomate','Gurke'],ARRAY['Zwiebel','Tomate','Gurke'],ARRAY['bacon','extra-cheese','extra-patty'],'',false,false,4),
  ('trueffel-smash','Trüffel Smash','burger','',9.50,2,ARRAY['Salat','Zwiebel','Gurke','Tomate'],ARRAY['Salat','Zwiebel','Gurke','Tomate'],ARRAY['bacon','extra-cheese','extra-patty'],'Premium',false,false,5),
  ('chicken-burger','Chicken Burger','burger','',8.50,NULL,ARRAY['Salat','Zwiebel','Gurke','Tomate'],ARRAY['Salat','Zwiebel','Gurke','Tomate'],ARRAY['bacon','extra-cheese','extra-patty'],'',false,false,6),
  ('tasty-burger','Tasty Burger','burger','',8.50,2,ARRAY[]::text[],ARRAY[]::text[],ARRAY['bacon','extra-cheese','extra-patty'],'',false,true,7),
  ('veggie-burger','Veggie Burger','burger','',7.50,NULL,ARRAY['Salat','Zwiebel','Gurke','Tomate'],ARRAY['Salat','Zwiebel','Gurke','Tomate'],ARRAY['bacon','extra-cheese','extra-patty'],'',true,false,8),
  ('pommes','Pommes','beilagen','',3.50,NULL,ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[],'',false,false,9),
  ('suesskartoffel-pommes','Süßkartoffel-Pommes','beilagen','',4.50,NULL,ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[],'',false,false,10),
  ('curly-fries','Curly Fries','beilagen','',4.50,NULL,ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[],'',false,false,11),
  ('trueffel-fries','Trüffel Fries','beilagen','',6.50,NULL,ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[],'',false,false,12);
