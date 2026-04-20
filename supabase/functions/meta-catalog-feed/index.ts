// Meta / Facebook Product Catalog feed (Google Merchant XML format, which Meta also accepts)
// Public endpoint — Meta Commerce Manager fetches this on a schedule.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_URL = "https://nakhrali.com.au";
const CURRENCY = "AUD";
const BRAND = "Nakhrali";

const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const { data: products, error } = await supabase
    .from("products")
    .select("sku, name, description, price, stock_quantity, is_active, image_url, color_images, brand, category:categories(name)")
    .eq("is_active", true);

  if (error) {
    return new Response(`<?xml version="1.0"?><error>${escapeXml(error.message)}</error>`, {
      status: 500,
      headers: { "Content-Type": "application/xml" },
    });
  }

  const items = (products ?? [])
    .filter((p) => p.sku && p.image_url && p.price != null)
    .map((p) => {
      const availability = (p.stock_quantity ?? 0) > 0 ? "in stock" : "out of stock";
      const link = `${SITE_URL}/product/${encodeURIComponent(p.sku!)}`;
      const category = (p.category as { name?: string } | null)?.name ?? "Jewellery";
      const colorImages = Array.isArray(p.color_images)
        ? (p.color_images as { color: string; image_url: string }[])
        : [];
      const additional = colorImages
        .map((ci) => ci.image_url)
        .filter((u) => u && u !== p.image_url)
        .slice(0, 10)
        .map((u) => `    <g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`)
        .join("\n");

      return `  <item>
    <g:id>${escapeXml(p.sku!)}</g:id>
    <g:title>${escapeXml(p.name)}</g:title>
    <g:description>${escapeXml(p.description ?? p.name)}</g:description>
    <g:link>${escapeXml(link)}</g:link>
    <g:image_link>${escapeXml(p.image_url!)}</g:image_link>
${additional}
    <g:availability>${availability}</g:availability>
    <g:condition>new</g:condition>
    <g:price>${Number(p.price).toFixed(2)} ${CURRENCY}</g:price>
    <g:brand>${escapeXml(p.brand ?? BRAND)}</g:brand>
    <g:product_type>${escapeXml(category)}</g:product_type>
    <g:google_product_category>Apparel &amp; Accessories &gt; Jewelry</g:google_product_category>
    <g:identifier_exists>no</g:identifier_exists>
  </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>Nakhrali Product Catalog</title>
  <link>${SITE_URL}</link>
  <description>Handcrafted Indian heritage jewellery</description>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
