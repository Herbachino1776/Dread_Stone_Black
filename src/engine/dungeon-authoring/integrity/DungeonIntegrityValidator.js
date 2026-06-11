import { DungeonIntegrityReport } from './DungeonIntegrityReport.js';
import { analyzeRoomEdges, validateDoorwayEdges } from './RoomEdgeAnalyzer.js';
import { validateWallCollisionMatching } from './WallCollisionMatcher.js';
import { detectWalkableLeaks } from './DungeonLeakDetector.js';
import { validateEntranceIntegrity } from './EntranceIntegrityValidator.js';

export function validateDungeonIntegrity(definition, options = {}) {
  const report = new DungeonIntegrityReport({ locationId: definition.id });
  const edgeAnalysis = analyzeRoomEdges(definition, report);

  validateDoorwayEdges(definition, edgeAnalysis, report);
  validateWallCollisionMatching(definition, edgeAnalysis, report);

  if (options.leakDetection !== false && definition.integrity?.leakDetection !== false) {
    detectWalkableLeaks(definition, report, {
      sampleStep: definition.integrity?.leakSampleStep ?? options.leakSampleStep ?? 1,
      intendedBounds: definition.integrity?.intendedBounds ?? options.intendedBounds,
    });
  }

  validateEntranceIntegrity(definition, report);

  return report.toJSON();
}
