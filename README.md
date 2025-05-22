# Hashstack v2 SDK (Itachi)

A Next.js-compatible StarkNet SDK for DeFi operations with Hashstack Protocol. This SDK enables developers to integrate Hashstack's DeFi functionality into their applications with seamless compatibility for both browser and server-side environments.

## Features

- **Next.js Compatible**: Works flawlessly in both client and server environments without polyfills
- **Tree-Shakable Architecture**: Optimized bundle size with ES modules support
- **Isomorphic Fetch**: Uses isomorphic-fetch for consistent API interactions across environments
- **TypeScript Support**: Full type definitions for enhanced developer experience
- **StarkNet Integration**: Built specifically for StarkNet blockchain operations
- **DEX Integrations**: Comprehensive support for JediSwap, MySwap, and ZkLend
- **Full Feature Parity**: Complete functional parity with v1 SDK maintained

## Installation

```bash
npm install @hashstack/v2-sdk starknet isomorphic-fetch
# or
yarn add @hashstack/v2-sdk starknet isomorphic-fetch
```

> **Note**: `starknet` and `isomorphic-fetch` are peer dependencies that need to be installed alongside the SDK.

## Quick Start

```typescript
import { Spend, Router, Address, MyBigNumber } from "@hashstack/v2-sdk";
import { RpcProvider } from "starknet";

// Initialize the SDK with a StarkNet provider
const provider = new RpcProvider({
  nodeUrl: "https://starknet-mainnet.public.blastapi.io",
});

// Configure the SDK
const config = {
  network: "mainnet",
  chain: "starknet",
  stage: "production",
  snProvider: provider,
  rpcUrl: "https://starknet-mainnet.public.blastapi.io",
};

// Router contract address
const routerAddress = Address.from(
  "0x1b862c518939339b950d0d21a3d4cc8ead102d6270850ac8544636e558fab68"
);

// Initialize tokens list
const tokens = [
  {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
    address:
      "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  },
  {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
    address:
      "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
  },
];

// Initialize Spend entity
const spend = new Spend(config, routerAddress, tokens);
```

## Usage Examples

### Performing a Swap

```typescript
import { Spend, Address, MyBigNumber } from "@hashstack/v2-sdk";

// After initializing the spend entity as shown above

async function performSwap() {
  // Define tokens for the swap
  const fromToken = Address.from(
    "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"
  ); // ETH
  const toToken = Address.from(
    "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8"
  ); // USDC
  const amount = new MyBigNumber("0.1", 18); // 0.1 ETH

  // Get swap calldata for JediSwap
  const swapCalldata = await spend.getSwapInfoCalldata(
    fromToken,
    toToken,
    amount,
    "jediswap" // Use "myswap" for MySwap DEX
  );

  console.log("Swap calldata:", swapCalldata);

  // Use this calldata with your Router contract
  // ...
}
```

### Adding Liquidity

```typescript
import { Spend, Address, IProcessedLoan } from "@hashstack/v2-sdk";

// After initializing the spend entity

async function addLiquidity(loanRecord: IProcessedLoan) {
  // Define tokens for liquidity provision
  const tokenA = Address.from(
    "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"
  ); // ETH
  const tokenB = Address.from(
    "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8"
  ); // USDC

  // Get liquidity calldata for JediSwap
  const liquidityCalldata = await spend.getAddLiquidityCalldata(
    loanRecord,
    "jediswap", // Use "myswap" for MySwap
    tokenA,
    tokenB
  );

  console.log("Liquidity calldata:", liquidityCalldata);

  // Use this calldata with your Router contract
  // ...
}
```

### Reverting Operations

```typescript
import { Spend } from "@hashstack/v2-sdk";

// After initializing the spend entity

async function revertOperation(loanId: string) {
  // Get universal revert parameters
  // This will automatically determine the correct revert method based on the loan type
  const revertParams = await spend.getUniversalRevertParams(
    loanId,
    0.5 // Max slippage percent
  );

  console.log("Revert params:", revertParams);

  // Use these parameters with your Router contract's revert methods
  // ...
}
```

### Getting Loan Records

```typescript
import { Spend } from "@hashstack/v2-sdk";

// After initializing the spend entity

async function getLoanDetails(loanId: string) {
  // Fetch loan record by ID
  const loanRecord = await spend.getLoanRecord(loanId);
  console.log("Loan details:", loanRecord);

  // You can also get all user loan records
  const userLoans = await spend.getUserLoans(userAddress);
  console.log("User loans:", userLoans);
}
```

### ZkLend Integration

```typescript
import { Spend, Address } from "@hashstack/v2-sdk";

// After initializing the spend entity

async function performZkLendOperation(loanRecord: IProcessedLoan) {
  // Get ZkLend liquidity calldata
  const zkLendCalldata = await spend.getZkLendLiquidityCalldata(
    loanRecord,
    "0x4c0a5193d58f74fbace4b74dcf65481e734ed1714121bdc571da345540efa05" // ZkLend market address
  );

  console.log("ZkLend calldata:", zkLendCalldata);

  // Use this calldata with your Router contract
  // ...
}
```

## API Reference

### Core Classes

#### `Spend`

The main class for interacting with Hashstack Protocol's spend functionality.

```typescript
new Spend(config: ISpendConfig, routerAddress: string, tokens: IToken[])
```

**Key Methods:**

| Method                                                       | Description                                    |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `getSwapInfo(fromToken, toToken, amount)`                    | Gets swap information between two tokens       |
| `getSwapInfoCalldata(fromToken, toToken, amount, dappname)`  | Gets calldata for a swap operation             |
| `getAddLiquidityCalldata(loan, dappname, tokenA, tokenB)`    | Gets calldata for adding liquidity             |
| `getRemoveLiquidityCalldata(loan, dappname, tokenA, tokenB)` | Gets calldata for removing liquidity           |
| `getUniversalRevertParams(loanId, maxSlippagePercent)`       | Gets parameters for reverting a loan operation |
| `getZeroSwapInfo()`                                          | Gets an empty swap info object                 |
| `sortSwapInfos(swapInfos)`                                   | Sorts swap info objects by priority            |
| `getLoanRecord(loanId)`                                      | Gets loan record by ID                         |
| `getUserLoans(userAddress)`                                  | Gets all loans for a user                      |

### Helper Classes

#### `Address`

Utility class for handling StarkNet addresses.

```typescript
Address.from(addressString);
```

#### `MyBigNumber`

Utility class for handling large numbers and conversions.

```typescript
new MyBigNumber(value: string | number, decimals?: number)
```

## Environment Compatibility

This SDK is designed to work in both server-side and client-side environments in Next.js applications.

### Server Components

In server components, you can import and use the SDK directly:

```typescript
// app/api/route.ts or other server component
import { Spend } from "@hashstack/v2-sdk";

// Use SDK methods...
```

### Client Components

In client components, you'll need to use the `'use client'` directive:

```typescript
"use client";

import { Spend } from "@hashstack/v2-sdk";

// Use SDK methods...
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

````

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
````

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
