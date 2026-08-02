export function wikiLink(relativePath: string, alias?: string): string {
  const target = relativePath.replace(/\.md$/, "");

  if (alias === undefined || alias === target) {
    return `[[${target}]]`;
  }

  return `[[${target}|${alias}]]`;
}
