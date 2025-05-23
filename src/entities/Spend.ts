import { BigNumberish } from "starknet";
import { Address, Numerical, MyBigNumber } from "../utils";
import { IConfig } from "../interfaces/config.interfaces";
import {
  ISwapInfo,
  IRoute,
  TokenInfo,
  IProcessedLoan,
  ISpendAllParams,
  IRevertSpendAllParams,
  ISpendParams,
  IRevertSpendParams,
  IIntegrationDApp,
  SpendCategory,
  IntegrationDapp,
} from "../interfaces/dapp.interfaces";
import { fetchJson, postJson } from "../adapters/fetch";
import { Router } from "./Router";
import { Jediswap } from "./jediswap";
import { MySwap } from "./myswap";
import { SpendView, DexLiquiditySplit } from "./SpendView";
import { getTokenDecimals, getTokenName } from "../constants";

const BASE_URL = "https://starknet.api.avnu.fi";

/**
 * Spend class for handling DeFi operations like swaps and liquidity provision
 * This implementation is designed to be compatible with Next.js and browser environments
 */
export class Spend extends Numerical {
  readonly pragmaMainnet: Address;
  readonly config: IConfig;
  readonly router: Router;
  readonly tokens: TokenInfo[];
  readonly jediswap: Jediswap;
  readonly myswap: MySwap;
  readonly spendview: SpendView;

  /**
   * Create a new Spend instance
   * @param config Configuration settings
   * @param routerAddr Router contract address
   * @param tokens List of supported tokens
   */
  constructor(config: IConfig, routerAddr: string, tokens: TokenInfo[]) {
    super();
    this.config = config;
    this.tokens = tokens;
    this.router = new Router(config, routerAddr);
    this.pragmaMainnet = Address.from(
      "0x2a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b"
    );
    this.jediswap = new Jediswap(config);
    this.myswap = new MySwap(config);
    this.spendview = new SpendView(config, tokens, this.pragmaMainnet);

    // Bind methods to this instance
    this.swapFunc = this.getSwapValues;
    this.priceFunc = this.TokenPrice;
  }

  /**
   * Get swap information calldata for Avnu swap
   * @param fromToken Source token address
   * @param toToken Destination token address
   * @param amount Amount to swap
   * @param integration DEX to exclude from the swap route
   * @returns Calldata for the swap
   */
  public async getSwapInfoCalldata(
    fromToken: Address,
    toToken: Address,
    amount: MyBigNumber,
    integration: "jediswap" | "myswap"
  ): Promise<BigNumberish[]> {
    try {
      // Using isomorphic fetch instead of axios
      const quotesResponse = await fetchJson(`${BASE_URL}/swap/v2/quote`, {
        method: "POST",
        body: {
          sellTokenAddress: fromToken.address,
          buyTokenAddress: toToken.address,
          sellAmount: BigInt(amount.valueOf()),
          excludeSources: [integration],
        },
      });

      const quotes = quotesResponse.quotes;

      if (!quotes || quotes.length === 0) {
        throw new Error("No quotes found");
      }

      const quote = quotes[0];

      try {
        const response = await postJson(`${BASE_URL}/swap/v2/build`, {
          quoteId: quote.quoteId,
          takerAddress:
            "0x01b862c518939339b950d0d21a3d4cc8ead102d6270850ac8544636e558fab68",
          slippage: 1,
          includeApprove: false,
        });

        const multiRouteSwapCall = response.calls.find(
          (call: { entrypoint: string }) =>
            call.entrypoint === "multi_route_swap"
        );

        return multiRouteSwapCall ? multiRouteSwapCall.calldata : [];
      } catch (error) {
        console.error("Error in calldata build:", error);
        throw error;
      }
    } catch (error) {
      console.error("Error in getSwapInfoCalldata:", error);
      throw error;
    }
  }

  /**
   * Calculate Add Liquidity calldata
   * @param loanRecord Loan record information
   * @param integration DEX integration to use
   * @param tokenA First token address
   * @param tokenB Second token address
   * @returns Promise with the calldata
   */
  async getAddLiquidityCalldata(
    loanRecord: IProcessedLoan,
    integration: "jediswap" | "myswap",
    tokenA: Address,
    tokenB: Address
  ): Promise<BigNumberish[]> {
    try {
      let splitFn: (
        tokenA: Address,
        tokenB: Address,
        amount: bigint
      ) => Promise<DexLiquiditySplit>;

      if (integration === "jediswap") {
        splitFn = this.spendview.get_liquidity_split_jediswap.bind(
          this.spendview
        );
      } else {
        splitFn = this.spendview.get_liquidity_split_myswap.bind(
          this.spendview
        );
      }

      const amount = BigInt(loanRecord.currentAmount.valueOf());
      const split = await splitFn(tokenA, tokenB, amount);

      if (integration === "jediswap") {
        const lpToken = await this.jediswap.getLPToken(tokenA, tokenB);
        return this.getJediswapLiquidityCalldata(loanRecord, tokenA, tokenB);
      } else {
        return this.getMyswapLiquidityCalldata(loanRecord, tokenA, tokenB);
      }
    } catch (error) {
      console.error("Error in getAddLiquidityCalldata:", error);
      throw error;
    }
  }

