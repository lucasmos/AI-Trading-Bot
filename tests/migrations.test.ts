import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

const prisma = new PrismaClient();

describe('Database Migrations', () => {
  beforeAll(async () => {
    // Reset the database before tests
    execSync('npx prisma migrate reset --force');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create a user with settings', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        settings: {
          create: {
            theme: 'dark',
            language: 'en',
            notifications: true,
            settings: {}
          }
        }
      },
      include: {
        settings: true
      }
    });

    expect(user.email).toBe('test@example.com');
    expect(user.settings).toBeDefined();
    expect(user.settings?.theme).toBe('dark');
  });

  it('should track user sessions', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'session@example.com',
        name: 'Session User'
      }
    });

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        userAgent: 'Chrome/91.0.4472.124',
        ipAddress: '127.0.0.1'
      }
    });

    expect(session.userId).toBe(user.id);
    expect(session.userAgent).toBe('Chrome/91.0.4472.124');
  });

  it('should save items with tags', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'saved@example.com',
        name: 'Saved Items User'
      }
    });

    const savedItem = await prisma.savedItem.create({
      data: {
        userId: user.id,
        title: 'Test Bookmark',
        content: 'Test Content',
        url: 'https://example.com',
        tags: ['test', 'bookmark']
      }
    });

    expect(savedItem.title).toBe('Test Bookmark');
    expect(savedItem.tags).toContain('test');
    expect(savedItem.tags).toContain('bookmark');
  });

  it('should create notifications', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'notify@example.com',
        name: 'Notification User'
      }
    });

    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'info'
      }
    });

    expect(notification.title).toBe('Test Notification');
    expect(notification.read).toBe(false);
  });

  it('should track usage statistics', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'stats@example.com',
        name: 'Stats User'
      }
    });

    const usageStat = await prisma.usageStats.create({
      data: {
        userId: user.id,
        action: 'button_click',
        metadata: { buttonId: 'save-button' }
      }
    });

    expect(usageStat.action).toBe('button_click');
    expect(usageStat.metadata).toEqual({ buttonId: 'save-button' });
  });
}); 