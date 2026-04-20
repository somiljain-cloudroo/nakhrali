# Nakhrali

Handcrafted Indian heritage jewellery storefront. Live at [nakhrali.com.au](https://nakhrali.com.au).

## Stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Auth, Storage, Edge Functions)
- Deployed to EC2 via GitHub Actions (`.github/workflows/deploy.yml`)

## Local development

```sh
npm install
npm run dev
```

The dev server runs on port 8080.

## Build

```sh
npm run build
```

## Deploy

Pushing to `main` on the `nakhrali` remote triggers the EC2 deploy workflow.

```sh
git push nakhrali main
```
