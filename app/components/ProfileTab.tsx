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
    console.log('🔵 [ProfileTab] MiniKit user context:', context.user);
  }
  
  // MiniKit user context is not fully typed, so we cast to a loose type for now
  // Add null safety
  const user = (context?.user as {
    displayName?: string;
    username?: string;
    fid?: number;
    pfp?: { url?: string };
    avatar?: string;
    profileImage?: string;
  } | undefined) || null;
  
  // Try multiple possible profile picture properties
  const userAny = context?.user as Record<string, unknown> | undefined;
  const profileImageUrl = 
    (user?.pfp?.url) || 
    (user?.avatar) || 
    (user?.profileImage) || 
    (userAny?.pfpUrl as string | undefined) || 
    (userAny?.avatarUrl as string | undefined) ||
    ((userAny?.pfp as Record<string, unknown> | undefined)?.url as string | undefined) ||
    ((userAny?.profile as Record<string, unknown> | undefined)?.image as string | undefined) ||
    (userAny?.profileImage as string | undefined) ||
    undefined; // Explicitly set to undefined if nothing found
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
        console.log("No FID available, skipping fetch");
        setUserCasts([]);
        setCastsLoading(false);
        return;
      }

      try {
        setCastsLoading(true);
        console.log("🔵 [ProfileTab] Fetching user casts for FID:", user.fid);
        const response = await fetch(`/api/casts/user?fid=${user.fid}`);
        console.log("🔵 [ProfileTab] User casts response status:", response.status);
        
        const data = await response.json().catch((err) => {
          console.error("🔵 [ProfileTab] Failed to parse JSON:", err);
          return { casts: [], error: "Failed to parse response" };
        });
        
        console.log("🔵 [ProfileTab] Received user casts data:", data);
        
        // Handle API errors gracefully
        if (data.error) {
          console.warn("🔵 [ProfileTab] API returned error:", data.error);
          setUserCasts([]);
          return;
        }
        
        // Ensure casts is an array
        const casts = Array.isArray(data.casts) ? data.casts : [];
        console.log('🔵 [ProfileTab] Fetched user casts:', casts.length, 'Total:', data.total);
        
        setUserCasts(casts);
      } catch (error) {
        console.error("🔵 [ProfileTab] Error fetching user casts:", error);
        setUserCasts([]);
      } finally {
        setCastsLoading(false);
      }
    }

    fetchUserCasts();
  }, [user?.fid]);

  // Calculate stats from userCasts with safety checks
  const stats: UserStats = {
    totalCasts: Array.isArray(userCasts) ? userCasts.length : 0,
    topRankedCasts: Array.isArray(userCasts) 
      ? userCasts.filter((c) => c && typeof c.score === 'number' && c.score > 100).length 
      : 0,
    spotlightWins: 2, // TODO: Fetch from API
    totalBids: 15, // TODO: Fetch from API
    totalPoints: 1250, // TODO: Fetch from API
    bestRank: 3, // TODO: Calculate from actual ranking
  };


  // Safety check - if no user context, show loading/error state
  if (!context || !user) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <p>Loading profile...</p>
          <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '8px' }}>
            Please make sure you're logged in to Farcaster
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.avatarSection}>
          {profileImageUrl ? (
            <img
              src={profileImageUrl}
              alt={user?.displayName || user?.username || "User"}
              className={styles.avatar}
              onError={(e) => {
                // Fallback to placeholder if image fails to load
                try {
                  e.currentTarget.style.display = 'none';
                  const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                  if (placeholder) placeholder.style.display = 'flex';
                } catch (err) {
                  console.error("Error handling image load:", err);
                }
              }}
            />
          ) : null}
          <div 
            className={styles.avatarPlaceholder}
            style={{ display: profileImageUrl ? 'none' : 'flex' }}
          >
            {(user?.displayName?.[0] || user?.username?.[0] || "U").toUpperCase()}
          </div>
          <div className={styles.userInfo}>
            <h1 className={styles.userName}>
              {user?.displayName || user?.username || "User"}
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
            <p>No casts found. Make sure you have casts on Farcaster!</p>
            {user?.fid && (
              <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '8px' }}>
                FID: {user.fid}
              </p>
            )}
          </div>
        ) : (
          <div className={styles.castsList}>
            {userCasts
              .filter((cast) => cast && cast.hash) // Filter out any null/undefined casts
              .map((cast) => (
                <div key={cast.hash || `cast-${Math.random()}`} className={styles.castCard}>
                  <div className={styles.castContent}>
                    <p className={styles.castText}>{cast.text || "No text"}</p>
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

