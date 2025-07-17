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

  // Get Vienna tile
  const vienna = { lat: 48.2082, lon: 16.3738 };
  const info = demLookup.getInfo();
  const zoom = info.maxZoom;
  
  // Calculate tile coordinates
  const tileCoords = demLookup.latLonToTile(vienna.lat, vienna.lon, zoom);
  console.log(`Vienna tile coordinates: ${tileCoords.x}/${tileCoords.y}/${zoom}`);

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
  const filename = `tile-${tileCoords.x}-${tileCoords.y}-${zoom}.${isPNG ? 'png' : isWebP ? 'webp' : 'bin'}`;
  fs.writeFileSync(filename, tileData);
  console.log(`- Saved as: ${filename}`);
  
  return { tileData, isPNG, isWebP, filename };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  inspectTileData().catch(console.error);
}

export { inspectTileData };
