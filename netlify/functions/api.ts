import serverless from "serverless-http";

import { createServer } from "../../server";

<<<<<<< HEAD
export const handler = async (event: NetlifyEvent) => {
  // Normalize the incoming path to extract the target segment after /api/
  const incomingPath = event.path || '';

  // Remove potential prefixes that Netlify might include
  let path = incomingPath
    .replace(/^\/\.netlify\/functions\/api\//, '')
    .replace(/^\/api\//, '')
    .replace(/^\//, '');

  // e.g. path === 'gemini' or 'google-maps'
  let targetApiUrl = '';
  let apiKey = '';

  if (path.startsWith('gemini')) {
    // We'll build the full Generative Language endpoint later using the `model` query param
    // e.g. https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
    targetApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    apiKey = process.env.GEMINI_API_KEY || '';
    // Note: keep both options for compatibility:
    // - GEMINI_BEARER_TOKEN: preferred, use as Authorization: Bearer <token>
    // - GEMINI_API_KEY: legacy; include as query param `key` and also send as Authorization: Bearer <key>
    // This preserves the prior behavior for users who only set GEMINI_API_KEY.
  } else if (path.startsWith('google-maps/geocode')) {
    // Direct geocoding route: maps geocode JSON endpoint
    targetApiUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  } else if (path.startsWith('google-maps')) {
    // Generic maps base (could be extended for other maps endpoints)
    targetApiUrl = 'https://maps.googleapis.com/maps/api';
    apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  }

  if (!apiKey || !targetApiUrl) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Service not configured' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    // Build forwarding URL: include original query string parameters if present
    const url = new URL(targetApiUrl);
    if (event.queryStringParameters) {
      for (const [k, v] of Object.entries(event.queryStringParameters)) {
        if (v != null) url.searchParams.set(k, v);
      }
    }

    // For Google Maps geocoding we must pass the API key as a `key` query parameter
    if (path.startsWith('google-maps')) {
      if (apiKey) url.searchParams.set('key', apiKey);
    }

    if (path.startsWith('gemini')) {
      // If the client passed a model via query param, build the full generateContent endpoint
      const model = event.queryStringParameters?.model || 'gemini-2.5-flash-preview-05-20';
      // Replace the base URL with the full model generate endpoint
      // (We already copied any incoming query params into `url` above; rebuild a new URL)
      const genUrl = new URL(`${targetApiUrl}/${model}:generateContent`);
      // copy query params from previous `url` (which held other query params)
      for (const [k, v] of url.searchParams.entries()) genUrl.searchParams.set(k, v);
      // Attach API key if present. For compatibility, include GEMINI_API_KEY as query param if set.
      if (process.env.GEMINI_API_KEY) {
        genUrl.searchParams.set('key', process.env.GEMINI_API_KEY);
      }
      // replace the URL used for the fetch
      url.href = genUrl.href;
    }

    const method = (event.httpMethod || 'GET').toUpperCase();

    // Build headers: for Google Geocoding we don't send Authorization header
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (path.startsWith('gemini')) {
      // Authorization priority:
      // 1) GEMINI_BEARER_TOKEN (preferred)
      // 2) GEMINI_API_KEY (legacy) - send as Bearer for compatibility
      if (process.env.GEMINI_BEARER_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GEMINI_BEARER_TOKEN}`;
      } else if (process.env.GEMINI_API_KEY) {
        headers.Authorization = `Bearer ${process.env.GEMINI_API_KEY}`;
      }
    }

    // Merge some incoming headers that may be useful (e.g. Accept)
    if (event.headers?.accept) headers.Accept = event.headers.accept;

    const fetchOptions: any = {
      method,
      headers,
    };

    if (method !== 'GET' && event.body) {
      // event.body is a string in Netlify functions; forward as-is
      fetchOptions.body = event.body;
    }

    // Optional debug: show outgoing URL and masked headers when GEMINI_PROXY_DEBUG=true
    if (process.env.GEMINI_PROXY_DEBUG === 'true') {
      const mask = (s: string | undefined) => {
        if (!s) return s;
        if (s.length <= 8) return '****';
        return `${s.slice(0, 4)}...${s.slice(-4)}`;
      };
      const maskedHeaders: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(headers)) {
        maskedHeaders[k] = k.toLowerCase() === 'authorization' ? mask(v) : v;
      }
      console.log('Proxy outgoing:', { url: url.toString(), headers: maskedHeaders });
    }

    const resp = await fetch(url.toString(), fetchOptions);

    const text = await resp.text();
    // Try to parse JSON, otherwise return text
    let body: string;
    try {
      body = JSON.stringify(JSON.parse(text));
    } catch {
      body = text;
    }

    return {
      statusCode: resp.status,
      body,
      headers: { 'Content-Type': resp.headers.get('content-type') || 'text/plain' },
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error?.message ?? String(error) }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};

// Note: `export const config = { path: '/api/*' }` is used for Netlify Edge
// Functions (which expect a Fetch Request/Response). This file lives under
// `netlify/functions` and uses the Netlify Functions (serverless) handler
// signature, so the Edge `config` export is not needed here.
=======
export const handler = serverless(createServer());
>>>>>>> parent of de8716d (Env changes)
