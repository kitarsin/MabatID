import { CARDS } from "@/data/cards";
import { DETAILS } from "@/data/details";
import { EXTRA_DOCUMENTS } from "@/data/documents";
import { FACTS, type ProfileFacts } from "@/data/facts";
import { isCalendarDate, type DocumentEvidenceMap } from "../documents";
import { preparationKeys, type Mode } from "../prepare";
import type { PlanningInput } from "./catalog";

export class PlanningRequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const record = (value: unknown, path: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new PlanningRequestError(`${path} must be an object.`);
  return value as Record<string, unknown>;
};
function keys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
) {
  for (const key of Object.keys(value))
    if (!allowed.has(key))
      throw new PlanningRequestError(`Unknown field: ${path}.${key}`);
}
const cardIds = new Set(CARDS.map((c) => c.id));
const documentIds = new Set([...cardIds, ...EXTRA_DOCUMENTS.map((d) => d.id)]);
function stringList(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
): string[] {
  if (!Array.isArray(value) || value.length > 200)
    throw new PlanningRequestError(
      `${path} must be an array of at most 200 items.`,
    );
  if (value.some((v) => typeof v !== "string" || !allowed.has(v)))
    throw new PlanningRequestError(`${path} contains an unknown item.`);
  return [...new Set(value as string[])];
}
export function parsePlanningInput(value: unknown): PlanningInput {
  const input = record(value, "request");
  keys(
    input,
    new Set([
      "targetId",
      "owned",
      "age",
      "facts",
      "documents",
      "prep",
      "modes",
      "budget",
      "setup",
      "objective",
    ]),
    "request",
  );
  if (typeof input.targetId !== "string" || !cardIds.has(input.targetId))
    throw new PlanningRequestError("Choose a known target ID or document.");
  if (
    input.age !== undefined &&
    input.age !== null &&
    (typeof input.age !== "number" ||
      !Number.isInteger(input.age) ||
      input.age < 0 ||
      input.age > 120)
  )
    throw new PlanningRequestError(
      "age must be an integer from 0 to 120, or null.",
    );
  const facts: ProfileFacts = {};
  if (input.facts !== undefined)
    for (const [key, value] of Object.entries(record(input.facts, "facts"))) {
      if (!Object.hasOwn(FACTS, key) || typeof value !== "boolean")
        throw new PlanningRequestError(
          `Invalid eligibility answer: facts.${key}`,
        );
      facts[key as keyof ProfileFacts] = value;
    }
  const documents: DocumentEvidenceMap = {};
  if (input.documents !== undefined)
    for (const [id, value] of Object.entries(
      record(input.documents, "documents"),
    )) {
      if (!documentIds.has(id))
        throw new PlanningRequestError(`Unknown document: ${id}`);
      const evidence = record(value, `documents.${id}`);
      keys(
        evidence,
        new Set([
          "issuedOn",
          "expiresOn",
          "noPrintedExpiry",
          "validityConfirmed",
          "photoSignature",
          "philsysFields",
          "addressCurrent",
        ]),
        `documents.${id}`,
      );
      for (const [key, v] of Object.entries(evidence))
        if (key === "issuedOn" || key === "expiresOn") {
          if (!isCalendarDate(v))
            throw new PlanningRequestError(
              `Invalid calendar date: documents.${id}.${key}`,
            );
        } else if (typeof v !== "boolean")
          throw new PlanningRequestError(
            `Invalid document confirmation: documents.${id}.${key}`,
          );
      documents[id] = evidence;
    }
  const prep: Record<string, string[]> = {};
  if (input.prep !== undefined)
    for (const [id, value] of Object.entries(record(input.prep, "prep"))) {
      if (!cardIds.has(id))
        throw new PlanningRequestError(`Unknown checklist target: ${id}`);
      prep[id] = stringList(value, preparationKeys(id), `prep.${id}`);
    }
  const modes: Record<string, Mode> = {};
  if (input.modes !== undefined)
    for (const [id, value] of Object.entries(record(input.modes, "modes"))) {
      if (
        !cardIds.has(id) ||
        (value !== "onsite" && value !== "online") ||
        !DETAILS[id][value]
      )
        throw new PlanningRequestError(
          `Unsupported application route: modes.${id}`,
        );
      modes[id] = value;
    }
  if (
    input.budget !== undefined &&
    !["free", "low", "mid", "any"].includes(input.budget as string)
  )
    throw new PlanningRequestError("Invalid budget preference.");
  if (
    input.setup !== undefined &&
    !["onsite", "online", "both"].includes(input.setup as string)
  )
    throw new PlanningRequestError("Invalid application preference.");
  if (
    input.objective !== undefined &&
    input.objective !== "fewest-documents" &&
    input.objective !== "lowest-fees"
  )
    throw new PlanningRequestError("Invalid planning objective.");
  return {
    targetId: input.targetId,
    owned: stringList(input.owned ?? [], documentIds, "owned"),
    age: (input.age ?? null) as number | null,
    facts,
    documents,
    prep,
    modes,
    budget: input.budget as PlanningInput["budget"],
    setup: input.setup as PlanningInput["setup"],
    objective: input.objective as PlanningInput["objective"],
  };
}

export async function readPlanningRequest(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new PlanningRequestError("Send application/json.", 415);
  const maximum = 64 * 1024;
  if (Number(request.headers.get("content-length")) > maximum)
    throw new PlanningRequestError("Planning request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PlanningRequestError("A JSON body is required.");
  const decoder = new TextDecoder();
  let size = 0,
    text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new PlanningRequestError("Planning request is too large.", 413);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text);
  } catch {
    throw new PlanningRequestError("The request body is not valid JSON.");
  }
}
