/**
 * Real-time on-chain price engine.
 * Fetches prices directly from PancakeSwap V2 pair reserves and V3 quoter.
 * NO external APIs — purely on-chain.
 */

import { ethers } from "ethers";
import {
  PANCAKE_V2_FACTORY,
  PANCAKE_V3_QUOTER,
  TOKENS,
  V3_FEE_TIERS,
} from "./constants.js";
import {
  PANCAKE_V2_FACTORY_ABI,
  PANCAKE_V2_PAIR_ABI,
  PANCAKE_V3_QUOTER_ABI,
} from "./abis.js";
import { getProvider } from "./rpcProvider.js";

/**
 * Get V2 price: how many tokenOut per 1 tokenIn (in human units)
 */
export async function getV2Price(tokenInSymbol, tokenOutSymbol, amountInHuman = 1) {
  const provider = getProvider();
  const tokenIn = TOKENS[tokenInSymbol];
  const tokenOut = TOKENS[tokenOutSymbol];

  const factory = new ethers.Contract(PANCAKE_V2_FACTORY, PANCAKE_V2_FACTORY_ABI, provider);
  const pairAddress = await factory.getPair(tokenIn.address, tokenOut.address);

  if (pairAddress === ethers.ZeroAddress) {
    return null; // pair doesn't exist
  }

  const pair = new ethers.Contract(pairAddress, PANCAKE_V2_PAIR_ABI, provider);
  const [reserves, token0Addr] = await Promise.all([
    pair.getReserves(),
    pair.token0(),
  ]);

  const [reserve0, reserve1] = [reserves[0], reserves[1]];
  const isToken0In = token0Addr.toLowerCase() === tokenIn.address.toLowerCase();

  const reserveIn  = isToken0In ? reserve0 : reserve1;
  const reserveOut = isToken0In ? reserve1 : reserve0;

  // AMM formula: amountOut = (amountIn * 9975 * reserveOut) / (reserveIn * 10000 + amountIn * 9975)
  const amountInWei = ethers.parseUnits(String(amountInHuman), tokenIn.decimals);
  const amountInWithFee = amountInWei * 9975n;
  const numerator   = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;
  const amountOutWei = numerator / denominator;

  const amountOut = parseFloat(ethers.formatUnits(amountOutWei, tokenOut.decimals));
  return {
    price: amountOut / amountInHuman,
    amountOut,
    reserveIn: parseFloat(ethers.formatUnits(reserveIn, tokenIn.decimals)),
    reserveOut: parseFloat(ethers.formatUnits(reserveOut, tokenOut.decimals)),
    pairAddress,
    dex: "PancakeSwap V2",
  };
}

/**
 * Get V3 price for a specific fee tier using Quoter V2
 */
export async function getV3Price(tokenInSymbol, tokenOutSymbol, amountInHuman = 1, feeTier = 500) {
  const provider = getProvider();
  const tokenIn  = TOKENS[tokenInSymbol];
  const tokenOut = TOKENS[tokenOutSymbol];

  const quoter = new ethers.Contract(PANCAKE_V3_QUOTER, PANCAKE_V3_QUOTER_ABI, provider);
  const amountInWei = ethers.parseUnits(String(amountInHuman), tokenIn.decimals);

  try {
    const result = await quoter.quoteExactInputSingle.staticCall({
      tokenIn:  tokenIn.address,
      tokenOut: tokenOut.address,
      amountIn: amountInWei,
      fee: feeTier,
      sqrtPriceLimitX96: 0n,
    });

    const amountOut = parseFloat(ethers.formatUnits(result[0], tokenOut.decimals));
    return {
      price: amountOut / amountInHuman,
      amountOut,
      feeTier,
      gasEstimate: result[3].toString(),
      dex: `PancakeSwap V3 (${feeTier / 10000}%)`,
    };
  } catch {
    return null; // pool doesn't exist at this fee tier
  }
}

/**
 * Get best V3 price across all fee tiers
 */
export async function getBestV3Price(tokenInSymbol, tokenOutSymbol, amountInHuman = 1) {
  const results = await Promise.allSettled(
    V3_FEE_TIERS.map(fee => getV3Price(tokenInSymbol, tokenOutSymbol, amountInHuman, fee))
  );

  let best = null;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value !== null) {
      if (!best || r.value.amountOut > best.amountOut) {
        best = r.value;
      }
    }
  }
  return best;
}

/**
 * Fetch both V2 and best V3 prices for a pair and compute arbitrage opportunity
 */
export async function getArbOpportunity(token0Symbol, token1Symbol, tradeAmountUsd) {
  // Estimate trade amount in token0 units (rough: assume BNB ~ $600, BUSD/USDT/USDC ~ $1)
  let amountIn = tradeAmountUsd;
  if (token0Symbol === "WBNB") amountIn = tradeAmountUsd / 600;
  else if (token0Symbol === "BTCB") amountIn = tradeAmountUsd / 65000;
  else if (token0Symbol === "ETH")  amountIn = tradeAmountUsd / 3500;
  else if (token0Symbol === "CAKE") amountIn = tradeAmountUsd / 2.5;

  const [v2, v3] = await Promise.allSettled([
    getV2Price(token0Symbol, token1Symbol, amountIn),
    getBestV3Price(token0Symbol, token1Symbol, amountIn),
  ]);

  const v2Result = v2.status === "fulfilled" ? v2.value : null;
  const v3Result = v3.status === "fulfilled" ? v3.value : null;

  if (!v2Result && !v3Result) return null;

  const v2Out = v2Result?.amountOut ?? 0;
  const v3Out = v3Result?.amountOut ?? 0;

  // Direction: V2 → V3 or V3 → V2?
  const v2First = v2Out > v3Out;
  const buyDex  = v2First ? "PancakeSwap V2" : (v3Result?.dex ?? "PancakeSwap V3");
  const sellDex = v2First ? (v3Result?.dex ?? "PancakeSwap V3") : "PancakeSwap V2";
  const buyOut  = v2First ? v2Out : v3Out;
  const sellOut = v2First ? v3Out : v2Out;

  const grossDiff = Math.abs(buyOut - sellOut);

  // Estimate USD profit (reverse-map to USD)
  let profitUsd = grossDiff;
  if (token1Symbol === "WBNB") profitUsd = grossDiff * 600;
  else if (token1Symbol === "BTCB") profitUsd = grossDiff * 65000;
  else if (token1Symbol === "ETH")  profitUsd = grossDiff * 3500;
  else if (token1Symbol === "CAKE") profitUsd = grossDiff * 2.5;

  // Subtract estimated gas cost (~$0.50 on BSC)
  profitUsd -= 0.5;

  const spreadPct = sellOut > 0 ? ((buyOut - sellOut) / sellOut) * 100 : 0;

  return {
    pair: `${token0Symbol}/${token1Symbol}`,
    token0: token0Symbol,
    token1: token1Symbol,
    amountIn,
    v2Price: v2Result,
    v3Price: v3Result,
    buyDex,
    sellDex,
    v2First,
    v3FeeTier: v3Result?.feeTier ?? 500,
    profitUsd,
    spreadPct,
    timestamp: Date.now(),
  };
}
