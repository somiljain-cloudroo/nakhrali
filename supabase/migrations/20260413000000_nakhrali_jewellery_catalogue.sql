-- ============================================================
-- Nakhrali Jewellery Catalogue
-- Replaces food data with 26 handcrafted jewellery pieces
-- ============================================================

-- Clear existing sample data (preserve schema + RLS policies)
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.products;
DELETE FROM public.categories;

-- ── Jewellery Categories ────────────────────────────────────
INSERT INTO public.categories (name, description, is_active) VALUES
('Necklaces',      'Statement necklace sets — bridal, festive & contemporary',              true),
('Earrings',       'Handcrafted earrings from classic studs to grand chandeliers',          true),
('Rings',          'Fine rings and stacking sets in rose gold & rhodium',                   true),
('Bracelets',      'Delicate bracelets and organic pearl collections',                      true),
('Bangles & Cuffs','Traditional bangles and contemporary statement cuffs',                  true),
('Choker Sets',    'Layered choker collections with cats-eye and seed pearl borders',       true);

-- ── 26 Jewellery Products ───────────────────────────────────
INSERT INTO public.products
  (name, description, brand, category_id, sku, price, unit, min_order_quantity, stock_quantity, is_active)
VALUES

-- BRACELETS
(
  'Ishara',
  'The Signal. Boho-contemporary bracelet strung with rough-cut Amethyst, Carnelian and Aquamarine on a gold-toned chain. Effortlessly layerable for casual and festival wear.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Bracelets'),
  'NK-JW001', 10.00, 'piece', 1, 10, true
),
(
  'Samudra',
  'The Ocean''s Edge. A bracelet and earrings set featuring baroque keshi/blister pearl squares alongside round freshwater pearls on gold-plated settings. Perfect for beach weddings and coastal aesthetics.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Bracelets'),
  'NK-JW025', 15.00, 'set', 1, 10, true
),

-- EARRINGS
(
  'Hira',
  'The Diamond Heart. Classic elegant earrings featuring white and clear crystal in a heart-shaped cut, set in gold-toned settings. A timeless choice for bridal and formal evenings.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Earrings'),
  'NK-JW002', 10.00, 'piece', 1, 10, true
),
(
  'Jal',
  'The Still Waters. Modern ethnic earrings featuring oval cabochon green cats-eye stones in gold-plated settings. Ideal for festive and Indo-western occasions.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Earrings'),
  'NK-JW006', 10.00, 'piece', 1, 10, true
),
(
  'Mayur',
  'The Peacock''s Song. Whimsical nature-inspired earrings threaded with seed and baroque freshwater pearls on gold-toned drops. Beautiful for bridal, sangeet and traditional ceremonies.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Earrings'),
  'NK-JW007', 15.00, 'piece', 1, 10, true
),
(
  'Chandni',
  'The Moonlit Cascade. Traditional bridal earrings with a mint green cats-eye teardrop and white polki/kundan centre on gold-plated drops. Crafted for sangeet, lehenga and festive events.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Earrings'),
  'NK-JW008', 20.00, 'piece', 1, 10, true
),
(
  'Vana',
  'The Forest Bells. Heritage temple jewellery earrings with triangular and hexagonal green onyx stones paired with freshwater pearls on antique gold-toned drops. Ideal for classical dance performances and bridal ceremonies.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Earrings'),
  'NK-JW013', 40.00, 'piece', 1, 10, true
),
(
  'Devika',
  'The Temple Dancer. Traditional earrings featuring blue sapphire glass, pink quartz glass and green onyx glass with polki accents on antique gold-toned settings. Perfect for festive, saree and cultural events.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Earrings'),
  'NK-JW015', 10.00, 'piece', 1, 10, true
),
(
  'Aarav',
  'The Celestial Orbit. Mughal-inspired statement earrings with a polki kundan centre surrounded by navratna stones — Ruby, Emerald, Sapphire, Citrine, Pink quartz and Teal — on antique gold-toned drops.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Earrings'),
  'NK-JW018', 10.00, 'piece', 1, 10, true
),
(
  'Rani',
  'The Ruby Rainstorm. Tribal-festive earrings featuring square ruby glass stones with seed pearls on antique gold-toned drops. A statement piece for sangeet, bridal and dance performances.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Earrings'),
  'NK-JW022', 20.00, 'piece', 1, 10, true
),

-- RINGS
(
  'Sitara',
  'The Star Bloom. Contemporary statement ring with a marquise rose quartz centre flanked by white zircon on rhodium-plated silver. Designed for cocktail parties and evening wear.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Rings'),
  'NK-JW003', 7.00, 'piece', 1, 10, true
),
(
  'Gulab',
  'The Rose Constellation. Vintage glamour ring with an oval rose quartz centre, white zircon accents and baguette stones on rhodium-plated silver. A stunning choice for formal and bridal occasions.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Rings'),
  'NK-JW004', 7.00, 'piece', 1, 10, true
),
(
  'Tara',
  'The Three Stars. A fine contemporary set of three rings — round rose quartz cabochon, polki/uncut diamond teardrop and white zircon halo — all in rose gold-plated settings. Perfect for engagement, cocktail and everyday luxury.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Rings'),
  'NK-JW021', 15.00, 'set', 1, 10, true
),

