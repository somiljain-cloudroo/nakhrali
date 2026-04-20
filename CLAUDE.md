# Nakhrali — Project Notes

## Git remotes

- **Deploy / production repo:** `nakhrali` → https://github.com/somiljain-cloudroo/nakhrali
- `origin` (snfoods-order-flow) is legacy — do NOT push to it.

When pushing: `git push nakhrali main`. The EC2 deploy workflow
(`.github/workflows/deploy.yml`) runs from the `nakhrali` repo on push to `main`.

## Project

- Nakhrali — handcrafted Indian heritage jewellery storefront (26 products).
- Stack: Vite + React + TypeScript + Tailwind + shadcn/ui + Supabase.
- Live site: https://nakhrali.com.au
- Currency: AUD.
