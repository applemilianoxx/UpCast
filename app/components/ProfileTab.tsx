"use client";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useState, useEffect } from "react";
import { Flame, Square, MessageSquare } from "lucide-react";
import styles from "./ProfileTab.module.css";

interface UserStats {
  totalCasts: number;
  topRankedCasts: number;
  spotlightWins: number;
  totalBids: number;
  totalPoints: number;
  bestRank: number;
}


export default function ProfileTab() {
  const { context } = useMiniKit();
  
  // Debug: Log context to see what's available
  if (typeof window !== 'undefined' && context?.user) {
    console.log('MiniKit user context:', context.user);
  }
  
  // MiniKit user context is not fully typed, so we cast to a loose type for now
  const user = context?.user as {
    displayName?: string;
    username?: string;
    fid?: number;
    pfp?: { url?: string };
    avatar?: string;
    profileImage?: string;
  } | undefined;
  
  // Try multiple possible profile picture properties
  const userAny = context?.user as Record<string, unknown> | undefined;
  const profileImageUrl = 
    user?.pfp?.url || 
    user?.avatar || 
    user?.profileImage || 
    (userAny?.pfpUrl as string | undefined) || 
    (userAny?.avatarUrl as string | undefined) ||
    ((userAny?.pfp as Record<string, unknown> | undefined)?.url as string | undefined) ||
    ((userAny?.profile as Record<string, unknown> | undefined)?.image as string | undefined) ||
    (userAny?.profileImage as string | undefined);
  const [userCasts, setUserCasts] = useState<Array<{
    hash: string;
    text: string;
    author: {
      fid: number;
      username: string;
      displayName: string;
      pfp?: { url?: string };
    };
    reactions: {
      likes: number;
      recasts: number;
      replies: number;
    };
    timestamp: number;
    score: number;
  }>>([]);
  const [castsLoading, setCastsLoading] = useState(false);

  // Fetch all user casts from API
  useEffect(() => {
    async function fetchUserCasts() {
      if (!user?.fid) {
        return;
      }

      try {
        setCastsLoading(true);
        const response = await fetch(`/api/casts/user?fid=${user.fid}`);
        if (!response.ok) {
          throw new Error("Failed to fetch user casts");
        }
        const data = await response.json();
        setUserCasts(data.casts || []);
        console.log('Fetched user casts:', data.casts?.length || 0, 'Total:', data.total);
      } catch (error) {
        console.error("Error fetching user casts:", error);
        setUserCasts([]);
      } finally {
        setCastsLoading(false);
      }
    }

    fetchUserCasts();
  }, [user?.fid]);

  // Calculate stats from userCasts
  const stats: UserStats = {
    totalCasts: userCasts.length,
    topRankedCasts: userCasts.filter((c) => c.score > 100).length,
    spotlightWins: 2, // TODO: Fetch from API
    totalBids: 15, // TODO: Fetch from API
    totalPoints: 1250, // TODO: Fetch from API
    bestRank: 3, // TODO: Calculate from actual ranking
  };


  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.avatarSection}>
          {profileImageUrl ? (
            <img
              src={profileImageUrl}
              alt={user?.displayName || "User"}
              className={styles.avatar}
              onError={(e) => {
                // Fallback to placeholder if image fails to load
                e.currentTarget.style.display = 'none';
                const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                if (placeholder) placeholder.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className={styles.avatarPlaceholder}
            style={{ display: profileImageUrl ? 'none' : 'flex' }}
          >
            {user?.displayName?.[0] || user?.username?.[0]?.toUpperCase() || "U"}
          </div>
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

      {/* Your Top Casts - Right below profile */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Your Top Casts</h2>
        {castsLoading ? (
          <div className={styles.emptyState}>
            <p>Loading your casts...</p>
          </div>
        ) : userCasts.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No casts yet. Start casting to see them here!</p>
          </div>
        ) : (
          <div className={styles.castsList}>
            {userCasts.map((cast) => (
              <div key={cast.hash} className={styles.castCard}>
                <div className={styles.castContent}>
                  <p className={styles.castText}>{cast.text}</p>
                  <div className={styles.castStats}>
                    <span className={styles.statItem}>
                      <Flame className={styles.statIcon} size={14} />
                      {cast.reactions?.likes || 0}
                    </span>
                    <span className={styles.statItem}>
                      <Square className={styles.statIcon} size={14} />
                      {cast.reactions?.recasts || 0}
                    </span>
                    <span className={styles.statItem}>
                      <MessageSquare className={styles.statIcon} size={14} />
                      {cast.reactions?.replies || 0}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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

