import { randomInt } from "node:crypto";

import { formatDateStamp } from "./dates.js";

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const RANDOM_ID_LENGTH = 6;
const MAX_SLUG_LENGTH = 60;

export function randomId(length = RANDOM_ID_LENGTH): string {
  let id = "";
  for (let i = 0; i < length; i += 1) {
    id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  }

  return id;
}

export function createChangeSetId(date = new Date()): string {
  return `cs_${formatDateStamp(date)}_${randomId()}`;
}

export function createEventId(): string {
  return `evt_${randomId()}`;
}

export function createValidationId(): string {
  return `val_${randomId()}`;
}

export function createMemoryId(date = new Date()): string {
  return `mem_${formatDateStamp(date)}_${randomId()}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}