  /**
   * Get swap calldata for interacting with L3
   * @param loanRecord Loan record
   * @param destination_market Destination market address
   * @param dapp Integration DApp
   * @param maxSlippagePercent Maximum slippage percentage
   * @returns Calldata for swap
   */
  async getSwapCalldata(
    loanRecord: IProcessedLoan,
    destination_market: Address,
    dapp: IIntegrationDApp,
    maxSlippagePercent: number = 0.5
  ): Promise<BigNumberish[]> {
    try {
      if (dapp === IIntegrationDApp.Jediswap) {
        return this.getJediswapCalldata(
          loanRecord,
          destination_market,
          maxSlippagePercent
        );
      } else if (dapp === IIntegrationDApp.Myswap) {
        return this.getMyswapCalldata(
          loanRecord,
          destination_market,
          maxSlippagePercent
        );
      } else {
        throw new Error("Unsupported DEX");
      }
    } catch (error) {
      console.error("Error in getSwapCalldata:", error);
      throw error;
    }
  }

  /**
   * Get JediSwap calldata
   * @param loanRecord Loan record
   * @param destination_market Destination market address
   * @param maxSlippagePercent Maximum slippage percentage
   * @returns Calldata for JediSwap
   */
  async getJediswapCalldata(
    loanRecord: IProcessedLoan,
    destination_market: Address,
    maxSlippagePercent: number = 0.5
  ): Promise<BigNumberish[]> {
    // This implementation avoids circular reference
    try {
      const fromToken = loanRecord.currentMarket;
      const calldata = await this.getSwapInfoCalldata(
        fromToken,
        destination_market,
        loanRecord.currentAmount,
        "myswap"
      );
      return calldata;
    } catch (error) {
      console.error("Error in getJediswapCalldata:", error);
      throw error;
    }
  }

  /**
   * Get MySwap calldata
   * @param loanRecord Loan record
   * @param destination_market Destination market address
   * @param maxSlippagePercent Maximum slippage percentage
   * @returns Calldata for MySwap
   */
  async getMyswapCalldata(
    loanRecord: IProcessedLoan,
    destination_market: Address,
    maxSlippagePercent: number = 0.5
  ): Promise<BigNumberish[]> {
    try {
      const fromToken = loanRecord.currentMarket;
      const calldata = await this.getSwapInfoCalldata(
        fromToken,
        destination_market,
        loanRecord.currentAmount,
        "jediswap"
      );
      return calldata;
    } catch (error) {
      console.error("Error in getMyswapCalldata:", error);
      throw error;
    }
  }

  /**
   * Get minimum swap output based on slippage
   * @param fromToken Source token address
   * @param destination Destination token address
   * @param amount Amount to swap
   * @param maxSlippagePercent Maximum slippage percentage
   * @returns Minimum output amount
   */
  async getMinSwapOut(
    fromToken: Address,
    destination: Address,
    amount: BigInt | MyBigNumber,
    maxSlippagePercent = 0.5
  ): Promise<BigInt> {
    try {
      // Calculate minimum amount out with slippage
      const amountValue =
        typeof amount === "bigint" ? amount : BigInt(amount.valueOf());
      const slippageFactor = 1 - maxSlippagePercent / 100;
      return BigInt(Math.floor(Number(amountValue) * slippageFactor));
    } catch (error) {
      console.error("Error in getMinSwapOut:", error);
      throw error;
    }
  }

  /**
   * Get loan record by ID
   * @param loan_id Loan ID
   * @returns Processed loan record
   */
  async getLoanRecord(loan_id: string): Promise<IProcessedLoan> {
    try {
      const [loan, _] = await this.router.getLoanCollateralRecord(loan_id);

      return {
        loan_id: loan.loan_id,
        underlyingMarket: Address.from(loan.market),
        underlyingDecimals: 18, // This would be dynamically determined in a full implementation
        currentMarket: Address.from(loan.current_market),
        currentAmount: new MyBigNumber(loan.current_amount.low, 18),
        state: loan.state,
      };
    } catch (error) {
      console.error("Error in getLoanRecord:", error);
      throw error;
    }
  }

