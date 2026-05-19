import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");

const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

const parseEnvFile = (content) =>
  Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        const unquotedValue = rawValue.replace(/^['"]|['"]$/g, "");

        return [key, unquotedValue];
      }),
  );

const readEnvValue = (key) => {
  if (process.env[key]) {
    return process.env[key];
  }

  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(projectRoot, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const parsed = parseEnvFile(fs.readFileSync(filePath, "utf8"));
    if (parsed[key]) {
      return parsed[key];
    }
  }

  return undefined;
};

const siteUrl = trimTrailingSlash(readEnvValue("VITE_APP_URL") || "https://your-app.example.com");
const today = new Date().toISOString().slice(0, 10);

const robotsContent = `User-agent: *
Allow: /
Disallow: /auth
Disallow: /reset-password
Disallow: /force-password-change
Disallow: /dashboard

Sitemap: ${siteUrl}/sitemap.xml
`;

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/privacy</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
`;

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "robots.txt"), robotsContent);
fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemapContent);

if (siteUrl === "https://your-app.example.com") {
  console.warn("SEO assets generated with placeholder VITE_APP_URL. Set VITE_APP_URL before deploying.");
}
