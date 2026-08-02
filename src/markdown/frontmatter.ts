export type FrontmatterValue =
  | string
  | number
  | boolean
  | string[]
  | undefined;

export function renderFrontMatter(
  data: Record<string, FrontmatterValue>,
): string {
  const lines = ["---"];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      lines.push(...value.map((item) => `  - ${formatStringValue(item)}`));
      continue;
    }

    lines.push(`${key}: ${formatScalarValue(value)}`);
  }

  lines.push("---", "");

  return lines.join("\n");
}

function formatScalarValue(value: string | number | boolean): string {
  if (typeof value === "string") {
    return formatStringValue(value);
  }

  return String(value);
}

function formatStringValue(value: string): string {
  if (canRenderBareString(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function canRenderBareString(value: string): boolean {
  return /^[A-Za-z0-9_./-]+$/.test(value);
}
