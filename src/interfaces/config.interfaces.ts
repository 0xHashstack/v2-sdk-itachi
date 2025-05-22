/**
 * Configuration interfaces for the Spend SDK
 */
import { Provider, RpcProvider, Account } from "starknet";

export interface IConfig {
  /**
   * StarkNet provider instance
   * Can be a Provider, RpcProvider, or any provider with a compatible interface
   */
  provider: Provider | RpcProvider | Account | any;

  /**
   * Chain ID (e.g., 'SN_MAIN', 'SN_GOERLI')
   */
  chainId?: string;

  /**
   * Account address - optional, can be provided later
   */
  accountAddress?: string;

  /**
   * Network name - optional, used for network-specific configurations
   */
  network?: string;

  /**
   * Chain name - optional, used for chain-specific configurations
   */
  chain?: string;

  /**
   * Stage (production, development) - optional
   */
  stage?: string;

  /**
   * RPC URL - optional, can be used as an alternative to provider
   */
  rpcUrl?: string;
}
