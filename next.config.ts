import type { NextConfig } from "next";

import { getDirectTraceProviderPolicies } from "./src/lib/trails/providers";

const isDev = process.env.NODE_ENV === "development";
const directTraceConnectSrc = Array.from(
  new Set(
    getDirectTraceProviderPolicies().map(
      (provider) => new URL(provider.baseUrl).origin,
    ),
  ),
).join(" ");

// Content Security Policy - allows only the external resources Aeris actually uses.
// https://nextjs.org/docs/app/guides/content-security-policy
//
// NOTE: planespotters.net, airport-data.com, and jetapi.dev are
// server-side only (accessed via /api/aircraft-photos proxy route). CSP does
// not apply to server-side fetches, so they are not listed in connect-src.
const cspHeader = `
  default-src 'self' https: data: blob:;
  script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https:;
  style-src 'self' 'unsafe-inline' https:;
  img-src 'self' data: blob: https:;
  font-src 'self' data: https:;
  media-src 'self' data: blob: https:;
  connect-src 'self' https: wss: data: blob: ${directTraceConnectSrc};
  worker-src 'self' blob: data:;
  child-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`;

const nextConfig: NextConfig = {
  transpilePackages: [
    "@deck.gl/core",
    "@deck.gl/layers",
    "@deck.gl/geo-layers",
    "@deck.gl/mesh-layers",
    "@deck.gl/mapbox",
    "@deck.gl/react",
    "@loaders.gl/core",
    "@loaders.gl/gltf",
    "@luma.gl/core",
    "@luma.gl/webgl",
  ],
  images: {
    remotePatterns: [
      { hostname: "a.basemaps.cartocdn.com" },
      { hostname: "server.arcgisonline.com" },
      { hostname: "tile.opentopomap.org" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader.replace(/\s{2,}/g, " ").trim(),
          },
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
        ],
      },
      {
        source: "/api/((?!routes(?:/|$)).*)",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
