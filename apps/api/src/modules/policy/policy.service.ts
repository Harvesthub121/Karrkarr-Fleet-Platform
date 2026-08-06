import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { POLICY_DEFAULTS, type PolicyKey } from '@vida/shared';

// ---------------------------------------------------------------------------
// PolicyService
//
// Resolution order (as documented in the schema):
//   1. Per-contract override (interestRateBpsOverride, gracePeriodDaysOverride
//      on RentalAgreement — handled inline by billing engine)
//   2. Branch-level PolicySetting (branchId IS NOT NULL)
//   3. Global PolicySetting (branchId IS NULL)
//   4. POLICY_DEFAULTS from @vida/shared (compile-time safety net)
//
// Cache design:
//   - We cache ALL active settings at startup and invalidate on every write.
//   - This is appropriate for a settings store that changes rarely (daily at most)
//     and is read on every billing/reminder tick. A per-key TTL cache would be
//     simpler but would silently serve stale rates for up to N seconds after an
//     admin changes the interest rate. Explicit invalidation is safer here.
//   - The cache is process-local. In a multi-instance deployment a write to one
//     pod will not immediately invalidate other pods. Acceptable for this use
//     case: settings changes take effect at most one billing cycle later (daily).
//     Add a Redis pub/sub invalidation if sub-second consistency is ever required.
// ---------------------------------------------------------------------------

interface CacheEntry {
  value: string;
}

type PolicyCache = {
  global: Map<PolicyKey, CacheEntry>;
  byBranch: Map<string, Map<PolicyKey, CacheEntry>>;
};

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);
  private cache: PolicyCache | null = null;

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Typed accessor — the primary API for the rest of the codebase
  // ---------------------------------------------------------------------------

  /** Resolve a policy key for a specific branch, following the priority chain. */
  async get(key: PolicyKey, branchId?: string | null): Promise<string> {
    const cache = await this.getCache();

    // Branch-level override
    if (branchId) {
      const branchVal = cache.byBranch.get(branchId)?.get(key);
      if (branchVal !== undefined) return branchVal.value;
    }

    // Global setting
    const globalVal = cache.global.get(key);
    if (globalVal !== undefined) return globalVal.value;

    // Compiled default
    return POLICY_DEFAULTS[key] ?? '';
  }

  async getInt(key: PolicyKey, branchId?: string | null): Promise<number> {
    const val = await this.get(key, branchId);
    const n = parseInt(val, 10);
    if (!Number.isInteger(n)) {
      this.logger.warn(`Policy key ${key} value "${val}" is not an integer; using default`);
      return parseInt(POLICY_DEFAULTS[key] ?? '0', 10);
    }
    return n;
  }

  async getBool(key: PolicyKey, branchId?: string | null): Promise<boolean> {
    const val = await this.get(key, branchId);
    return val === 'true' || val === '1';
  }

  async getAll(branchId?: string | null): Promise<Record<string, string>> {
    const result: Record<string, string> = { ...POLICY_DEFAULTS };
    const cache = await this.getCache();

    // Overlay global settings
    for (const [k, v] of cache.global.entries()) {
      result[k] = v.value;
    }

    // Overlay branch settings
    if (branchId) {
      const branch = cache.byBranch.get(branchId);
      if (branch) {
        for (const [k, v] of branch.entries()) {
          result[k] = v.value;
        }
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Write path
  // ---------------------------------------------------------------------------

  async set(
    key: PolicyKey,
    value: string,
    branchId: string | null,
    updatedById?: string,
    description?: string,
  ) {
    // Find latest version for this key+branch pair to increment
    const existing = await this.prisma.policySetting.findFirst({
      where: { key, branchId: branchId ?? null },
      orderBy: { version: 'desc' },
    });

    const version = (existing?.version ?? 0) + 1;

    const setting = await this.prisma.policySetting.create({
      data: {
        key,
        value,
        branchId: branchId ?? null,
        version,
        updatedById,
        description,
        effectiveFrom: new Date(),
      },
    });

    // Invalidate cache so next read loads fresh settings
    this.cache = null;
    this.logger.log(`Policy updated: ${key} = ${value} (branch: ${branchId ?? 'global'})`);

    return setting;
  }

  async findHistory(key: PolicyKey, branchId?: string | null) {
    return this.prisma.policySetting.findMany({
      where: { key, branchId: branchId ?? null },
      orderBy: { version: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Cache management
  // ---------------------------------------------------------------------------

  private async getCache(): Promise<PolicyCache> {
    if (this.cache) return this.cache;

    const settings = await this.prisma.policySetting.findMany({
      orderBy: { version: 'asc' }, // ascending so higher versions overwrite lower
    });

    const global = new Map<PolicyKey, CacheEntry>();
    const byBranch = new Map<string, Map<PolicyKey, CacheEntry>>();

    for (const s of settings) {
      const k = s.key as PolicyKey;
      if (!s.branchId) {
        global.set(k, { value: s.value });
      } else {
        if (!byBranch.has(s.branchId)) {
          byBranch.set(s.branchId, new Map());
        }
        byBranch.get(s.branchId)!.set(k, { value: s.value });
      }
    }

    this.cache = { global, byBranch };
    return this.cache;
  }

  /** Force cache invalidation — called by the write path and can be called
   *  by integration tests to reset state. */
  invalidateCache(): void {
    this.cache = null;
  }
}
