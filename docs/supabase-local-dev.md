# Local Supabase Development Guide

## Overview

This project uses **local Supabase** for development and **production Supabase** only for deployments. This approach allows you to:

- ✅ Develop for free without using production quotas
- ✅ Work offline
- ✅ Test database changes safely before deploying
- ✅ Keep development and production data separate

## Quick Start

### 1. Start Local Supabase

```bash
supabase start
```

This will:
- Start Docker containers for PostgreSQL, Auth, Storage, etc.
- Run migrations from `supabase/migrations/`
- Seed the database with data from `supabase/seed.sql`
- Display local URLs and API keys

### 2. Access Supabase Studio

Open the Studio URL shown in the terminal (typically `http://localhost:54323`) to:
- View tables and data
- Run SQL queries
- Manage authentication
- View logs

### 3. Seed Test Users

After starting Supabase, you'll see output with API keys. Copy the **service_role key** and add it to your `.env.local`:

```bash
# Add to .env.local
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Then seed the test users:

```bash
# Option 1: Use the API endpoint (recommended)
curl -X POST http://localhost:3000/api/seed-users

# Option 2: Use the script (requires tsx: npm install -D tsx)
npm run seed:users
```

This creates three test users:
- **Admin**: EMP001 / admin@vgt.com / Admin@123
- **Employee**: EMP002 / employee@vgt.com / Employee@123
- **Agent**: AGT001 / agent@vgt.com / Agent@123

### 4. Start Your App

```bash
npm run dev
```

Your app will connect to local Supabase automatically (configured in `.env.local`).

Visit `http://localhost:3000/login` to test the login.

### 5. Stop Local Supabase

```bash
supabase stop
```

## Database Migrations

### Creating a New Migration

When you need to change your database schema:

```bash
supabase migration new your_migration_name
```

This creates a new migration file in `supabase/migrations/`. Edit it to add your SQL changes.

### Applying Migrations Locally

Migrations are automatically applied when you run `supabase start`. To manually apply:

```bash
supabase db reset
```

This resets the database and re-runs all migrations + seed data.

## Environment Configuration

### Development (Local)
- File: `.env.local` or `.env.development.local`
- Required variables:
  ```bash
  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_from_supabase_start
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_from_supabase_start
  ```
- Used when running `npm run dev`

### Production
- File: `.env.production.local`
- Supabase URL: `https://flhakggyiykhimbvolfc.supabase.co`
- Used when deploying to Vercel

## Migrating Schema to Production

When you're ready to deploy database changes to production:

### Option 1: Via Supabase Dashboard (Recommended for beginners)

1. Open your production Supabase dashboard
2. Go to SQL Editor
3. Copy the SQL from your migration file
4. Review and run it

### Option 2: Via Supabase CLI (Advanced)

First, link your project:

```bash
supabase link --project-ref flhakggyiykhimbvolfc
```

Then push migrations:

```bash
supabase db push
```

## Migrating Data to Production

### Export Data from Local

```bash
supabase db dump -f local_data.sql --data-only
```

### Import to Production

1. Open production Supabase dashboard
2. Go to SQL Editor
3. Paste and run the contents of `local_data.sql`

## Common Commands

```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Reset database (re-run migrations + seed)
supabase db reset

# Create a new migration
supabase migration new migration_name

# View database status
supabase status

# View logs
supabase logs

# Generate TypeScript types from your database
supabase gen types typescript --local > types/supabase.ts
```

## Troubleshooting

### Docker not running
**Error**: `Cannot connect to the Docker daemon`

**Solution**: Start Docker Desktop

### Port already in use
**Error**: `Port 54321 is already in use`

**Solution**: 
```bash
supabase stop
# Wait a few seconds
supabase start
```

### Database changes not showing
**Solution**: Reset the database
```bash
supabase db reset
```

### Environment variables not updating
**Solution**: Restart your Next.js dev server
```bash
# Stop npm run dev (Ctrl+C)
npm run dev
```

## File Structure

```
vgt/
├── supabase/
│   ├── config.toml              # Supabase configuration
│   ├── migrations/              # Database migration files
│   │   └── 20260118000000_create_notes_table.sql
│   └── seed.sql                 # Seed data for local dev
├── .env.local                   # Local development (default)
├── .env.development.local       # Local development (explicit)
└── .env.production.local        # Production credentials
```

## Best Practices

1. **Always test locally first** - Never run migrations directly on production
2. **Keep migrations small** - One migration per feature/change
3. **Use seed data** - Populate `supabase/seed.sql` with test data
4. **Commit migrations** - Migration files should be in version control
5. **Don't commit .env files** - They're in `.gitignore` for security

## Production Deployment

When deploying to Vercel:

1. Vercel will use production environment variables (set in Vercel dashboard)
2. Your app will connect to production Supabase
3. Make sure migrations are applied to production first
4. Test thoroughly in staging/preview environments
