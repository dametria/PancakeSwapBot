// BSC Mainnet Chain ID
export const BSC_CHAIN_ID = 56;

// BSC RPC endpoints (public + fallbacks)
export const BSC_RPC_URLS = [
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed2.binance.org",
  "https://bsc-dataseed3.binance.org",
  "https://bsc-dataseed4.binance.org",
];

// PancakeSwap V2 Router (REAL address — not zero)
export const PANCAKE_V2_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
// PancakeSwap V2 Factory
export const PANCAKE_V2_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";

// PancakeSwap V3 Router (SmartRouter)
export const PANCAKE_V3_ROUTER = "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4";
// PancakeSwap V3 Factory
export const PANCAKE_V3_FACTORY = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865";
// PancakeSwap V3 Quoter V2
export const PANCAKE_V3_QUOTER = "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997";

// Tokens on BSC
export const TOKENS = {
  WBNB:  { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", decimals: 18, symbol: "WBNB" },
  BUSD:  { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", decimals: 18, symbol: "BUSD" },
  USDT:  { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, symbol: "USDT" },
  USDC:  { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18, symbol: "USDC" },
  CAKE:  { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", decimals: 18, symbol: "CAKE" },
  ETH:   { address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", decimals: 18, symbol: "ETH" },
  BTCB:  { address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", decimals: 18, symbol: "BTCB" },
};

// Arbitrage pairs to monitor (token0, token1)
export const ARB_PAIRS = [
  { token0: "WBNB", token1: "BUSD",  label: "WBNB/BUSD" },
  { token0: "WBNB", token1: "USDT",  label: "WBNB/USDT" },
  { token0: "WBNB", token1: "USDC",  label: "WBNB/USDC" },
  { token0: "CAKE", token1: "WBNB",  label: "CAKE/WBNB" },
  { token0: "ETH",  token1: "WBNB",  label: "ETH/WBNB"  },
  { token0: "BTCB", token1: "WBNB",  label: "BTCB/WBNB" },
  { token0: "BUSD", token1: "USDT",  label: "BUSD/USDT" },
];

// Fee tiers for V3
export const V3_FEE_TIERS = [100, 500, 2500, 10000]; // 0.01%, 0.05%, 0.25%, 1%

// Slippage tolerance in basis points (50 = 0.5%)
export const DEFAULT_SLIPPAGE_BPS = 50;

// Minimum profit threshold in USD to execute trade
export const MIN_PROFIT_USD = 5;

// Trade amount in USD equivalent
export const TRADE_AMOUNT_USD = 1000;

// Gas limit for arbitrage tx
export const ARB_GAS_LIMIT = 500000n;
