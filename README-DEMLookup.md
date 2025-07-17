# DEMLookup - PMTiles DEM Elevation Lookup

A TypeScript module for performing elevation lookups from PMTiles-based Digital Elevation Models (DEMs) with RGB-encoded elevation data.

## Features

- ✅ **PMTiles Integration**: Works with PMTiles format for efficient tile storage and retrieval
- ✅ **Tile Caching**: Configurable LRU cache for improved performance
- ✅ **Elevation Lookup**: Get elevation and meters/pixel resolution for any lat/lon coordinate
- ✅ **Batch Pre-caching**: Pre-cache tiles for specific areas or bounding boxes
- ✅ **Debug Mode**: Trace PMTiles operations for development
- ✅ **PMTiles Info**: Get metadata about zoom levels, bounds, compression, etc.
- 🚧 **RGB Decoding**: Currently simulated - full PNG/WebP decoding to be implemented

## Installation

```bash
npm install pmtiles
# For development/testing
npm install --save-dev tsx
```

## Usage

### Basic Usage

```typescript
import { DEMLookup } from './src/lib/DEMLookup.js';

// Initialize with a PMTiles URL
const demLookup = new DEMLookup('https://static.mah.priv.at/cors/AT-10m-png.pmtiles', {
  maxCacheSize: 100,
  debug: true
});

// Initialize the connection
await demLookup.initialize();

// Get elevation at a specific coordinate
const result = await demLookup.getElevation(48.2082, 16.3738); // Vienna
console.log(`Elevation: ${result.elevation}m`);
console.log(`Resolution: ${result.metersPerPixel}m/pixel`);
```

### Advanced Features

```typescript
// Get PMTiles information
const info = demLookup.getInfo();
console.log(`Zoom levels: ${info.minZoom} - ${info.maxZoom}`);
console.log(`Bounds: ${info.bounds}`);

// Pre-cache a bounding box
const viennaBounds = {
  north: 48.25,
  south: 48.16,
  east: 16.42,
  west: 16.32
};
await demLookup.precacheBoundingBox(viennaBounds);

// Check cache statistics
const stats = demLookup.getCacheStats();
console.log(`Cache: ${stats.size}/${stats.maxSize} tiles`);

// Clear cache
demLookup.clearCache();
```

## API Reference

### Constructor

```typescript
new DEMLookup(url: string, options?: {
  maxCacheSize?: number;  // Default: 100
  debug?: boolean;        // Default: false
})
```

### Methods

#### `initialize(): Promise<void>`
Initialize the PMTiles connection and fetch metadata.

#### `getElevation(lat: number, lon: number, zoom?: number): Promise<ElevationResult>`
Get elevation and resolution for a coordinate.

**Returns:**
```typescript
{
  elevation: number;        // Elevation in meters
  metersPerPixel: number;   // Resolution at the zoom level
}
```

#### `getInfo(): PMTileInfo | null`
Get information about the PMTiles file.

**Returns:**
```typescript
{
  minZoom: number;
  maxZoom: number;
  metersPerPixel: number;
  compression: Compression;
  tileType: TileType;
  bounds: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
}
```

#### `precacheTile(x: number, y: number, z: number): Promise<void>`
Pre-cache a specific tile.

#### `precacheBoundingBox(boundingBox: BoundingBox): Promise<void>`
Pre-cache all tiles within a bounding box.

**BoundingBox:**
```typescript
{
  north: number;
  south: number;
  east: number;
  west: number;
  zoom?: number;  // Optional, uses maxZoom if not specified
}
```

#### `clearCache(): void`
Clear the tile cache.

#### `getCacheStats(): { size: number; maxSize: number; keys: string[] }`
Get cache statistics.

## Test Data

Sample PMTiles DEM files are available for Austria:

- **PNG format**: `https://static.mah.priv.at/cors/AT-10m-png.pmtiles`
- **WebP format**: `https://static.mah.priv.at/cors/AT-10m-webp.pmtiles`

These files contain 10-meter resolution elevation data for Austria using Mapbox RGB encoding.

## Testing

Run the test harness to verify functionality:

```bash
# Full test suite
npm run test:dem

# Interactive test with specific locations
npm run test:dem:interactive

# Performance test
npm run test:dem:performance
```

## Example Test Locations

The test harness includes several interesting locations in Austria:

- **Grossglockner** (47.0739, 12.6769) - Highest peak in Austria
- **Innsbruck** (47.2692, 11.4041) - Alpine valley
- **Vienna** (48.2082, 16.3738) - Capital city in lowlands
- **Bad Ischl** (47.5595, 14.2654) - Lake district

## Architecture

```
DEMLookup
├── PMTiles integration (pmtiles package)
├── LRU tile cache (configurable size)
├── Coordinate transformation (lat/lon ↔ tile/pixel)
├── RGB elevation decoding (TODO: implement image decoding)
└── Debug logging
```

## Mapbox RGB Encoding

The elevation data uses Mapbox's RGB encoding format:

```
elevation = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
```

Where R, G, B are the red, green, and blue color values (0-255) from the RGB-encoded DEM tile.

## TODO

- [ ] Implement proper PNG/WebP image decoding using Sharp or similar
- [ ] Add support for different RGB encoding formats
- [ ] Implement bilinear interpolation for sub-pixel accuracy
- [ ] Add support for multiple DEM sources
- [ ] Optimize memory usage for large cache sizes
- [ ] Add TypeScript type definitions export
- [ ] Add unit tests with Jest/Vitest
- [ ] Add browser compatibility layer

## License

This project is part of the BalloonWare capacitor project.
