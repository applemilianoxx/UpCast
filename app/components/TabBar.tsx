"use client";
import { Home, Gavel, Gift, User } from "lucide-react";
import styles from "./TabBar.module.css";

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const tabs = [
    { id: "home", label: "Home", Icon: Home },
    { id: "bids", label: "Bids", Icon: Gavel },
    { id: "rewards", label: "Rewards", Icon: Gift },
    { id: "profile", label: "Profile", Icon: User },
  ];

  return (
    <nav className={styles.tabBar}>
      {tabs.map((tab) => {
        const Icon = tab.Icon;
        return (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            <Icon className={styles.icon} size={20} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
            <span className={styles.label}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

