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
      const startTime = Date.now();
      console.log("🏠 [HomeTab] Starting to fetch today's casts...");
      
      try {
        setLoading(true);
        console.log("🏠 [HomeTab] Loading state set to true");
        console.log("🏠 [HomeTab] Making fetch request to /api/casts/today");
        
        const response = await fetch("/api/casts/today");
        const fetchTime = Date.now() - startTime;
        console.log(`🏠 [HomeTab] Fetch completed in ${fetchTime}ms`);
        console.log("🏠 [HomeTab] Response status:", response.status);
        console.log("🏠 [HomeTab] Response ok:", response.ok);
        console.log("🏠 [HomeTab] Response headers:", Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("🏠 [HomeTab] ❌ Response not OK, error text:", errorText);
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
            console.error("🏠 [HomeTab] ❌ Parsed error data:", errorData);
          } catch (e) {
            console.error("🏠 [HomeTab] ❌ Could not parse error as JSON:", e);
            errorData = { error: errorText };
          }
          
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        console.log("🏠 [HomeTab] ✅ Response OK, parsing JSON...");
        const data = await response.json();
        const totalTime = Date.now() - startTime;
        console.log(`🏠 [HomeTab] ✅ JSON parsed in ${totalTime}ms total`);
        console.log("🏠 [HomeTab] 📦 Received data structure:", {
          hasCasts: !!data.casts,
          castsType: Array.isArray(data.casts) ? 'array' : typeof data.casts,
          castsLength: data.casts?.length || 0,
          total: data.total,
          keys: Object.keys(data),
          firstCast: data.casts?.[0] ? {
            hash: data.casts[0].hash,
            text: data.casts[0].text?.substring(0, 50),
            author: data.casts[0].author?.username,
          } : null,
        });
        console.log("🏠 [HomeTab] 📊 Full data object:", data);
        
        if (data.casts && Array.isArray(data.casts)) {
          console.log(`🏠 [HomeTab] ✅ Setting ${data.casts.length} casts to state`);
          setRankedCasts(data.casts);
        } else {
          console.warn("🏠 [HomeTab] ⚠️ No casts array in response, setting empty array");
          setRankedCasts([]);
        }
      } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`🏠 [HomeTab] ❌ Error after ${totalTime}ms:`, error);
        console.error("🏠 [HomeTab] ❌ Error details:", {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        console.error("🏠 [HomeTab] ❌ Setting empty casts array due to error");
        setRankedCasts([]);
      } finally {
        const totalTime = Date.now() - startTime;
        console.log(`🏠 [HomeTab] 🏁 Finished fetch attempt in ${totalTime}ms`);
        setLoading(false);
        console.log("🏠 [HomeTab] Loading state set to false");
      }
    }

    console.log("🏠 [HomeTab] useEffect triggered, calling fetchTodaysCasts");
    fetchTodaysCasts();
  }, []);

  // Debug: Log state changes
  useEffect(() => {
    console.log("🏠 [HomeTab] State update:", {
      loading,
      rankedCastsCount: rankedCasts.length,
      hasCasts: rankedCasts.length > 0,
    });
  }, [loading, rankedCasts]);

  if (loading) {
    console.log("🏠 [HomeTab] Rendering loading state");
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading top casts...</div>
      </div>
    );
  }
  
  console.log("🏠 [HomeTab] Rendering casts list with", rankedCasts.length, "casts");

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

