/**
 * BigNumber utility for StarkNet operations
 * Modified to be compatible with Next.js
 */

import BigNumber from 'bignumber.js';
import { BigNumberish, uint256 } from 'starknet';

/**
 * @description Helps track big numbers in true amount terms.
 * Instead of tracking 1010000000000000000,
 * tracks 1.01 ETH with 18 decimal places while still maintaining the precision
 */
export class MyBigNumber {
  private _value: BigNumber;
  private _decimals: number;
  static TEN_POW_18 = new BigNumber(10).pow(18).toString();
  static TEN_POW_6 = new BigNumber(10).pow(6).toString();

  /**
   * @param raw in true amount terms include decimals point if applicable. E.g. 1.01 ETH, not 1010000000000000000
   * @param decimals number of decimal places used to denominate the amount. e.g. 18 for ETH amount
   */
  constructor(raw: number | string | BigNumber, decimals: number = 18) {
    if (Number(raw) > 10 ** 9) {
      console.warn(
        'BigNumber is too large, are you sure its the true amount and not wei amount? Ignore otherwise. Consider using MyBigNumber.fromWeiUint256 / fromWei for initiating using wei amounts',
      );
      console.warn(`value: ${raw}, decimals: ${decimals}`);
    }
    // default base 10;
    this._value = new BigNumber(raw);
    this._decimals = decimals;
  }

  /**
   * Get the decimals of this number
   */
  get decimals(): number {
    return this._decimals;
  }

  /** 
   * Returns updated MyBigNumber with new decimals 
   */
  updateDecimals(decimals: number): MyBigNumber {
    return MyBigNumber.fromWei(this.toWeiString(), decimals);
  }

  /**
   * Create a MyBigNumber from a wei value string
   */
  static fromWei(value: string | BigNumberish, decimals: number): MyBigNumber {
    const b = new BigNumber(value.toString()).div(new BigNumber(10).pow(decimals));
    return new MyBigNumber(b, decimals);
  }

  /**
   * Create a MyBigNumber from a Uint256 value
   */
  static fromWeiUint256(value: { low: BigNumberish; high: BigNumberish }, decimals: number): MyBigNumber {
    const weiValue = uint256.uint256ToBN({ low: value.low, high: value.high }).toString();
    return this.fromWei(weiValue, decimals);
  }

  /**
   * Convert to a wei string
   */
  toWeiString(): string {
    return this._value.multipliedBy(new BigNumber(10).pow(this._decimals)).toFixed(0);
  }

  /**
   * Convert to a Uint256 object for StarkNet
   */
  toWeiU256(): BigNumberish[] {
    // Convert to Wei format (no decimals)
    const weiValue = this.toWeiString();
    
    // Parse to Uint256 for StarkNet
    const uint = uint256.bnToUint256(weiValue);
    return [uint.low, uint.high];
  }

  /**
   * Get the raw value
   */
  valueOf(): string {
    return this._value.toString();
  }

  /**
   * Get the value with applied decimal precision
   */
  toString(): string {
    return this._value.toString();
  }

  /**
   * Get the value as a human-readable string with specified precision
   */
  toDisplayString(precision: number = 4): string {
    return this._value.toFixed(precision);
  }

  /**
   * Multiply by another value
   */
  mul(other: MyBigNumber): MyBigNumber {
    return new MyBigNumber(this._value.multipliedBy(other._value), this._decimals);
  }

  /**
   * Divide by another value
   */
  div(other: MyBigNumber): MyBigNumber {
    return new MyBigNumber(this._value.dividedBy(other._value), this._decimals);
  }

  /**
   * Add another value
   */
  add(other: MyBigNumber): MyBigNumber {
    return new MyBigNumber(this._value.plus(other._value), this._decimals);
  }

  /**
   * Subtract another value
   */
  sub(other: MyBigNumber): MyBigNumber {
    return new MyBigNumber(this._value.minus(other._value), this._decimals);
  }

  /**
   * Compare with another BigNumber
   * @returns -1 if less than, 0 if equal, 1 if greater than
   */
  cmp(other: MyBigNumber): number {
    const result = this._value.comparedTo(other._value);
    return result !== null ? result : 0; // Handle potential null return
  }

  /**
   * Check if equal to another BigNumber
   */
  eq(other: MyBigNumber): boolean {
    return this._value.isEqualTo(other._value);
  }

  /**
   * Check if less than another BigNumber
   */
  lt(other: MyBigNumber): boolean {
    return this._value.isLessThan(other._value);
  }

  /**
   * Check if greater than another BigNumber
   */
  gt(other: MyBigNumber): boolean {
    return this._value.isGreaterThan(other._value);
  }
}

// Setting default config of computing upto 18 decimal places
BigNumber.config({ DECIMAL_PLACES: 18, ROUNDING_MODE: 4 });
