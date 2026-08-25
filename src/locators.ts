export type LocatorFact = { label: string; value: string };

export function parseLocatorBlock(text: string): LocatorFact[] {
  const lines = text.split(/\r?\n/);
  let facts: LocatorFact[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim() !== "## Locators") continue;
    const block: LocatorFact[] = [];
    let j = i + 1;
    while (j < lines.length && lines[j]!.trim() === "") j++;
    for (; j < lines.length; j++) {
      const trimmed = lines[j]!.trim();
      if (trimmed === "" || /^#{1,6}\s/.test(trimmed)) break;
      const match = lines[j]!.match(/^-\s+([^:]+):\s*(.+)$/);
      if (!match) break;
      const label = match[1].trim();
      const value = match[2].trim();
      if (!label || !value) break;
      block.push({ label, value });
    }
    facts = block;
    i = j - 1;
  }
  return facts;
}

export function hasLocatorBlock(text: string): boolean {
  return parseLocatorBlock(text).length > 0;
}
