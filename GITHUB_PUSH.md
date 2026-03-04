# How to Push This Project to GitHub

## Step 1: Create the GitHub repository

1. Go to https://github.com/new
2. Set repository name: `arcium-prediction-market`
3. Set to **Public** (required for bounty)
4. Do NOT tick "Add a README" (we have one)
5. Click **Create repository**

## Step 2: Open a terminal in this folder

```bash
cd arcium-prediction-market
```

## Step 3: Initialise git and push

```bash
# Initialise git
git init

# Add all files
git add .

# First commit
git commit -m "feat: CipherBet — private prediction markets powered by Arcium MPC on Solana"

# Connect to your GitHub repo (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/arcium-prediction-market.git

# Push
git branch -M main
git push -u origin main
```

## Step 4: Add topics to your repo (helps judges find it)

On GitHub, click the gear icon next to "Topics" and add:
- `solana`
- `arcium`
- `prediction-market`
- `mpc`
- `anchor`
- `defi`
- `privacy`

## Step 5: Submit to Arcium RTG

Go to rtg.arcium.com and submit your GitHub repo URL.
