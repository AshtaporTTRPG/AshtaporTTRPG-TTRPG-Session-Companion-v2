import { ShapeType } from '../types/ttrpg';

export interface CalculationResult {
  euclideanDistance: number;
  standard5eDistance: number;
  alternateDiagonalDistance: number;
  elevationDelta: number;
  horizontalDistance: number;
  pitchAngleDegrees: number;
  isInRange: boolean;
  squaresCovered: number;
  estimatedMediumTargets: number;
}

/**
 * Calculates 3D distance between two points with elevation
 */
export function calculate3DDistance({
  horizontalDistance,
  sourceElevation,
  targetElevation,
  rangeLimit,
}: {
  horizontalDistance: number;
  sourceElevation: number;
  targetElevation: number;
  rangeLimit?: number;
}): CalculationResult {
  const elevationDelta = Math.abs(targetElevation - sourceElevation);
  
  // 1. True Euclidean distance (Physics / Real 3D)
  const euclideanDistance = Math.round(
    Math.sqrt(Math.pow(horizontalDistance, 2) + Math.pow(elevationDelta, 2)) * 10
  ) / 10;

  // 2. Standard 5e (RAW): A diagonal counts the same as horizontal or vertical (Cube rule: max(dx, dy, dz))
  const standard5eDistance = Math.max(horizontalDistance, elevationDelta);

  // 3. Alternate 5/10/5 rule (DMG optional rule): First diagonal is 5ft, second is 10ft, etc.
  const squaresH = Math.round(horizontalDistance / 5);
  const squaresV = Math.round(elevationDelta / 5);
  const minSquares = Math.min(squaresH, squaresV);
  const maxSquares = Math.max(squaresH, squaresV);
  const diagonals = minSquares;
  const straights = maxSquares - minSquares;
  const diagonalCost = Math.floor(diagonals * 1.5) * 5;
  const alternateDiagonalDistance = straights * 5 + diagonalCost;

  // Angle of pitch (for archery, flying dragons, etc.)
  const pitchAngleDegrees = horizontalDistance === 0 
    ? (elevationDelta > 0 ? 90 : 0)
    : Math.round(Math.atan2(elevationDelta, horizontalDistance) * (180 / Math.PI));

  const checkDistance = standard5eDistance;
  const isInRange = rangeLimit !== undefined ? checkDistance <= rangeLimit : true;

  return {
    euclideanDistance,
    standard5eDistance,
    alternateDiagonalDistance,
    elevationDelta,
    horizontalDistance,
    pitchAngleDegrees,
    isInRange,
    squaresCovered: 0,
    estimatedMediumTargets: 0,
  };
}

/**
 * Calculates Spell Area of Effect (AOE) target capacity according to standard DMG p.249
 * and geometric grid footprint.
 */
export function calculateAreaOfEffect(shape: ShapeType, size: number, _height: number = 0): {
  squaresCovered: number;
  dmgTargetEstimate: number;
  description: string;
} {
  switch (shape) {
    case 'sphere': {
      // Radius size in feet. DMG p.249: Radius / 5 = targets
      const radiusSquares = size / 5;
      const squares = Math.round(Math.PI * Math.pow(radiusSquares, 2));
      const targets = Math.max(1, Math.round(size / 5));
      return {
        squaresCovered: squares,
        dmgTargetEstimate: targets,
        description: `${size}ft-radius sphere (${squares} 5ft squares on ground). Affects up to ~${targets} medium targets comfortably.`,
      };
    }
    case 'cone': {
      // Cone length in feet. DMG p.249: Size / 10 targets
      const lengthSquares = size / 5;
      const squares = Math.round((Math.PI * Math.pow(lengthSquares, 2) * 53) / 360);
      const targets = Math.max(1, Math.round(size / 10));
      return {
        squaresCovered: squares,
        dmgTargetEstimate: targets,
        description: `${size}ft cone. DMG target guideline: ~${targets} targets.`,
      };
    }
    case 'cube': {
      // Cube width in feet. DMG p.249: Size / 5 targets
      const sideSquares = Math.round(size / 5);
      const squares = Math.pow(sideSquares, 2);
      const targets = Math.max(1, Math.round(size / 5));
      return {
        squaresCovered: squares,
        dmgTargetEstimate: targets,
        description: `${size}ft cube (${squares} 5ft squares). DMG target guideline: ~${targets} targets.`,
      };
    }
    case 'cylinder': {
      // Cylinder radius in feet.
      const radiusSquares = size / 5;
      const squares = Math.round(Math.PI * Math.pow(radiusSquares, 2));
      const targets = Math.max(1, Math.round(size / 5));
      return {
        squaresCovered: squares,
        dmgTargetEstimate: targets,
        description: `${size}ft-radius cylinder (${squares} squares). Great for pillars of fire or moonbeams.`,
      };
    }
    case 'line': {
      // Line length in feet. DMG p.249: Size / 30 targets
      const lengthSquares = Math.round(size / 5);
      const squares = lengthSquares; // 5ft wide line
      const targets = Math.max(1, Math.round(size / 30));
      return {
        squaresCovered: squares,
        dmgTargetEstimate: targets,
        description: `${size}ft-long, 5ft-wide line. DMG target guideline: ~${targets} targets.`,
      };
    }
  }
}
