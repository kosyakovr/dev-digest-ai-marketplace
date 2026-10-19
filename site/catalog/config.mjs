// Site-wide settings shared by the Vite config, the catalog builder and the route writer.

/** GitHub "owner/repo" of the marketplace. CI sets GITHUB_REPOSITORY; the default covers local runs. */
export const REPO = process.env.GITHUB_REPOSITORY || "kosyakovr/dev-digest-ai-marketplace";

/** URL path the site is served from. GitHub Pages project sites live under /<repo>/. */
export const SITE_BASE = process.env.SITE_BASE || `/${REPO.split("/")[1]}/`;

/** Branch that GitHub "View source" links point to. */
export const BRANCH = "main";
