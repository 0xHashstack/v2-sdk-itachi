/**
 * Configuration interfaces for the Spend SDK
 */

export interface IConfig {
  /**
   * StarkNet provider URL
   */
  provider: string;
  
  /**
   * Chain ID (e.g., 'SN_MAIN', 'SN_GOERLI')
   */
  chainId?: string;
  
  /**
   * Account address - optional, can be provided later
   */
  accountAddress?: string;
}
