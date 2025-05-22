import { Contract, BigNumberish, ProviderInterface } from 'starknet';
import { IConfig } from '../interfaces/config.interfaces';
import { Address, MyBigNumber } from '../utils';
// @ts-ignore - Suppressing JSON import error
import RouterABI from '../abis/router.abi.json';
import { ISpendAllParams, IRevertSpendAllParams } from '../interfaces/dapp.interfaces';

// Simple interfaces for loan and collateral records
export interface ILoan {
  loan_id: BigNumberish;
  borrower: string;
  market: string;
  amount: { low: string; high: string };
  current_market: string;
  current_amount: { low: string; high: string };
  state: string;
  l3_integration: string;
  l3_category: string;
  created_at: string;
}

export interface ICollateral {
  loan_id: BigNumberish;
  collateral_token: string;
  amount: { low: string; high: string };
  created_at?: string;
}

/**
 * Router class to interact with the Hashstack router contract
 * Next.js compatible implementation
 */
export class Router {
  readonly contract: Contract;
  readonly contractAddr: string;
  readonly config: IConfig;
  
  constructor(config: IConfig, contractAddr: string) {
    this.config = config;
    // Cast the provider to the appropriate type for the Contract constructor
    this.contract = new Contract(RouterABI, contractAddr, this.config.provider as unknown as ProviderInterface);
    this.contractAddr = contractAddr;
  }

  /**
   * Get loan and collateral record for a loan ID
   * @param loan_id The loan ID to query
   */
  async getLoanCollateralRecord(loan_id: BigNumberish): Promise<[ILoan, ICollateral]> {
    try {
      const result = await this.contract.get_loan_by_id(loan_id);
      const loan = result.loan;
      
      // Extract loan details
      const borrower = new Address(loan.borrower.toString());
      const dToken = new Address(loan.market.toString());
      const dTokenAmount = { low: loan.amount.low.toString(), high: loan.amount.high.toString() };
      const currentMarket = new Address(loan.current_market.toString());
      const currentAmount = { low: loan.current_amount.low.toString(), high: loan.current_amount.high.toString() };
      
      // Create loan record
      const loanRec: ILoan = {
        loan_id,
        borrower: borrower.toString(),
        market: dToken.toString(),
        amount: dTokenAmount,
        current_market: currentMarket.toString(),
        current_amount: currentAmount,
        state: loan.state.toString(),
        l3_integration: loan.l3_integration.toString(),
        l3_category: loan.l3_category.toString(),
        created_at: loan.created_at.toString(),
      };
      
      // Extract collateral details
      const collateral = result.collateral;
      const collateral_token = new Address(collateral.collateral_token.toString());
      const collateral_amount = { 
        low: collateral.amount.low.toString(), 
        high: collateral.amount.high.toString() 
      };
      
      // Create collateral record
      const colRec: ICollateral = {
        loan_id,
        collateral_token: collateral_token.toString(),
        amount: collateral_amount,
        created_at: collateral.created_at?.toString(),
      };
      
      return [loanRec, colRec];
    } catch (error) {
      console.error('Error in getLoanCollateralRecord:', error);
      throw error;
    }
  }

  /**
   * Spend loan funds
   * @param spendAllParams Spend parameters
   */
  async spendAll(spendAllParams: ISpendAllParams) {
    try {
      return await this.contract.spend_all(spendAllParams);
    } catch (error) {
      console.error('Error in spendAll:', error);
      throw error;
    }
  }

  /**
   * Revert spend operation
   * @param revertSpendAllParams Revert spend parameters
   */
  async revertSpendAll(revertSpendAllParams: IRevertSpendAllParams) {
    try {
      return await this.contract.revert_spend_all(revertSpendAllParams);
    } catch (error) {
      console.error('Error in revertSpendAll:', error);
      throw error;
    }
  }
}
