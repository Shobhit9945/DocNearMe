// scripts/run-function-test.ts
// Simple test harness to invoke the Netlify function handler

import { handler } from '../netlify/functions/api.ts';

async function run() {
  console.log('Running local tests for netlify/functions/api.ts');

  // Test Google Maps geocode proxy
  const googleEvent = {
    path: '/api/google-maps/geocode',
    httpMethod: 'GET',
    headers: { accept: 'application/json' },
    queryStringParameters: { latlng: '37.4219999,-122.0840575' },
  } as any;

  try {
    const result = await handler(googleEvent);
    console.log('\n--- Google Maps Proxy Result ---');
    console.log('statusCode:', result.statusCode);
    console.log('headers:', result.headers);
    console.log('body (first 1000 chars):', typeof result.body === 'string' ? result.body.slice(0, 1000) : result.body);
  } catch (e) {
    console.error('Google proxy threw:', e);
  }

  // Test Gemini (Generative Language) proxy
  const geminiEvent = {
    path: '/api/gemini',
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    queryStringParameters: { model: 'gemini-2.5-flash-preview-05-20' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] }),
  } as any;

  try {
    const result2 = await handler(geminiEvent);
    console.log('\n--- Gemini Proxy Result ---');
    console.log('statusCode:', result2.statusCode);
    console.log('headers:', result2.headers);
    console.log('body (first 1000 chars):', typeof result2.body === 'string' ? result2.body.slice(0, 1000) : result2.body);
  } catch (e) {
    console.error('Gemini proxy threw:', e);
  }
}

run().catch(err => {
  console.error('Test harness failed:', err);
  process.exit(1);
});
