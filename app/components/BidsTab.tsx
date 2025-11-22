"use client";
import { useState } from "react";
import styles from "./BidsTab.module.css";

interface Auction {
  id: string;
  castHash: string;
  castText: string;
  author: string;
  currentBid: number;
  yourBid?: number;
  timeRemaining: number;
  slotNumber: number;
}

export default function BidsTab() {
  const [auctions] = useState<Auction[]>([
    // TODO: Fetch from API
    {
      id: "1",
      castHash: "0x123",
      castText: "Example cast for spotlight auction...",
      author: "@example",
      currentBid: 0.05,
      timeRemaining: 3600000, // 1 hour in ms
      slotNumber: 1,
    },
  ]);
  const [bidAmount, setBidAmount] = useState("");
  const [selectedAuction, setSelectedAuction] = useState<string | null>(null);

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const handleBid = (auctionId: string) => {
    if (!bidAmount || parseFloat(bidAmount) <= 0) return;
    // TODO: Submit bid to API
    console.log("Bidding", bidAmount, "on auction", auctionId);
    setSelectedAuction(null);
    setBidAmount("");
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Spotlight Auctions</h1>
        <p className={styles.subtitle}>Bid to feature your cast on the front page</p>
      </div>

      {auctions.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>💰</div>
          <p>No active auctions at the moment</p>
          <p className={styles.emptySubtext}>
            Check back soon for new spotlight opportunities!
          </p>
        </div>
      ) : (
        <div className={styles.auctionsList}>
          {auctions.map((auction) => (
            <div key={auction.id} className={styles.auctionCard}>
              <div className={styles.auctionHeader}>
                <div className={styles.slotBadge}>Slot #{auction.slotNumber}</div>
                <div className={styles.timeRemaining}>
                  ⏱️ {formatTime(auction.timeRemaining)}
                </div>
              </div>
              
              <div className={styles.castPreview}>
                <div className={styles.author}>@{auction.author}</div>
                <p className={styles.castText}>{auction.castText}</p>
              </div>

              <div className={styles.bidInfo}>
                <div className={styles.currentBid}>
                  <span className={styles.label}>Current Bid:</span>
                  <span className={styles.amount}>{auction.currentBid} ETH</span>
                </div>
                {auction.yourBid && (
                  <div className={styles.yourBid}>
                    Your bid: {auction.yourBid} ETH
                  </div>
                )}
              </div>

              {selectedAuction === auction.id ? (
                <div className={styles.bidForm}>
                  <input
                    type="number"
                    step="0.001"
                    min={auction.currentBid + 0.001}
                    placeholder={`Min: ${auction.currentBid + 0.001} ETH`}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className={styles.bidInput}
                  />
                  <div className={styles.bidActions}>
                    <button
                      onClick={() => {
                        setSelectedAuction(null);
                        setBidAmount("");
                      }}
                      className={styles.cancelButton}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleBid(auction.id)}
                      className={styles.submitButton}
                      disabled={!bidAmount || parseFloat(bidAmount) <= auction.currentBid}
                    >
                      Place Bid
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedAuction(auction.id)}
                  className={styles.bidButton}
                >
                  Place Bid
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={styles.infoBox}>
        <h3>How Spotlight Works</h3>
        <ul>
          <li>Bid ETH to feature your cast in a spotlight slot</li>
          <li>Highest bidder wins the slot for 24 hours</li>
          <li>You can outbid others until the auction ends</li>
          <li>Earn rewards when your cast appears in spotlight</li>
        </ul>
      </div>
    </div>
  );
}

