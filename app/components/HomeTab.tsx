"use client";
import { useState, useEffect } from "react";
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
  const [rankedCasts, setRankedCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(true);
  
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

  // Fetch today's top casts from API
  useEffect(() => {
    async function fetchTodaysCasts() {
      try {
        setLoading(true);
        console.log("Fetching today's casts from API...");
        const response = await fetch("/api/casts/today");
        console.log("Response status:", response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("API error:", errorData);
          throw new Error(errorData.error || "Failed to fetch today's casts");
        }
        
        const data = await response.json();
        console.log("Received data:", data);
        console.log("Casts count:", data.casts?.length || 0);
        
        setRankedCasts(data.casts || []);
      } catch (error) {
        console.error("Error fetching today's casts:", error);
        setRankedCasts([]);
      } finally {
        setLoading(false);
      }
    }

    fetchTodaysCasts();
  }, []);

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

