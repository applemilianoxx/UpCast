"use client";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useState, useEffect } from "react";
import { Flame, Square, MessageSquare } from "lucide-react";
import { useLatestCasts } from "farcasterkit";
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

  // Fallback: Use farcasterkit hook directly
  const { data: fallbackCastsData, loading: fallbackLoading } = useLatestCasts(
    user?.fid ? { fid: user.fid, limit: 200 } : { limit: 0 }
  );

  // Fetch all user casts from API with fallback
  useEffect(() => {
    async function fetchUserCasts() {
      if (!user?.fid) {
        console.log("No FID available, skipping fetch");
        return;
      }

      try {
        setCastsLoading(true);
        console.log("Fetching user casts for FID:", user.fid);
        const response = await fetch(`/api/casts/user?fid=${user.fid}`);
        console.log("User casts response status:", response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("API error:", errorData);
          throw new Error(errorData.error || "Failed to fetch user casts");
        }
        
        const data = await response.json();
        console.log("Received user casts data:", data);
        console.log('Fetched user casts:', data.casts?.length || 0, 'Total:', data.total);
        
        if (data.casts && data.casts.length > 0) {
          setUserCasts(data.casts);
          setCastsLoading(false);
          return;
        }
        
        // Fallback: Use hook data if API returns empty
        console.log("API returned empty, using fallback data");
        throw new Error("No casts from API");
      } catch (error) {
        console.error("Error fetching user casts from API, using fallback:", error);
        // Fallback to hook data
        if (fallbackCastsData && Array.isArray(fallbackCastsData) && fallbackCastsData.length > 0) {
          console.log("Using fallback casts:", fallbackCastsData.length);
          processFallbackCasts(fallbackCastsData);
        } else {
          console.log("No fallback data available either");
          setUserCasts([]);
        }
        setCastsLoading(false);
      }
    }

    function processFallbackCasts(castsData: unknown[]) {
      const casts = castsData.map((cast: unknown) => {
        const castRecord = cast as unknown as Record<string, unknown>;
        const author = castRecord.author as { fid?: number; username?: string; displayName?: string; pfp?: { url?: string } } | undefined;
        const reactions = castRecord.reactions as { likes?: number; recasts?: number; replies?: number } | undefined;
        
        const likes = reactions?.likes || (castRecord.likes as number | undefined) || 0;
        const recasts = reactions?.recasts || (castRecord.recasts as number | undefined) || 0;
        const replies = reactions?.replies || (castRecord.replies as number | undefined) || 0;
        const timestamp = (castRecord.timestamp as number | undefined) || (castRecord.publishedAt as number | undefined) || Date.now();
        
        // Calculate score
        const age = Date.now() - timestamp;
        const hoursOld = age / (1000 * 60 * 60);
        const engagement = likes * 1 + recasts * 2 + replies * 1.5;
        const recencyBonus = Math.max(0, 24 - hoursOld) / 24;
        const score = engagement * (1 + recencyBonus * 0.5);

        return {
          hash: (castRecord.hash as string | undefined) || (castRecord.id as string | undefined) || "",
          text: (castRecord.text as string | undefined) || (castRecord.content as string | undefined) || "",
          author: {
            fid: author?.fid || (castRecord.fid as number | undefined) || 0,
            username: author?.username || (castRecord.username as string | undefined) || "unknown",
            displayName: author?.displayName || (castRecord.displayName as string | undefined) || "Unknown",
            pfp: { url: author?.pfp?.url || ((castRecord.pfp as { url?: string } | undefined)?.url) || "" },
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

      // Sort by score and return top 10
      const sorted = casts.sort((a, b) => b.score - a.score);
      console.log("Processed fallback casts:", sorted.length);
      setUserCasts(sorted.slice(0, 10));
    }

    fetchUserCasts();
  }, [user?.fid, fallbackCastsData]);

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

