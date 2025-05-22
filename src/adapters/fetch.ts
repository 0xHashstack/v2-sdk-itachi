/**
 * Isomorphic fetch adapter that works in both browser and Node.js environments
 */

// We're using a dynamic import for 'isomorphic-fetch' to avoid bundling it unnecessarily
type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
};

export async function fetchJson<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const isServer = typeof window === "undefined";

  // Ensure isomorphic-fetch is loaded in Node.js environment
  if (isServer) {
    await import("isomorphic-fetch");
  }

  const { method = "GET", headers = {}, body, timeout = 30000 } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }

    throw new Error("Unknown fetch error");
  }
}

export async function postJson<T = any>(
  url: string,
  data: any,
  options: Omit<RequestOptions, "method" | "body"> = {}
): Promise<T> {
  return fetchJson<T>(url, {
    ...options,
    method: "POST",
    body: data,
  });
}
