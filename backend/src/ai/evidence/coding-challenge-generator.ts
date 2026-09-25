export interface CodeChallenge {
  id: string;
  repoName: string;
  functionName: string;
  language: string;
  title: string;
  description: string;
  starterCode: string;
  expectedBehavior: string;
}

export class CodingChallengeGenerator {
  /**
   * Generates a concise, realistic function challenge anchored directly to the candidate's GitHub repository work.
   */
  static generateChallenge(params: {
    githubAnalysis?: any;
    jdSkills?: string[];
    candidateName?: string;
  }): CodeChallenge {
    const { githubAnalysis, jdSkills = [] } = params;

    const repos = githubAnalysis?.analyzedRepos || [];
    const topRepo = repos.length > 0 ? repos[0] : null;
    const repoName = topRepo?.repoName || 'backend-service';
    const repoTechs = (topRepo?.relevantTechnologies || githubAnalysis?.topTechnologies || jdSkills || []).map((t: string) => t.toLowerCase());

    const isPython = repoTechs.includes('python') || topRepo?.language?.toLowerCase() === 'python';

    // 1. Security / Auth / Token Hashing (e.g. OAuth, JWT, session tokens)
    if (
      repoTechs.some((t: string) => t.includes('auth') || t.includes('sec') || t.includes('jwt') || t.includes('crypto') || t.includes('oauth')) ||
      repoName.toLowerCase().includes('auth') ||
      repoName.toLowerCase().includes('sec') ||
      repoName.toLowerCase().includes('oauth') ||
      repoTechs.length === 0 // Default to Auth/OAuth challenge if no specific tech matched
    ) {
      if (isPython) {
        return {
          id: `challenge-hash-${repoName}`,
          repoName,
          functionName: 'hash_token',
          language: 'python',
          title: `OAuth Token Hashing from ${repoName}`,
          description: `In your repository "${repoName}", you implemented OAuth and authentication flows. Write a small helper function 'hash_token(payload: str, salt: str) -> str' that combines the payload with the salt and computes a secure SHA-256 hash string representation.`,
          starterCode: `import hashlib

def hash_token(payload: str, salt: str) -> str:
    # TODO: Combine payload and salt, compute SHA-256 hex digest
    pass
`,
          expectedBehavior: 'Combines payload and salt, returns a deterministic SHA-256 hexadecimal string, and handles empty inputs gracefully.',
        };
      }

      return {
        id: `challenge-hash-${repoName}`,
        repoName,
        functionName: 'hashToken',
        language: 'typescript',
        title: `OAuth Token Hashing from ${repoName}`,
        description: `In your repository "${repoName}", you implemented OAuth and authentication flows. Write a small helper function 'hashToken(payload: string, salt: string): string' that combines the payload with the salt and computes a deterministic hash or encoded token string.`,
        starterCode: `export function hashToken(payload: string, salt: string): string {
  // TODO: Combine payload and salt, then return a hashed or encoded token string
  
}
`,
        expectedBehavior: 'Combines payload and salt, returns a deterministic hash string, and handles empty inputs gracefully.',
      };
    }

    // 2. Cache / Data Store / TTL Check
    if (repoTechs.some((t: string) => t.includes('redis') || t.includes('cache') || t.includes('store')) || repoName.toLowerCase().includes('cache')) {
      return {
        id: `challenge-cache-${repoName}`,
        repoName,
        functionName: 'isCacheExpired',
        language: isPython ? 'python' : 'typescript',
        title: `Cache TTL Checker from ${repoName}`,
        description: `In your repository "${repoName}", you implemented caching logic. Write a small function 'isCacheExpired' that takes an entry's creation timestamp (ms), time-to-live duration (ms), and current time (ms), and returns whether the entry is expired.`,
        starterCode: isPython
          ? `def is_cache_expired(created_at_ms: int, ttl_ms: int, current_time_ms: int) -> bool:
    # TODO: Return True if expired, False otherwise
    pass
`
          : `export function isCacheExpired(createdAtMs: number, ttlMs: number, currentTimeMs: number): boolean {
  // TODO: Return true if expired, false otherwise
  
}
`,
        expectedBehavior: 'Returns true when (currentTimeMs - createdAtMs) >= ttlMs, handles edge cases with zero or negative durations.',
      };
    }

    // 3. E-Commerce / Order / Pricing Calculation
    if (repoTechs.some((t: string) => t.includes('order') || t.includes('checkout') || t.includes('cart') || t.includes('shop')) || repoName.toLowerCase().includes('checkout') || repoName.toLowerCase().includes('order')) {
      return {
        id: `challenge-calc-${repoName}`,
        repoName,
        functionName: 'calculateCartTotal',
        language: isPython ? 'python' : 'typescript',
        title: `Cart Total Calculation from ${repoName}`,
        description: `In your repository "${repoName}", you handled order calculations. Write a small function 'calculateCartTotal' that takes a list of items ({ price, quantity }) and a discount percentage (0 to 100), and returns the final rounded total (rounded to 2 decimal places).`,
        starterCode: isPython
          ? `def calculate_cart_total(items: list[dict], discount_percent: float = 0.0) -> float:
    # TODO: Calculate subtotal, apply discount_percent, and return rounded total
    pass
`
          : `interface CartItem {
  price: number;
  quantity: number;
}

export function calculateCartTotal(items: CartItem[], discountPercent: number = 0): number {
  // TODO: Calculate total, apply discountPercent, and return rounded amount
  
}
`,
        expectedBehavior: 'Sums (price * quantity), applies percentage discount, ensures non-negative total, and handles empty list gracefully.',
      };
    }

    // 4. Default / Canonical Data Transformation (e.g. hash token / data utility)
    return {
      id: `challenge-util-${repoName}`,
      repoName,
      functionName: 'hashToken',
      language: isPython ? 'python' : 'typescript',
      title: `Token Hashing Utility from ${repoName}`,
      description: `In your repository "${repoName}", you implemented authentication and data processing. Write a small helper function 'hashToken' that takes a secret string and a salt string, and returns a sanitized, combined hash string representation.`,
      starterCode: isPython
        ? `def hash_token(secret: str, salt: str) -> str:
    # TODO: Combine secret with salt and return a hash string
    pass
`
        : `export function hashToken(secret: string, salt: string): string {
  // TODO: Combine secret with salt and return a hash string
  
}
`,
      expectedBehavior: 'Combines secret and salt, returns clean hash string, handles edge cases like empty inputs.',
    };
  }
}
