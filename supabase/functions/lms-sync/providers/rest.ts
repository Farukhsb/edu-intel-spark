function parseNextLink(linkHeader: string | null) {
  if (!linkHeader) return null;

  for (const segment of linkHeader.split(",")) {
    const match = segment.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match && match[2] === "next") {
      return match[1];
    }
  }

  return null;
}

export async function lmsRestGetJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`LMS REST request failed for ${url}: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return await response.json() as T;
}

export async function lmsRestPostJson<T>(
  url: string,
  token: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    throw new Error(`LMS REST request failed for ${url}: ${response.status} ${response.statusText}${responseBody ? ` - ${responseBody}` : ""}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return await response.json() as T;
}

export async function lmsRestGetPaginatedJson<T>(url: string, token: string): Promise<T[]> {
  const items: T[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`LMS REST request failed for ${nextUrl}: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`);
    }

    const page = await response.json() as T[];
    items.push(...page);
    nextUrl = parseNextLink(response.headers.get("link"));
  }

  return items;
}
