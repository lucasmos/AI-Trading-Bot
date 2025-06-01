import { prisma } from '@/lib/db';

async function main() {
  try {
    // Create a test user
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        settings: {
          create: {
            theme: 'dark',
            language: 'en',
            notifications: true,
            settings: {
              sidebar: true,
              autoSave: true
            }
          }
        }
      }
    });

    console.log('Created test user:', user);

    // Create some saved items
    const items = await Promise.all([
      prisma.savedItem.create({
        data: {
          userId: user.id,
          title: 'Getting Started with Chrome Extensions',
          content: 'Learn how to build Chrome extensions...',
          url: 'https://developer.chrome.com/docs/extensions/mv3/getstarted/',
          tags: ['tutorial', 'chrome', 'development']
        }
      }),
      prisma.savedItem.create({
        data: {
          userId: user.id,
          title: 'Manifest V3 Overview',
          content: 'Understanding the new Manifest V3...',
          url: 'https://developer.chrome.com/docs/extensions/mv3/intro/',
          tags: ['manifest', 'chrome', 'documentation']
        }
      })
    ]);

    console.log('Created test items:', items);

    // Create some notifications
    const notifications = await Promise.all([
      prisma.notification.create({
        data: {
          userId: user.id,
          title: 'Welcome!',
          message: 'Welcome to the Chrome extension. Get started by saving your first item.',
          type: 'info'
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          title: 'Tip',
          message: 'You can organize your saved items using tags.',
          type: 'success'
        }
      })
    ]);

    console.log('Created test notifications:', notifications);

    // Create a session
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        userAgent: 'Chrome/91.0.4472.124',
        ipAddress: '127.0.0.1'
      }
    });

    console.log('Created test session:', session);

    // Add some usage statistics
    const stats = await Promise.all([
      prisma.usageStats.create({
        data: {
          userId: user.id,
          action: 'page_view',
          metadata: { page: 'home' }
        }
      }),
      prisma.usageStats.create({
        data: {
          userId: user.id,
          action: 'save_item',
          metadata: { itemId: items[0].id }
        }
      })
    ]);

    console.log('Created test usage stats:', stats);

    // Add some logs
    const logs = await Promise.all([
      prisma.extensionLog.create({
        data: {
          level: 'info',
          message: 'Extension initialized',
          metadata: { version: '1.0.0' }
        }
      }),
      prisma.extensionLog.create({
        data: {
          level: 'info',
          message: 'User logged in',
          metadata: { userId: user.id }
        }
      })
    ]);

    console.log('Created test logs:', logs);

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 