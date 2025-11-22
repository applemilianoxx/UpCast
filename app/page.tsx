"use client";
import { useState, useEffect } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { sdk } from "@farcaster/miniapp-sdk";
import TabBar from "./components/TabBar";
import HomeTab from "./components/HomeTab";
import BidsTab from "./components/BidsTab";
import RewardsTab from "./components/RewardsTab";
import ProfileTab from "./components/ProfileTab";
import styles from "./page.module.css";

export default function Home() {
  const { isFrameReady, setFrameReady } = useMiniKit();
  const [activeTab, setActiveTab] = useState("home");

  // Initialize the miniapp and call ready()
  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
    // Call ready() to hide loading splash screen
    sdk.actions.ready();
  }, [setFrameReady, isFrameReady]);

  const renderTab = () => {
    switch (activeTab) {
      case "home":
        return <HomeTab />;
      case "bids":
        return <BidsTab />;
      case "rewards":
        return <RewardsTab />;
      case "profile":
        return <ProfileTab />;
      default:
        return <HomeTab />;
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        {renderTab()}
      </main>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
