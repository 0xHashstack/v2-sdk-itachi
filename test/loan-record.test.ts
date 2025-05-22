import { Spend } from "../src";
import { Address } from "../src/utils/Address";
import mainnetTokens from "./tokens.mainnet.json";
import { IConfig } from "../src/interfaces/config.interfaces";
import { RpcProvider } from "starknet";

/**
 * Test the getLoanRecord method with a specific loan ID
 */
async function testGetLoanById() {
  try {
    // Initialize a proper StarkNet provider
    const provider = new RpcProvider({
      nodeUrl: "https://starknet-mainnet.public.blastapi.io",
    });

    // Configure the SDK with a proper provider object
    // Note: There's a mismatch between the interface and implementation
    // The interface expects 'provider' to be a string, but the implementation requires a provider object
    // We'll use a type assertion with 'any' to bypass this type check
    const config: any = {
      provider: provider, // Pass the initialized provider object
      chainId: "SN_MAIN", // Optional chain ID
    };

    // Router contract address
    const routerAddress =
      "0x1b862c518939339b950d0d21a3d4cc8ead102d6270850ac8544636e558fab68";

    // Define interface for token structure in the JSON file
    interface TokenJson {
      name: string;
      symbol: string;
      decimals: number;
      address?: string;
      NETWORK_TOKEN_ADDRESS?: string;
    }

    // Format tokens to match the format expected by the SDK
    const formattedTokens = mainnetTokens.map((token: TokenJson) => ({
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      address: token.address || token.NETWORK_TOKEN_ADDRESS || "", // Use NETWORK_TOKEN_ADDRESS if address is empty
    }));

    console.log(
      `Using ${formattedTokens.length} tokens from mainnet configuration`
    );

    // Initialize Spend entity
    const spend = new Spend(config, routerAddress, formattedTokens);

    // Test with the specific loan ID requested
    const loanId = "2355";

    console.log(`Fetching loan record for ID: ${loanId}`);

    try {
      // Get the loan record
      const loanRecord = await spend.getLoanRecord(loanId);
      console.log("Loan Record retrieved successfully:", loanRecord);
      return loanRecord;
    } catch (error) {
      console.error("Error in testGetLoanById:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error in testGetLoanById:", error);
    throw error;
  }
}

// If running this file directly
if (require.main === module) {
  console.log("Starting loan record test...");
  testGetLoanById()
    .then(() => console.log("Test completed successfully"))
    .catch((error) => {
      console.error("Test failed:", error);
      process.exit(1);
    });
}

export { testGetLoanById };
