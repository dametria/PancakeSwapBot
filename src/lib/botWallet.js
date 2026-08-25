import { ethers } from 'ethers';
import { BSC_RPC_URLS, ERC20_ABI, TOKEN_SYMBOLS, TOKEN_DECIMALS, WBNB } from './bsc';

let _wallet = null;
let _provider = null;

/**
 * Initialize bot wallet from private key (stored in env or user-provided)
 */
export function initBotWallet(privateKey, rpcUrl) {
  const rpc = rpcUrl || BSC_RPC_URLS[0];
  _provider = new ethers.JsonRpcProvider(rpc);
  _wallet = new ethers.Wallet(privateKey, _provider);
  return _wallet;
}

export function getBotWallet() {
  return _wallet;
}

export function getBotProvider() {
  return _provider;
}

export function isBotReady() {
  return _wallet !== null;
}

export async function getBotAddress() {
  if (!_wallet) return null;
  return _wallet.address;
}

export async function getBNBBalance() {
  if (!_wallet) return '0';
  const bal = await _provider.getBalance(_wallet.address);
  return ethers.formatEther(bal);
}

export async function getTokenBalance(tokenAddress) {
  if (!_wallet) return '0';
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, _provider);
  const decimals = TOKEN_DECIMALS[tokenAddress] ?? 18;
  const bal = await contract.balanceOf(_wallet.address);
  return ethers.formatUnits(bal, decimals);
}

export async function getWalletBalances(tokenAddresses) {
  if (!_wallet) return {};
  const results = await Promise.all(
    tokenAddresses.map(async (addr) => {
      const bal = await getTokenBalance(addr);
      return [addr, bal];
    })
  );
  return Object.fromEntries(results);
}
