import { NextResponse } from "next/server";
import { minikitConfig } from "../../../minikit.config";

export async function GET() {
  const manifest = {
    accountAssociation: minikitConfig.accountAssociation,
    baseBuilder: {
      ownerAddress: "0x", // TODO: Add your Base Account address
    },
    miniapp: {
      version: minikitConfig.miniapp.version,
      name: minikitConfig.miniapp.name,
      homeUrl: minikitConfig.miniapp.homeUrl,
      iconUrl: minikitConfig.miniapp.iconUrl,
      splashImageUrl: minikitConfig.miniapp.splashImageUrl,
      splashBackgroundColor: minikitConfig.miniapp.splashBackgroundColor,
      webhookUrl: minikitConfig.miniapp.webhookUrl,
      subtitle: minikitConfig.miniapp.subtitle,
      description: minikitConfig.miniapp.description,
      screenshotUrls: minikitConfig.miniapp.screenshotUrls,
      primaryCategory: minikitConfig.miniapp.primaryCategory,
      tags: minikitConfig.miniapp.tags,
      heroImageUrl: minikitConfig.miniapp.heroImageUrl,
      tagline: minikitConfig.miniapp.tagline,
      ogTitle: minikitConfig.miniapp.ogTitle,
      ogDescription: minikitConfig.miniapp.ogDescription,
      ogImageUrl: minikitConfig.miniapp.ogImageUrl,
      noindex: false,
    },
  };

  return NextResponse.json(manifest);
}
