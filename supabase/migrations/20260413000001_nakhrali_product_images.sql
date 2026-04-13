-- ============================================================
-- Nakhrali Product Images
-- Assigns Unsplash jewellery photos by category
-- ============================================================

-- Necklaces — ornate Indian gold bridal sets
UPDATE public.products
SET image_url = CASE sku
  WHEN 'NK-JW005' THEN 'https://images.unsplash.com/photo-1601121141461-9d6647bef0a1?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW009' THEN 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW010' THEN 'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW011' THEN 'https://images.unsplash.com/photo-1614585198698-c47a5c3e2b51?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW012' THEN 'https://images.unsplash.com/photo-1601121141461-9d6647bef0a1?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW014' THEN 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW016' THEN 'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW019' THEN 'https://images.unsplash.com/photo-1614585198698-c47a5c3e2b51?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW020' THEN 'https://images.unsplash.com/photo-1601121141461-9d6647bef0a1?w=600&h=600&fit=crop&q=80'
  ELSE image_url
END
WHERE category_id = (SELECT id FROM public.categories WHERE name = 'Necklaces');

-- Earrings — gold drop and chandelier earrings
UPDATE public.products
SET image_url = CASE sku
  WHEN 'NK-JW002' THEN 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW006' THEN 'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW007' THEN 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW008' THEN 'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW013' THEN 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW015' THEN 'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW018' THEN 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW022' THEN 'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=600&h=600&fit=crop&q=80'
  ELSE image_url
END
WHERE category_id = (SELECT id FROM public.categories WHERE name = 'Earrings');

-- Rings — rose gold and zircon rings
UPDATE public.products
SET image_url = CASE sku
  WHEN 'NK-JW003' THEN 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW004' THEN 'https://images.unsplash.com/photo-1603047030945-e49cf0fb0e41?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW021' THEN 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&h=600&fit=crop&q=80'
  ELSE image_url
END
WHERE category_id = (SELECT id FROM public.categories WHERE name = 'Rings');

-- Bracelets — gold chain and pearl bracelets
UPDATE public.products
SET image_url = CASE sku
  WHEN 'NK-JW001' THEN 'https://images.unsplash.com/photo-1553935338-dab85eb3d5e5?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW025' THEN 'https://images.unsplash.com/photo-1630997035025-c75ef7c4db04?w=600&h=600&fit=crop&q=80'
  ELSE image_url
END
WHERE category_id = (SELECT id FROM public.categories WHERE name = 'Bracelets');

-- Bangles & Cuffs — gold bangles
UPDATE public.products
SET image_url = CASE sku
  WHEN 'NK-JW017' THEN 'https://images.unsplash.com/photo-1576022319765-c55a5c71c30f?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW023' THEN 'https://images.unsplash.com/photo-1603047030945-e49cf0fb0e41?w=600&h=600&fit=crop&q=80'
  WHEN 'NK-JW024' THEN 'https://images.unsplash.com/photo-1576022319765-c55a5c71c30f?w=600&h=600&fit=crop&q=80'
  ELSE image_url
END
WHERE category_id = (SELECT id FROM public.categories WHERE name = 'Bangles & Cuffs');

-- Choker Sets — layered chokers
UPDATE public.products
SET image_url = CASE sku
  WHEN 'NK-JW026' THEN 'https://images.unsplash.com/photo-1573408301185-9519f94804f1?w=600&h=600&fit=crop&q=80'
  ELSE image_url
END
WHERE category_id = (SELECT id FROM public.categories WHERE name = 'Choker Sets');