  /**
   * Get swap routes for a token pair
   * @param fromToken Source token address
   * @param toToken Destination token address
   * @param amount Amount to swap
   * @param integration DEX to use
   * @returns Array of routes
   */
  public async getSwapRoutes(
    fromToken: string,
    toToken: string,
    amount: MyBigNumber,
    integration: "jediswap" | "myswap"
  ): Promise<IRoute[]> {
    try {
      // Using isomorphic fetch instead of axios
      const response = await fetchJson(`${BASE_URL}/swap/v2/quote`, {
        method: "POST",
        body: {
          sellTokenAddress: fromToken,
          buyTokenAddress: toToken,
          sellAmount: amount.toWeiString(),
          includeSources: [integration],
        },
      });

      if (!response.quotes || response.quotes.length === 0) {
        // Return a mock route if no quotes are found
        return [
          {
            dex: integration,
            percent: 100,
            fromToken,
            toToken,
            path: [fromToken, toToken],
            additional_params: [],
          },
        ];
      }

      // Extract routes from the response
      const quote = response.quotes[0];

      return [
        {
          dex: integration,
          percent: 100,
          fromToken,
          toToken,
          path: [fromToken, toToken],
          additional_params: [],
        },
      ];
    } catch (error) {
      console.error("Error in getSwapRoutes:", error);
      // Return a mock route in case of error
      return [
        {
          dex: integration,
          percent: 100,
          fromToken,
          toToken,
          path: [fromToken, toToken],
          additional_params: [],
        },
      ];
    }
  }

  /**
   * Get token price from an external API
   * @param fromToken Source token
   * @param toToken Destination token
   * @returns Price as a MyBigNumber
   */
  private async TokenPrice(
    fromToken: Address,
    toToken: Address
  ): Promise<MyBigNumber> {
    try {
      const tokenA = getTokenName(fromToken);
      const tokenB = getTokenName(toToken);

      // In a real implementation, this would fetch from an API
      // For now, return a mock price to maintain API parity
      return new MyBigNumber("1", getTokenDecimals(toToken));
    } catch (error) {
      console.error("Error fetching price:", error);
      throw error;
    }
  }

  /**
   * Get swap values for a token pair
   * @param fromToken Source token address
   * @param toToken Destination token address
   * @param amount Amount to swap
   * @param integration DEX to use
   * @returns Expected swap output amount
   */
  private async getSwapValues(
    fromToken: string,
    toToken: string,
    amount: bigint,
    integration: "jediswap" | "myswap"
  ): Promise<bigint> {
    try {
      // In a real implementation, this would call APIs or contracts
      // For now, return the input amount to maintain API parity
      return amount;
    } catch (error) {
      console.error("Error in getSwapValues:", error);
      throw error;
    }
  }

  /**
   * Create swap information object
   * @param fromToken Source token
   * @param toToken Destination token
   * @param amount Amount to swap
   * @returns Swap information object
   */
  public async getSwapInfo(
    fromToken: Address,
    toToken: Address,
    amount: MyBigNumber
  ): Promise<ISwapInfo> {
    try {
      const routes: IRoute[] = await this.getSwapRoutes(
        fromToken.address,
        toToken.address,
        amount,
        "jediswap"
      );

      return {
        fromToken: fromToken.address,
        toToken: toToken.address,
        amount: amount.toWeiU256(),
        routes,
      };
    } catch (error) {
      console.error("Error in getSwapInfo:", error);
      throw error;
    }
  }

  /**
   * Returns an empty swap info object for cases where no swap is needed
   * @returns An empty ISwapInfo object
   */
  getZeroSwapInfo(): ISwapInfo {
    return {
      fromToken: "0x0",
      toToken: "0x0",
      amount: ["0", "0"], // [low, high] as BigNumberish[]
      routes: [],
    };
  }

  /**
   * Sorts swap info objects, prioritizing non-zero swaps first
   * @param swapInfos Array of swap info objects to sort
   * @returns Sorted array of swap info objects
   */
  private sortSwapInfos(swapInfos: ISwapInfo[]): ISwapInfo[] {
    const swaps: ISwapInfo[] = [];
    swapInfos.forEach((swapInfo) => {
      if (swapInfo.fromToken === "0x0") {
        swaps.push(swapInfo);
      } else {
        swaps.unshift(swapInfo);
      }
    });
    return swaps;
  }

