import { vi } from "vitest";

type QueryResult = { data: any; error: any };

interface TableMockConfig {
  selectResult?: QueryResult;
  selectEqResult?: QueryResult;
  selectInResult?: QueryResult;
  selectEqInResult?: QueryResult;
  upsertResult?: QueryResult;
}

export const createSupabaseMock = (tables: Record<string, TableMockConfig>) => {
  const from = vi.fn((table: string) => {
    const config = tables[table] || {};
    const result =
      config.selectEqInResult ??
      config.selectEqResult ??
      config.selectInResult ??
      config.selectResult ??
      { data: [], error: null };

    const query: any = {
      eq: vi.fn(() => query),
      in: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => Promise.resolve(result)),
      then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
    };

    return {
      select: vi.fn(() => query),
      insert: vi.fn(async () => ({ data: null, error: null })),
      upsert: vi.fn(async () => config.upsertResult ?? { data: null, error: null }),
    };
  });

  return { from };
};
