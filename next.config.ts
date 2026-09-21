import type { NextConfig } from "next";

/* GH_PAGES=1 → static export under /<repo>/ for GitHub Pages.
   API routes must be moved aside during that build (see deploy workflow). */
const gh = process.env.GH_PAGES === "1";
const repo = process.env.GH_REPO ?? "dosewise";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  ...(gh && {
    output: "export",
    basePath: `/${repo}`,
    assetPrefix: `/${repo}/`,
    trailingSlash: true,
  }),
};

export default nextConfig;