  /**
   * Calculates the length of encoded swap info for calldata generation
   * @param params Array of swap info objects
   * @returns Length of encoded swap info
   */
  private swap_info(params: ISwapInfo[]): number {
    // In a Next.js compatible environment, we need to handle this differently
    // than in the v1 SDK which uses direct access to CallData.getAbiStruct
    // This is a simplified implementation that calculates the approximate length
    let totalLength = 0;

    for (const info of params) {
      // Base fields: fromToken, toToken, amount
      totalLength += 3;

      // Add routes length
      if (info.routes && info.routes.length > 0) {
        totalLength += 1; // Length field

        for (const route of info.routes) {
          // Each route has fields: dex, percent, fromToken, toToken, path, additional_params
          totalLength += 5;

          // Add path length
          totalLength += route.path.length;

          // Add additional_params length
          totalLength += route.additional_params.length;
        }
      } else {
        totalLength += 1; // Empty routes array length
      }
    }

    return totalLength;
  }

  /**
   * Get Jediswap liquidity calldata
   * @param loanRecord Loan record
   * @param tokenA First token address
   * @param tokenB Second token address
   * @returns Calldata for adding liquidity to Jediswap
   */
  async getJediswapLiquidityCalldata(
    loanRecord: IProcessedLoan,
    tokenA: Address,
    tokenB: Address
  ): Promise<BigNumberish[]> {
    try {
      // Get the split for the tokens
      const split = await this.spendview.get_liquidity_split_jediswap(
        tokenA,
        tokenB,
        BigInt(loanRecord.currentAmount.valueOf())
      );

      // Get the LP token
      const lpToken = await this.jediswap.getLPToken(tokenA, tokenB);

      // Get reserves for the token pair
      const [reserveA, reserveB] = await this.jediswap.getReserves(lpToken);

      // Get total supply of LP tokens
      const totalSupply = await this.jediswap.getTotalSupply(lpToken);

      // Calculate minimum LP tokens out based on slippage
      const minLPOut = this.jediswap.minLPOut(
        BigInt(split.amountA),
        BigInt(split.amountB),
        reserveA,
        reserveB,
        totalSupply,
        0.5 // Default slippage percentage
      );

      // Mock calldata structure for adding liquidity
      // In a real implementation, this would be generated based on the contract's ABI
      return [
        split.amountA.toString(),
        split.amountB.toString(),
        minLPOut.toString(),
        "0", // Deadline (0 for no deadline)
      ];
    } catch (error) {
      console.error("Error in getJediswapLiquidityCalldata:", error);
      throw error;
    }
  }

  /**
   * Get MySwap liquidity calldata
   * @param loanRecord Loan record
   * @param tokenA First token address
   * @param tokenB Second token address
   * @returns Calldata for adding liquidity to MySwap
   */
  async getMyswapLiquidityCalldata(
    loanRecord: IProcessedLoan,
    tokenA: Address,
    tokenB: Address
  ): Promise<BigNumberish[]> {
    try {
      // Get the split for the tokens
      const split = await this.spendview.get_liquidity_split_myswap(
        tokenA,
        tokenB,
        BigInt(loanRecord.currentAmount.valueOf())
      );

      // Get the pool ID
      const poolId = await this.myswap.getPoolId(tokenA, tokenB);

      // Get reserves for the token pair
      const [reserveA, reserveB] = await this.myswap.getReserves(poolId);

      // Calculate minimum LP tokens based on slippage
      const minLPOut = this.myswap.calculateMinLPTokens(
        BigInt(split.amountA),
        BigInt(split.amountB),
        reserveA,
        reserveB,
        0.5 // Default slippage percentage
      );

      // Mock calldata structure for adding liquidity
      // In a real implementation, this would be generated based on the contract's ABI
      return [
        poolId,
        split.amountA.toString(),
        split.amountB.toString(),
        minLPOut.toString(),
      ];
    } catch (error) {
      console.error("Error in getMyswapLiquidityCalldata:", error);
      throw error;
    }
  }

  /**
   * Spend loan funds through the router contract
   * @param params Spend parameters
   * @returns Transaction response
   */
  async spend(params: ISpendParams) {
    try {
      const spendAllParams: ISpendAllParams = {
        loan_id: params.loan_id,
        destination_market: params.destination_market.address,
        l3_integration: params.l3_integration,
        l3_category: params.l3_category,
        l3_data: params.l3_data || [],
      };

      return await this.router.spendAll(spendAllParams);
    } catch (error) {
      console.error("Error in spend:", error);
      throw error;
    }
  }

  /**
   * Revert a spend operation
   * @param params Revert spend parameters
   * @returns Transaction response
   */
  async revertSpend(params: IRevertSpendParams) {
    try {
      const revertSpendAllParams: IRevertSpendAllParams = {
        loan_id: params.loan_id,
      };

      return await this.router.revertSpendAll(revertSpendAllParams);
    } catch (error) {
      console.error("Error in revertSpend:", error);
      throw error;
    }
  }

