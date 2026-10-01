-- =============================================================================
-- Irie's Cuisine — SAMPLE data so the app is usable on day one.
-- Every price, zone, fee and opening hour below is a placeholder: edit them in
-- Admin → Menu / Settings before launch (or change this file before seeding).
-- Prices are in pesewas: 8500 = GHS 85.00
-- =============================================================================

-- Store settings ---------------------------------------------------------------
update public.store_settings set
  store_name = 'Irie''s Cuisine',
  pickup_address = 'Adenta, Accra (exact pickup point shared after payment)',
  pickup_lat = 5.7084,
  pickup_lng = -0.1634,
  support_phone = '+233200000000',
  whatsapp_number = '+233200000000',
  default_prep_minutes = 25
where id = 1;

-- Opening hours (0 = Sunday) ---------------------------------------------------
insert into public.opening_hours (day_of_week, opens_at, closes_at) values
  (1, '10:00', '21:30'),
  (2, '10:00', '21:30'),
  (3, '10:00', '21:30'),
  (4, '10:00', '21:30'),
  (5, '10:00', '22:00'),
  (6, '10:00', '22:00'),
  (0, '12:00', '20:00');

-- Delivery zones around Adenta -------------------------------------------------
insert into public.delivery_zones (name, areas, fee_pesewas, min_order_pesewas, eta_minutes, sort_order) values
  ('Adenta',            'Adenta Housing Down, SSNIT Flats, Adenta Barrier, Frafraha', 1500, 5000, 30, 1),
  ('Madina & Ashaley Botwe', 'Madina, Zongo Junction, Ashaley Botwe, Lakeside',   2500, 6000, 40, 2),
  ('Oyarifa & Dodowa Rd', 'Oyarifa, Ayimensah, Danfa Rd, Teiman',                 3000, 7000, 45, 3),
  ('East Legon & Haatso', 'East Legon, American House, Haatso, Ashongman',         4000, 8000, 50, 4),
  ('Spintex & Tema Mtwy', 'Spintex Rd, Baatsona, Sakumono',                        5000, 10000, 60, 5);

-- Modifier groups --------------------------------------------------------------
with g as (
  insert into public.modifier_groups (name, kind, min_select, max_select, sort_order) values
    ('Spice level',    'spice', 1, 1, 1),
    ('Extra protein',  'addon', 0, 3, 2),
    ('Sides',          'addon', 0, 3, 3),
    ('Waakye extras',  'addon', 0, 4, 4)
  returning id, name
)
insert into public.modifier_options (group_id, name, price_pesewas, is_default, sort_order)
select g.id, o.name, o.price, o.is_default, o.sort_order
from g
join (values
  ('Spice level',   'Mild',             0,    false, 1),
  ('Spice level',   'Medium',           0,    true,  2),
  ('Spice level',   'Hot',              0,    false, 3),
  ('Spice level',   'Irie hot (very hot)', 0, false, 4),
  ('Extra protein', 'Grilled chicken',  3000, false, 1),
  ('Extra protein', 'Fried fish',       2500, false, 2),
  ('Extra protein', 'Boiled egg',        500, false, 3),
  ('Extra protein', 'Wele (cow skin)',  1000, false, 4),
  ('Extra protein', 'Gizzard',          2000, false, 5),
  ('Sides',         'Kelewele',         1500, false, 1),
  ('Sides',         'Fried plantain',   1200, false, 2),
  ('Sides',         'Coleslaw',         1000, false, 3),
  ('Sides',         'Extra shito',       500, false, 4),
  ('Waakye extras', 'Gari',              300, false, 1),
  ('Waakye extras', 'Talia (spaghetti)', 500, false, 2),
  ('Waakye extras', 'Avocado (seasonal)', 1000, false, 3),
  ('Waakye extras', 'Extra stew',        500, false, 4)
) as o(group_name, name, price, is_default, sort_order) on o.group_name = g.name;

-- Categories -------------------------------------------------------------------
insert into public.categories (name, slug, description, sort_order) values
  ('Rice dishes',        'rice-dishes',   'Party-style jollof, fried rice and waakye', 1),
  ('Local favourites',   'local-favourites', 'Banku, fufu, kenkey and more — cooked the home way', 2),
  ('Grills & sides',     'grills-sides',  'Charcoal-grilled proteins and sides', 3),
  ('Drinks',             'drinks',        'Chilled local drinks, made fresh', 4),
  ('Small chops & sweet','small-chops',   'Bofrot, kelewele and treats', 5);

