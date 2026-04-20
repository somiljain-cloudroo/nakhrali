-- Update prices (column U — Sell Price 50% Margin AUD) and stock
-- quantities (column L — QTY) from the Nakhrali costing sheet.
-- Marks every product inactive so they can be staggered back to live
-- one batch at a time.

UPDATE public.products SET price = 5.28,  stock_quantity = 2, is_active = false WHERE sku = 'NK-JW001';
UPDATE public.products SET price = 5.28,  stock_quantity = 2, is_active = false WHERE sku = 'NK-JW002';
UPDATE public.products SET price = 5.28,  stock_quantity = 3, is_active = false WHERE sku = 'NK-JW003';
UPDATE public.products SET price = 5.28,  stock_quantity = 4, is_active = false WHERE sku = 'NK-JW004';
UPDATE public.products SET price = 65.54, stock_quantity = 2, is_active = false WHERE sku = 'NK-JW005';
UPDATE public.products SET price = 6.55,  stock_quantity = 2, is_active = false WHERE sku = 'NK-JW006';
UPDATE public.products SET price = 6.55,  stock_quantity = 2, is_active = false WHERE sku = 'NK-JW007';
UPDATE public.products SET price = 9.83,  stock_quantity = 3, is_active = false WHERE sku = 'NK-JW008';
UPDATE public.products SET price = 44.79, stock_quantity = 2, is_active = false WHERE sku = 'NK-JW009';
UPDATE public.products SET price = 44.79, stock_quantity = 2, is_active = false WHERE sku = 'NK-JW010';
UPDATE public.products SET price = 44.79, stock_quantity = 3, is_active = false WHERE sku = 'NK-JW011';
UPDATE public.products SET price = 60.08, stock_quantity = 2, is_active = false WHERE sku = 'NK-JW012';
UPDATE public.products SET price = 60.08, stock_quantity = 2, is_active = false WHERE sku = 'NK-JW013';
UPDATE public.products SET price = 60.08, stock_quantity = 1, is_active = false WHERE sku = 'NK-JW014';
UPDATE public.products SET price = 24.03, stock_quantity = 3, is_active = false WHERE sku = 'NK-JW015';
UPDATE public.products SET price = 24.03, stock_quantity = 2, is_active = false WHERE sku = 'NK-JW016';
UPDATE public.products SET price = 8.74,  stock_quantity = 4, is_active = false WHERE sku = 'NK-JW017';
UPDATE public.products SET price = 7.65,  stock_quantity = 4, is_active = false WHERE sku = 'NK-JW018';
UPDATE public.products SET price = 9.83,  stock_quantity = 2, is_active = false WHERE sku = 'NK-JW019';
UPDATE public.products SET price = 9.83,  stock_quantity = 1, is_active = false WHERE sku = 'NK-JW020';
UPDATE public.products SET price = 17.48, stock_quantity = 2, is_active = false WHERE sku = 'NK-JW021';
UPDATE public.products SET price = 17.48, stock_quantity = 2, is_active = false WHERE sku = 'NK-JW022';
UPDATE public.products SET price = 28.40, stock_quantity = 4, is_active = false WHERE sku = 'NK-JW023';
UPDATE public.products SET price = 28.40, stock_quantity = 4, is_active = false WHERE sku = 'NK-JW024';
UPDATE public.products SET price = 8.92,  stock_quantity = 2, is_active = false WHERE sku = 'NK-JW025';
UPDATE public.products SET price = 13.11, stock_quantity = 3, is_active = false WHERE sku = 'NK-JW026';

-- New products from the costing sheet (JW027-JW030). All inactive by default.
INSERT INTO public.products
  (name, description, brand, category_id, sku, price, unit, min_order_quantity, stock_quantity, is_active)
VALUES
  (
    'Abha',
    'The Iridescent Shore. Where abalone meets pearl, the shore becomes a gallery. Abha is iridescence given form — baroque mother-of-pearl tiles and freshwater rounds in gold, a set made for garden weddings, engagement brunches, and the quietly spectacular. Coastal luxe at its most poetic.',
    'Nakhrali',
    (SELECT id FROM public.categories WHERE name = 'Necklaces'),
    'NK-JW027', 28.40, 'set', 1, 2, false
  ),
  (
    'Navgrah',
    'The Nine Planets. Nine sacred planets, nine radiant gems — all orbiting the one who wears them. Navgrah is ancient knowledge worn as adornment: a Heritage Navratan ring set carrying centuries of meaning in every stone. For weddings, for festivals, for the days that hold weight.',
    'Nakhrali',
    (SELECT id FROM public.categories WHERE name = 'Rings'),
    'NK-JW028', 5.28, 'set', 1, 4, false
  ),
  (
    'Mridula',
    'The Gentle Earth. There is a royalty that is not loud. It is grounded. Warm. Ancient. Mridula holds the earth''s palette — teal, amber, terracotta, forest, cream — in cats-eye ovals with seed pearls in gold. For Mehendi mornings, summer weddings, and heritage days dressed in beauty.',
    'Nakhrali',
    (SELECT id FROM public.categories WHERE name = 'Rings'),
    'NK-JW029', 17.48, 'piece', 1, 1, false
  ),
  (
    'Aranya',
    'The Royal Forest. A forest is never just one thing — it is layers, depth, mystery, and life all at once. Aranya is that complexity made wearable: Polki, Navratan cabochons, and a simulated emerald hexagonal centrepiece in antique gold. For Bridal tables, Grand Receptions, and every occasion that deserves a ring with a story.',
    'Nakhrali',
    (SELECT id FROM public.categories WHERE name = 'Rings'),
    'NK-JW030', 17.48, 'piece', 1, 3, false
  );
