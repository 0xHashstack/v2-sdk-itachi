/**
 * Constants and utility functions for token operations
 */

import { Address } from './utils';

// Token symbol to decimals mapping
const TOKEN_DECIMALS: Record<string, number> = {
  ETH: 18,
  USDC: 6,
  USDT: 6,
  DAI: 18,
  WBTC: 8,
};

// Token symbol to address mapping (for mainnet)
const TOKEN_ADDRESSES: Record<string, string> = {
  ETH: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
  USDC: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
  USDT: '0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8',
  DAI: '0x00da114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3',
  WBTC: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac',
};

/**
 * Get token decimals by address
 * @param address Token address
 * @returns Number of decimals for the token
 */
export function getTokenDecimals(address: Address): number {
  const symbol = getTokenName(address);
  return TOKEN_DECIMALS[symbol] || 18; // Default to 18 decimals if not found
}

/**
 * Get token name/symbol by address
 * @param address Token address
 * @returns Token symbol
 */
export function getTokenName(address: Address): string {
  const addressString = address.toString().toLowerCase();
  
  for (const [symbol, addr] of Object.entries(TOKEN_ADDRESSES)) {
    if (addr.toLowerCase() === addressString) {
      return symbol;
    }
  }
  
  return 'UNKNOWN';
}
