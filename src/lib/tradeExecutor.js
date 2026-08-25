/**
 * Trade Executor — local signing using BOT_PRIVATE_KEY from env.
 *
 * ⚠️  The private key is read from VITE_BOT_PRIVATE_KEY and is embedded
 * in the client bundle. For production, move this to a server-side
 * backend function (requires Builder+ plan).
 */

import { ethers } from "ethers";
import { BSC_RPC_URL } from "./env";
import { TOKENS, PANCAKE_V2_FACTORY } from "./constants";
import { ARB_CONTRACT_ABI, PANCAKE_V2_FACTORY_ABI } from "./abis";

const BSC_NETWORK = { chainId: 56, name: "bnb" };

function getWallet(privateKey) {
  if (!privateKey) throw new Error("Bot wallet not configured — enter your private key in Settings");
  const provider = new ethers.JsonRpcProvider(BSC_RPC_URL, BSC_NETWORK, { staticNetwork: true });
  const key = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  return new ethers.Wallet(key, provider);
}

export async function getBotBalances(privateKey) {
  if (!privateKey) return null;

  const wallet = getWallet(privateKey);
  const provider = wallet.provider;

  const bnbBalance = await provider.getBalance(wallet.address);

  const tokenEntries = Object.entries(TOKENS);
  const results = await Promise.allSettled(
    tokenEntries.map(async ([symbol, token]) => {
      const contract = new ethers.Contract(token.address, ["function balanceOf(address) view returns (uint256)"], provider);
      const bal = await contract.balanceOf(wallet.address);
      return { symbol, balance: parseFloat(ethers.formatUnits(bal, token.decimals)), address: token.address };
    })
  );

  const tokens = results
    .filter(r => r.status === "fulfilled")
    .map(r => r.value)
    .filter(t => t.balance > 0);

  return {
    address: wallet.address,
    bnb: parseFloat(ethers.formatEther(bnbBalance)),
    tokens,
  };
}

export async function executeArbitrage(opportunity, arbContractAddress, privateKey) {
  if (!privateKey) throw new Error("Bot wallet not configured — enter your private key in Settings");
  if (!arbContractAddress) throw new Error("No arb contract address configured");
  if (!ethers.isAddress(arbContractAddress)) throw new Error("Invalid arb contract address — must be a valid 0x Ethereum address");

  const logs = [];
  const log = (msg) => logs.push(`[${new Date().toISOString()}] ${msg}`);

  const wallet = getWallet(privateKey);
  const provider = wallet.provider;

  const { token0, token1, amountIn, v2First, v3FeeTier } = opportunity;

  log(`Starting arbitrage: ${opportunity.pair}`);
  log(`Direction: ${v2First ? "Buy V2 → Sell V3" : "Buy V3 → Sell V2"}`);
  log(`Amount in: ${amountIn} ${token0}`);
  log(`Bot wallet: ${wallet.address}`);

  // Find the non-USDT token for flash loan
  const USDT_ADDR = TOKENS.USDT.address.toLowerCase();
  let arbTokenSymbol;
  if (TOKENS[token0] && TOKENS[token0].address.toLowerCase() !== USDT_ADDR) {
    arbTokenSymbol = token0;
  } else if (TOKENS[token1] && TOKENS[token1].address.toLowerCase() !== USDT_ADDR) {
    arbTokenSymbol = token1;
  } else {
    throw new Error("Cannot find non-USDT token in pair for flash loan");
  }

  // Calculate loan amount in USD
  let loanUsd = 1000;
  if (token0 === "WBNB") loanUsd = amountIn * 600;
  else if (token0 === "BTCB") loanUsd = amountIn * 65000;
  else if (token0 === "ETH") loanUsd = amountIn * 3500;
  else if (token0 === "CAKE") loanUsd = amountIn * 2.5;
  else loanUsd = amountIn;

  const loanAmountWei = ethers.parseUnits(String(Math.floor(loanUsd)), 18);
  const arbToken = TOKENS[arbTokenSymbol];
  const feeTier = Number(v3FeeTier || 500);

  log(`Flash loan: ${Math.floor(loanUsd)} USDT`);
  log(`Arb token:  ${arbToken.address} (${arbTokenSymbol})`);
  log(`v2First:    ${v2First}`);
  log(`feeTier:    ${feeTier}`);

  // Verify contract ownership
  const arbContract = new ethers.Contract(arbContractAddress, ARB_CONTRACT_ABI, wallet);
  const contractOwner = await arbContract.owner();
  log(`Contract owner: ${contractOwner}`);

  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(
      `Ownership mismatch! Contract owner is ${contractOwner.slice(0, 8)}... but bot wallet is ${wallet.address.slice(0, 8)}... Redeploy the contract from the bot wallet.`
    );
  }
  log(`Ownership verified ✓`);

  // Check V2 pair exists for flash loan
  const factoryContract = new ethers.Contract(PANCAKE_V2_FACTORY, PANCAKE_V2_FACTORY_ABI, provider);
  const pairAddress = await factoryContract.getPair(TOKENS.USDT.address, arbToken.address);
  log(`Flash loan pair: ${pairAddress}`);

  if (!pairAddress || pairAddress === ethers.ZeroAddress) {
    throw new Error(`No V2 liquidity pair found for USDT/${arbTokenSymbol}. Cannot flash loan.`);
  }

  // Execute the flash loan arbitrage
  log(`Calling executeArbitrage...`);
  const tx = await arbContract.executeArbitrage(
    arbToken.address,
    TOKENS.USDT.address,
    loanAmountWei,
    v2First,
    feeTier,
    0n,
    { gasLimit: 500000n }
  );
  log(`Tx sent: ${tx.hash}`);
  const receipt = await tx.wait(1);

  if (receipt.status === 0) {
    throw new Error(`Tx reverted on-chain: ${tx.hash}`);
  }

  log(`Confirmed in block ${receipt.blockNumber} ✓`);
  return { success: true, txHash: tx.hash, logs };
}
