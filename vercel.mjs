// Generated at Vercel build time. Keep deployment URLs out of Git.
 // Set RENDER_API_ORIGIN in Vercel Project > Settings > Environment Variables.
function resolveRenderOrigin(raw) {
  if (!raw) {
    throw new Error("RENDER_API_ORIGIN is required. Set it to https://<service>.onrender.com in Vercel.");
  }

  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("RENDER_API_ORIGIN must be a valid HTTPS origin.");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new Error("RENDER_API_ORIGIN must be an HTTPS origin without a path, query, or credentials.");
  }
  return url.origin;
}

const renderOrigin = resolveRenderOrigin(process.env.RENDER_API_ORIGIN);

export const config = {
  framework: "vite",
  installCommand: "npm ci --ignore-scripts",
  buildCommand: "VITE_FIRST_PARTY_API=1 npm run build --workspace=@ysabellestore/frontend",
  outputDirectory: "frontend/dist",
  rewrites: [
    // Same-origin reverse proxy: browser cookies stay scoped to the Vercel frontend.
    { source: "/api", destination: `${renderOrigin}/api` },
    { source: "/api/:path*", destination: `${renderOrigin}/api/:path*` },
    // React SPA routes (assets and other real files take filesystem precedence).
    { source: "/(.*)", destination: "/index.html" }
  ]
};
