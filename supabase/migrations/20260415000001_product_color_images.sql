-- Add color_images JSONB column to products
-- Stores array of { color: string, image_url: string } objects
-- e.g. [{"color":"Gold","image_url":"https://..."},{"color":"Silver","image_url":"https://..."}]

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS color_images JSONB NOT NULL DEFAULT '[]'::jsonb;