  /**
   * Get calldata for reverting a swap operation with either Jediswap or Myswap
   * @param loanRecord Loan record to revert
   * @param dappname The DEX integration name ('jediswap' or 'myswap')
   * @param maxSlippagePercent Maximum slippage percentage allowed
   * @returns Calldata for the revert operation
   * @private
   */
  /**
   * Get calldata for reverting a JediSwap operation
   * @param loanRecord Loan record to revert
   * @param maxSlippagePercent Maximum slippage percentage allowed
   * @returns Calldata for the revert operation
   */
  async getRevertJediSwapCalldata(
    loanRecord: IProcessedLoan,
    maxSlippagePercent: number = 0.5
  ): Promise<IRevertSpendAllParams> {
    return this.getRevertSwapCalldata(
      loanRecord,
      "jediswap",
      maxSlippagePercent
    );
  }

  /**
   * Get calldata for reverting a MySwap operation
   * @param loanRecord Loan record to revert
   * @param maxSlippagePercent Maximum slippage percentage allowed
   * @returns Calldata for the revert operation
   */
  async getRevertMySwapCalldata(
    loanRecord: IProcessedLoan,
    maxSlippagePercent: number = 0.5
  ): Promise<IRevertSpendAllParams> {
    return this.getRevertSwapCalldata(loanRecord, "myswap", maxSlippagePercent);
  }

  /**
   * Get calldata for reverting a JediSwap liquidity provision operation
   * @param loanRecord Loan record with LP tokens
   * @param maxSlippagePercent Maximum slippage percentage allowed
   * @returns Calldata for the revert operation
   */
  async getRevertJediLiquidityCalldata(
    loanRecord: IProcessedLoan,
    maxSlippagePercent: number = 0.5
  ): Promise<IRevertSpendAllParams> {
    try {
      // Use the base method with JediSwap-specific implementations for
      // getting token splits and underlying tokens
      const res = await this.getRevertLiquidityCalldata(
        loanRecord,
        // Function to get token amounts from LP tokens
        async (lpAmount: MyBigNumber, pairAddress: Address) => {
          // In v2 we use our simplified implementation
          const split = await this.spendview.get_liquidity_split_jediswap(
            Address.from("0x0"), // This is a placeholder, just need split ratio
            Address.from("0x0"), // This is a placeholder
            BigInt(lpAmount.valueOf())
          );
          return split;
        },
        // Function to get the underlying tokens for a given LP token
        async (lpToken: Address) => {
          return await this.spendview.get_underlying_tokens_jediswap(lpToken);
        },
        "jediswap",
        maxSlippagePercent
      );

      // Return the parameters needed for the router contract
      return res.spendAllParams;
    } catch (error) {
      console.error("Error in getRevertJediLiquidityCalldata:", error);
      throw error;
    }
  }

  /**
   * Get calldata for reverting a MySwap liquidity provision operation
   * @param loanRecord Loan record with LP tokens
   * @param maxSlippagePercent Maximum slippage percentage allowed
   * @returns Calldata for the revert operation
   */
  async getRevertMySwapLiquidityCalldata(
    loanRecord: IProcessedLoan,
    maxSlippagePercent: number = 0.5
  ): Promise<IRevertSpendAllParams> {
    try {
      // Use the base method with MySwap-specific implementations
      const res = await this.getRevertLiquidityCalldata(
        loanRecord,
        // Function to get token amounts from LP tokens
        async (lpAmount: MyBigNumber, pairAddress: Address) => {
          // Get liquidity split using the MySwap implementation
          const split = await this.spendview.get_liquidity_split_myswap(
            Address.from("0x0"), // This is a placeholder
            Address.from("0x0"), // This is a placeholder
            BigInt(lpAmount.valueOf())
          );

          return split;
        },
        // Function to get the underlying tokens for a given pool ID
        async (lpToken: Address) => {
          // In MySwap, the lpToken is actually the pool ID
          const poolId = await this.myswap.getPoolId(
            Address.from("0x0"), // Placeholder
            Address.from("0x0") // Placeholder
          );

          return await this.spendview.get_underlying_tokens_myswap(poolId);
        },
        "myswap",
        maxSlippagePercent
      );

      // For MySwap we need to retrieve the pool ID and set it as an additional parameter
      // In a real implementation we would query for the actual pool ID here
      const poolId = "1"; // Mock value for demonstration

      // Ensure revertSpendParams exists before accessing it
      if (res.spendAllParams.revertSpendParams) {
        res.spendAllParams.revertSpendParams.additional_params = [poolId];
      } else {
        // If revertSpendParams doesn't exist, create it with the pool ID
        res.spendAllParams.revertSpendParams = {
          loan_id: res.spendAllParams.loan_id,
          additional_params: [poolId],
        };
      }

      return res.spendAllParams;
    } catch (error) {
      console.error("Error in getRevertMySwapLiquidityCalldata:", error);
      throw error;
    }
  }

