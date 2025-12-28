import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Handler as NetlifyHandler } from "@netlify/functions";

// Mock the createServer function
vi.mock("../../server/index", () => ({
  createServer: vi.fn(),
}));

// Mock serverless-http
vi.mock("serverless-http", () => ({
  default: vi.fn(),
}));

describe("Netlify Function API Handler", () => {
  let handler: NetlifyHandler;
  let mockExpressApp: any;
  let mockServerlessHandler: any;
  let createServerMock: any;
  let serverlessHttpMock: any;

  beforeEach(async () => {
    // Reset modules to get fresh imports
    vi.resetModules();
    
    // Setup mocks
    mockExpressApp = {
      use: vi.fn(),
      listen: vi.fn(),
    };
    
    mockServerlessHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify({ success: true }),
    });

    // Mock createServer
    const { createServer } = await import("../../server/index");
    createServerMock = createServer as any;
    createServerMock.mockResolvedValue(mockExpressApp);

    // Mock serverless-http
    const serverlessHttp = await import("serverless-http");
    serverlessHttpMock = serverlessHttp.default as any;
    serverlessHttpMock.mockReturnValue(mockServerlessHandler);

    // Import handler after mocks are set up
    const apiModule = await import("./api");
    handler = apiModule.handler;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Request Path Normalization", () => {
    it("should normalize path with /.netlify/functions/api prefix", async () => {
      const event = {
        rawUrl: "https://example.com/.netlify/functions/api/auth/login",
        path: "/.netlify/functions/api/auth/login",
        httpMethod: "POST",
        headers: {},
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/api/auth/login",
        }),
        expect.any(Object)
      );
    });

    it("should normalize path with /api prefix", async () => {
      const event = {
        rawUrl: "https://example.com/api/users",
        path: "/api/users",
        httpMethod: "GET",
        headers: {},
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/api/users",
        }),
        expect.any(Object)
      );
    });

    it("should add /api prefix when path has no prefix", async () => {
      const event = {
        rawUrl: "https://example.com/users",
        path: "/users",
        httpMethod: "GET",
        headers: {},
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/api/users",
        }),
        expect.any(Object)
      );
    });

    it("should handle root path", async () => {
      const event = {
        rawUrl: "https://example.com/",
        path: "/",
        httpMethod: "GET",
        headers: {},
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/api/",
        }),
        expect.any(Object)
      );
    });

    it("should handle empty path", async () => {
      const event = {
        rawUrl: "https://example.com",
        path: "",
        httpMethod: "GET",
        headers: {},
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/api/",
        }),
        expect.any(Object)
      );
    });

    it("should handle paths with query parameters", async () => {
      const event = {
        rawUrl: "https://example.com/users?limit=10&offset=0",
        path: "/users",
        httpMethod: "GET",
        headers: {},
        queryStringParameters: { limit: "10", offset: "0" },
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/api/users",
        }),
        expect.any(Object)
      );
    });
  });

  describe("Body Handling", () => {
    it("should handle null body", async () => {
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "GET",
        headers: {},
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: "",
          isBase64Encoded: false,
        }),
        expect.any(Object)
      );
    });

    it("should handle undefined body", async () => {
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "GET",
        headers: {},
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: "",
          isBase64Encoded: false,
        }),
        expect.any(Object)
      );
    });

    it("should handle string body as-is", async () => {
      const bodyString = '{"name":"test"}';
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: { "content-type": "application/json" },
        body: bodyString,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: bodyString,
          isBase64Encoded: false,
        }),
        expect.any(Object)
      );
    });

    it("should stringify object body", async () => {
      const bodyObj = { name: "test", value: 42 };
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: {},
        body: bodyObj as any,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: JSON.stringify(bodyObj),
          isBase64Encoded: false,
        }),
        expect.any(Object)
      );
    });

    it("should decode base64 encoded body", async () => {
      const originalBody = '{"test":"data"}';
      const base64Body = Buffer.from(originalBody).toString("base64");
      
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: {},
        body: base64Body,
        isBase64Encoded: true,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: originalBody,
          isBase64Encoded: false,
        }),
        expect.any(Object)
      );
    });

    it("should handle empty string body", async () => {
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: {},
        body: "",
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: "",
          isBase64Encoded: false,
        }),
        expect.any(Object)
      );
    });

    it("should handle array body by stringifying", async () => {
      const bodyArray = [1, 2, 3];
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: {},
        body: bodyArray as any,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: JSON.stringify(bodyArray),
          isBase64Encoded: false,
        }),
        expect.any(Object)
      );
    });
  });

  describe("Header Handling", () => {
    it("should add content-type header for JSON body when missing", async () => {
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: {},
        body: '{"test":"data"}',
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "content-type": "application/json",
          }),
        }),
        expect.any(Object)
      );
    });

    it("should not override existing content-type header", async () => {
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: { "content-type": "text/plain" },
        body: "plain text",
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "content-type": "text/plain",
          }),
        }),
        expect.any(Object)
      );
    });

    it("should respect Content-Type header (capital C)", async () => {
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: { "Content-Type": "application/xml" },
        body: "<data/>",
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/xml",
          }),
        }),
        expect.any(Object)
      );
    });

    it("should add content-length header for non-empty body", async () => {
      const body = '{"test":"data"}';
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: {},
        body,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "content-length": Buffer.byteLength(body).toString(),
          }),
        }),
        expect.any(Object)
      );
    });

    it("should not add content-length for empty body", async () => {
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "GET",
        headers: {},
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      const call = mockServerlessHandler.mock.calls[0][0];
      expect(call.headers).not.toHaveProperty("content-length");
    });

    it("should preserve existing headers", async () => {
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "GET",
        headers: {
          "x-custom-header": "custom-value",
          authorization: "Bearer token123",
        },
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-custom-header": "custom-value",
            authorization: "Bearer token123",
          }),
        }),
        expect.any(Object)
      );
    });

    it("should handle missing headers object", async () => {
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "GET",
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.any(Object),
        }),
        expect.any(Object)
      );
    });
  });

  describe("HTTP Method Handling", () => {
    it("should handle GET requests", async () => {
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "GET",
        headers: {},
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestContext: expect.objectContaining({
            http: expect.objectContaining({
              method: "GET",
            }),
          }),
        }),
        expect.any(Object)
      );
    });

    it("should handle POST requests", async () => {
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: {},
        body: '{"data":"test"}',
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestContext: expect.objectContaining({
            http: expect.objectContaining({
              method: "POST",
            }),
          }),
        }),
        expect.any(Object)
      );
    });

    it("should handle PUT requests", async () => {
      const event = {
        rawUrl: "https://example.com/api/test/123",
        path: "/api/test/123",
        httpMethod: "PUT",
        headers: {},
        body: '{"data":"updated"}',
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestContext: expect.objectContaining({
            http: expect.objectContaining({
              method: "PUT",
            }),
          }),
        }),
        expect.any(Object)
      );
    });

    it("should handle DELETE requests", async () => {
      const event = {
        rawUrl: "https://example.com/api/test/123",
        path: "/api/test/123",
        httpMethod: "DELETE",
        headers: {},
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestContext: expect.objectContaining({
            http: expect.objectContaining({
              method: "DELETE",
            }),
          }),
        }),
        expect.any(Object)
      );
    });

    it("should handle PATCH requests", async () => {
      const event = {
        rawUrl: "https://example.com/api/test/123",
        path: "/api/test/123",
        httpMethod: "PATCH",
        headers: {},
        body: '{"field":"value"}',
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestContext: expect.objectContaining({
            http: expect.objectContaining({
              method: "PATCH",
            }),
          }),
        }),
        expect.any(Object)
      );
    });

    it("should handle OPTIONS requests", async () => {
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "OPTIONS",
        headers: {},
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestContext: expect.objectContaining({
            http: expect.objectContaining({
              method: "OPTIONS",
            }),
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe("Request Context Preservation", () => {
    it("should preserve existing requestContext properties", async () => {
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "GET",
        headers: {},
        body: null,
        isBase64Encoded: false,
        requestContext: {
          accountId: "123456",
          requestId: "req-abc-123",
          authorizer: { claims: { sub: "user-123" } },
        },
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestContext: expect.objectContaining({
            accountId: "123456",
            requestId: "req-abc-123",
            authorizer: { claims: { sub: "user-123" } },
            http: expect.objectContaining({
              method: "GET",
            }),
          }),
        }),
        expect.any(Object)
      );
    });

    it("should handle missing requestContext", async () => {
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "GET",
        headers: {},
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestContext: expect.objectContaining({
            http: expect.objectContaining({
              method: "GET",
            }),
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe("Edge Cases and Error Scenarios", () => {
    it("should handle very large body strings", async () => {
      const largeBody = JSON.stringify({ data: "x".repeat(10000) });
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: {},
        body: largeBody,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: largeBody,
          headers: expect.objectContaining({
            "content-length": Buffer.byteLength(largeBody).toString(),
          }),
        }),
        expect.any(Object)
      );
    });

    it("should handle special characters in body", async () => {
      const bodyWithSpecialChars = '{"name":"Test™","emoji":"🎉","unicode":"\\u0041"}';
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: {},
        body: bodyWithSpecialChars,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: bodyWithSpecialChars,
        }),
        expect.any(Object)
      );
    });

    it("should handle nested object body", async () => {
      const nestedBody = {
        user: {
          profile: {
            name: "Test",
            settings: {
              theme: "dark",
              notifications: true,
            },
          },
        },
      };
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: {},
        body: nestedBody as any,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: JSON.stringify(nestedBody),
        }),
        expect.any(Object)
      );
    });

    it("should handle path with multiple slashes", async () => {
      const event = {
        rawUrl: "https://example.com/api//test///path",
        path: "/api//test///path",
        httpMethod: "GET",
        headers: {},
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalled();
    });

    it("should handle path with special characters", async () => {
      const event = {
        rawUrl: "https://example.com/api/test%20path",
        path: "/api/test%20path",
        httpMethod: "GET",
        headers: {},
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/api/test%20path",
        }),
        expect.any(Object)
      );
    });

    it("should handle case-sensitive headers correctly", async () => {
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Custom-Header": "value",
        },
        body: '{"test":"data"}',
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Custom-Header": "value",
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe("Integration with Express Handler", () => {
    it("should return the response from express handler", async () => {
      const expectedResponse = {
        statusCode: 201,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "123", created: true }),
      };
      mockServerlessHandler.mockResolvedValue(expectedResponse);

      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: {},
        body: '{"data":"test"}',
        isBase64Encoded: false,
      };

      const result = await handler(event as any, {} as any);

      expect(result).toEqual(expectedResponse);
    });

    it("should pass context to express handler", async () => {
      const context = {
        functionName: "api",
        functionVersion: "1",
        invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789:function:api",
      };

      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "GET",
        headers: {},
        body: null,
        isBase64Encoded: false,
      };

      await handler(event as any, context);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.any(Object),
        context
      );
    });

    it("should handle express handler errors gracefully", async () => {
      const error = new Error("Express handler error");
      mockServerlessHandler.mockRejectedValue(error);

      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "GET",
        headers: {},
        body: null,
        isBase64Encoded: false,
      };

      await expect(handler(event as any, {} as any)).rejects.toThrow(
        "Express handler error"
      );
    });
  });

  describe("UTF-8 and Encoding Edge Cases", () => {
    it("should correctly calculate content-length for multibyte characters", async () => {
      const body = '{"message":"Hello 世界 🌍"}';
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: {},
        body,
        isBase64Encoded: false,
      };

      await handler(event as any, {} as any);

      // Buffer.byteLength correctly handles multibyte characters
      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "content-length": Buffer.byteLength(body, "utf8").toString(),
          }),
        }),
        expect.any(Object)
      );
    });

    it("should handle base64 encoded multibyte characters", async () => {
      const originalBody = '{"message":"こんにちは"}';
      const base64Body = Buffer.from(originalBody, "utf8").toString("base64");
      
      const event = {
        rawUrl: "https://example.com/api/test",
        path: "/api/test",
        httpMethod: "POST",
        headers: {},
        body: base64Body,
        isBase64Encoded: true,
      };

      await handler(event as any, {} as any);

      expect(mockServerlessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: originalBody,
          isBase64Encoded: false,
        }),
        expect.any(Object)
      );
    });
  });
});