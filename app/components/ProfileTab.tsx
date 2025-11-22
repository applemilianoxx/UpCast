"use client";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useState } from "react";
import styles from "./ProfileTab.module.css";

interface UserStats {
  totalCasts: number;
  topRankedCasts: number;
  spotlightWins: number;
  totalBids: number;
  totalPoints: number;
  bestRank: number;
}

interface UserCast {
  hash: string;
  text: string;
  rank?: number;
  score: number;
  timestamp: number;
}

export default function ProfileTab() {
  const { context } = useMiniKit();
  // MiniKit user context is not fully typed, so we cast to a loose type for now
  const user = context?.user as {
    displayName?: string;
    username?: string;
    fid?: number;
    pfp?: { url?: string };
  } | undefined;
  const [stats] = useState<UserStats>({
    totalCasts: 42,
    topRankedCasts: 8,
    spotlightWins: 2,
    totalBids: 15,
    totalPoints: 1250,
    bestRank: 3,
  });

  const [userCasts] = useState<UserCast[]>([
    // TODO: Fetch user's casts from API
    {
      hash: "0x123",
      text: "My top cast that ranked #3!",
      rank: 3,
      score: 1250,
      timestamp: Date.now() - 3600000,
    },
  ]);

  const formatTime = (timestamp: number) => {
    const hours = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.avatarSection}>
          {user?.pfp?.url ? (
            <img
              src={user.pfp.url}
              alt={user.displayName || "User"}
              className={styles.avatar}
            />
          ) : (
            <div className={styles.avatarPlaceholder}>
              {user?.displayName?.[0] || "U"}
            </div>
          )}
          <div className={styles.userInfo}>
            <h1 className={styles.userName}>
              {user?.displayName || "User"}
            </h1>
            <p className={styles.userHandle}>
              @{user?.username || "username"}
            </p>
            {user?.fid && (
              <p className={styles.fid}>FID: {user.fid}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📊</div>
          <div className={styles.statValue}>{stats.totalCasts}</div>
          <div className={styles.statLabel}>Total Casts</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🏆</div>
          <div className={styles.statValue}>{stats.topRankedCasts}</div>
          <div className={styles.statLabel}>Top Ranked</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>✨</div>
          <div className={styles.statValue}>{stats.spotlightWins}</div>
          <div className={styles.statLabel}>Spotlight Wins</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🎁</div>
          <div className={styles.statValue}>{stats.totalPoints}</div>
          <div className={styles.statLabel}>Points</div>
        </div>
      </div>

      {/* Best Rank */}
      {stats.bestRank > 0 && (
        <div className={styles.bestRankCard}>
          <div className={styles.bestRankIcon}>🥇</div>
          <div>
            <div className={styles.bestRankLabel}>Best Rank</div>
            <div className={styles.bestRankValue}>#{stats.bestRank}</div>
          </div>
        </div>
      )}

      {/* Your Top Casts */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Your Top Casts</h2>
        {userCasts.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No ranked casts yet. Keep casting to get featured!</p>
          </div>
        ) : (
          <div className={styles.castsList}>
            {userCasts.map((cast) => (
              <div key={cast.hash} className={styles.castCard}>
                {cast.rank && (
                  <div className={styles.rankBadge}>#{cast.rank}</div>
                )}
                <div className={styles.castContent}>
                  <p className={styles.castText}>{cast.text}</p>
                  <div className={styles.castMeta}>
                    <span>Score: {Math.round(cast.score)}</span>
                    <span>{formatTime(cast.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bidding History */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Bidding History</h2>
        <div className={styles.bidStats}>
          <div className={styles.bidStat}>
            <span className={styles.bidStatLabel}>Total Bids:</span>
            <span className={styles.bidStatValue}>{stats.totalBids}</span>
          </div>
          <div className={styles.bidStat}>
            <span className={styles.bidStatLabel}>Wins:</span>
            <span className={styles.bidStatValue}>{stats.spotlightWins}</span>
          </div>
          <div className={styles.bidStat}>
            <span className={styles.bidStatLabel}>Win Rate:</span>
            <span className={styles.bidStatValue}>
              {stats.totalBids > 0
                ? Math.round((stats.spotlightWins / stats.totalBids) * 100)
                : 0}
              %
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