  /**
   * General method for reverting liquidity operations
   * @param loanRecord Loan record with the LP tokens
   * @param liquiditySplitFn Function to calculate token amounts from LP tokens
   * @param getUnderlyingTokensFn Function to get the underlying tokens of an LP token
   * @param dappname The DEX integration name
   * @param maxSlippagePercent Maximum slippage percentage
   * @returns Object containing revert parameters and additional info
   * @private
   */
  private async getRevertLiquidityCalldata(
    loanRecord: IProcessedLoan,
    liquiditySplitFn: (
      lpAmount: MyBigNumber,
      pairAddress: Address
    ) => Promise<DexLiquiditySplit>,
    getUnderlyingTokensFn: (lpToken: Address) => Promise<[Address, Address]>,
    dappname: "jediswap" | "myswap",
    maxSlippagePercent: number = 0.5
  ): Promise<{
    spendAllParams: IRevertSpendAllParams;
    additionalInfo: {
      lpToken: Address;
    };
  }> {
    try {
      const fromToken = loanRecord.underlyingMarket;
      const lpToken = loanRecord.currentMarket;

      // Get the tokens in the liquidity pool
      const [tokenA, tokenB] = await getUnderlyingTokensFn(lpToken);

      // Calculate the expected token amounts from the LP tokens
      const result2 = await liquiditySplitFn(loanRecord.currentAmount, lpToken);

      // Map the token amounts to the correct tokens
      const amtA = tokenA.eq(result2.tokenA)
        ? result2.amountA
        : result2.amountB;
      const amtB = tokenB.eq(result2.tokenB)
        ? result2.amountB
        : result2.amountA;
      console.log(
        "amtA",
        BigInt(amtA.valueOf()).toString(),
        "amtB",
        BigInt(amtB.valueOf()).toString()
      );

      // Create swap info objects for each token
      let swap_infoA: ISwapInfo = this.getZeroSwapInfo();
      if (!tokenA.eq(fromToken.address)) {
        const routesA: IRoute[] = await this.getSwapRoutes(
          tokenA.address,
          fromToken.address,
          new MyBigNumber(amtA.toString(), 18),
          dappname
        );
        swap_infoA = {
          fromToken: tokenA.address,
          toToken: fromToken.address,
          amount: [amtA.toString(), "0"], // Low, high as BigNumberish[]
          routes: routesA,
        };
      }

      let swap_infoB: ISwapInfo = this.getZeroSwapInfo();
      if (!tokenB.eq(fromToken.address)) {
        const routesB: IRoute[] = await this.getSwapRoutes(
          tokenB.address,
          fromToken.address,
          new MyBigNumber(amtB.toString(), 18),
          dappname
        );
        swap_infoB = {
          fromToken: tokenB.address,
          toToken: fromToken.address,
          amount: [amtB.toString(), "0"], // Low, high as BigNumberish[]
          routes: routesB,
        };
      }

      // Calculate minimum expected output with slippage
      const minA = await this.getMinSwapOut(
        tokenA,
        fromToken,
        BigInt(amtA.valueOf()),
        maxSlippagePercent
      );
      const minB = await this.getMinSwapOut(
        tokenB,
        fromToken,
        BigInt(amtB.valueOf()),
        maxSlippagePercent
      );

      // Total minimum amount is the sum of both token minimums
      // Use explicit conversion to ensure proper BigInt addition
      const minOut = BigInt(minA.toString()) + BigInt(minB.toString());
      console.log("minOut", minOut.toString());

      // Sort the swap infos to prioritize non-zero swaps
      const [swap1, swap2] = this.sortSwapInfos([swap_infoA, swap_infoB]);

      // Convert loan_id to string if needed
      const loanIdStr =
        typeof loanRecord.loan_id === "string"
          ? loanRecord.loan_id
          : loanRecord.loan_id.toString();

      // Create the revert parameters
      const revertSpendParams: IRevertSpendParams = {
        loan_id: loanIdStr,
        additional_params: [],
      };

      // Create the final parameters for the router
      const spendAllParams: IRevertSpendAllParams = {
        loan_id: loanIdStr,
        revertSpendParams,
      };

      return {
        spendAllParams,
        additionalInfo: {
          lpToken,
        },
      };
    } catch (error) {
      console.error("Error in getRevertLiquidityCalldata:", error);
      throw error;
    }
  }

