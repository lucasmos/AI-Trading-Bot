import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load environment variables
config();

const args = process.argv.slice(2);
const command = args[0];

function runCommand(cmd: string) {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Error executing command: ${cmd}`);
    console.error(error);
    process.exit(1);
  }
}

switch (command) {
  case 'create':
    const name = args[1];
    if (!name) {
      console.error('Please provide a migration name');
      process.exit(1);
    }
    runCommand(`npx prisma migrate dev --name ${name}`);
    break;

  case 'deploy':
    runCommand('npx prisma migrate deploy');
    break;

  case 'reset':
    if (process.env.NODE_ENV === 'production') {
      console.error('Cannot reset database in production environment');
      process.exit(1);
    }
    runCommand('npx prisma migrate reset');
    break;

  case 'status':
    runCommand('npx prisma migrate status');
    break;

  default:
    console.log(`
Usage: npm run migrate <command> [options]

Commands:
  create <name>    Create a new migration
  deploy          Apply pending migrations
  reset           Reset database (development only)
  status          Show migration status

Examples:
  npm run migrate create add_user_table
  npm run migrate deploy
  npm run migrate status
    `);
    process.exit(1);
} 