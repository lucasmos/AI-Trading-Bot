const { PrismaClient } = require('@prisma/client');

async function main() {
  console.log('Testing Prisma connection...');
  
  const prisma = new PrismaClient();
  
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Connection successful!');
    
    console.log('Testing query...');
    const users = await prisma.user.findMany({
      take: 1
    });
    
    console.log('Query successful!');
    console.log('Found users:', users.length);
    
    console.log('Disconnecting...');
    await prisma.$disconnect();
    console.log('Disconnected successfully!');
    
    console.log('Prisma is working correctly!');
  } catch (error) {
    console.error('Error testing Prisma:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 