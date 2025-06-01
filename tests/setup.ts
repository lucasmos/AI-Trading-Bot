import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });
 
// Set test timeout
jest.setTimeout(30000); 