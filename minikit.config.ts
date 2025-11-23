const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

/**
 * MiniApp configuration object. Must follow the Farcaster MiniApp specification.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export const minikitConfig = {
  accountAssociation: {
    header: "eyJmaWQiOjE0MDcyNTYsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHgyNDg3OTQ2ZTM2NDVjYTI2ZTVDMzY2MzFEQzBiMEUyNEYxNGE4M0JBIn0",
    payload: "eyJkb21haW4iOiJjdWJleS1taW5pLWFwcC52ZXJjZWwuYXBwIn0",
    signature: "cD6bcNlQp7EiqBeC3BgbvHYJmsAshCSyrnMoW/UD1HVFLIhAWguk7DRyvi7Z+SisS/N9qS0iWSDciqYXAQkZBhw=",
  },
  miniapp: {
    version: "1",
    name: "UPLYST", 
    subtitle: "Front page for Farcaster casts", 
    description: "UPLYST is the front page for Farcaster casts, combining organic top posts with paid spotlight auctions, rewards, and a personal performance profile.",
    screenshotUrls: [`${ROOT_URL}/screenshot-portrait.png`],
    iconUrl: `${ROOT_URL}/blue-icon.png`,
    splashImageUrl: `${ROOT_URL}/blue-hero.png`,
    splashBackgroundColor: "#000000",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "social",
    tags: ["farcaster", "casts", "ranking", "auctions", "discovery"],
    heroImageUrl: `${ROOT_URL}/blue-hero.png`, 
    tagline: "Front page for Farcaster casts",
    ogTitle: "UPLYST - Front page for Farcaster casts",
    ogDescription: "Discover top casts and bid for spotlight slots",
    ogImageUrl: `${ROOT_URL}/blue-hero.png`,
  },
} as const;

