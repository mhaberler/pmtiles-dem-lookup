#!/usr/bin/env node

/**
 * WebP DEM Test - Test WebP-compressed PMTiles DEM
 */

import { DEMLookup } from '../src/lib/DEMLookup.js';

async function testWebPDEM() {
  console.log('🖼️  Testing WebP-compressed PMTiles DEM...\n');

  // Initialize with Austria 10m DEM (WebP format)
  const demLookup = new DEMLookup('https://static.mah.priv.at/cors/AT-10m-webp.pmtiles', {
    maxCacheSize: 50,
    debug: true
  });

  try {
    // Initialize the PMTiles connection
    console.log('🔧 Connecting to WebP PMTiles...');
    await demLookup.initialize();

    // Display DEM information
    const info = demLookup.getInfo();
    if (info) {
      console.log('✅ WebP PMTiles loaded successfully!');
      console.log(`📊 Coverage: Austria (${info.bounds[0].toFixed(2)}°, ${info.bounds[1].toFixed(2)}°) to (${info.bounds[2].toFixed(2)}°, ${info.bounds[3].toFixed(2)}°)`);
      console.log(`🔍 Resolution: ${info.metersPerPixel.toFixed(1)}m per pixel at zoom ${info.maxZoom}`);
      console.log(`📷 Format: ${info.tileType === 2 ? 'PNG' : info.tileType === 4 ? 'WebP' : 'Unknown'}`);
      console.log(`🗜️  Compression: ${info.compression}`);
      console.log('');
    }

    // Test locations including Stiwoll Kehrer
    const testLocations = [
      { name: 'Vienna (Stephansdom)', lat: 48.2082, lon: 16.3738, expected: '~200m' },
      { name: 'Grossglockner', lat: 47.0739, lon: 12.6769, expected: '~3798m' },
      { name: 'Stiwoll Kehrer', lat: 47.12871160312656, lon: 15.210914658403269, expected: '~860m' },
      { name: 'Salzburg', lat: 47.8095, lon: 13.0550, expected: '~400m' },
      { name: 'Innsbruck', lat: 47.2692, lon: 11.4041, expected: '~600m' }
    ];

    console.log('🗻 WebP Elevation Lookups:');
    console.log('='.repeat(70));

    for (const location of testLocations) {
      try {
        const startTime = Date.now();
        const result = await demLookup.getElevation(location.lat, location.lon);
        const duration = Date.now() - startTime;

        console.log(`📍 ${location.name}`);
        console.log(`   Coordinates: ${location.lat}°N, ${location.lon}°E`);
        console.log(`   Elevation: ${result.elevation.toFixed(1)}m ${location.expected}`);
        console.log(`   Resolution: ${result.metersPerPixel.toFixed(1)}m/pixel`);
        console.log(`   Query time: ${duration}ms`);
        console.log('');

      } catch (error) {
        console.error(`❌ Error looking up ${location.name}: ${error}`);
      }
    }

    // Test tile format inspection
    console.log('🔍 Tile Format Analysis:');
    console.log('='.repeat(70));
    
    const vienna = { lat: 48.2082, lon: 16.3738 };
    const tileCoords = demLookup.latLonToTile(vienna.lat, vienna.lon, info.maxZoom);
    const tileData = await demLookup.getTile(tileCoords.x, tileCoords.y, info.maxZoom);
    
    console.log(`Vienna tile (${tileCoords.x}/${tileCoords.y}/${info.maxZoom}):`);
    console.log(`- Size: ${tileData.length} bytes`);
    console.log(`- First 12 bytes: ${Array.from(tileData.slice(0, 12)).map(b => String.fromCharCode(b)).join('')}`);
    console.log(`- Hex: ${Array.from(tileData.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    
    // Check format
    const isWebP = tileData.length >= 12 &&
                   tileData[0] === 0x52 && tileData[1] === 0x49 && tileData[2] === 0x46 && tileData[3] === 0x46 && // "RIFF"
                   tileData[8] === 0x57 && tileData[9] === 0x45 && tileData[10] === 0x42 && tileData[11] === 0x50; // "WEBP"
    
    console.log(`- Is WebP: ${isWebP}`);

    const cacheStats = demLookup.getCacheStats();
    console.log(`\n📦 Cache: ${cacheStats.size}/${cacheStats.maxSize} tiles cached`);

    console.log('\n✅ WebP DEM test completed successfully!');

  } catch (error) {
    console.error('❌ WebP DEM test failed:', error);
    process.exit(1);
  }
}

// Compare PNG vs WebP performance
async function compareFormats() {
  console.log('\n⚡ Comparing PNG vs WebP Performance...\n');
  
  const locations = [
    { name: 'Vienna', lat: 48.2082, lon: 16.3738 },
    { name: 'Stiwoll Kehrer', lat: 47.12871160312656, lon: 15.210914658403269 }
  ];

  for (const location of locations) {
    console.log(`🏁 Testing ${location.name}:`);
    
    // Test PNG
    const pngDEM = new DEMLookup('https://static.mah.priv.at/cors/AT-10m-png.pmtiles', { debug: false });
    await pngDEM.initialize();
    
    const pngStart = Date.now();
    const pngResult = await pngDEM.getElevation(location.lat, location.lon);
    const pngTime = Date.now() - pngStart;
    
    // Test WebP
    const webpDEM = new DEMLookup('https://static.mah.priv.at/cors/AT-10m-webp.pmtiles', { debug: false });
    await webpDEM.initialize();
    
    const webpStart = Date.now();
    const webpResult = await webpDEM.getElevation(location.lat, location.lon);
    const webpTime = Date.now() - webpStart;
    
    console.log(`   PNG:  ${pngResult.elevation.toFixed(1)}m (${pngTime}ms)`);
    console.log(`   WebP: ${webpResult.elevation.toFixed(1)}m (${webpTime}ms)`);
    console.log(`   Difference: ${Math.abs(pngResult.elevation - webpResult.elevation).toFixed(1)}m`);
    console.log(`   Speed: ${webpTime < pngTime ? 'WebP faster' : 'PNG faster'} (${Math.abs(pngTime - webpTime)}ms)`);
    console.log('');
  }
}

// Main execution
async function main() {
  try {
    await testWebPDEM();
    await compareFormats();
  } catch (error) {
    console.error('💥 Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
