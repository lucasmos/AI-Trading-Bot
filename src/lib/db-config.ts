export const dbConfig = {
  url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chrome_extension_db?schema=public',
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
}; 