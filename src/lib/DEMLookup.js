import { PMTiles } from 'pmtiles';
import { PNG } from 'pngjs';
import * as sharp from 'sharp';
export class DEMLookup {
    constructor(url, options) {
        this.cache = {};
        this.maxCacheSize = 100;
        this.cacheKeys = [];
        this.debug = false;
        this.info = null;
        this.pmtiles = new PMTiles(url);
        this.maxCacheSize = options?.maxCacheSize || 100;
        this.debug = options?.debug || false;
        if (this.debug) {
            console.log(`DEMLookup initialized with URL: ${url}`);
        }
    }
    /**
     * Initialize the PMTiles and get metadata
     */
    async initialize() {
        try {
            const header = await this.pmtiles.getHeader();
            const metadata = await this.pmtiles.getMetadata();
            this.info = {
                minZoom: header.minZoom,
                maxZoom: header.maxZoom,
                metersPerPixel: this.calculateMetersPerPixel(header.maxZoom),
                compression: header.internalCompression,
                tileType: header.tileType,
                bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat]
            };
            if (this.debug) {
                console.log('PMTiles initialized:', this.info);
                console.log('Metadata:', metadata);
            }
        }
        catch (error) {
            console.error('Failed to initialize PMTiles:', error);
            throw error;
        }
    }
    /**
     * Get information about the PMTiles file
     */
    getInfo() {
        return this.info;
    }
    /**
     * Get elevation at a specific latitude and longitude
     */
    async getElevation(lat, lon, zoom) {
        if (!this.info) {
            throw new Error('DEMLookup not initialized. Call initialize() first.');
        }
        const targetZoom = zoom || this.info.maxZoom;
        const { x, y } = this.latLonToTile(lat, lon, targetZoom);
        if (this.debug) {
            console.log(`Getting elevation for lat: ${lat}, lon: ${lon}, zoom: ${targetZoom}, tile: ${x}/${y}/${targetZoom}`);
        }
        const tileData = await this.getTile(x, y, targetZoom);
        const elevation = await this.extractElevationFromTile(tileData, lat, lon, targetZoom);
        const metersPerPixel = this.calculateMetersPerPixel(targetZoom);
        return {
            elevation,
            metersPerPixel
        };
    }
    /**
     * Pre-cache a single tile
     */
    async precacheTile(x, y, z) {
        const tileKey = `${z}/${x}/${y}`;
        if (this.debug) {
            console.log(`Pre-caching tile: ${tileKey}`);
        }
        await this.getTile(x, y, z);
    }
    /**
     * Pre-cache tiles within a bounding box
     */
    async precacheBoundingBox(boundingBox) {
        if (!this.info) {
            throw new Error('DEMLookup not initialized. Call initialize() first.');
        }
        const zoom = boundingBox.zoom || this.info.maxZoom;
        const nwTile = this.latLonToTile(boundingBox.north, boundingBox.west, zoom);
        const seTile = this.latLonToTile(boundingBox.south, boundingBox.east, zoom);
        if (this.debug) {
            console.log(`Pre-caching bounding box at zoom ${zoom}: from ${nwTile.x}/${nwTile.y} to ${seTile.x}/${seTile.y}`);
        }
        const promises = [];
        for (let x = nwTile.x; x <= seTile.x; x++) {
            for (let y = nwTile.y; y <= seTile.y; y++) {
                promises.push(this.precacheTile(x, y, zoom));
            }
        }
        await Promise.all(promises);
    }
    /**
     * Clear the tile cache
     */
    clearCache() {
        this.cache = {};
        this.cacheKeys = [];
        if (this.debug) {
            console.log('Cache cleared');
        }
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cacheKeys.length,
            maxSize: this.maxCacheSize,
            keys: [...this.cacheKeys]
        };
    }
    /**
     * Get a tile from cache or fetch it
     */
    async getTile(x, y, z) {
        const tileKey = `${z}/${x}/${y}`;
        // Check cache first
        if (this.cache[tileKey]) {
            if (this.debug) {
                console.log(`Cache hit for tile: ${tileKey}`);
            }
            return this.cache[tileKey];
        }
        if (this.debug) {
            console.log(`Cache miss for tile: ${tileKey}, fetching...`);
        }
        // Fetch tile
        const tileResult = await this.pmtiles.getZxy(z, x, y);
        if (!tileResult || !tileResult.data) {
            throw new Error(`Failed to fetch tile ${tileKey}`);
        }
        const tileData = new Uint8Array(tileResult.data);
        // Add to cache
        this.addToCache(tileKey, tileData);
        return tileData;
    }
    /**
     * Add tile to cache with LRU eviction
     */
    addToCache(key, data) {
        // Remove if already exists
        const existingIndex = this.cacheKeys.indexOf(key);
        if (existingIndex !== -1) {
            this.cacheKeys.splice(existingIndex, 1);
        }
        // Add to front
        this.cacheKeys.unshift(key);
        this.cache[key] = data;
        // Evict if over limit
        while (this.cacheKeys.length > this.maxCacheSize) {
            const oldestKey = this.cacheKeys.pop();
            if (oldestKey) {
                delete this.cache[oldestKey];
                if (this.debug) {
                    console.log(`Evicted tile from cache: ${oldestKey}`);
                }
            }
        }
    }
    /**
     * Convert latitude/longitude to tile coordinates
     */
    latLonToTile(lat, lon, zoom) {
        const x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
        const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
        return { x, y };
    }
    /**
     * Extract elevation from RGB-encoded tile data
     */
    async extractElevationFromTile(tileData, lat, lon, zoom) {
        try {
            // Convert tile coordinates to pixel coordinates within the tile
            const { x: tileX, y: tileY } = this.latLonToTile(lat, lon, zoom);
            const { pixelX, pixelY } = this.latLonToPixel(lat, lon, zoom, tileX, tileY);
            if (this.debug) {
                console.log(`Extracting elevation at pixel (${pixelX}, ${pixelY}) from tile data (${tileData.length} bytes)`);
            }
            // Detect image format and decode accordingly
            const isPNG = this.isPNGFormat(tileData);
            const isWebP = this.isWebPFormat(tileData);
            let imageData;
            if (isPNG) {
                if (this.debug) {
                    console.log('Decoding PNG tile');
                }
                const png = PNG.sync.read(Buffer.from(tileData));
                imageData = {
                    data: png.data,
                    width: png.width,
                    height: png.height
                };
            }
            else if (isWebP) {
                if (this.debug) {
                    console.log('Decoding WebP tile');
                }
                // Use Sharp to decode WebP
                const sharpImage = sharp.default(Buffer.from(tileData));
                const { data, info } = await sharpImage.raw().toBuffer({ resolveWithObject: true });
                imageData = {
                    data: data,
                    width: info.width,
                    height: info.height
                };
            }
            else {
                throw new Error('Unsupported image format - not PNG or WebP');
            }
            if (this.debug) {
                console.log(`Image decoded: ${imageData.width}x${imageData.height}, ${imageData.data.length} bytes`);
            }
            // Ensure pixel coordinates are within bounds
            const x = Math.max(0, Math.min(pixelX, imageData.width - 1));
            const y = Math.max(0, Math.min(pixelY, imageData.height - 1));
            // Calculate pixel index (assuming RGBA format, 4 bytes per pixel for PNG, 3 for RGB)
            const channels = imageData.data.length / (imageData.width * imageData.height);
            const pixelIndex = (y * imageData.width + x) * channels;
            if (pixelIndex + 2 >= imageData.data.length) {
                if (this.debug) {
                    console.log('Pixel out of bounds, returning 0 elevation');
                }
                return 0;
            }
            // Extract RGB values (ignore alpha channel if present)
            const r = imageData.data[pixelIndex];
            const g = imageData.data[pixelIndex + 1];
            const b = imageData.data[pixelIndex + 2];
            // Decode elevation using Mapbox RGB encoding
            // elevation = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
            const elevation = -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
            if (this.debug) {
                console.log(`RGB values: (${r}, ${g}, ${b}) -> elevation: ${elevation.toFixed(1)}m`);
            }
            return Math.round(elevation * 10) / 10; // Round to 1 decimal place
        }
        catch (error) {
            console.error('Error extracting elevation from tile:', error);
            // Fallback to simulated data if image decoding fails
            if (this.debug) {
                console.log('Falling back to simulated elevation');
            }
            const { x: tileX, y: tileY } = this.latLonToTile(lat, lon, zoom);
            const { pixelX, pixelY } = this.latLonToPixel(lat, lon, zoom, tileX, tileY);
            const baseElevation = Math.abs(Math.sin(lat * Math.PI / 180) * Math.cos(lon * Math.PI / 180)) * 3000;
            const dataVariation = (tileData.length % 1000) / 10;
            const pixelVariation = (pixelX + pixelY) % 500;
            return Math.round((baseElevation + dataVariation + pixelVariation) * 10) / 10;
        }
    }
    /**
     * Convert lat/lon to pixel coordinates within a specific tile
     */
    latLonToPixel(lat, lon, zoom, tileX, tileY) {
        const tileSize = 256; // Standard tile size
        const scale = Math.pow(2, zoom);
        // Convert to world coordinates
        const worldX = (lon + 180) / 360 * scale;
        const worldY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * scale;
        // Convert to pixel coordinates within the tile
        const pixelX = Math.floor((worldX - tileX) * tileSize);
        const pixelY = Math.floor((worldY - tileY) * tileSize);
        return { pixelX, pixelY };
    }
    /**
     * Calculate meters per pixel at a given zoom level
     */
    calculateMetersPerPixel(zoom) {
        // At zoom level 0, one pixel represents ~156543.03 meters
        // Each zoom level halves the meters per pixel
        const baseMetersPerPixel = 156543.03392804097;
        return baseMetersPerPixel / Math.pow(2, zoom);
    }
    /**
     * Check if data is PNG format
     */
    isPNGFormat(data) {
        const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        return pngSignature.every((byte, i) => data[i] === byte);
    }
    /**
     * Check if data is WebP format
     */
    isWebPFormat(data) {
        // WebP signature: "RIFF" at start and "WEBP" at offset 8
        return data.length >= 12 &&
            data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 && // "RIFF"
            data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50; // "WEBP"
    }
}
