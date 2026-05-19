import { useEffect } from "react";

import { env } from "@/lib/env";

const DEFAULT_SITE_NAME = "GradeAI";
const DEFAULT_OG_IMAGE_PATH = "/pwa-512x512.png";

export interface PageMetadata {
  title: string;
  description: string;
  path?: string;
  robots?: string;
  imagePath?: string;
  type?: "website" | "article";
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getSiteUrl = () => {
  if (env.VITE_APP_URL) {
    return trimTrailingSlash(env.VITE_APP_URL);
  }

  if (typeof window !== "undefined" && window.location.origin) {
    return trimTrailingSlash(window.location.origin);
  }

  return "https://your-app.example.com";
};

const buildAbsoluteUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
};

const upsertMeta = (selector: string, attributes: Record<string, string>) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
};

const upsertLink = (rel: string, href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }

  element.href = href;
};

export const applyPageMetadata = ({
  title,
  description,
  path = "/",
  robots = "index,follow",
  imagePath = DEFAULT_OG_IMAGE_PATH,
  type = "website",
}: PageMetadata) => {
  const canonicalUrl = buildAbsoluteUrl(path);
  const imageUrl = imagePath.startsWith("http") ? imagePath : buildAbsoluteUrl(imagePath);

  document.title = title;

  upsertMeta('meta[name="description"]', { name: "description", content: description });
  upsertMeta('meta[name="robots"]', { name: "robots", content: robots });
  upsertMeta('meta[name="author"]', { name: "author", content: DEFAULT_SITE_NAME });
  upsertMeta('meta[property="og:type"]', { property: "og:type", content: type });
  upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: DEFAULT_SITE_NAME });
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
  upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
  upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
  upsertMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });
  upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
  upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });
  upsertLink("canonical", canonicalUrl);
};

export const usePageMetadata = (metadata: PageMetadata | null) => {
  useEffect(() => {
    if (!metadata) {
      return;
    }

    applyPageMetadata(metadata);
  }, [metadata]);
};
