// BSC Chain constants and PancakeSwap contract addresses
export const BSC_RPC_URLS = [
  'https://bsc-dataseed1.binance.org/',
  'https://bsc-dataseed2.binance.org/',
  'https://bsc-dataseed3.binance.org/',
  'https://bsc-dataseed4.binance.org/',
];

export const PANCAKESWAP_V2_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
export const PANCAKESWAP_V2_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
export const PANCAKESWAP_V3_ROUTER = '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4';
export const PANCAKESWAP_V3_FACTORY = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865';
export const PANCAKESWAP_V3_QUOTER = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997';

export const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
export const BUSD = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
export const USDT = '0x55d398326f99059fF775485246999027B3197955';
export const USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
export const CAKE = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';
export const ETH  = '0x2170Ed0880ac9A755fd29B2688956BD959F933F8';
export const BTCB = '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c';

// Common token decimals
export const TOKEN_DECIMALS = {
  [WBNB]: 18,
  [BUSD]: 18,
  [USDT]: 18,
  [USDC]: 18,
  [CAKE]: 18,
  [ETH]:  18,
  [BTCB]: 18,
};

export const TOKEN_SYMBOLS = {
  [WBNB]: 'WBNB',
  [BUSD]: 'BUSD',
  [USDT]: 'USDT',
  [USDC]: 'USDC',
  [CAKE]: 'CAKE',
  [ETH]:  'ETH',
  [BTCB]: 'BTCB',
};

// Arbitrage pairs to monitor
export const ARBI_PAIRS = [
  { tokenA: WBNB, tokenB: BUSD,  label: 'WBNB/BUSD' },
  { tokenA: WBNB, tokenB: USDT,  label: 'WBNB/USDT' },
  { tokenA: WBNB, tokenB: USDC,  label: 'WBNB/USDC' },
  { tokenA: BTCB, tokenB: BUSD,  label: 'BTCB/BUSD' },
  { tokenA: ETH,  tokenB: BUSD,  label: 'ETH/BUSD'  },
  { tokenA: CAKE, tokenB: WBNB,  label: 'CAKE/WBNB' },
  { tokenA: USDT, tokenB: BUSD,  label: 'USDT/BUSD' },
  { tokenA: ETH,  tokenB: USDT,  label: 'ETH/USDT'  },
];

// V2 Pair ABI (minimal)
export const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];

// V2 Factory ABI (minimal)
export const FACTORY_V2_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
];

// V2 Router ABI (minimal — only what we need)
export const ROUTER_V2_ABI = [
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function WETH() external pure returns (address)',
];

// V3 Quoter ABI (minimal)
export const QUOTER_V3_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
];

// V3 Router ABI (minimal)
export const ROUTER_V3_ABI = [
  `function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)`,
];

// ERC20 ABI (minimal)
export const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
];

// Common V3 fee tiers
export const V3_FEE_TIERS = [100, 500, 2500, 10000]; // 0.01%, 0.05%, 0.25%, 1%
