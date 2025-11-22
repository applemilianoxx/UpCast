"use client";
import { ReactNode } from "react";
import { base } from "wagmi/chains";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { FarcasterKitProvider } from "farcasterkit";
import "@coinbase/onchainkit/styles.css";

export function RootProvider({ children }: { children: ReactNode }) {
  // Workaround for React 18/19 type mismatch between farcasterkit and project
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const FarcasterProviderWrapper = FarcasterKitProvider as any;
  
  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={base}
      config={{
        appearance: {
          mode: "auto",
        },
        wallet: {
          display: "modal",
          preference: "all",
        },
      }}
      miniKit={{
        enabled: true,
        autoConnect: true,
        notificationProxyUrl: undefined,
      }}
    >
      <FarcasterProviderWrapper>
        {children}
      </FarcasterProviderWrapper>
    </OnchainKitProvider>
  );
}
