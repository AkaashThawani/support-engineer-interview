import { config } from 'dotenv';

// Load environment variables for tests
config({ path: '.env.local' });

// Set test encryption key if not already set
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = 'ff8064df8d479fab839b10a1fa5c74b2303359bd8915b9758c498d594057bee3';
}
