// netlify/functions/api.ts
// Netlify Functions (serverless) handler acting as a secure proxy.
// Netlify's Functions runtime expects an exported `handler` that returns
// { statusCode, body, headers } rather than a Fetch `Request`/`Response` pair.

type NetlifyEvent = {
  path?: string;
  httpMethod?: string;
  headers?: Record<string, string>;
  body?: string | null;
  isBase64Encoded?: boolean;
  queryStringParameters?: Record<string, string> | null;
};

import serverless from "serverless-http";
import { createServer } from "../../server/index";

let cachedExpressHandler: ReturnType<typeof serverless> | null = null;

const getExpressHandler = async () => {
  if (!cachedExpressHandler) {
    const app = await createServer();
    cachedExpressHandler = serverless(app);
  }
  return cachedExpressHandler;
};

const resolveHttpMethod = (event: NetlifyEvent, context: any) => {
  // Netlify should always supply httpMethod, but production traces show it may be
  // omitted. Try a few fallbacks before defaulting so POST bodies don't downgrade to GET.
  const explicitMethod =
    event.httpMethod ||
    (event as any).requestContext?.http?.method ||
    event.headers?.["x-nf-http-method"] ||
    event.headers?.["x-http-method-override"] ||
    context?.httpMethod ||
    context?.method;

  if (explicitMethod) return explicitMethod;

  // As a last resort, infer POST when a body is present; otherwise default to GET.
  return event.body ? "POST" : "GET";
};

export const handler = async (event: NetlifyEvent, context: any) => {
  // Netlify occasionally omits the httpMethod on rewrites, which causes
  // serverless-http to treat the request as a GET and drop the JSON body.
  // Resolve it early (falling back to POST when a body is present) so POST
  // auth routes receive the payload required by Zod validation.
  const resolvedMethod = resolveHttpMethod(event, context);

  // Normalize the incoming path to extract the target segment after /api/
  const incomingPath = event.path
    ? event.path
    : (() => {
        try {
          const rawUrl = (event as any).rawUrl;
          if (rawUrl) return new URL(rawUrl).pathname;
        } catch (err) {
          console.warn("Unable to parse rawUrl for event path", err);
        }
        return "";
      })();

  // Remove potential prefixes that Netlify might include
  const normalizedPath = incomingPath
    .replace(/^\/\.netlify\/functions\/api\//, "")
    .replace(/^\/api\//, "")
    .replace(/^\//, "");

  const bodyWasBase64 = event.isBase64Encoded && typeof event.body === "string";
  let decodedBody: string | null | undefined = event.body;
  if (bodyWasBase64) {
    try {
      decodedBody = Buffer.from(event.body, "base64").toString("utf8");
    } catch (err) {
      console.warn("Failed to decode base64 Netlify body", err);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Incoming request body could not be decoded",
          detail: "netlify_body_decode_failed",
          hint: "Disable base64 encoding or ensure the body is valid JSON before the Netlify rewrite.",
        }),
        headers: { "Content-Type": "application/json" },
      };
    }
  }

  // e.g. path === 'gemini' or 'google-maps'
  let targetApiUrl = "";
  let apiKey = "";

  if (normalizedPath.startsWith("gemini")) {
    // We'll build the full Generative Language endpoint later using the `model` query param
    // e.g. https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
    targetApiUrl = "https://generativelanguage.googleapis.com/v1beta/models";
    apiKey = process.env.GEMINI_API_KEY || "";
  } else if (normalizedPath.startsWith("google-maps/geocode")) {
    // Direct geocoding route: maps geocode JSON endpoint
    targetApiUrl = "https://maps.googleapis.com/maps/api/geocode/json";
    apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
  } else if (normalizedPath.startsWith("google-maps")) {
    // Generic maps base (could be extended for other maps endpoints)
    targetApiUrl = "https://maps.googleapis.com/maps/api";
    apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
  }

  // If this isn't a configured external service, delegate to the Express API so
  // endpoints like /api/auth/... are handled instead of returning a 404.
  if (!targetApiUrl) {
    const expressHandler = await getExpressHandler();
    // Normalize the path so Express sees /api/... instead of /.netlify/functions/api/...
    const expressPath = incomingPath.startsWith("/.netlify/functions/api")
      ? incomingPath.replace(/^\/\.netlify\/functions\/api/, "/api")
      : incomingPath.startsWith("/api/")
        ? incomingPath
        : `/api/${normalizedPath}`;

    const headers = { ...(event.headers ?? {}) };
    const bodyString = typeof decodedBody === "string" ? decodedBody : decodedBody == null ? "" : JSON.stringify(decodedBody);
    // Ensure JSON bodies are parsed even if Netlify omits the content-type header on rewrites
    if (!headers["content-type"] && !headers["Content-Type"] && bodyString) {
      headers["content-type"] = "application/json";
    }
    if (bodyString) {
      headers["content-length"] = Buffer.byteLength(bodyString).toString();
    }

    const expressEvent = {
      ...event,
      httpMethod: resolvedMethod,
      path: expressPath,
      requestContext: {
        ...(event as any).requestContext,
        http: { ...(event as any).requestContext?.http, method: resolvedMethod },
      },
      isBase64Encoded: bodyWasBase64 ? false : event.isBase64Encoded,
      body: decodedBody,
    };
    return expressHandler(expressEvent, context);
  }

  if (!apiKey) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Service not configured" }),
      headers: { "Content-Type": "application/json" },
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

    // For Google-style APIs (generative language + maps) we must pass the API key as a `key` query parameter
    if (normalizedPath.startsWith("google-maps")) {
      // If a key is present, append it to the URL query params
      if (apiKey) url.searchParams.set("key", apiKey);
    }

    if (normalizedPath.startsWith("gemini")) {
      // If the client passed a model via query param, build the full generateContent endpoint
      const model = event.queryStringParameters?.model || "gemini-2.5-flash-preview-05-20";
      // Replace the base URL with the full model generate endpoint
      // (We already copied any incoming query params into `url` above; rebuild a new URL)
      const genUrl = new URL(`${targetApiUrl}/${model}:generateContent`);
      // copy query params from previous `url` (which held other query params)
      for (const [k, v] of url.searchParams.entries()) genUrl.searchParams.set(k, v);
      // attach API key
      if (apiKey) genUrl.searchParams.set("key", apiKey);
      // replace the URL used for the fetch
      url.href = genUrl.href;
    }

    const method = resolvedMethod.toUpperCase();

    // Build headers: for Google Geocoding we don't send Authorization header
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (!normalizedPath.startsWith("google-maps")) {
      // Non-Google APIs may use bearer auth
      headers.Authorization = `Bearer ${apiKey}`;
    }

    // Merge some incoming headers that may be useful (e.g. Accept)
    if (event.headers?.accept) headers.Accept = event.headers.accept;

    const fetchOptions: any = {
      method,
      headers,
    };

    if (method !== "GET" && decodedBody) {
      // decodedBody is a string in Netlify functions; forward as-is
      fetchOptions.body = decodedBody;
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
      headers: { "Content-Type": resp.headers.get("content-type") || "text/plain" },
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error?.message ?? String(error) }),
      headers: { "Content-Type": "application/json" },
    };
  }
};

// Note: `export const config = { path: '/api/*' }` is used for Netlify Edge
// Functions (which expect a Fetch Request/Response). This file lives under
// `netlify/functions` and uses the Netlify Functions (serverless) handler
// signature, so the Edge `config` export is not needed here.
