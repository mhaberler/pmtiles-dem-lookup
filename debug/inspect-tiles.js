#!/usr/bin/env node

/**
 * Tile Data Inspector - Examine PMTiles tile data
 */

import { DEMLookup } from '../src/lib/DEMLookup.js';
import fs from 'fs';

async function inspectTileData() {
  console.log('🔍 Inspecting PMTiles tile data...\n');

  const demLookup = new DEMLookup('https://static.mah.priv.at/cors/AT-10m-png.pmtiles', {
    debug: true
  });

  await demLookup.initialize();

  // Get Stiwoll Kehrer tile (expected ~860m elevation)
  const stiwoll = { lat: 47.12871160312656, lon: 15.210914658403269 };
  const info = demLookup.getInfo();
  const zoom = info.maxZoom;
  
  // Calculate tile coordinates
  const tileCoords = demLookup.latLonToTile(stiwoll.lat, stiwoll.lon, zoom);
  console.log(`Stiwoll Kehrer tile coordinates: ${tileCoords.x}/${tileCoords.y}/${zoom}`);

  // Get the tile data directly
  const tileData = await demLookup.getTile(tileCoords.x, tileCoords.y, zoom);
  
  console.log(`\nTile data analysis:`);
  console.log(`- Size: ${tileData.length} bytes`);
  console.log(`- First 20 bytes: ${Array.from(tileData.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
  
  // Check PNG signature
  const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  const isPNG = pngSignature.every((byte, i) => tileData[i] === byte);
  console.log(`- Is PNG: ${isPNG}`);
  
  // Check WebP signature
  const isWebP = tileData[0] === 0x52 && tileData[1] === 0x49 && tileData[2] === 0x46 && tileData[3] === 0x46;
  console.log(`- Is WebP: ${isWebP}`);
  
  // Save tile for inspection
  const filename = `tile-stiwoll-${tileCoords.x}-${tileCoords.y}-${zoom}.${isPNG ? 'png' : isWebP ? 'webp' : 'bin'}`;
  fs.writeFileSync(filename, tileData);
  console.log(`- Saved as: ${filename}`);

  // Test elevation lookup
  console.log(`\n🏔️  Testing elevation at Stiwoll Kehrer:`);
  const elevation = await demLookup.getElevation(stiwoll.lat, stiwoll.lon);
  console.log(`- Coordinates: ${stiwoll.lat}, ${stiwoll.lon}`);
  console.log(`- Elevation: ${elevation.elevation.toFixed(1)}m (expected ~860m)`);
  console.log(`- Resolution: ${elevation.metersPerPixel.toFixed(1)}m/pixel`);
  
  return { tileData, isPNG, isWebP, filename, elevation };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  inspectTileData().catch(console.error);
}

export { inspectTileData };
