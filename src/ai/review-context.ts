import type { CanonicalCoaster } from "../canonical/coaster.js";
import type { CanonicalPark } from "../canonical/park.js";
import { AI_REVIEW_PRIORITY } from "./config.js";
import type { ReviewItem } from "../matching/types.js";

export type AiReviewItemContext = {
  itemKey: string;
  reviewType: string;
  summary: string;
  entity?: Record<string, unknown>;
  related?: Record<string, unknown>;
};

function parkSnippet(park: CanonicalPark | undefined): Record<string, unknown> | undefined {
  if (!park) return undefined;
  return {
    id: park.id,
    name: park.name.value,
    country: park.countryCode.value,
    lat: park.coordinates?.value.lat,
    lng: park.coordinates?.value.lng,
  };
}

function coasterSnippet(coaster: CanonicalCoaster | undefined): Record<string, unknown> | undefined {
  if (!coaster) return undefined;
  return {
    id: coaster.id,
    name: coaster.name.value,
    parkId: coaster.parkId,
    country: coaster.countryCode?.value ?? null,
    type: coaster.coasterType?.value ?? null,
    manufacturer: coaster.manufacturer?.value ?? null,
    status: coaster.status,
    heightM: coaster.height?.value.value ?? null,
    speedMs: coaster.speed?.value.value ?? null,
  };
}

export function reviewItemKey(item: ReviewItem, index: number): string {
  if (item.type === "POSSIBLE_DUPLICATE") {
    return `dup:${item.entityA}:${item.entityB}`;
  }
  return `${item.type.toLowerCase()}:${item.entityId ?? index}`;
}

export function buildReviewItemContext(
  item: ReviewItem,
  index: number,
  parksById: Map<string, CanonicalPark>,
  coastersById: Map<string, CanonicalCoaster>,
): AiReviewItemContext {
  const itemKey = reviewItemKey(item, index);

  if (item.type === "POSSIBLE_DUPLICATE") {
    const entityA =
      item.entityType === "park"
        ? parkSnippet(parksById.get(item.entityA))
        : coasterSnippet(coastersById.get(item.entityA));
    const entityB =
      item.entityType === "park"
        ? parkSnippet(parksById.get(item.entityB))
        : coasterSnippet(coastersById.get(item.entityB));

    const parkA =
      item.entityType === "coaster"
        ? parksById.get(coastersById.get(item.entityA)?.parkId ?? "")
        : undefined;
    const parkB =
      item.entityType === "coaster"
        ? parksById.get(coastersById.get(item.entityB)?.parkId ?? "")
        : undefined;

    return {
      itemKey,
      reviewType: item.type,
      summary: `Possible duplicate ${item.entityType}: "${item.nameA}" vs "${item.nameB}"`,
      entity: entityA,
      related: { other: entityB, parkA: parkSnippet(parkA), parkB: parkSnippet(parkB) },
    };
  }

  if (item.type === "COUNTRY_CONFLICT") {
    const entity =
      item.entityType === "park"
        ? parkSnippet(parksById.get(item.entityId))
        : coasterSnippet(coastersById.get(item.entityId));
    const park =
      item.entityType === "coaster"
        ? parkSnippet(parksById.get(coastersById.get(item.entityId)?.parkId ?? ""))
        : undefined;

    return {
      itemKey,
      reviewType: item.type,
      summary: item.reason,
      entity,
      related: park ? { linkedPark: park } : undefined,
    };
  }

  const entity =
    item.entityType === "park"
      ? parkSnippet(parksById.get(item.entityId))
      : coasterSnippet(coastersById.get(item.entityId));
  const park =
    item.entityType === "coaster"
      ? parkSnippet(parksById.get(coastersById.get(item.entityId)?.parkId ?? ""))
      : undefined;

  return {
    itemKey,
    reviewType: item.type,
    summary: item.reason,
    entity,
    related: park ? { linkedPark: park } : undefined,
  };
}

export function selectItemsForAiReview(
  items: ReviewItem[],
  limit: number,
  includeDuplicates: boolean,
  includeMissing = false,
): ReviewItem[] {
  const filtered = items.filter((item) => {
    if (item.type === "POSSIBLE_DUPLICATE") {
      if (!includeDuplicates) return false;
      if (item.confidence === "LOW") return false;
      return true;
    }
    if (!includeMissing && item.type === "MISSING_DATA") return false;
    return true;
  });

  return [...filtered]
    .sort((a, b) => {
      const pa = AI_REVIEW_PRIORITY[a.type] ?? 99;
      const pb = AI_REVIEW_PRIORITY[b.type] ?? 99;
      return pa - pb;
    })
    .slice(0, limit);
}
