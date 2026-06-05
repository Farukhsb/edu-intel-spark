import type { LmsEntityId } from "../../lms/types.ts";

export function toLmsEntityKey(id: LmsEntityId) {
  return `${id.provider}:${id.externalId}`;
}

