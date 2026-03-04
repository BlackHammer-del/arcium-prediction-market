#!/usr/bin/env bash
# ============================================================
#  CipherBet — Full Setup Script
#  Installs all prerequisites and configures Solana + Arcium
# ============================================================
set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()    { echo -e "${CYAN}[SETUP]${NC} $1"; }
success(){ echo -e "${GREEN}[OK]${NC} $1"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()  { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   CipherBet × Arcium — Dev Setup         ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# ── 1. Check OS ──────────────────────────────────────────────
OS=$(uname -s)
log "Detected OS: $OS"

# ── 2. Install Rust ──────────────────────────────────────────
if ! command -v rustc &> /dev/null; then
  log "Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
  success "Rust installed: $(rustc --version)"
else
  success "Rust already installed: $(rustc --version)"
fi

# Install Solana-compatible nightly toolchain
rustup toolchain install stable
rustup default stable
rustup component add rustfmt clippy

# ── 3. Install Solana CLI ────────────────────────────────────
if ! command -v solana &> /dev/null; then
  log "Installing Solana CLI..."
  sh -c "$(curl -sSfL https://release.solana.com/v1.18.22/install)"
  export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
  success "Solana CLI installed: $(solana --version)"
else
  success "Solana CLI already installed: $(solana --version)"
fi

# Configure Solana for devnet
log "Configuring Solana for devnet..."
solana config set --url https://api.devnet.solana.com
success "Solana configured for devnet"

# ── 4. Create / load wallet ──────────────────────────────────
WALLET_PATH="$HOME/.config/solana/id.json"
if [ ! -f "$WALLET_PATH" ]; then
  log "Generating new Solana keypair..."
  mkdir -p "$HOME/.config/solana"
  solana-keygen new --outfile "$WALLET_PATH" --no-bip39-passphrase
  success "New wallet created at $WALLET_PATH"
else
  success "Wallet already exists: $(solana address)"
fi

PUBKEY=$(solana address)
log "Wallet address: $PUBKEY"

# ── 5. Airdrop SOL (devnet) ──────────────────────────────────
log "Requesting devnet SOL airdrop..."
solana airdrop 4 || warn "Airdrop failed (faucet rate limited). Try: https://faucet.solana.com"
BALANCE=$(solana balance | awk '{print $1}')
success "Wallet balance: $BALANCE SOL"

# ── 6. Install Anchor CLI ────────────────────────────────────
if ! command -v anchor &> /dev/null; then
  log "Installing Anchor CLI..."
  cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
  avm install 0.30.1
  avm use 0.30.1
  success "Anchor installed: $(anchor --version)"
else
  success "Anchor already installed: $(anchor --version)"
fi

# ── 7. Install Node.js ───────────────────────────────────────
if ! command -v node &> /dev/null; then
  log "Installing Node.js via nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
  success "Node.js installed: $(node --version)"
else
  success "Node.js already installed: $(node --version)"
fi

# ── 8. Install project dependencies ─────────────────────────
log "Installing npm dependencies..."
npm install
cd app && npm install && cd ..
success "Dependencies installed"

# ── 9. Build Anchor program ──────────────────────────────────
log "Building Anchor program..."
anchor build
success "Anchor program built"

# ── 10. Deploy to devnet ─────────────────────────────────────
log "Deploying to Solana devnet..."
anchor deploy --provider.cluster devnet || warn "Deploy failed — check your SOL balance"

# ── 11. Summary ──────────────────────────────────────────────
echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   ✓  Setup Complete!                     ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""
echo "  Wallet:  $PUBKEY"
echo "  Network: Solana Devnet"
echo ""
echo "  Next steps:"
echo "    1. cd app && npm run dev     # start the frontend"
echo "    2. Open http://localhost:3000"
echo "    3. Connect Phantom wallet (set to Devnet)"
echo "    4. Browse and create markets!"
echo ""
echo "  Useful commands:"
echo "    solana balance               # check SOL balance"
echo "    anchor test                  # run tests"
echo "    anchor deploy               # redeploy program"
echo ""
