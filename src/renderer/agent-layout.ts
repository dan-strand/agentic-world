/**
 * Auto-positioning algorithm for agents in the compound courtyard.
 * Distributes agents in a grid pattern centered on the canvas,
 * biased toward the center/courtyard area.
 *
 * Pure function -- no side effects.
 */
export function calculateAgentPositions(
  count: number,
  canvasWidth: number,
  canvasHeight: number,
): Array<{ x: number; y: number }> {
  if (count === 0) return [];

  // Usable area -- margin from edges to keep agents in courtyard
  const marginX = 150;
  const marginY = 120;
  const usableWidth = Math.max(canvasWidth - marginX * 2, 120);
  const usableHeight = Math.max(canvasHeight - marginY * 2, 100);

  // Determine row count based on agent count
  let rows: number;
  if (count <= 4) {
    rows = 1;
  } else if (count <= 8) {
    rows = 2;
  } else {
    rows = 3;
  }

  // Distribute agents across rows as evenly as possible
  const agentsPerRow: number[] = [];
  const basePerRow = Math.floor(count / rows);
  let remainder = count % rows;
  for (let r = 0; r < rows; r++) {
    agentsPerRow.push(basePerRow + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder--;
  }

  const positions: Array<{ x: number; y: number }> = [];

  // Center X of usable area
  const centerX = canvasWidth / 2;
  // Vertical spacing
  const rowSpacing = rows > 1 ? Math.min(usableHeight / (rows - 1), 100) : 0;
  const startY = canvasHeight / 2 - (rowSpacing * (rows - 1)) / 2;

  for (let r = 0; r < rows; r++) {
    const agentsInThisRow = agentsPerRow[r];
    const colSpacing =
      agentsInThisRow > 1
        ? Math.min(usableWidth / (agentsInThisRow - 1), 120)
        : 0;
    const rowStartX = centerX - (colSpacing * (agentsInThisRow - 1)) / 2;
    const y = startY + r * rowSpacing;

    for (let c = 0; c < agentsInThisRow; c++) {
      positions.push({
        x: rowStartX + c * colSpacing,
        y,
      });
    }
  }

  return positions;
}
