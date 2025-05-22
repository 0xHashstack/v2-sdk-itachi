import { BigNumberish } from 'starknet';
import { Address, MyBigNumber } from '../utils';

/**
 * Processed loan interface
 */
export interface IProcessedLoan {
  loan_id: BigNumberish;
  underlyingMarket: Address;
  underlyingDecimals: number;
  currentMarket: Address;
  currentAmount: MyBigNumber;
  state: BigNumberish;
}

/**
 * Token information interface
 */
export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Swap route interface
 */
export interface IRoute {
  dex: string;
  percent: number;
  fromToken: string;
  toToken: string;
  path: string[];
  additional_params: string[];
}

/**
 * Swap information interface
 */
export interface ISwapInfo {
  fromToken: string;
  toToken: string;
  amount: BigNumberish[];
  routes: IRoute[];
}

/**
 * Spend parameters interface
 */
export interface ISpendParams {
  loan_id: string;
  destination_market: Address;
  l3_integration: number;
  l3_category: number;
  l3_data?: any[];
}

/**
 * Spend all parameters interface
 */
export interface ISpendAllParams {
  loan_id: string;
  destination_market: string;
  l3_integration: number;
  l3_category: number;
  l3_data: any[];
}

/**
 * Revert spend parameters interface
 */
export interface IRevertSpendParams {
  loan_id: string;
  lp_token?: string;
  additional_params: any[];
}

/**
 * Revert spend all parameters interface
 */
export interface IRevertSpendAllParams {
  loan_id: string;
  revertSpendParams?: IRevertSpendParams;
}

/**
 * Integration method enum
 */
export enum IIntegrationMethod {
  Swap = 0,
  Liquidity = 1,
}

/**
 * Integration DApp interface
 */
export enum IIntegrationDApp {
  Jediswap = 0,
  Myswap = 1,
  ZkLend = 2,
}

/**
 * Spend categories enum
 */
export enum SpendCategory {
  Swap = 0,
  Liquidity = 1,
}

/**
 * Integration dapp enum
 */
export enum IntegrationDapp {
  JediSwap = 0,
  MySwap = 1,
  zkLend = 2,
}
