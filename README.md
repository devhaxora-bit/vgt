This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop (for local Supabase)
- Supabase CLI (`brew install supabase/tap/supabase`)

### Local Development Setup

1. **Start Local Supabase**

```bash
supabase start
```

This starts a local Supabase instance in Docker. Wait for it to complete.

2. **Run the Development Server**

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

3. **Seed Test Users**

After starting Supabase, you need to create test users. Get your service role key from the `supabase start` output, then:

```bash
# Option 1: Use the API endpoint (recommended)
curl -X POST http://localhost:3000/api/seed-users

# Option 2: Use the script (requires tsx)
npm install -D tsx
npm run seed:users
```

Make sure to set `SUPABASE_SERVICE_ROLE_KEY` in your `.env.local` file. You can find it in the output of `supabase start`.

4. **Access Supabase Studio**

Visit the Studio URL shown in terminal (typically `http://localhost:54323`) to manage your local database.

### Environment Configuration

- **Local Development**: Uses `.env.local` (points to local Supabase)
- **Production**: Uses `.env.production.local` (points to production Supabase)

See [docs/supabase-local-dev.md](docs/supabase-local-dev.md) for complete setup guide.

## Project Structure

```
vgt/
├── app/               # Next.js app router pages
├── utils/             # Supabase client utilities
├── supabase/          # Database migrations and config
│   ├── migrations/    # SQL migration files
│   └── seed.sql       # Local development seed data
└── docs/              # Documentation
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [Supabase Documentation](https://supabase.com/docs) - learn about Supabase features.
- [Local Development Guide](docs/supabase-local-dev.md) - local Supabase setup and workflow.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
