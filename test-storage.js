import { storage } from './server/storage.js';

console.log('Testing storage connection...');

async function testStorage() {
  try {
    console.log('Testing getSportsSettings...');
    const settings = await storage.getSportsSettings();
    console.log('Sports settings:', Object.keys(settings));
    
    console.log('Testing getEvents...');
    const events = await storage.getEvents({ limit: 5 });
    console.log('Events count:', events.length);
    
    console.log('All tests passed!');
  } catch (error) {
    console.error('Storage test failed:', error);
  }
}

testStorage();