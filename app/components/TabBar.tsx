"use client";
import styles from "./TabBar.module.css";

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const tabs = [
    { id: "home", label: "Home", icon: "🏠" },
    { id: "bids", label: "Bids", icon: "💰" },
    { id: "rewards", label: "Rewards", icon: "🎁" },
    { id: "profile", label: "Profile", icon: "👤" },
  ];

  return (
    <nav className={styles.tabBar}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles.active : ""}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className={styles.icon}>{tab.icon}</span>
          <span className={styles.label}>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

