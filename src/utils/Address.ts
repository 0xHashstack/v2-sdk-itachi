/**
 * Address utility class for StarkNet addresses
 * Modified to be compatible with Next.js
 */

// Helper function to process addresses - moved inline to avoid additional dependencies
function processAddress(address?: string): string {
  if (!address) {
    return "0x0";
  }

  // Remove '0x' prefix if it exists
  const hexAddress = address.toLowerCase().startsWith("0x")
    ? address.slice(2)
    : address;

  // Convert to BigInt and back to hex for normalization
  try {
    return (
      "0x" +
      BigInt("0x" + hexAddress)
        .toString(16)
        .toLowerCase()
    );
  } catch {
    // Fallback if address is not valid hex
    return "0x0";
  }
}

export class Address {
  readonly address: string;

  constructor(address: string) {
    this.address = processAddress(address);
  }

  /** Just an alternative syntax */
  static from(address: string): Address {
    return new Address(address);
  }

  toString(): string {
    return this.address;
  }

  eq(other: string | Address): boolean {
    const otherAddress = other instanceof Address ? other.address : other;
    return Address.eqString(this.address, otherAddress);
  }

  static eq(a: Address, b: Address): boolean {
    return a.address === b.address;
  }

  static eqString(a: string, b: string): boolean {
    return processAddress(a) === processAddress(b);
  }

  /**
   * Convert to a format suitable for JSON serialization
   */
  toJSON(): string {
    return this.address;
  }
}
