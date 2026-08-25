import { ethers } from "ethers";
import { BSC_RPC_URLS } from "./constants.js";

let currentRpcIndex = 0;

const BSC_NETWORK = { chainId: 56, name: "bnb" };

export function getProvider() {
  const url = BSC_RPC_URLS[currentRpcIndex % BSC_RPC_URLS.length];
  return new ethers.JsonRpcProvider(url, BSC_NETWORK, { staticNetwork: true });
}

export async function getProviderWithFallback() {
  for (let i = 0; i < BSC_RPC_URLS.length; i++) {
    const idx = (currentRpcIndex + i) % BSC_RPC_URLS.length;
    try {
      const provider = new ethers.JsonRpcProvider(BSC_RPC_URLS[idx], BSC_NETWORK, { staticNetwork: true });
      await provider.getBlockNumber(); // ping test
      currentRpcIndex = idx;
      return provider;
    } catch {
      continue;
    }
  }
  throw new Error("All BSC RPC endpoints are unreachable");
}

export function getBotWallet(privateKey) {
  if (!privateKey) throw new Error("No private key configured");
  const provider = getProvider();
  // ethers v6 Wallet requires 0x prefix
  const key = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  return new ethers.Wallet(key, provider);
}
