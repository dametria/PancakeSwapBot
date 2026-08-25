# PancakeArbFlashLoan – Hardened Version

## What was fixed

### Original failure
```
transaction execution reverted
data = ""   ← empty calldata
```
You (or the bot) sent a transaction with **no function selector**.  
The contract only does useful work inside `executeArbitrage(...)`.  
Empty data hits `receive()` (or fails if the deployed bytecode is different).

### Changes in this version
| Item | Original | New |
|------|----------|-----|
| Function signature | 6 params (tokenOut unused) | 6 params (tokenOut removed, slippageBps added) |
| Slippage | 0 (dangerous) | Configurable bps (capped at 5 %) |
| Reentrancy | None | `nonReentrant` on entry + callback |
| Approves | Raw, no reset | Safe approve with zero-reset (USDT-safe) |
| Transfers | Raw | Low-level call + success check |
| Fee math | `*10025/10000 +1` | Ceiling division |
| Events | None | `ArbitrageExecuted` + `GasRefunded` |
| Ownership | No transfer | `transferOwnership` |

## Deploy

1. Remix → Solidity 0.8.19 → Optimization 200 → Deploy on BSC Mainnet.
2. Or Foundry:
   ```bash
   forge create --rpc-url $BSC_RPC --private-key $PK src/PancakeArbFlashLoan.sol:PancakeArbFlashLoan
   ```

After deploy, the deployer is the only address that can call `executeArbitrage`.

## Correct execution (the part that was missing)

**Never** send a transaction with empty `data`.

### ethers v6 (Node)

```js
const data = contract.interface.encodeFunctionData("executeArbitrage", [
  tokenIn,       // e.g. WBNB
  loanAmount,    // BigInt
  v2First,       // boolean
  v3Fee,         // 100 | 500 | 2500 | 10000
  minProfit,     // BigInt
  slippageBps    // e.g. 30 = 0.30 %
]);

await wallet.sendTransaction({
  to: contractAddress,
  data,                // ← mandatory
  gasLimit: 900_000n
});
```

See `executeArbitrage.js` for a complete runnable example.

### Python (web3.py)

```python
from web3 import Web3
fn = contract.functions.executeArbitrage(
    token_in, loan_amount, v2_first, v3_fee, min_profit, slippage_bps
)
tx = fn.build_transaction({
    "from": account.address,
    "nonce": w3.eth.get_transaction_count(account.address),
    "gas": 900_000,
    "gasPrice": w3.eth.gas_price,
})
signed = account.sign_transaction(tx)
tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
```

## Recommended parameters for testing

| Param | Safe test value | Notes |
|-------|-----------------|-------|
| loanAmount | 500–2000 USDT | Start small |
| slippageBps | 30–50 | 0.3–0.5 % |
| minProfit | 0.5–2 USDT | After fee + gas refund |
| v3Fee | 500 (most liquid) | Check pool exists first |

## Security notes

- Only the owner can trigger arbitrage.
- Flash-loan callback verifies the pair and the original caller.
- Still use a private RPC / builder for production (public mempool will get you sandwiched even with slippage).
- The gas-refund swap also has 0.5 % slippage protection.

## Withdraw profits

```js
await contract.withdrawAll(USDT);
await contract.withdrawBNB();
```
