# Nakhrali — Project Notes

## Git remotes

- **Deploy / production repo:** `nakhrali` → https://github.com/somiljain-cloudroo/nakhrali
- `origin` (snfoods-order-flow) is legacy — do NOT push to it.

When pushing: `git push nakhrali main`. The EC2 deploy workflow
(`.github/workflows/deploy.yml`) runs from the `nakhrali` repo on push to `main`.

## Project

- Nakhrali — handcrafted Indian heritage jewellery storefront (26 products, 26 active).
- Stack: Vite + React + TypeScript + Tailwind + shadcn/ui + Supabase.
- Live site: https://nakhrali.com.au
- Currency: AUD. GST is included in all listed prices (no separate GST line).
- Supabase project ref: `swfyybcczjkwjbddzfgd`

## EC2 Deploy

- `.github/workflows/deploy.yml` uses `git fetch origin && git reset --hard origin/main` (NOT `git pull`) to avoid conflicts from local file changes (e.g. package-lock.json).

## Design System

- Dark background (`#0f0d09` / near-black), gold accent (`#b8960c` / `rgba(184,150,12,…)`).
- Typography: Cormorant Garamond (serif display), system sans-serif for body.
- Tagline: "Bold · Elegant · You"
- Logo: `/nakhrali-logo.jpg` (circular, gold border) — used in header, emails, hero.

## Colour Options (products)

14 colours: Pink, Teal, Purple, Green, White, Beige, Multi, Golden, Blue, Maroon, Yellow, Brown, Orange, Silver.

## Auth & User Approval Flow

- Email confirmation is required (`enable_confirmations = true` in `supabase/config.toml`).
- New user profiles are created with `is_active = false` (pending approval).
  - DB trigger `on_auth_user_created` auto-creates the profile row on sign-up.
  - Client-side fallback in `useAuth.ts` also creates with `is_active: false`.
- **Admin approves users** via the "Users" tab in the admin dashboard (`/admin`).
  - Pending tab: users with `is_active = false`.
  - Active tab: users with `is_active = true`, with a Revoke button.
  - Approving sets `is_active = true` and sends the approval email.
- Admin role check uses `public.get_my_role()` (SECURITY DEFINER) to avoid RLS recursion.

## Transactional Emails (SendGrid)

Sender: `somiljain@aol.com` / name "Nakhrali". Key: `SENDGRID_API_KEY` Supabase secret.

| Trigger | Edge Function | Template |
|---|---|---|
| User signs up | `send-pending-approval-email` | "Your account is pending approval" |
| Admin approves user | `send-account-approved-email` | "Your account is approved — welcome!" |
| Admin approves order | `send-order-approval-email` | Order approval details |

All email edge functions use `verify_jwt = false` except `send-order-approval-email` (`verify_jwt = true`).

Branded HTML emails: Nakhrali circular logo, gold gradient button, cream/gold palette, no Supabase branding.

Auth email templates (Supabase native) in `supabase/emails/`:
- `confirmation.html` — email verification on sign-up
- `recovery.html` — password reset
- `magic_link.html` — magic link sign-in

## Admin Dashboard (`/admin`)

Tabs: Overview · Orders · Products · Accounts · **Users** · Invite Users · Account Contacts

- **Users tab** (`UserManagement.tsx`): approve/revoke user sign-up access.
- **Orders tab**: approve/reject orders. `orders.status` CHECK includes `'rejected'`.
- **Products tab**: `is_active` toggle per product. Active products drive hero stats.
- RLS silent failure pattern: always use `.select("id")` on updates and check `rows.length === 0`.

## Known RLS Patterns

- `profiles` SELECT/UPDATE for admins uses `public.get_my_role()` (SECURITY DEFINER) — direct subquery on `profiles` within a profiles policy causes infinite recursion.
- Products/categories: "viewable by everyone" policies allow public read of `is_active = true` rows.
- Admins get additional SELECT policy via `get_my_role()` to see all rows.

## Cart & Checkout

- Cart open state is lifted to `Index.tsx` (`isCartOpen` / `setIsCartOpen`).
- Header "Bag" button and floating FAB both control this state.

## Key Files

- `src/pages/Index.tsx` — main storefront, hero stats wired to live product/category counts, footer.
- `src/components/HeroSection.tsx` — floating cards (logo + Titli green bracelet + empty mandala card).
- `src/components/admin/UserManagement.tsx` — pending/active user approval UI.
- `src/hooks/useAuth.ts` — profile load + create (new users get `is_active: false`).
- `src/components/AuthModal.tsx` — calls `send-pending-approval-email` after sign-up.
- `supabase/config.toml` — auth settings, email templates, function JWT config.
- `.github/workflows/deploy.yml` — EC2 deploy via `git reset --hard`.
