/**
 * Base numerical utility class with common methods for token calculations
 * Simplified for Next.js compatibility
 */

import { MyBigNumber } from "./MyBigNumber";
import { Address } from "./Address";

export class Numerical {
  // Function pointers for overriding in derived classes
  protected swapFunc?: (
    fromToken: string,
    toToken: string,
    amount: bigint,
    integration: "jediswap" | "myswap"
  ) => Promise<bigint>;
  protected priceFunc?: (
    fromToken: Address,
    toToken: Address
  ) => Promise<MyBigNumber>;

  /**
   * Calculate minimum amount out based on slippage
   * @param amount The input amount
   * @param slippagePercent The slippage percentage (e.g., 0.5 for 0.5%)
   * @returns The minimum amount out with slippage applied
   */
  protected calculateMinAmountOut(
    amount: MyBigNumber,
    slippagePercent: number
  ): MyBigNumber {
    // Convert slippage to a decimal (e.g., 0.5% -> 0.005)
    const slippageFactor = new MyBigNumber(slippagePercent / 100, 0);

    // Calculate the slippage amount
    const slippageAmount = amount.mul(slippageFactor);

    // Subtract the slippage from the original amount
    return amount.sub(slippageAmount);
  }

  /**
   * Format a number for display
   * @param value The number to format
   * @param decimals The number of decimal places to show
   * @returns A formatted string
   */
  formatNumber(value: MyBigNumber, decimals: number = 4): string {
    return value.toDisplayString(decimals);
  }
}
