import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { formatSgd } from '@vida/shared';

/**
 * Money Serialiser Interceptor
 *
 * Problem: `bigint` is not JSON-serialisable. `JSON.stringify(1234n)` throws
 * "TypeError: Do not know how to serialize a BigInt". Prisma returns bigint for
 * every `BigInt` column.
 *
 * Solution: Walk the outgoing response tree and replace every `bigint` value
 * with a `Money` object — `{ cents: number, display: "S$12.34" }` — that
 * matches the shared `Money` type clients import.
 *
 * Why a number for `cents` and not a string?
 *   JS integers are exact up to 2^53 (~9 quadrillion). The largest conceivable
 *   SGD amount in this system is a few million dollars (8–9 digits of cents),
 *   comfortably inside that range. Using `number` keeps the client code simple:
 *   arithmetic without BigInt conversion.
 *
 * Field naming: the transform only fires on bigint values. Prisma maps
 * BigInt columns to JS bigint, so there is no ambiguity with regular numbers.
 *
 * We do NOT recurse into class instances to avoid hitting methods. We only
 * recurse into plain objects and arrays, which covers all Prisma results.
 */
@Injectable()
export class MoneySerializerInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => transformBigInts(data)));
  }
}

function transformBigInts(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'bigint') {
    return {
      cents: Number(value),
      display: formatSgd(value),
    };
  }

  if (Array.isArray(value)) {
    return value.map(transformBigInts);
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = transformBigInts(v);
    }
    return result;
  }

  return value;
}
