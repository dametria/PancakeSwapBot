#!/usr/bin/env node
"use strict";

try {
  require("dotenv").config();
} catch (_) {}

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const CONFIG = {
  RPC_URL: process.env.RPC_URL || "https://bsc-dataseed.binance.org/",
  CHAIN_ID: BigInt(process.env.CHAIN_ID || "56"),
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  ARTIFACT_PATH:
    process.env.CONTRACT_ARTIFACT ||
    path.join(__dirname, "out", "PancakeArbFlashLoan.sol", "PancakeArbFlashLoan.json"),
  GAS_BUFFER_PERCENT: Number(process.env.GAS_BUFFER_PERCENT || "20"),
  GAS_PRICE_GWEI: process.env.GAS_PRICE_GWEI || "",
  CONFIRMATIONS: Number(process.env.CONFIRMATIONS || "1"),
  CONSTRUCTOR_ARGS: process.env.CONSTRUCTOR_ARGS || "[]",
  OUTPUT_FILE:
    process.env.OUTPUT_FILE ||
    path.join(__dirname, "deployments", "bsc-mainnet.json"),
  EXPLORER_BASE: process.env.EXPLORER_BASE || "https://bscscan.com/address/",
};

function fail(message) {
  console.error(`
[ERROR] ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[WARN] ${message}`);
}

function info(message) {
  console.log(`[INFO] ${message}`);
}

function hasFunction(abi, name) {
  return abi.some((item) => {
    if (!item) return false;
    if (typeof item === "string") {
      return item.includes(`function ${name}(`);
    }
    return item.type === "function" && item.name === name;
  });
}

function loadArtifact(artifactPath) {
  if (!fs.existsSync(artifactPath)) {
    fail(`Artifact not found at: ${artifactPath}
Run: forge build --force`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const abi = artifact.abi;
  let bytecode = artifact.bytecode?.object ?? artifact.bytecode;

  if (!abi || !Array.isArray(abi)) {
    fail(`Artifact at ${artifactPath} is missing a valid ABI array.`);
  }

  if (!bytecode || typeof bytecode !== "string") {
    fail(`Artifact at ${artifactPath} is missing bytecode.`);
  }

  if (!bytecode.startsWith("0x")) {
    bytecode = `0x${bytecode}`;
  }

  return { abi, bytecode };
}

function parseConstructorArgs(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      fail('CONSTRUCTOR_ARGS must be a JSON array, e.g. [] or ["arg1", "arg2"].');
    }
    return parsed;
  } catch (err) {
    fail(`Invalid CONSTRUCTOR_ARGS JSON: ${err.message}`);
  }
}

async function main() {
  if (!CONFIG.PRIVATE_KEY) {
    fail("Set PRIVATE_KEY in your environment.");
  }

  const constructorArgs = parseConstructorArgs(CONFIG.CONSTRUCTOR_ARGS);
  const { abi, bytecode } = loadArtifact(CONFIG.ARTIFACT_PATH);

  const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);

  const network = await provider.getNetwork();
  info(`Connected chain ID: ${network.chainId}`);

  if (network.chainId !== CONFIG.CHAIN_ID) {
    fail(`Wrong network. Expected chain ID ${CONFIG.CHAIN_ID}, got ${network.chainId}.`);
  }

  info(`Deployer: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  info(`Balance: ${ethers.formatEther(balance)} BNB`);

  if (balance < ethers.parseEther("0.01")) {
    warn("Very low BNB balance. Deployment may fail.");
  }

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);

  info("Preparing deployment transaction...");
  const unsignedDeployTx = await factory.getDeployTransaction(...constructorArgs);

  let gasEstimate;
  try {
    gasEstimate = await provider.estimateGas({
      ...unsignedDeployTx,
      from: wallet.address,
    });
  } catch (err) {
    fail(`Gas estimation failed: ${err.shortMessage || err.message}`);
  }

  const feeData = await provider.getFeeData();
  const gasPrice = CONFIG.GAS_PRICE_GWEI
    ? ethers.parseUnits(CONFIG.GAS_PRICE_GWEI, "gwei")
    : feeData.gasPrice;

  const gasLimit =
    (gasEstimate * BigInt(100 + CONFIG.GAS_BUFFER_PERCENT)) / 100n;

  info(`Estimated gas: ${gasEstimate.toString()}`);
  info(`Gas limit with buffer: ${gasLimit.toString()}`);

  if (gasPrice) {
    info(`Gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
    const estimatedCost = gasLimit * gasPrice;
    info(`Estimated max deploy cost: ${ethers.formatEther(estimatedCost)} BNB`);
  } else {
    warn("Could not determine gasPrice from provider; deploying without explicit gasPrice.");
  }

  const overrides = { gasLimit };
  if (gasPrice) overrides.gasPrice = gasPrice;

  info("Deploying PancakeArbFlashLoan...");
  const deployment = await factory.deploy(...constructorArgs, overrides);
  const deployTx = deployment.deploymentTransaction();

  if (!deployTx) {
    fail("Deployment transaction was not created.");
  }

  info(`Tx hash: ${deployTx.hash}`);
  info(`Waiting for ${CONFIG.CONFIRMATIONS} confirmation(s)...`);

  await deployTx.wait(CONFIG.CONFIRMATIONS);

  const contractAddress = await deployment.getAddress();
  info(`Contract deployed at: ${contractAddress}`);
  info(`Explorer: ${CONFIG.EXPLORER_BASE}${contractAddress}`);

  const contract = new ethers.Contract(contractAddress, abi, provider);

  if (hasFunction(abi, "owner")) {
    try {
      const owner = await contract.owner();
      info(`Owner: ${owner}`);
      if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
        warn("Owner does not match deployer wallet.");
      }
    } catch (err) {
      warn(`owner() check failed: ${err.shortMessage || err.message}`);
    }
  }

  if (hasFunction(abi, "gasRefundUsdt")) {
    try {
      const refund = await contract.gasRefundUsdt();
      info(`gasRefundUsdt: ${ethers.formatUnits(refund, 18)} USDT`);
    } catch (err) {
      warn(`gasRefundUsdt() check failed: ${err.shortMessage || err.message}`);
    }
  }

  const code = await provider.getCode(contractAddress);
  if (!code || code === "0x") {
    fail("No runtime bytecode found at deployed address.");
  }

  const deploymentRecord = {
    network: "bsc-mainnet",
    chainId: network.chainId.toString(),
    rpcUrl: CONFIG.RPC_URL,
    contractName: "PancakeArbFlashLoan",
    contractAddress,
    deployer: wallet.address,
    txHash: deployTx.hash,
    blockNumber: deployTx.blockNumber ?? null,
    confirmations: CONFIG.CONFIRMATIONS,
    artifactPath: CONFIG.ARTIFACT_PATH,
    constructorArgs,
    deployedAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(CONFIG.OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(deploymentRecord, null, 2));
  info(`Deployment record saved to: ${CONFIG.OUTPUT_FILE}`);

  console.log('Next steps:');
  console.log(`1. Put this contract address into your bot config: ${contractAddress}`);
  console.log('2. Fund the bot/operator wallet with BNB for runtime gas.');
  console.log('3. Verify the contract on BscScan if you want source-level verification.');
  console.log('4. Run a separate test script for executeArbitrage — do not auto-trade from deploy.js.');
}

main().catch((err) => {
  fail(err.shortMessage || err.message || String(err));
});