  /**
   * Get calldata for ZkLend liquidity provision operation
   * @param loanRecord Loan record
   * @returns Calldata for the ZkLend operation
   */
  async getZkLendLiquidityCalldata(
    loanRecord: IProcessedLoan
  ): Promise<ISpendAllParams> {
    try {
      const fromToken = loanRecord.currentMarket;

      // Create the spend parameters for ZkLend
      const spendParams: ISpendParams = {
        loan_id:
          typeof loanRecord.loan_id === "string"
            ? loanRecord.loan_id
            : loanRecord.loan_id.toString(),
        destination_market: fromToken,
        l3_integration: 2, // ZkLend enum value
        l3_category: 1, // Liquidity enum value
      };

      // Create the final parameters for the router
      const spendAllParams: ISpendAllParams = {
        loan_id:
          typeof loanRecord.loan_id === "string"
            ? loanRecord.loan_id
            : loanRecord.loan_id.toString(),
        destination_market: fromToken.address,
        l3_integration: 2, // ZkLend
        l3_category: 1, // Liquidity
        l3_data: [],
      };

      return spendAllParams;
    } catch (error) {
      console.error("Error in getZkLendLiquidityCalldata:", error);
      throw error;
    }
  }

  /**
   * Get calldata for reverting a ZkLend liquidity operation
   * @param loan_id Loan ID to revert
   * @returns Calldata for the revert operation
   */
  async getRevertZkLendLiquidityCalldata(
    loan_id: string
  ): Promise<IRevertSpendAllParams> {
    try {
      // For ZkLend we use a simple revert with no swap operations
      const revertSpendParams: IRevertSpendParams = {
        loan_id: loan_id,
        additional_params: [],
      };

      const spendAllParams: IRevertSpendAllParams = {
        loan_id: loan_id,
        revertSpendParams,
      };

      return spendAllParams;
    } catch (error) {
      console.error("Error in getRevertZkLendLiquidityCalldata:", error);
      throw error;
    }
  }

  /**
   * Get the direct revert calldata for a loan based on its integration and category
   * @param loan_id Loan ID to get revert calldata for
   * @param maxSlippagePercent Maximum slippage percentage allowed (default 0.5%)
   * @returns The appropriate calldata for reverting the loan
   */
  async getRevertCalldata(
    loan_id: string,
    maxSlippagePercent: number = 0.5
  ): Promise<BigNumberish[]> {
    try {
      // Get the loan record to determine integration and category
      const loanRecord = await this.getLoanRecord(loan_id);

      // Get loan details from the router
      const [loan, _] = await this.router.getLoanCollateralRecord(loan_id);
      console.log("loan", loan);
      const integration = Number(loan.l3_integration);
      console.log("integration", integration);
      const category = Number(loan.l3_category);
      console.log("category", category);

      // Route to the appropriate revert method based on integration and category
      if (integration === IntegrationDapp.JediSwap) {
        // JediSwap integration
        if (category === SpendCategory.Swap) {
          // Swap operation
          const params = await this.getRevertJediSwapCalldata(
            loanRecord,
            maxSlippagePercent
          );
          console.log("params", params);
          return params.revertSpendParams?.additional_params || [];
        } else if (category === SpendCategory.Liquidity) {
          // Liquidity operation
          const params = await this.getRevertJediLiquidityCalldata(loanRecord);
          console.log("params", params);
          return params.revertSpendParams?.additional_params || [];
        } else {
          throw new Error(`Invalid JediSwap category: ${category}`);
        }
      } else if (integration === IntegrationDapp.MySwap) {
        // MySwap integration
        if (category === SpendCategory.Swap) {
          // Swap operation
          const params = await this.getRevertMySwapCalldata(
            loanRecord,
            maxSlippagePercent
          );
          console.log("params", params);
          return params.revertSpendParams?.additional_params || [];
        } else if (category === SpendCategory.Liquidity) {
          // Liquidity operation
          const params =
            await this.getRevertMySwapLiquidityCalldata(loanRecord);
          console.log("params", params);
          return params.revertSpendParams?.additional_params || [];
        } else {
          throw new Error(`Invalid MySwap category: ${category}`);
        }
      } else if (integration === IntegrationDapp.zkLend) {
        // ZkLend integration
        if (category === SpendCategory.Liquidity) {
          // Liquidity operation
          const params = await this.getRevertZkLendLiquidityCalldata(loan_id);
          console.log("params", params);
          return params.revertSpendParams?.additional_params || [];
        } else {
          throw new Error(`Invalid ZkLend category: ${category}`);
        }
      }

      throw new Error(`Invalid integration: ${integration} or loan not spent`);
    } catch (error) {
      console.error("Error in getRevertCalldata:", error);
      throw error;
    }
  }

