-- Rename Necklaces → Necklaces & Choker Sets
UPDATE public.categories
SET name = 'Necklaces & Choker Sets'
WHERE id = '3ddafade-1911-48df-9536-ac01bf80f52b';

-- Reassign all Choker Sets products to the merged category
UPDATE public.products
SET category_id = '3ddafade-1911-48df-9536-ac01bf80f52b'
WHERE category_id = '0557c492-95a4-4b09-abbd-ed339d86fc65';

-- Deactivate the now-empty Choker Sets category
UPDATE public.categories
SET is_active = false
WHERE id = '0557c492-95a4-4b09-abbd-ed339d86fc65';

-- Add new Studs category
INSERT INTO public.categories (name, description, is_active)
VALUES ('Studs', 'Stud earrings — handcrafted heritage designs', true)
ON CONFLICT DO NOTHING;
