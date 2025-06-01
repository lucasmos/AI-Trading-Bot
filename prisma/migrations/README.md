# Database Migrations

This directory contains all database migrations for the Chrome extension project.

## Migration Commands

### Create a new migration
```bash
npx prisma migrate dev --name <migration_name>
```

### Apply pending migrations
```bash
npx prisma migrate deploy
```

### Reset database (development only)
```bash
npx prisma migrate reset
```

### View migration status
```bash
npx prisma migrate status
```

## Migration Best Practices

1. Always create migrations for schema changes
2. Test migrations in development before applying to production
3. Back up the database before running migrations in production
4. Review generated SQL before applying migrations
5. Keep migrations atomic and focused on specific changes
6. Document breaking changes in migration files

## Migration Workflow

1. Make changes to `schema.prisma`
2. Create a new migration: `npx prisma migrate dev --name <descriptive_name>`
3. Review the generated migration file
4. Test the migration locally
5. Commit the migration file
6. Deploy to production using `npx prisma migrate deploy` 