  /**
   * Determine the appropriate revert parameters based on the loan's integration and category
   * @param loan_id Loan ID to revert
   * @param maxSlippagePercent Maximum slippage percentage allowed
   * @returns Appropriate revert parameters for the loan
   */
  async getUniversalRevertParams(
    loan_id: string,
    maxSlippagePercent: number = 0.5
  ): Promise<IRevertSpendAllParams> {
    try {
      // Get the loan record first
      const loanRecord = await this.getLoanRecord(loan_id);

      // Get loan and collateral data from Router contract
      const [loan, _] = await this.router.getLoanCollateralRecord(loan_id);

      // Parse the l3_integration and l3_category from loan data
      const integration = parseInt(loan.l3_integration.toString());
      const category = parseInt(loan.l3_category.toString());

      // Determine the appropriate revert method based on integration and category
      if (integration === IntegrationDapp.JediSwap) {
        if (category === SpendCategory.Swap) {
          return await this.getRevertJediSwapCalldata(
            loanRecord,
            maxSlippagePercent
          );
        } else if (category === SpendCategory.Liquidity) {
          return await this.getRevertJediLiquidityCalldata(
            loanRecord,
            maxSlippagePercent
          );
        } else {
          throw new Error("Invalid Jedi category");
        }
      } else if (integration === IntegrationDapp.MySwap) {
        if (category === SpendCategory.Swap) {
          return await this.getRevertMySwapCalldata(
            loanRecord,
            maxSlippagePercent
          );
        } else if (category === SpendCategory.Liquidity) {
          return await this.getRevertMySwapLiquidityCalldata(
            loanRecord,
            maxSlippagePercent
          );
        } else {
          throw new Error("Invalid MySwap category");
        }
      } else if (integration === IntegrationDapp.zkLend) {
        if (category === SpendCategory.Liquidity) {
          return await this.getRevertZkLendLiquidityCalldata(loan_id);
        } else {
          throw new Error("Invalid ZkLend category");
        }
      }

      throw new Error("Invalid integration or loan not spent");
    } catch (error) {
      console.error("Error in getUniversalRevertParams:", error);
      throw error;
    }
  }

  /**
   * Base method for reverting swap operations
   * @param loanRecord Loan record to revert
   * @param dappname The DEX integration name ('jediswap' or 'myswap')
   * @param maxSlippagePercent Maximum slippage percentage allowed
   * @returns Calldata for the revert operation
   * @private
   */
  private async getRevertSwapCalldata(
    loanRecord: IProcessedLoan,
    dappname: "jediswap" | "myswap",
    maxSlippagePercent: number = 0.5
  ): Promise<IRevertSpendAllParams> {
    try {
      const fromToken = loanRecord.currentMarket;
      const total_loan = loanRecord.currentAmount;

      // Verify the loan is in spent state (state 2)
      if (loanRecord.state !== 2) {
        throw new Error("Loan not in spent state");
      }

      const underlying = loanRecord.underlyingMarket;
      console.log("got underlying token", underlying.address);

      // Get swap routes from current market back to underlying market
      const routes: IRoute[] = await this.getSwapRoutes(
        fromToken.address,
        underlying.address,
        total_loan,
        dappname
      );

      console.log("got route", routes);
      console.log("total_loan", total_loan);

      // Create swap info for the revert operation
      const swap_infoA: ISwapInfo = {
        fromToken: fromToken.address,
        toToken: underlying.address,
        amount: total_loan.toWeiU256(),
        routes: routes,
      };

      console.log("swapinfo", swap_infoA);

      // Get minimum amount out based on slippage
      const minAmountOut = await this.getMinSwapOut(
        fromToken,
        underlying,
        total_loan,
        maxSlippagePercent
      );

      // Convert loan_id to string if it's not already
      const loanIdStr =
        typeof loanRecord.loan_id === "string"
          ? loanRecord.loan_id
          : loanRecord.loan_id.toString();

      // Create revert spend parameters
      const revertSpendParams: IRevertSpendParams = {
        loan_id: loanIdStr,
        additional_params: [],
      };

      // Create final parameters for router contract
      const spendAllParams: IRevertSpendAllParams = {
        loan_id: loanIdStr,
        revertSpendParams,
      };

      return spendAllParams;
    } catch (error) {
      console.error("Error in getRevertSwapCalldata:", error);
      throw error;
    }
  }
}
