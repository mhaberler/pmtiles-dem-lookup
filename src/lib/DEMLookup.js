import { PMTiles } from 'pmtiles';
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
     * TODO: Implement proper image decoding for PNG/WebP tiles
     */
    async extractElevationFromTile(tileData, lat, lon, zoom) {
        // For now, return a simulated elevation based on tile data
        // This is a placeholder until proper image decoding is implemented
        if (this.debug) {
            console.log(`Extracting elevation from tile data (${tileData.length} bytes) for lat: ${lat}, lon: ${lon}, zoom: ${zoom}`);
        }
        // Simple simulation: use tile data length and coordinates to simulate elevation
        // In a real implementation, you would:
        // 1. Decode the PNG/WebP image to get RGBA pixel data
        // 2. Calculate exact pixel position within the 256x256 tile
        // 3. Extract RGB values at that position
        // 4. Apply Mapbox RGB encoding: elevation = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
        const { x: tileX, y: tileY } = this.latLonToTile(lat, lon, zoom);
        const { pixelX, pixelY } = this.latLonToPixel(lat, lon, zoom, tileX, tileY);
        // Simulate elevation based on coordinates and tile data
        // This gives us values that vary by location for testing purposes
        const baseElevation = Math.abs(Math.sin(lat * Math.PI / 180) * Math.cos(lon * Math.PI / 180)) * 3000;
        const dataVariation = (tileData.length % 1000) / 10;
        const pixelVariation = (pixelX + pixelY) % 500;
        const simulatedElevation = baseElevation + dataVariation + pixelVariation;
        if (this.debug) {
            console.log(`Simulated elevation: ${simulatedElevation.toFixed(1)}m (pixel: ${pixelX}, ${pixelY})`);
        }
        return Math.round(simulatedElevation * 10) / 10; // Round to 1 decimal place
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
}
