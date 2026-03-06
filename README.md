# 🔒 Oracle — Private Prediction Markets on Solana × Arcium

> **Arcium RTG Bounty Submission** — Prediction/Opinion Markets track

Prediction markets aggregate collective intelligence — but only when participants reveal their genuine beliefs. On traditional platforms, **public stakes create herding**: users copy popular positions rather than contributing independent analysis, distorting prices and defeating the entire purpose.

**Oracle** solves this with Arcium's Multi-Party Computation (MPC). Stakes, votes, and resolution inputs remain **fully encrypted on-chain** until settlement. Outcomes are revealed honestly, restoring incentive-compatible participation.

---

## 🎯 What This Project Does

Oracle is a fully functional decentralised prediction market where:

| Feature | Traditional Market | Oracle (Arcium) |
|---|---|---|
| Stake amount visible | ✅ Anyone can see | ❌ Encrypted (ElGamal) |
| Vote direction visible | ✅ YES/NO on-chain | ❌ Ciphertext on-chain |
| Real-time odds | ✅ Manipulatable | ❌ Hidden until settlement |
| Resolution input | ✅ Oracle can be front-run | ❌ Encrypted until MPC tally |
| Settlement | Simple summation | Threshold MPC decryption |

---

## 🔐 How Arcium Is Used

### 1. Client-Side Encryption (Before Submission)

When a user places a position, their browser:

1. Fetches the **Arcium cluster's public key** from the on-chain registry
2. Generates fresh randomness `r`
3. Encrypts stake amount `m` as an **ElGamal ciphertext**:
   ```
   C1 = r · G          (ephemeral public key)
   C2 = m · G + r · PK  (blinded message)
   ```
4. Encrypts YES/NO choice with the same scheme
5. Only the ciphertexts `(C1, C2)` are submitted to Solana

**The plaintext never touches the blockchain.**

### 2. Homomorphic Accumulation (During Market)

Arcium nodes monitor the Solana program for `PositionSubmitted` events. As positions arrive, they homomorphically accumulate ciphertexts:

```
Σ(C1) = Σ(r_i) · G
Σ(C2) = Σ(m_i) · G + Σ(r_i) · PK
```

This is valid because ElGamal encryption over Ristretto255 is **additively homomorphic** — encrypted values can be summed without decryption.

### 3. Threshold MPC Decryption (At Settlement)

After `resolution_timestamp`, anyone triggers `request_tally()`. The Arcium cluster:

1. Each of `n` MPC nodes holds a **key share** `sk_i` such that `Σ sk_i = sk`
2. A threshold `t` of nodes compute partial decryptions: `D_i = sk_i · C1`
3. The partial decryptions are combined: `m · G = C2 - Σ D_i`
4. The result is posted on-chain via the Arcium relayer

**No single node can decrypt alone.** Quorum is required. This prevents the market operator, Arcium employees, or any single party from learning the tally before settlement.

### 4. Per-Position Reveal

After market settlement, individual positions are also decrypted by the Arcium cluster, enabling proportional payout calculation. Each user's stake and choice are revealed only at claim time.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SOLANA ON-CHAIN                       │
│                                                         │
│  MarketRegistry ──► Market ──► Position (per user)      │
│       │               │             │                   │
│  arcium_cluster    vault PDA    encrypted_stake (C1,C2) │
│                               encrypted_choice (C1,C2)  │
│                                                         │
└──────────────────────────┬──────────────────────────────┘
                           │ Events / CPI
┌──────────────────────────▼──────────────────────────────┐
│                 ARCIUM MXE CLUSTER                       │
│                                                         │
│  Node 1 (sk_1) ─┐                                       │
│  Node 2 (sk_2) ─┼──► Threshold MPC ──► Decrypt Result  │
│  Node N (sk_N) ─┘                          │            │
│                                            ▼            │
│                                      Arcium Relayer     │
└──────────────────────────┬──────────────────────────────┘
                           │ settle_market() CPI
┌──────────────────────────▼──────────────────────────────┐
│              SETTLEMENT ON-CHAIN                         │
│  revealed_yes_stake, revealed_no_stake, outcome          │
│  → Winners claim proportional payouts from vault         │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
oracle/
├── programs/
│   └── prediction-market/
│       └── src/
│           └── lib.rs          # Anchor smart contract (Solana program)
├── app/
│   ├── components/
│   │   ├── Navbar.tsx
│   │   └── MarketCard.tsx
│   ├── pages/
│   │   ├── index.tsx           # Market listing
│   │   ├── market/[id].tsx     # Market detail + position submission
│   │   ├── create/index.tsx    # Create new market
│   │   └── how-it-works/      # Arcium flow explainer
│   ├── utils/
│   │   ├── arcium.ts           # Client-side encryption utilities
│   │   └── program.ts          # Anchor client helpers & PDAs
│   └── styles/globals.css
├── tests/
│   └── prediction-market.ts   # Anchor integration tests
├── scripts/
│   └── setup.sh               # One-command full setup
├── Anchor.toml
└── README.md
```

---

## 🚀 Quick Start (From Scratch)

### Prerequisites

The setup script installs everything automatically:

```bash
git clone https://github.com/YOUR_USERNAME/oracle
cd oracle
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This installs: Rust, Solana CLI, Anchor CLI, Node.js, and configures a devnet wallet with an SOL airdrop.

### Manual Setup

If you prefer to install manually:

```bash
# 1. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.22/install)"
solana config set --url https://api.devnet.solana.com

# 3. Create wallet & airdrop
solana-keygen new
solana airdrop 4

# 4. Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.30.1 && avm use 0.30.1

# 5. Build & deploy
anchor build
anchor deploy

# 6. Start frontend
cd app
npm install
npm run dev
```

### Connect Phantom Wallet

1. Install [Phantom](https://phantom.app)
2. Settings → Developer Settings → **Change Network → Devnet**
3. Visit `http://localhost:3000` and connect

---

## 🧪 Running Tests

```bash
anchor test
```

Tests cover:
- Protocol initialisation with Arcium cluster assignment
- Market creation with future resolution timestamp
- Encrypted position submission (ciphertexts stored, not plaintext)
- Tally request and settlement flow

---

## 🔑 Key Program Instructions

| Instruction | Description |
|---|---|
| `initialize` | Deploy registry, assign Arcium cluster |
| `create_market` | Create a new prediction market |
| `submit_position` | Submit encrypted (stake, choice) ciphertexts |
| `request_tally` | Lock market, emit Arcium MPC job request |
| `settle_market` | Receive MPC result, reveal outcome |
| `reveal_position` | Arcium reveals per-position decryption |
| `claim_winnings` | Winner claims proportional payout from vault |

---

## 🌐 Privacy Benefits Summary

1. **No Herding** — Users can't see others' positions, eliminating copycat behaviour
2. **No Frontrunning** — Resolution inputs are encrypted; oracles cannot manipulate settlement
3. **No Market Manipulation** — Whale positions are invisible; no one can trigger liquidations by tracking large stakes
4. **Genuine Price Discovery** — Odds are hidden until settlement, forcing participants to submit based on true beliefs
5. **Non-custodial** — All funds in Solana PDAs; only the program logic can release them

---

## 📄 License

MIT — Open Source

---

## 🙏 Credits

- [Arcium](https://arcium.com) — MPC privacy layer
- [Anchor](https://www.anchor-lang.com) — Solana smart contract framework
- [Solana](https://solana.com) — High-throughput blockchain

*Built for the Arcium RTG Bounty — Prediction Markets track*


