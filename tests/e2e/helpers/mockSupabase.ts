import type { Page, Route } from "@playwright/test";

const JSON_HEADERS = {
  "access-control-allow-origin": "*",
  "content-type": "application/json",
};

type Row = Record<string, any>;

type TableState = {
  assignments: Row[];
  submissions: Row[];
  grades: Row[];
  moderation_cases: Row[];
  moderation_reviews: Row[];
  grade_audit_log: Row[];
  academic_integrity_reviews: Row[];
  profiles: Row[];
  communication_messages: Row[];
  student_interventions: Row[];
};

export interface MockSupabaseState {
  tables: TableState;
  counters: Record<string, number>;
}

const nowIso = () => new Date().toISOString();

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const parseValue = (value: string) => {
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return decodeURIComponent(value);
};

const parseFilterValues = (raw: string) => {
  const inner = raw.slice(4, -1);
  if (!inner) return [];
  return inner.split(",").map((value) => parseValue(value));
};

const matchesFilters = (row: Row, url: URL) => {
  for (const [key, value] of url.searchParams.entries()) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(key)) continue;
    if (value.startsWith("eq.")) {
      if (row[key] !== parseValue(value.slice(3))) return false;
      continue;
    }
    if (value.startsWith("in.(") && value.endsWith(")")) {
      if (!parseFilterValues(value).includes(row[key])) return false;
      continue;
    }
  }

  return true;
};

const applyOrder = (rows: Row[], orderValue: string | null) => {
  if (!orderValue) return rows;

  const [column, direction = "asc"] = orderValue.split(".");
  return [...rows].sort((left, right) => {
    const a = left[column];
    const b = right[column];
    if (a === b) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (a < b) return direction === "desc" ? 1 : -1;
    return direction === "desc" ? -1 : 1;
  });
};

const maybeObjectResponse = (route: Route, rows: Row[]) => {
  const accept = route.request().headers()["accept"] || "";
  if (accept.includes("application/vnd.pgrst.object+json")) {
    return rows[0] ?? null;
  }
  return rows;
};

const nextId = (state: MockSupabaseState, table: string) => {
  state.counters[table] = (state.counters[table] ?? 0) + 1;
  return `${table}-${state.counters[table]}`;
};

const ensureAuditFields = (row: Row) => {
  const timestamp = nowIso();
  if (!row.created_at) row.created_at = timestamp;
  if ("updated_at" in row && !row.updated_at) row.updated_at = timestamp;
  return row;
};

const fulfillJson = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({
    status,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
};

const handleGet = async (route: Route, state: MockSupabaseState, table: keyof TableState, url: URL) => {
  let rows = state.tables[table].filter((row) => matchesFilters(row, url));
  rows = applyOrder(rows, url.searchParams.get("order"));

  const limit = url.searchParams.get("limit");
  if (limit) {
    rows = rows.slice(0, Number(limit));
  }

  await fulfillJson(route, maybeObjectResponse(route, clone(rows)));
};

const handlePatch = async (route: Route, state: MockSupabaseState, table: keyof TableState, url: URL) => {
  const patch = JSON.parse(route.request().postData() || "{}");
  const updatedRows: Row[] = [];

  state.tables[table] = state.tables[table].map((row) => {
    if (!matchesFilters(row, url)) return row;
    const nextRow = {
      ...row,
      ...patch,
    };
    if ("updated_at" in row && !patch.updated_at) {
      nextRow.updated_at = nowIso();
    }
    updatedRows.push(nextRow);
    return nextRow;
  });

  await fulfillJson(route, maybeObjectResponse(route, clone(updatedRows)));
};

const handlePost = async (route: Route, state: MockSupabaseState, table: keyof TableState, url: URL) => {
  const payload = JSON.parse(route.request().postData() || "{}");
  const rows = Array.isArray(payload) ? payload : [payload];
  const onConflict = url.searchParams.get("on_conflict");
  const inserted: Row[] = [];

  for (const row of rows) {
    let nextRow = {
      ...row,
    };

    if (onConflict) {
      const existingIndex = state.tables[table].findIndex((candidate) => candidate[onConflict] === row[onConflict]);
      if (existingIndex >= 0) {
        nextRow = ensureAuditFields({
          ...state.tables[table][existingIndex],
          ...row,
          updated_at: nowIso(),
        });
        state.tables[table][existingIndex] = nextRow;
        inserted.push(nextRow);
        continue;
      }
    }

    if (!nextRow.id) {
      nextRow.id = nextId(state, table);
    }
    nextRow = ensureAuditFields(nextRow);
    state.tables[table].push(nextRow);
    inserted.push(nextRow);
  }

  await fulfillJson(route, maybeObjectResponse(route, clone(inserted)), 201);
};

const handleRpc = async (route: Route, state: MockSupabaseState) => {
  const payload = JSON.parse(route.request().postData() || "{}");

  if (route.request().url().includes("/rpc/apply_recommendation_action")) {
    await fulfillJson(route, { success: true });
    return;
  }

  if (route.request().url().includes("/rpc/")) {
    await fulfillJson(route, { error: "Unhandled rpc mock" }, 400);
    return;
  }

  await fulfillJson(route, { error: "Unknown rpc route" }, 404);
};

export const installSupabaseMocks = async (page: Page, state: MockSupabaseState) => {
  await page.route(/.*\/rest\/v1\/.*/, async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").pop() as keyof TableState;

    if (!(table in state.tables)) {
      await fulfillJson(route, { error: `Unhandled table: ${table}` }, 404);
      return;
    }

    if (route.request().method() === "GET") {
      await handleGet(route, state, table, url);
      return;
    }

    if (route.request().method() === "PATCH") {
      await handlePatch(route, state, table, url);
      return;
    }

    if (route.request().method() === "POST") {
      await handlePost(route, state, table, url);
      return;
    }

    await fulfillJson(route, { error: "Unsupported method" }, 405);
  });

  await page.route(/.*\/rpc\/.*/, async (route) => {
    await handleRpc(route, state);
  });
};

export const createMockSupabaseState = (overrides: Partial<TableState>): MockSupabaseState => ({
  tables: {
    assignments: [],
    submissions: [],
    grades: [],
    moderation_cases: [],
    moderation_reviews: [],
    grade_audit_log: [],
    academic_integrity_reviews: [],
    profiles: [],
    communication_messages: [],
    student_interventions: [],
    ...clone(overrides),
  },
  counters: {},
});
