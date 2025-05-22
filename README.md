# Hashstack v2 SDK (Itachi)

A Next.js-compatible StarkNet SDK for DeFi operations with Hashstack Protocol. This SDK enables developers to integrate Hashstack's DeFi functionality into their applications with seamless compatibility for both browser and server-side environments.

## Features

- **Next.js Compatible**: Works in both client and server environments without polyfills
- **Isomorphic Fetch**: Uses isomorphic-fetch for consistent API interactions
- **StarkNet Integration**: Built for StarkNet blockchain operations
- **DEX Integrations**: Support for JediSwap and MySwap
- **Full Feature Parity**: All functionality from v1 SDK maintained

## Installation

```bash
npm install @hashstack/v2-sdk
# or
yarn add @hashstack/v2-sdk
```

## Quick Start

```typescript
import { Spend, Address, MyBigNumber } from "@hashstack/v2-sdk";
import { Provider } from "starknet";

// Initialize the SDK with a StarkNet provider
const provider = new Provider({
  /* your provider config */
});
const config = {
  provider,
  chainId: "0x534e5f4d41494e", // StarkNet Mainnet
};

// Initialize tokens
const tokens = [
  {
    address:
      "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  {
    address:
      "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
  },
];

// Initialize SDK with router contract address
const routerAddress = "0x12345...";
const spend = new Spend(config, routerAddress, tokens);

// Example: Getting swap information
async function getSwapInfo() {
  const fromToken = Address.from(
    "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"
  ); // ETH
  const toToken = Address.from(
    "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8"
  ); // USDC
  const amount = new MyBigNumber("1", 18); // 1 ETH

  const swapInfo = await spend.getSwapInfo(fromToken, toToken, amount);
  console.log("Swap info:", swapInfo);
}
```

## Usage

### Getting Loan Records

```typescript
async function getLoanDetails(loanId: string) {
  const loanRecord = await spend.getLoanRecord(loanId);
  console.log("Loan details:", loanRecord);
}
```

### Executing Swaps

```typescript
async function executeSwap(loanId: string, destinationMarket: string) {
  const loanRecord = await spend.getLoanRecord(loanId);
  const destMarket = Address.from(destinationMarket);

  // Execute the swap
  await spend.spend({
    loan_id: loanId,
    destination_market: destMarket,
    l3_integration: 0, // JediSwap
    l3_category: 0, // Swap
  });
}
```

### Adding Liquidity

```typescript
async function addLiquidity(loanId: string, tokenA: string, tokenB: string) {
  const loanRecord = await spend.getLoanRecord(loanId);
  const tokenAAddress = Address.from(tokenA);
  const tokenBAddress = Address.from(tokenB);

  // Get liquidity calldata
  const calldata = await spend.getAddLiquidityCalldata(
    loanRecord,
    "jediswap",
    tokenAAddress,
    tokenBAddress
  );

  // Execute liquidity provision
  await spend.spend({
    loan_id: loanId,
    destination_market: tokenAAddress, // The LP token address will be calculated
    l3_integration: 0, // JediSwap
    l3_category: 1, // Liquidity
    l3_data: calldata,
  });
}
```

## Core Classes

- **Spend**: Main class for handling DeFi operations
- **Router**: For interacting with Hashstack router contracts
- **MyBigNumber**: For handling big number calculations
- **Address**: For StarkNet address operations
- **Numerical**: Utility functions for numerical operations

## Development

### Setup

1. Clone the repository
2. Install dependencies:

```bash
yarn install
```

### Building

```bash
yarn build
```

### Testing

```bash
yarn test
```

## License

MIT

## Acknowledgements

This SDK is built for the Hashstack Protocol and maintains compatibility with the v1 SDK while adding Next.js support.
