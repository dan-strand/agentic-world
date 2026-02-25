/**
 * Radial layout algorithm for positioning project compounds around central HQ.
 * Single ring for 1-6 compounds, double ring for 7+.
 */

export interface CompoundPosition {
  x: number;
  y: number;
  angle: number; // radians from center
}

/**
 * Calculate positions for compounds arranged in a circle around a center point.
 * Distributes evenly starting from the top (-PI/2).
 */
function calculateRingPositions(
  count: number,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle = -Math.PI / 2,
): CompoundPosition[] {
  const positions: CompoundPosition[] = [];
  if (count === 0) return positions;

  const angleStep = (Math.PI * 2) / count;

  for (let i = 0; i < count; i++) {
    const angle = startAngle + i * angleStep;
    positions.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      angle,
    });
  }
  return positions;
}

/**
 * Calculate compound positions using single ring (1-6) or double ring (7+).
 *
 * @param count - Number of compounds to place
 * @param centerX - Center X of the world (HQ position)
 * @param centerY - Center Y of the world (HQ position)
 * @param innerRadius - Radius for first ring (1-6 compounds)
 * @param outerRadius - Radius for second ring (7+ compounds)
 * @returns Array of CompoundPosition with x, y, angle for each compound
 */
export function calculateCompoundPositions(
  count: number,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
): CompoundPosition[] {
  if (count === 0) return [];

  if (count <= 6) {
    return calculateRingPositions(count, centerX, centerY, innerRadius);
  }

  // Inner ring: first 6
  const inner = calculateRingPositions(6, centerX, centerY, innerRadius);

  // Outer ring: remainder, offset by half-step to stagger between inner compounds
  const outerCount = count - 6;
  const offsetAngle = -Math.PI / 2 + Math.PI / 6; // half-step offset from inner ring
  const outer = calculateRingPositions(outerCount, centerX, centerY, outerRadius, offsetAngle);

  return [...inner, ...outer];
}

/**
 * Calculate road path points from HQ center to a compound position.
 * Returns a simple 2-point radial spoke (straight line from center to compound entrance).
 *
 * @param centerX - HQ center X
 * @param centerY - HQ center Y
 * @param compound - Target compound position
 * @returns Array of {x, y} points forming the road path
 */
export function calculateRoadPath(
  centerX: number,
  centerY: number,
  compound: CompoundPosition,
): { x: number; y: number }[] {
  return [
    { x: centerX, y: centerY },
    { x: compound.x, y: compound.y },
  ];
}