-- Menu items -------------------------------------------------------------------
insert into public.menu_items (category_id, name, slug, description, is_featured, dietary_tags, sort_order)
select c.id, i.name, i.slug, i.description, i.featured, i.tags, i.sort_order
from (values
  ('rice-dishes', 'Irie''s Jollof with Grilled Chicken', 'jollof-grilled-chicken',
     'Smoky party jollof, charcoal-grilled chicken, fried plantain and fresh salad.', true, array['contains_chicken'], 1),
  ('rice-dishes', 'Assorted Fried Rice', 'assorted-fried-rice',
     'Wok-fried rice with mixed vegetables, chicken, beef and prawns.', false, array['contains_shellfish'], 2),
  ('rice-dishes', 'Waakye Special', 'waakye-special',
     'Rice and beans with stew, shito, boiled egg and fried fish.', true, array['contains_fish', 'contains_egg'], 3),
  ('local-favourites', 'Banku & Grilled Tilapia', 'banku-grilled-tilapia',
     'Whole grilled tilapia with banku, fresh pepper and onions.', true, array['contains_fish'], 1),
  ('local-favourites', 'Fufu & Light Soup with Goat', 'fufu-light-soup-goat',
     'Pounded fufu with spicy light soup and tender goat meat.', false, array[]::text[], 2),
  ('local-favourites', 'Omo Tuo & Groundnut Soup', 'omo-tuo-groundnut-soup',
     'Rice balls with rich groundnut soup and chicken.', false, array['contains_peanuts'], 3),
  ('local-favourites', 'Red Red with Plantain', 'red-red-plantain',
     'Black-eyed bean stew in palm oil with ripe fried plantain and gari.', false, array['vegetarian'], 4),
  ('local-favourites', 'Kenkey with Fried Fish & Shito', 'kenkey-fried-fish',
     'Ga kenkey, crispy fried fish, fresh pepper and shito.', false, array['contains_fish'], 5),
  ('grills-sides', 'Charcoal Grilled Chicken', 'charcoal-grilled-chicken',
     'Marinated in Irie''s spice blend and grilled over charcoal.', false, array['contains_chicken'], 1),
  ('grills-sides', 'Kelewele', 'kelewele',
     'Spiced ripe plantain cubes, fried golden. Served with roasted peanuts.', false, array['vegetarian', 'contains_peanuts'], 2),
  ('drinks', 'Sobolo', 'sobolo',
     'Chilled hibiscus drink with ginger and cloves.', false, array['vegan'], 1),
  ('drinks', 'Pineapple Ginger Juice', 'pineapple-ginger',
     'Fresh-pressed pineapple with a ginger kick.', false, array['vegan'], 2),
  ('drinks', 'Asaana', 'asaana',
     'Caramelised fermented corn drink.', false, array['vegan'], 3),
  ('small-chops', 'Bofrot (6 pcs)', 'bofrot',
     'Warm Ghanaian puff-puff, lightly sweet.', false, array['vegetarian'], 1)
) as i(cat, name, slug, description, featured, tags, sort_order)
join public.categories c on c.slug = i.cat;

-- Portions (every item needs at least one) --------------------------------------
insert into public.menu_item_portions (menu_item_id, name, price_pesewas, is_default, sort_order)
select m.id, p.name, p.price, p.is_default, p.sort_order
from (values
  ('jollof-grilled-chicken', 'Regular', 8500, true, 1),
  ('jollof-grilled-chicken', 'Large', 11000, false, 2),
  ('jollof-grilled-chicken', 'Family platter (serves 4)', 38000, false, 3),
  ('assorted-fried-rice', 'Regular', 9000, true, 1),
  ('assorted-fried-rice', 'Large', 12000, false, 2),
  ('waakye-special', 'Regular', 7000, true, 1),
  ('waakye-special', 'Large', 9000, false, 2),
  ('banku-grilled-tilapia', 'Medium fish', 15000, true, 1),
  ('banku-grilled-tilapia', 'Large fish', 19000, false, 2),
  ('fufu-light-soup-goat', 'Regular', 11000, true, 1),
  ('omo-tuo-groundnut-soup', 'Regular', 10000, true, 1),
  ('red-red-plantain', 'Regular', 5500, true, 1),
  ('kenkey-fried-fish', 'Regular', 6000, true, 1),
  ('charcoal-grilled-chicken', 'Quarter', 4500, true, 1),
  ('charcoal-grilled-chicken', 'Half', 8000, false, 2),
  ('kelewele', 'Regular', 3000, true, 1),
  ('sobolo', '500 ml', 2000, true, 1),
  ('sobolo', '1 litre', 3500, false, 2),
  ('pineapple-ginger', '500 ml', 2500, true, 1),
  ('asaana', '500 ml', 2000, true, 1),
  ('bofrot', '6 pieces', 2000, true, 1)
) as p(slug, name, price, is_default, sort_order)
join public.menu_items m on m.slug = p.slug;

-- Attach modifier groups -------------------------------------------------------
insert into public.menu_item_modifier_groups (menu_item_id, group_id, sort_order)
select m.id, g.id, l.sort_order
from (values
  ('jollof-grilled-chicken', 'Spice level', 1),
  ('jollof-grilled-chicken', 'Extra protein', 2),
  ('jollof-grilled-chicken', 'Sides', 3),
  ('assorted-fried-rice', 'Spice level', 1),
  ('assorted-fried-rice', 'Extra protein', 2),
  ('assorted-fried-rice', 'Sides', 3),
  ('waakye-special', 'Spice level', 1),
  ('waakye-special', 'Waakye extras', 2),
  ('waakye-special', 'Extra protein', 3),
  ('banku-grilled-tilapia', 'Spice level', 1),
  ('banku-grilled-tilapia', 'Sides', 2),
  ('fufu-light-soup-goat', 'Spice level', 1),
  ('omo-tuo-groundnut-soup', 'Spice level', 1),
  ('omo-tuo-groundnut-soup', 'Extra protein', 2),
  ('red-red-plantain', 'Extra protein', 1),
  ('kenkey-fried-fish', 'Spice level', 1),
  ('charcoal-grilled-chicken', 'Spice level', 1),
  ('charcoal-grilled-chicken', 'Sides', 2)
) as l(slug, group_name, sort_order)
join public.menu_items m on m.slug = l.slug
join public.modifier_groups g on g.name = l.group_name;
