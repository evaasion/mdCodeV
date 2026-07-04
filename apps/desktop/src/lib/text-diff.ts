export type DiffLineType = "same" | "add" | "remove";

export interface DiffLine {
  type: DiffLineType;
  oldLineNum: number | null;
  newLineNum: number | null;
  content: string;
}

export function diffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const rows = oldLines.length;
  const cols = newLines.length;

  const lcs: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(cols + 1).fill(0),
  );

  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = rows;
  let j = cols;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({
        type: "same",
        oldLineNum: i,
        newLineNum: j,
        content: oldLines[i - 1],
      });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      result.push({
        type: "add",
        oldLineNum: null,
        newLineNum: j,
        content: newLines[j - 1],
      });
      j -= 1;
    } else {
      result.push({
        type: "remove",
        oldLineNum: i,
        newLineNum: null,
        content: oldLines[i - 1],
      });
      i -= 1;
    }
  }

  return result.reverse();
}

export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  return lines.reduce(
    (acc, line) => {
      if (line.type === "add") acc.added += 1;
      if (line.type === "remove") acc.removed += 1;
      return acc;
    },
    { added: 0, removed: 0 },
  );
}