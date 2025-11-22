"use client";
import { useLatestCasts } from "farcasterkit";
import { useState, useMemo } from "react";
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
  const { data: castsData, loading } = useLatestCasts({ limit: 100 });
  const [spotlights] = useState<Spotlight[]>([]); // TODO: Fetch from API

  // Calculate score for ranking
  const calculateScore = (cast: any): number => {
    // Handle different possible response formats
    const likes = cast.reactions?.likes || cast.likes || 0;
    const recasts = cast.reactions?.recasts || cast.recasts || 0;
    const replies = cast.reactions?.replies || cast.replies || 0;
    const timestamp = cast.timestamp || cast.publishedAt || Date.now();
    const age = Date.now() - timestamp;
    const hoursOld = age / (1000 * 60 * 60);
    
    // Score formula: engagement weighted by recency
    const engagement = likes * 1 + recasts * 2 + replies * 1.5;
    const recencyBonus = Math.max(0, 24 - hoursOld) / 24; // Bonus for recent casts
    
    return engagement * (1 + recencyBonus * 0.5);
  };

  // Rank casts by score
  const rankedCasts = useMemo(() => {
    // Handle different response formats from Farcaster Kit
    const casts = castsData?.casts || castsData?.data || castsData || [];
    if (!Array.isArray(casts) || casts.length === 0) return [];
    
    const castsWithScores = casts.map((cast: any) => ({
      hash: cast.hash || cast.id,
      text: cast.text || cast.content || "",
      author: {
        fid: cast.author?.fid || cast.fid || 0,
        username: cast.author?.username || cast.username || "unknown",
        displayName: cast.author?.displayName || cast.displayName || "Unknown",
        pfp: { url: cast.author?.pfp?.url || cast.pfp?.url || "" },
      },
      reactions: {
        likes: cast.reactions?.likes || cast.likes || 0,
        recasts: cast.reactions?.recasts || cast.recasts || 0,
        replies: cast.reactions?.replies || cast.replies || 0,
      },
      timestamp: cast.timestamp || cast.publishedAt || Date.now(),
      embeds: cast.embeds || [],
      score: calculateScore(cast),
    }));
    
    return castsWithScores.sort((a, b) => b.score - a.score).slice(0, 20);
  }, [castsData]);

  const formatTime = (timestamp: number) => {
    const hours = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading top casts...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>UPLYST</h1>
        <p className={styles.subtitle}>Top Casts Today</p>
      </div>

      {/* Spotlight Section */}
      {spotlights.length > 0 && (
        <section className={styles.spotlightSection}>
          <h2 className={styles.sectionTitle}>✨ Spotlight</h2>
          <div className={styles.spotlightGrid}>
            {spotlights.map((spotlight) => (
              <div key={spotlight.id} className={styles.spotlightCard}>
                <div className={styles.spotlightBadge}>PAID</div>
                <div className={styles.spotlightContent}>
                  <div className={styles.spotlightAuthor}>
                    {spotlight.cast.author.pfp?.url && (
                      <img
                        src={spotlight.cast.author.pfp.url}
                        alt={spotlight.cast.author.displayName}
                        className={styles.avatar}
                      />
                    )}
                    <div>
                      <div className={styles.authorName}>
                        {spotlight.cast.author.displayName}
                      </div>
                      <div className={styles.authorHandle}>
                        @{spotlight.cast.author.username}
                      </div>
                    </div>
                  </div>
                  <p className={styles.castText}>{spotlight.cast.text}</p>
                  <div className={styles.spotlightMeta}>
                    <span>Bid: {spotlight.bidAmount} ETH</span>
                    <span>Expires in {Math.ceil((spotlight.expiresAt - Date.now()) / (1000 * 60 * 60))}h</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Casts Section */}
      <section className={styles.topCastsSection}>
        <h2 className={styles.sectionTitle}>🔥 Top Casts Today</h2>
        <div className={styles.castsList}>
          {rankedCasts.map((cast, index) => (
            <div key={cast.hash} className={styles.castCard}>
              <div className={styles.rankBadge}>#{index + 1}</div>
              <div className={styles.castContent}>
                <div className={styles.castHeader}>
                  <div className={styles.authorInfo}>
                    {cast.author.pfp?.url && (
                      <img
                        src={cast.author.pfp.url}
                        alt={cast.author.displayName}
                        className={styles.avatar}
                      />
                    )}
                    <div>
                      <div className={styles.authorName}>
                        {cast.author.displayName}
                      </div>
                      <div className={styles.authorHandle}>
                        @{cast.author.username}
                      </div>
                    </div>
                  </div>
                  <div className={styles.timeAgo}>{formatTime(cast.timestamp)}</div>
                </div>
                <p className={styles.castText}>{cast.text}</p>
                {cast.embeds?.[0]?.url && (
                  <div className={styles.embed}>
                    <a href={cast.embeds[0].url} target="_blank" rel="noopener noreferrer">
                      {cast.embeds[0].url}
                    </a>
                  </div>
                )}
                <div className={styles.castStats}>
                  <span>❤️ {cast.reactions?.likes || 0}</span>
                  <span>🔄 {cast.reactions?.recasts || 0}</span>
                  <span>💬 {cast.reactions?.replies || 0}</span>
                  <span className={styles.score}>Score: {Math.round(cast.score)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

