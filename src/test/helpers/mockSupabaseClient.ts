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

    return {
      select: vi.fn(() => {
        if (config.selectEqInResult) {
          return {
            eq: vi.fn(() => ({
              in: vi.fn(async () => config.selectEqInResult),
            })),
          };
        }

        if (config.selectEqResult) {
          return {
            eq: vi.fn(async () => config.selectEqResult),
          };
        }

        if (config.selectInResult) {
          return {
            in: vi.fn(async () => config.selectInResult),
          };
        }

        return Promise.resolve(config.selectResult ?? { data: [], error: null });
      }),
      upsert: vi.fn(async () => config.upsertResult ?? { data: null, error: null }),
    };
  });

  return { from };
};
