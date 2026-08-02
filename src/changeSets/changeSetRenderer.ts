import { renderChangeSetTemplate } from "../markdown/templates/changeSetTemplate.js";
import { formatMonthPath } from "../util/dates.js";
import { slugify } from "../util/ids.js";
import type { ChangeSet } from "./changeSetTypes.js";

export type RenderedChangeSetNote = {
  relativePath: string;
  contents: string;
};

export function getChangeSetNotePath(
  changeSet: Pick<ChangeSet, "id" | "title" | "createdAt">,
): string {
  const created = new Date(changeSet.createdAt);
  const filename = `${changeSet.id} - ${slugify(changeSet.title)}.md`;

  return `02-Change-Sets/${formatMonthPath(created)}/${filename}`;
}

export function renderChangeSetNote(changeSet: ChangeSet): RenderedChangeSetNote {
  return {
    relativePath: getChangeSetNotePath(changeSet),
    contents: renderChangeSetTemplate(changeSet),
  };
}