-- NECKLACES
(
  'Maharani',
  'The Queen''s Girdle. Royal bridal necklace and earrings set encrusted with Emerald, Ruby, multi-colour Navratna stones, uncut Polki diamonds and Pearls on gold-plated settings. Crafted for sangeet, lehenga and traditional ceremonies.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Necklaces'),
  'NK-JW005', 45.00, 'set', 1, 10, true
),
(
  'Panna',
  'The Emerald Throne. Mughal-royal bridal necklace and earrings set featuring rectangular emeralds with uncut polki/kundan diamonds on gold-plated settings. Designed for bridal, wedding receptions and traditional ceremonies.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Necklaces'),
  'NK-JW009', 35.00, 'set', 1, 10, true
),
(
  'Gulabi',
  'The Rose Garden. Contemporary bridal necklace and earrings set with rectangular rose quartz and uncut polki/kundan diamonds on gold-plated settings. Ideal for bridal, engagement and wedding occasions.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Necklaces'),
  'NK-JW010', 35.00, 'set', 1, 10, true
),
(
  'Vasant',
  'The Festival of Spring. Traditional festive necklace and earrings set with multi-colour navratna stones — Ruby, Emerald, Sapphire, Pink quartz, Teal and Amethyst — with Polki accents on gold-plated settings.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Necklaces'),
  'NK-JW011', 35.00, 'set', 1, 10, true
),
(
  'Navaratna',
  'Nine Sacred Gems. A vintage Mughal necklace and earrings set featuring all nine sacred stones — Ruby, Emerald, Amethyst, Sapphire, Pink quartz, Turquoise, Citrine and Pearls — on gold-plated settings. For grand weddings and festive events.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Necklaces'),
  'NK-JW012', 50.00, 'set', 1, 10, true
),
(
  'Bahar',
  'The Garden in Bloom. Delicate bridal necklace and earrings set with seed freshwater pearls, mint green cats-eye and polki kundan stones on gold-plated settings. Crafted for mehendi, engagement and day weddings.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Necklaces'),
  'NK-JW014', 45.00, 'set', 1, 10, true
),
(
  'Shahi',
  'The Royal Seal. Mughal heritage bridal necklace and earrings set with uncut polki diamonds in kundan-set and seed pearls on antique gold-plated settings. For traditional ceremonies and festive celebrations.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Necklaces'),
  'NK-JW016', 15.00, 'set', 1, 10, true
),
(
  'Gaja',
  'The Royal Procession. Temple-heritage necklace with uncut polki/kundan diamonds, rose quartz drops and freshwater pearls on antique matte gold. A sacred piece for bridal, puja and traditional ceremonies.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Necklaces'),
  'NK-JW019', 15.00, 'piece', 1, 10, true
),
(
  'Prism',
  'The Wandering Light. Contemporary boho necklace and earrings set featuring Blue topaz, Sapphire, Amethyst, Ruby, Aquamarine, Peridot and Iolite on gold-plated settings. Versatile for cocktail, casual glam and Indo-western occasions.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Necklaces'),
  'NK-JW020', 15.00, 'set', 1, 10, true
),

-- BANGLES & CUFFS
(
  'Lahar',
  'The Golden Wave. Traditional festive bangles featuring polki kundan in clear, ruby red and emerald green on gold-plated settings. Perfect for bridal stacking, sangeet and festive occasions.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Bangles & Cuffs'),
  'NK-JW017', 5.00, 'piece', 1, 10, true
),
(
  'Titli',
  'The Pearl Butterfly. A statement contemporary bangle/cuff with mother-of-pearl butterfly wings, emerald green heart-cut stones and polki kundan on gold-plated settings. Made for Indo-western cocktail and special events.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Bangles & Cuffs'),
  'NK-JW023', 25.00, 'piece', 1, 10, true
),
(
  'Ivory Garden',
  'The Garden Cuff. A luxury contemporary cuff featuring square mother of pearl, marquise pink quartz, polki kundan and white zircon on gold-plated settings. Designed for bridal, formal evenings and receptions.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Bangles & Cuffs'),
  'NK-JW024', 25.00, 'piece', 1, 10, true
),

-- CHOKER SETS
(
  'Nazar',
  'The Enchanted Eye. A set of three boho chokers featuring cats-eye cabochons — Teal/Aquamarine, multicolour (grey, cream, amber, teal, orange) and forest green — on gold-plated chains with seed pearl borders. Ideal for festive, casual ethnic and Indo-western styling.',
  'Nakhrali',
  (SELECT id FROM public.categories WHERE name = 'Choker Sets'),
  'NK-JW026', 20.00, 'set', 1, 10, true
);
