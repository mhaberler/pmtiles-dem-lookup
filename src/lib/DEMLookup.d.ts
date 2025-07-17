import { Compression, TileType } from 'pmtiles';
export interface ElevationResult {
    elevation: number;
    metersPerPixel: number;
}
export interface PMTileInfo {
    minZoom: number;
    maxZoom: number;
    metersPerPixel: number;
    compression: Compression;
    tileType: TileType;
    bounds: [number, number, number, number];
}
export interface BoundingBox {
    north: number;
    south: number;
    east: number;
    west: number;
    zoom?: number;
}
export interface TileCache {
    [key: string]: Uint8Array;
}
export declare class DEMLookup {
    private pmtiles;
    private cache;
    private maxCacheSize;
    private cacheKeys;
    private debug;
    private info;
    constructor(url: string, options?: {
        maxCacheSize?: number;
        debug?: boolean;
    });
    /**
     * Initialize the PMTiles and get metadata
     */
    initialize(): Promise<void>;
    /**
     * Get information about the PMTiles file
     */
    getInfo(): PMTileInfo | null;
    /**
     * Get elevation at a specific latitude and longitude
     */
    getElevation(lat: number, lon: number, zoom?: number): Promise<ElevationResult>;
    /**
     * Pre-cache a single tile
     */
    precacheTile(x: number, y: number, z: number): Promise<void>;
    /**
     * Pre-cache tiles within a bounding box
     */
    precacheBoundingBox(boundingBox: BoundingBox): Promise<void>;
    /**
     * Clear the tile cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
        keys: string[];
    };
    /**
     * Get a tile from cache or fetch it
     */
    getTile(x: number, y: number, z: number): Promise<Uint8Array>;
    /**
     * Add tile to cache with LRU eviction
     */
    private addToCache;
    /**
     * Convert latitude/longitude to tile coordinates
     */
    latLonToTile(lat: number, lon: number, zoom: number): {
        x: number;
        y: number;
    };
    /**
     * Extract elevation from RGB-encoded tile data
     */
    private extractElevationFromTile;
    /**
     * Convert lat/lon to pixel coordinates within a specific tile
     */
    private latLonToPixel;
    /**
     * Calculate meters per pixel at a given zoom level
     */
    private calculateMetersPerPixel;
}
