#!/usr/bin/env node

/**
 * DEMLookup Demo - Node.js Test Harness
 * 
 * This script demonstrates the DEMLookup module functionality
 * for performing elevation lookups from PMTiles DEM data.
 */

import { DEMLookup } from '../src/lib/DEMLookup.js';

async function main() {
  console.log('🏔️  DEMLookup Demo - Austria 10m DEM\n');

  // Initialize with Austria 10m DEM (PNG format)
  const demLookup = new DEMLookup('https://static.mah.priv.at/cors/AT-10m-png.pmtiles', {
    maxCacheSize: 50,
    debug: false  // Set to true for detailed logging
  });

  try {
    // Initialize the PMTiles connection
    console.log('🔧 Connecting to PMTiles...');
    await demLookup.initialize();

    // Display DEM information
    const info = demLookup.getInfo();
    if (info) {
      console.log('✅ PMTiles loaded successfully!');
      console.log(`📊 Coverage: Austria (${info.bounds[0].toFixed(2)}°, ${info.bounds[1].toFixed(2)}°) to (${info.bounds[2].toFixed(2)}°, ${info.bounds[3].toFixed(2)}°)`);
      console.log(`🔍 Resolution: ${info.metersPerPixel.toFixed(1)}m per pixel at zoom ${info.maxZoom}`);
      console.log(`📷 Format: ${info.tileType === 2 ? 'PNG' : info.tileType === 4 ? 'WebP' : 'Unknown'}`);
      console.log('');
    }

    // Test various locations in Austria
    const testLocations = [
      { name: 'Vienna (Stephansdom)', lat: 48.2082, lon: 16.3738, expected: '~200m (city center)' },
      { name: 'Hallstatt (lake village)', lat: 47.5622, lon: 13.6492, expected: '~500m (lake level)' },
      { name: 'Grossglockner', lat: 47.0739, lon: 12.6769, expected: '~3798m (highest peak)' },
      { name: 'Salzburg', lat: 47.8095, lon: 13.0550, expected: '~400m (city)' },
      { name: 'Innsbruck', lat: 47.2692, lon: 11.4041, expected: '~600m (alpine valley)' },
      { name: 'Stiwoll Kehrer', lat: 47.12871160312656, lon: 15.210914658403269, expected: '~860m (hill)' }
    ];

    console.log('🗻 Elevation Lookups:');
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

    // Demonstrate caching performance
    console.log('⚡ Cache Performance Test:');
    console.log('='.repeat(70));

    const vienna = { lat: 48.2082, lon: 16.3738 };
    
    // First lookup (cache miss)
    const start1 = Date.now();
    await demLookup.getElevation(vienna.lat, vienna.lon);
    const time1 = Date.now() - start1;

    // Second lookup (cache hit)
    const start2 = Date.now();
    await demLookup.getElevation(vienna.lat, vienna.lon);
    const time2 = Date.now() - start2;

    console.log(`First lookup (cache miss): ${time1}ms`);
    console.log(`Second lookup (cache hit): ${time2}ms`);
    console.log(`Speed improvement: ${(time1 / time2).toFixed(1)}x faster\n`);

    // Cache statistics
    const cacheStats = demLookup.getCacheStats();
    console.log(`📦 Cache: ${cacheStats.size}/${cacheStats.maxSize} tiles cached`);

    console.log('\n✅ Demo completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   • Integrate into Vue.js application');
    console.log('   • Add Leaflet map with protomaps-leaflet');
    console.log('   • Implement real-time elevation lookup on mouseover');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
