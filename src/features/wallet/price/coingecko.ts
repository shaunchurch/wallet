// ETH/USD price fetch from CoinGecko with 60s cache

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';
const PRICE_CACHE_MS = 60_000;

let cachedPrice: { usd: number; fetchedAt: number } | null = null;

/**
 * Get current ETH price in USD.
 * Returns cached value if < 60s old. Returns 0 on fetch error.
 */
export async function getEthPrice(): Promise<number> {
  if (cachedPrice && Date.now() - cachedPrice.fetchedAt < PRICE_CACHE_MS) {
    return cachedPrice.usd;
  }

  try {
    const res = await fetch(COINGECKO_URL);
    const json = (await res.json()) as { ethereum?: { usd?: number } };
    const usd = json.ethereum?.usd ?? 0;
    cachedPrice = { usd, fetchedAt: Date.now() };
    return usd;
  } catch {
    return cachedPrice?.usd ?? 0;
  }
}
