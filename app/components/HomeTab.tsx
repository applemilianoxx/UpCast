"use client";
import { useLatestCasts } from "farcasterkit";
import { useState, useMemo } from "react";
import { Flame, Square, MessageSquare } from "lucide-react";
import styles from "./HomeTab.module.css";

interface Cast {
  hash: string;
  text: string;
  author: {
    fid: number;
    username: string;
    displayName: string;
    pfp?: { url: string };
  };
  reactions?: {
    likes: number;
    recasts: number;
    replies: number;
  };
  timestamp: number;
  embeds?: Array<{ url?: string }>;
}

interface Spotlight {
  id: string;
  castHash: string;
  cast: Cast;
  bidder: string;
  bidAmount: number;
  expiresAt: number;
}

export default function HomeTab() {
  // Fetch latest casts from all users (increased limit to get more data for today's filter)
  const { data: castsData, loading } = useLatestCasts({ limit: 500 });
  const [spotlights] = useState<Spotlight[]>([
    // Mock data for now
    {
      id: "1",
      castHash: "0x123",
      cast: {
        hash: "0x123",
        text: "Check out my new project! More details below",
        author: {
          fid: 1,
          username: "carol",
          displayName: "carol",
          pfp: { url: "" },
        },
        reactions: { likes: 0, recasts: 0, replies: 0 },
        timestamp: Date.now(),
        embeds: [],
      },
      bidder: "carol",
      bidAmount: 50,
      expiresAt: Date.now() + 86400000,
    },
    {
      id: "2",
      castHash: "0x456",
      cast: {
        hash: "0x456",
        text: "#web3 is the future 🌐",
        author: {
          fid: 2,
          username: "dave",
          displayName: "dave",
          pfp: { url: "" },
        },
        reactions: { likes: 0, recasts: 0, replies: 0 },
        timestamp: Date.now(),
        embeds: [],
      },
      bidder: "dave",
      bidAmount: 65,
      expiresAt: Date.now() + 86400000,
    },
  ]); // TODO: Fetch from API

  // Calculate score for ranking
  const calculateScore = (cast: Record<string, unknown>): number => {
    // Handle different possible response formats
    const reactions = cast.reactions as { likes?: number; recasts?: number; replies?: number } | undefined;
    const likes = reactions?.likes || (cast.likes as number | undefined) || 0;
    const recasts = reactions?.recasts || (cast.recasts as number | undefined) || 0;
    const replies = reactions?.replies || (cast.replies as number | undefined) || 0;
    const timestamp = (cast.timestamp as number | undefined) || (cast.publishedAt as number | undefined) || Date.now();
    const age = Date.now() - timestamp;
    const hoursOld = age / (1000 * 60 * 60);
    
    // Score formula: engagement weighted by recency
    const engagement = likes * 1 + recasts * 2 + replies * 1.5;
    const recencyBonus = Math.max(0, 24 - hoursOld) / 24; // Bonus for recent casts
    
    return engagement * (1 + recencyBonus * 0.5);
  };

  // Rank casts by score - filter to today only
  const rankedCasts = useMemo(() => {
    // useLatestCasts returns data as an array directly
    if (!castsData || !Array.isArray(castsData) || castsData.length === 0) {
      return [];
    }
    
    const casts = castsData;
    
    // Get today's date range (start of today to now)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTimestamp = todayStart.getTime();
    const nowTimestamp = Date.now();
    
    const castsWithScores = casts
      .map((cast: Record<string, unknown>) => {
        const author = cast.author as { fid?: number; username?: string; displayName?: string; pfp?: { url?: string } } | undefined;
        const reactions = cast.reactions as { likes?: number; recasts?: number; replies?: number } | undefined;
        const embeds = cast.embeds as Array<{ url?: string }> | undefined;
        const timestamp = (cast.timestamp as number | undefined) || (cast.publishedAt as number | undefined) || Date.now();
        
        // Filter: only include casts from today
        if (timestamp < todayStartTimestamp || timestamp > nowTimestamp) {
          return null;
        }
        
        return {
          hash: (cast.hash as string | undefined) || (cast.id as string | undefined) || "",
          text: (cast.text as string | undefined) || (cast.content as string | undefined) || "",
          author: {
            fid: author?.fid || (cast.fid as number | undefined) || 0,
            username: author?.username || (cast.username as string | undefined) || "unknown",
            displayName: author?.displayName || (cast.displayName as string | undefined) || "Unknown",
            pfp: { url: author?.pfp?.url || ((cast.pfp as { url?: string } | undefined)?.url) || "" },
          },
          reactions: {
            likes: reactions?.likes || (cast.likes as number | undefined) || 0,
            recasts: reactions?.recasts || (cast.recasts as number | undefined) || 0,
            replies: reactions?.replies || (cast.replies as number | undefined) || 0,
          },
          timestamp,
          embeds: embeds || [],
          score: calculateScore(cast),
        };
      })
      .filter((cast): cast is NonNullable<typeof cast> => cast !== null); // Remove nulls
    
    // Sort by engagement score (likes + recasts + replies) - no recency bonus for today's ranking
    return castsWithScores
      .sort((a, b) => {
        const aEngagement = (a.reactions.likes || 0) + (a.reactions.recasts || 0) + (a.reactions.replies || 0);
        const bEngagement = (b.reactions.likes || 0) + (b.reactions.recasts || 0) + (b.reactions.replies || 0);
        return bEngagement - aEngagement;
      })
      .slice(0, 20);
  }, [castsData]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading top casts...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Top Tabs */}
      <div className={styles.topTabs}>
        <button
          className={`${styles.topTab} ${styles.active}`}
        >
          Top Casts Today
        </button>
        <button
          className={styles.topTab}
        >
          Spotlight
        </button>
      </div>

      {/* Top Casts Section */}
      <section className={styles.topCastsSection}>
        <h2 className={styles.sectionTitle}>Top Casts Today</h2>
        <div className={styles.castsList}>
          {rankedCasts.map((cast, index) => (
            <div key={cast.hash} className={styles.castCard}>
              <div className={styles.rankBadge}>
                <span className={styles.rankNumber}>{index + 1}</span>
                <Flame className={styles.flameIcon} size={16} />
              </div>
              <div className={styles.castContent}>
                <div className={styles.castHeader}>
                  <div className={styles.authorInfo}>
                    {cast.author.pfp?.url ? (
                      <img
                        src={cast.author.pfp.url}
                        alt={cast.author.username}
                        className={styles.avatar}
                      />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        {cast.author.username[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    <div className={styles.authorName}>{cast.author.username}</div>
                  </div>
                </div>
                <p className={styles.castText}>{cast.text}</p>
                {cast.embeds?.[0]?.url && (
                  <div className={styles.embedImage}>
                    <img src={cast.embeds[0].url} alt="Embed" className={styles.embedImg} />
                  </div>
                )}
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
      </section>

      {/* Spotlight Section */}
      <section className={styles.spotlightSection}>
        <h2 className={styles.sectionTitle}>Spotlight Auctions</h2>
        <div className={styles.spotlightGrid}>
          {spotlights.map((spotlight, index) => (
            <div key={spotlight.id} className={styles.spotlightCard}>
              <div className={styles.spotlightTitle}>Auction Winner {index + 1}</div>
              <div className={styles.spotlightContent}>
                <div className={styles.spotlightAuthor}>
                  {spotlight.cast.author.pfp?.url ? (
                    <img
                      src={spotlight.cast.author.pfp.url}
                      alt={spotlight.cast.author.username}
                      className={styles.spotlightAvatar}
                    />
                  ) : (
                    <div className={styles.spotlightAvatarPlaceholder}>
                      {spotlight.cast.author.username[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div className={styles.spotlightAuthorName}>{spotlight.cast.author.username}</div>
                </div>
                <p className={styles.spotlightText}>{spotlight.cast.text}</p>
                <div className={styles.spotlightWon}>Won at ${spotlight.bidAmount}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

