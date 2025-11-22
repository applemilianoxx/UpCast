"use client";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useLatestCasts } from "farcasterkit";
import { useState, useMemo } from "react";
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
  // Fetch user's casts if FID is available
  // Increased limit and will try to fetch multiple pages if needed
  const { data: userCastsData, loading: castsLoading } = useLatestCasts(
    user?.fid ? { fid: user.fid, limit: 500 } : { limit: 0 }
  );
  
  // Also try fetching without limit restriction to get more casts
  const { data: userCastsData2 } = useLatestCasts(
    user?.fid ? { fid: user.fid, limit: 1000 } : { limit: 0 }
  );
  
  // Combine both data sources if available
  const combinedCastsData = useMemo(() => {
    const casts1 = Array.isArray(userCastsData) ? userCastsData : [];
    const casts2 = Array.isArray(userCastsData2) ? userCastsData2 : [];
    // Remove duplicates by hash
    const allCasts = [...casts1, ...casts2];
    const uniqueCasts = allCasts.filter((cast, index, self) => {
      const hash = (cast as Record<string, unknown>).hash || (cast as Record<string, unknown>).id;
      return index === self.findIndex((c) => 
        ((c as Record<string, unknown>).hash || (c as Record<string, unknown>).id) === hash
      );
    });
    return uniqueCasts.length > 0 ? uniqueCasts : (userCastsData || userCastsData2);
  }, [userCastsData, userCastsData2]);

  // Debug: Log casts data
  if (typeof window !== 'undefined') {
    console.log('User FID:', user?.fid);
    console.log('User casts data 1:', userCastsData);
    console.log('User casts data 2:', userCastsData2);
    console.log('Combined casts data:', combinedCastsData);
    console.log('Casts loading:', castsLoading);
  }

  // Process and rank user's casts
  const userCasts = useMemo(() => {
    // Handle different response formats - use combined data
    let casts: unknown[] = [];
    if (Array.isArray(combinedCastsData)) {
      casts = combinedCastsData;
    } else if (combinedCastsData && typeof combinedCastsData === 'object') {
      const dataObj = combinedCastsData as Record<string, unknown>;
      if (Array.isArray(dataObj.casts)) {
        casts = dataObj.casts;
      } else if (Array.isArray(dataObj.data)) {
        casts = dataObj.data;
      }
    } else if (Array.isArray(userCastsData)) {
      casts = userCastsData;
    } else if (userCastsData && typeof userCastsData === 'object') {
      const dataObj = userCastsData as Record<string, unknown>;
      if (Array.isArray(dataObj.casts)) {
        casts = dataObj.casts;
      } else if (Array.isArray(dataObj.data)) {
        casts = dataObj.data;
      }
    }

    if (!Array.isArray(casts) || casts.length === 0) {
      console.log('No casts found or invalid format');
      return [];
    }

    console.log('Processing casts:', casts.length);

    const processedCasts = casts.map((cast) => {
      const castData = cast as Record<string, unknown>;
      const author = castData.author as { fid?: number; username?: string; displayName?: string; pfp?: { url?: string } } | undefined;
      const reactions = castData.reactions as { likes?: number; recasts?: number; replies?: number } | undefined;
      
      const likes = reactions?.likes || (castData.likes as number | undefined) || 0;
      const recasts = reactions?.recasts || (castData.recasts as number | undefined) || 0;
      const replies = reactions?.replies || (castData.replies as number | undefined) || 0;
      const timestamp = (castData.timestamp as number | undefined) || (castData.publishedAt as number | undefined) || Date.now();
      
      // Calculate score similar to HomeTab
      const age = Date.now() - timestamp;
      const hoursOld = age / (1000 * 60 * 60);
      const engagement = likes * 1 + recasts * 2 + replies * 1.5;
      const recencyBonus = Math.max(0, 24 - hoursOld) / 24;
      const score = engagement * (1 + recencyBonus * 0.5);

      return {
        hash: (castData.hash as string | undefined) || (castData.id as string | undefined) || "",
        text: (castData.text as string | undefined) || (castData.content as string | undefined) || "",
        author: {
          fid: author?.fid || (castData.fid as number | undefined) || 0,
          username: author?.username || (castData.username as string | undefined) || "unknown",
          displayName: author?.displayName || (castData.displayName as string | undefined) || "Unknown",
          pfp: { url: author?.pfp?.url || ((castData.pfp as { url?: string } | undefined)?.url) || "" },
        },
        reactions: {
          likes,
          recasts,
          replies,
        },
        timestamp,
        score,
      };
    });

    // Sort by score and return all (not just top 10, show all user casts)
    const sorted = processedCasts.sort((a, b) => b.score - a.score);
    console.log('Processed and sorted casts:', sorted.length);
    return sorted;
  }, [combinedCastsData, userCastsData]);

  const [stats] = useState<UserStats>({
    totalCasts: userCasts.length,
    topRankedCasts: userCasts.filter((c) => c.score > 100).length,
    spotlightWins: 2,
    totalBids: 15,
    totalPoints: 1250,
    bestRank: 3,
  });


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

