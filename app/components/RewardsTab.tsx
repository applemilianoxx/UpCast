"use client";
import { useState } from "react";
import styles from "./RewardsTab.module.css";

interface Reward {
  id: string;
  type: "points" | "badge" | "perk";
  title: string;
  description: string;
  points?: number;
  icon: string;
  earned?: boolean;
}

interface UserRewards {
  totalPoints: number;
  badges: string[];
  perks: string[];
}

export default function RewardsTab() {
  const [userRewards] = useState<UserRewards>({
    totalPoints: 1250,
    badges: ["Top Caster", "Spotlight Winner"],
    perks: ["10% Discount"],
  });

  const [rewards] = useState<Reward[]>([
    {
      id: "1",
      type: "perk",
      title: "10% Spotlight Discount",
      description: "Get 10% off your next spotlight bid",
      points: 500,
      icon: "🎯",
    },
    {
      id: "2",
      type: "perk",
      title: "25% Spotlight Discount",
      description: "Get 25% off your next spotlight bid",
      points: 2000,
      icon: "⭐",
    },
    {
      id: "3",
      type: "badge",
      title: "Top Caster Badge",
      description: "Earned by reaching top 10 casts",
      points: 1000,
      icon: "🏆",
      earned: true,
    },
    {
      id: "4",
      type: "badge",
      title: "Spotlight Winner Badge",
      description: "Earned by winning a spotlight auction",
      points: 1500,
      icon: "✨",
      earned: true,
    },
    {
      id: "5",
      type: "perk",
      title: "Featured Placement",
      description: "Guaranteed top 3 placement for 24h",
      points: 5000,
      icon: "👑",
    },
  ]);

  const handleRedeem = (reward: Reward) => {
    if (userRewards.totalPoints < (reward.points || 0)) {
      alert("Not enough points!");
      return;
    }
    // TODO: Redeem via API
    console.log("Redeeming", reward.title);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Rewards</h1>
        <div className={styles.pointsDisplay}>
          <div className={styles.pointsIcon}>🎁</div>
          <div>
            <div className={styles.pointsLabel}>Total Points</div>
            <div className={styles.pointsValue}>{userRewards.totalPoints.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Earned Badges */}
      {userRewards.badges.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Your Badges</h2>
          <div className={styles.badgesGrid}>
            {userRewards.badges.map((badge, index) => (
              <div key={index} className={styles.badgeCard}>
                <div className={styles.badgeIcon}>🏆</div>
                <div className={styles.badgeName}>{badge}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Available Rewards */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Available Rewards</h2>
        <div className={styles.rewardsList}>
          {rewards.map((reward) => (
            <div
              key={reward.id}
              className={`${styles.rewardCard} ${reward.earned ? styles.earned : ""}`}
            >
              <div className={styles.rewardIcon}>{reward.icon}</div>
              <div className={styles.rewardContent}>
                <div className={styles.rewardHeader}>
                  <h3 className={styles.rewardTitle}>{reward.title}</h3>
                  {reward.earned && (
                    <span className={styles.earnedBadge}>Earned</span>
                  )}
                </div>
                <p className={styles.rewardDescription}>{reward.description}</p>
                {reward.points && (
                  <div className={styles.rewardFooter}>
                    <span className={styles.pointsCost}>
                      {reward.points.toLocaleString()} points
                    </span>
                    {!reward.earned && (
                      <button
                        onClick={() => handleRedeem(reward)}
                        className={`${styles.redeemButton} ${
                          userRewards.totalPoints >= reward.points
                            ? ""
                            : styles.disabled
                        }`}
                        disabled={userRewards.totalPoints < reward.points}
                      >
                        {userRewards.totalPoints >= reward.points
                          ? "Redeem"
                          : "Not Enough Points"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How to Earn */}
      <div className={styles.infoBox}>
        <h3>How to Earn Points</h3>
        <ul>
          <li>Get your cast in Top Casts Today: +50 points</li>
          <li>Reach top 10: +200 points</li>
          <li>Reach top 3: +500 points</li>
          <li>Win a spotlight auction: +300 points</li>
          <li>Refer a friend: +100 points</li>
        </ul>
      </div>
    </div>
  );
}

