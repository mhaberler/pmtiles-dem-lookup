#!/usr/bin/env node

import { DEMLookup } from '../src/lib/DEMLookup.js';

async function testDEMLookup() {
  console.log('🚀 Starting DEMLookup test harness...\n');

  // Test URLs for Austria DEM data
  const testUrls = [
    'https://static.mah.priv.at/cors/AT-10m-png.pmtiles',
    'https://static.mah.priv.at/cors/AT-10m-webp.pmtiles'
  ];

  // Test coordinates in Austria (Vienna area)
  const testCoords = [
    { lat: 48.2082, lon: 16.3738, name: 'Vienna, Austria' },
    { lat: 47.2692, lon: 11.4041, name: 'Innsbruck, Austria' },
    { lat: 47.8095, lon: 13.0550, name: 'Salzburg, Austria' }
  ];

  for (const url of testUrls) {
    console.log(`📍 Testing with PMTiles URL: ${url}`);
    console.log('=' .repeat(80));

    try {
      // Initialize DEMLookup with debug enabled
      const demLookup = new DEMLookup(url, { maxCacheSize: 50, debug: true });
      
      console.log('🔧 Initializing PMTiles...');
      await demLookup.initialize();
      
      // Get and display PMTiles info
      const info = demLookup.getInfo();
      if (info) {
        console.log('\n📊 PMTiles Information:');
        console.log(`  Zoom levels: ${info.minZoom} - ${info.maxZoom}`);
        console.log(`  Meters per pixel: ${info.metersPerPixel.toFixed(2)}m`);
        console.log(`  Compression: ${info.compression}`);
        console.log(`  Tile type: ${info.tileType}`);
        console.log(`  Bounds: [${info.bounds.map(b => b.toFixed(4)).join(', ')}]`);
      }

      // Test elevation lookups
      console.log('\n🗻 Testing elevation lookups:');
      for (const coord of testCoords) {
        try {
          console.log(`\n📍 ${coord.name} (${coord.lat}, ${coord.lon}):`);
          
          const result = await demLookup.getElevation(coord.lat, coord.lon);
          console.log(`  Elevation: ${result.elevation.toFixed(1)}m`);
          console.log(`  Resolution: ${result.metersPerPixel.toFixed(2)}m/pixel`);
          
        } catch (error) {
          console.error(`  ❌ Error getting elevation: ${error}`);
        }
      }

      // Test cache functionality
      console.log('\n🗂️  Testing cache functionality:');
      const cacheStats = demLookup.getCacheStats();
      console.log(`  Cache size: ${cacheStats.size}/${cacheStats.maxSize}`);
      console.log(`  Cached tiles: ${cacheStats.keys.length > 0 ? cacheStats.keys.slice(0, 3).join(', ') + (cacheStats.keys.length > 3 ? '...' : '') : 'none'}`);

      // Test pre-caching
      console.log('\n🔄 Testing pre-caching...');
      const viennaBounds = {
        north: 48.25,
        south: 48.16,
        east: 16.42,
        west: 16.32
      };
      
      await demLookup.precacheBoundingBox(viennaBounds);
      const newCacheStats = demLookup.getCacheStats();
      console.log(`  Cache size after pre-caching: ${newCacheStats.size}/${newCacheStats.maxSize}`);

      // Clear cache test
      console.log('\n🧹 Testing cache clearing...');
      demLookup.clearCache();
      const clearedCacheStats = demLookup.getCacheStats();
      console.log(`  Cache size after clearing: ${clearedCacheStats.size}/${clearedCacheStats.maxSize}`);

    } catch (error) {
      console.error(`❌ Error testing ${url}:`, error);
    }

    console.log('\n' + '=' .repeat(80) + '\n');
  }

  console.log('✅ DEMLookup test harness completed!');
}

// Performance test
async function performanceTest() {
  console.log('⚡ Running performance test...\n');
  
  const demLookup = new DEMLookup('https://static.mah.priv.at/cors/AT-10m-png.pmtiles', { maxCacheSize: 100 });
  await demLookup.initialize();
  
  const testCoord = { lat: 48.2082, lon: 16.3738 };
  const numTests = 10;
  
  console.log(`🔄 Testing ${numTests} elevation lookups at ${testCoord.lat}, ${testCoord.lon}...`);
  
  const startTime = Date.now();
  const promises = [];
  
  for (let i = 0; i < numTests; i++) {
    promises.push(demLookup.getElevation(testCoord.lat, testCoord.lon));
  }
  
  const results = await Promise.all(promises);
  const endTime = Date.now();
  
  const totalTime = endTime - startTime;
  const avgTime = totalTime / numTests;
  
  console.log(`⏱️  Total time: ${totalTime}ms`);
  console.log(`📊 Average time per lookup: ${avgTime.toFixed(2)}ms`);
  console.log(`🎯 Results: ${results[0].elevation.toFixed(1)}m (all should be identical due to caching)`);
  
  const cacheStats = demLookup.getCacheStats();
  console.log(`🗂️  Final cache utilization: ${cacheStats.size} tiles`);
}

// Main execution
async function main() {
  try {
    await testDEMLookup();
    await performanceTest();
  } catch (error) {
    console.error('💥 Test harness failed:', error);
    process.exit(1);
  }
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
