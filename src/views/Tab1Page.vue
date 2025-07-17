<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>PMTiles DEM Lookup Demo</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">DEM Lookup</ion-title>
        </ion-toolbar>
      </ion-header>

      <!-- Parameter Input and Status Panel -->
      <div class="dem-control-panel">
        <ion-card>
          <ion-card-header>
            <ion-card-title>DEM Configuration</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item>
              <ion-select 
                v-model="selectedDemUrl" 
                @ionChange="switchDem"
                interface="popover"
                placeholder="Select DEM Format"
              >
                <ion-select-option value="https://static.mah.priv.at/cors/AT-10m-png.pmtiles">
                  Austria 10m (PNG)
                </ion-select-option>
                <ion-select-option value="https://static.mah.priv.at/cors/AT-10m-webp.pmtiles">
                  Austria 10m (WebP)
                </ion-select-option>
              </ion-select>
              <ion-label slot="start">DEM Source:</ion-label>
            </ion-item>

            <ion-item>
              <ion-input 
                v-model.number="cacheSize" 
                type="number" 
                :min="10" 
                :max="500"
                @ionInput="updateCacheSize"
              ></ion-input>
              <ion-label slot="start">Cache Size:</ion-label>
            </ion-item>

            <ion-item>
              <ion-checkbox v-model="debugMode" @ionChange="toggleDebug"></ion-checkbox>
              <ion-label slot="start">Debug Mode</ion-label>
            </ion-item>

            <div class="action-buttons">
              <ion-button 
                @click="initializeDem" 
                :disabled="!selectedDemUrl || isLoading"
                fill="solid"
              >
                <ion-icon name="refresh-outline" slot="start"></ion-icon>
                Initialize DEM
              </ion-button>
              
              <ion-button 
                @click="clearCache" 
                :disabled="!demLookup"
                fill="outline"
              >
                <ion-icon name="trash-outline" slot="start"></ion-icon>
                Clear Cache
              </ion-button>

              <ion-button 
                @click="toggleBoundingBoxMode" 
                :disabled="!demLookup"
                :fill="boundingBoxMode ? 'solid' : 'outline'"
              >
                <ion-icon name="square-outline" slot="start"></ion-icon>
                {{ boundingBoxMode ? 'Exit' : 'Draw' }} Bounding Box
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Status Display -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>Status & Results</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="status-grid">
              <div class="status-item">
                <strong>Status:</strong> 
                <span :class="statusClass">{{ status }}</span>
              </div>
              
              <div class="status-item" v-if="demInfo">
                <strong>Coverage:</strong> 
                {{ demInfo.bounds[0].toFixed(2) }}°, {{ demInfo.bounds[1].toFixed(2) }}° to 
                {{ demInfo.bounds[2].toFixed(2) }}°, {{ demInfo.bounds[3].toFixed(2) }}°
              </div>
              
              <div class="status-item" v-if="demInfo">
                <strong>Resolution:</strong> 
                {{ demInfo.metersPerPixel.toFixed(1) }}m/pixel (zoom {{ demInfo.maxZoom }})
              </div>
              
              <div class="status-item" v-if="cacheStats">
                <strong>Cache:</strong> 
                {{ cacheStats.size }}/{{ cacheStats.maxSize }} tiles
              </div>
              
              <div class="status-item" v-if="lastElevation">
                <strong>Last Lookup:</strong>
                {{ lastElevation.coordinates.lat.toFixed(6) }}, {{ lastElevation.coordinates.lon.toFixed(6) }}
              </div>
              
              <div class="status-item" v-if="lastElevation">
                <strong>Elevation:</strong> 
                {{ lastElevation.elevation.toFixed(1) }}m
              </div>
              
              <div class="status-item" v-if="lastElevation">
                <strong>Query Time:</strong> 
                {{ lastElevation.queryTime }}ms
              </div>
            </div>

            <!-- Debug Output -->
            <div v-if="debugMode && debugOutput.length > 0" class="debug-output">
              <h4>Debug Output:</h4>
              <div class="debug-log">
                <div 
                  v-for="(log, index) in debugOutput.slice(-10)" 
                  :key="index"
                  class="debug-line"
                >
                  <span class="debug-time">{{ log.time }}</span>
                  <span class="debug-message">{{ log.message }}</span>
                </div>
              </div>
            </div>
          </ion-card-content>
        </ion-card>
      </div>

      <!-- Leaflet Map -->
      <div class="map-container">
        <div id="map" class="leaflet-map"></div>
        <div v-if="boundingBoxMode" class="bounding-box-instructions">
          <ion-chip color="primary">
            <ion-icon name="information-circle"></ion-icon>
            <ion-label>Click and drag to draw a bounding box for pre-caching</ion-label>
          </ion-chip>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { 
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, 
  IonCardTitle, IonCardContent, IonItem, IonLabel, IonSelect, IonSelectOption,
  IonInput, IonCheckbox, IonButton, IonIcon, IonChip
} from '@ionic/vue';
import { onMounted, onUnmounted, ref, computed } from 'vue';
import L from 'leaflet';
import { DEMLookup, type PMTileInfo } from '@/lib/DEMLookup';

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

// Reactive state
const selectedDemUrl = ref('https://static.mah.priv.at/cors/AT-10m-png.pmtiles');
const cacheSize = ref(100);
const debugMode = ref(false);
const isLoading = ref(false);
const status = ref('Not initialized');
const boundingBoxMode = ref(false);

// DEM and map instances
const demLookup = ref<DEMLookup | null>(null);
const map = ref<L.Map | null>(null);
const demInfo = ref<PMTileInfo | null>(null);
const cacheStats = ref<{ size: number; maxSize: number; keys: string[] } | null>(null);
const lastElevation = ref<{
  coordinates: { lat: number; lon: number };
  elevation: number;
  queryTime: number;
} | null>(null);

// Debug output
const debugOutput = ref<{ time: string; message: string }[]>([]);

// Bounding box drawing
let boundingBox: L.Rectangle | null = null;
let boundingBoxStart: L.LatLng | null = null;

// Computed properties
const statusClass = computed(() => {
  switch (status.value) {
    case 'Ready': return 'status-ready';
    case 'Loading...': return 'status-loading';
    case 'Error': return 'status-error';
    default: return 'status-idle';
  }
});

// Methods
const addDebugLog = (message: string) => {
  if (debugMode.value) {
    const time = new Date().toLocaleTimeString();
    debugOutput.value.push({ time, message });
    if (debugOutput.value.length > 50) {
      debugOutput.value = debugOutput.value.slice(-50);
    }
  }
};

const initializeDem = async () => {
  if (!selectedDemUrl.value) return;
  
  isLoading.value = true;
  status.value = 'Loading...';
  
  try {
    addDebugLog(`Initializing DEM: ${selectedDemUrl.value}`);
    
    demLookup.value = new DEMLookup(selectedDemUrl.value, {
      maxCacheSize: cacheSize.value,
      debug: debugMode.value
    });
    
    await demLookup.value.initialize();
    demInfo.value = demLookup.value.getInfo();
    
    updateCacheStats();
    status.value = 'Ready';
    
    addDebugLog(`DEM initialized: ${demInfo.value?.metersPerPixel.toFixed(1)}m/pixel`);
    
    // Center map on Austria if not already positioned
    if (map.value && demInfo.value) {
      const bounds = demInfo.value.bounds;
      const center = [(bounds[1] + bounds[3]) / 2, (bounds[0] + bounds[2]) / 2] as [number, number];
      map.value.setView(center, 8);
    }
    
  } catch (error) {
    console.error('Failed to initialize DEM:', error);
    status.value = 'Error';
    addDebugLog(`Error: ${error}`);
  } finally {
    isLoading.value = false;
  }
};

const switchDem = () => {
  if (demLookup.value) {
    initializeDem();
  }
};

const updateCacheSize = () => {
  // Cache size will be applied on next initialization
  addDebugLog(`Cache size updated to: ${cacheSize.value}`);
};

const toggleDebug = () => {
  if (demLookup.value) {
    // Debug mode change will require re-initialization
    addDebugLog(`Debug mode ${debugMode.value ? 'enabled' : 'disabled'}`);
  }
};

const clearCache = () => {
  if (demLookup.value) {
    demLookup.value.clearCache();
    updateCacheStats();
    addDebugLog('Cache cleared');
  }
};

const updateCacheStats = () => {
  if (demLookup.value) {
    cacheStats.value = demLookup.value.getCacheStats();
  }
};

const lookupElevation = async (lat: number, lon: number) => {
  if (!demLookup.value) return;
  
  try {
    const startTime = Date.now();
    const result = await demLookup.value.getElevation(lat, lon);
    const queryTime = Date.now() - startTime;
    
    lastElevation.value = {
      coordinates: { lat, lon },
      elevation: result.elevation,
      queryTime
    };
    
    updateCacheStats();
    addDebugLog(`Elevation lookup: ${lat.toFixed(6)}, ${lon.toFixed(6)} -> ${result.elevation.toFixed(1)}m (${queryTime}ms)`);
    
  } catch (error) {
    console.error('Elevation lookup failed:', error);
    addDebugLog(`Lookup error: ${error}`);
  }
};

const toggleBoundingBoxMode = () => {
  boundingBoxMode.value = !boundingBoxMode.value;
  
  if (!boundingBoxMode.value && boundingBox) {
    map.value?.removeLayer(boundingBox);
    boundingBox = null;
    boundingBoxStart = null;
  }
  
  addDebugLog(`Bounding box mode ${boundingBoxMode.value ? 'enabled' : 'disabled'}`);
};

const precacheBoundingBox = async (bounds: L.LatLngBounds) => {
  if (!demLookup.value) return;
  
  const boundingBoxDef = {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest()
  };
  
  try {
    addDebugLog(`Pre-caching bounding box: ${Object.values(boundingBoxDef).map(v => v.toFixed(4)).join(', ')}`);
    status.value = 'Pre-caching...';
    
    await demLookup.value.precacheBoundingBox(boundingBoxDef);
    updateCacheStats();
    
    status.value = 'Ready';
    addDebugLog(`Pre-caching completed. Cache: ${cacheStats.value?.size} tiles`);
    
  } catch (error) {
    console.error('Pre-caching failed:', error);
    addDebugLog(`Pre-caching error: ${error}`);
    status.value = 'Ready';
  }
};

// Map initialization
const initializeMap = () => {
  if (map.value) return;
  
  map.value = L.map('map', {
    center: [47.5, 13.5], // Austria center
    zoom: 8,
    zoomControl: true
  });
  
  // Add protomaps base layer - using OpenStreetMap as fallback
  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
  });
  
  osmLayer.addTo(map.value as any);
  
  // Add click handler for elevation lookup
  map.value.on('click', (e: L.LeafletMouseEvent) => {
    if (boundingBoxMode.value) {
      handleBoundingBoxClick(e);
    } else {
      lookupElevation(e.latlng.lat, e.latlng.lng);
    }
  });
  
  // Add mouse move handler for bounding box
  map.value.on('mousemove', (e: L.LeafletMouseEvent) => {
    if (boundingBoxMode.value && boundingBoxStart) {
      updateBoundingBox(e.latlng);
    }
  });
  
  addDebugLog('Map initialized');
};

const handleBoundingBoxClick = (e: L.LeafletMouseEvent) => {
  if (!boundingBoxStart) {
    // Start drawing bounding box
    boundingBoxStart = e.latlng;
    boundingBox = L.rectangle([[e.latlng.lat, e.latlng.lng], [e.latlng.lat, e.latlng.lng]], {
      color: '#3388ff',
      weight: 2,
      fillOpacity: 0.1
    }).addTo(map.value as any);
  } else {
    // Finish drawing bounding box and trigger pre-caching
    const bounds = L.latLngBounds(boundingBoxStart, e.latlng);
    precacheBoundingBox(bounds);
    
    // Reset
    boundingBoxStart = null;
    boundingBoxMode.value = false;
  }
};

const updateBoundingBox = (latlng: L.LatLng) => {
  if (boundingBox && boundingBoxStart) {
    const bounds = L.latLngBounds(boundingBoxStart, latlng);
    boundingBox.setBounds(bounds);
  }
};

// Lifecycle
onMounted(() => {
  setTimeout(() => {
    initializeMap();
    // Auto-initialize with PNG format
    initializeDem();
  }, 100);
});

onUnmounted(() => {
  if (map.value) {
    map.value.remove();
  }
});
</script>

<style scoped>
.dem-control-panel {
  padding: 16px;
  max-height: 50vh;
  overflow-y: auto;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-size: 14px;
}

.status-item {
  padding: 4px 0;
}

.status-ready {
  color: #2dd36f;
  font-weight: bold;
}

.status-loading {
  color: #ffc409;
  font-weight: bold;
}

.status-error {
  color: #eb445a;
  font-weight: bold;
}

.status-idle {
  color: #92949c;
}

.debug-output {
  margin-top: 16px;
  border-top: 1px solid #e0e0e0;
  padding-top: 16px;
}

.debug-log {
  max-height: 200px;
  overflow-y: auto;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px;
  font-family: monospace;
  font-size: 12px;
}

.debug-line {
  display: flex;
  margin-bottom: 2px;
}

.debug-time {
  color: #666;
  margin-right: 8px;
  min-width: 80px;
}

.debug-message {
  color: #333;
  flex: 1;
}

.map-container {
  position: relative;
  height: 50vh;
  min-height: 400px;
}

.leaflet-map {
  height: 100%;
  width: 100%;
}

.bounding-box-instructions {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1000;
}

/* Responsive design */
@media (max-width: 768px) {
  .dem-control-panel {
    max-height: 40vh;
  }
  
  .map-container {
    height: 60vh;
  }
  
  .status-grid {
    grid-template-columns: 1fr;
  }
  
  .action-buttons {
    flex-direction: column;
  }
}

/* Fix Leaflet default icon issue in Vite */
:deep(.leaflet-default-icon-path) {
  background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFgUlEQVR4Aa1XA5BjWRTN2oW17d3YaZtr2962HUzbXNfN1nr3ps6uw2uUBR9eBvJC8/Wk6pCylKxzXL3KBqz1CrLp0s54s2W6tX33Xs9n996X/5zT9ef4/v/9ev+NaePV+QRZfAhCdT92Xe/uOL4kO+OMdH+O+K7Nh8aBK9FHYGEWWDdJGYlQylUHT2P0JdaGVKWcyYrF1bqfCLQdNOGlLtpGBnRQF5hPcBhQPYwFFkXrBF3oIh7CZJcS4DgxHGKGIVgMYbKZOPJG6pzJnTlHRzxfDfKjwCImFIFQNiICIjCQ4+h9aJfSDyuYi/KRMQLa/ADMNsZFw8CIXHB/kXTOJc5nEQxYFYXOBH+0sgrM/g+qrz2wWFFYWAwYcJNOJCg6EH8BZIaahZFRaTSRF7zlL8DMHXPW16C4rKm5UVKmRIkM2hUInN/iMGQHjvVT7S2fNuwCOJGYiDIGNBOoLlCLQm6RiELpgqyM0Eaw6tpxAkJjh4YJjBkcxcNI/E/3nZOwSzHMgIAMAAOIoklHbXjB4cFz2MPLV6HdGEJ6Qd8a4b8sH3MH1kfJLf4DGVNq/a3I8HIWa1Fqy+Zt6kKsYoOWzUUmQbBBa9QxqYyRrQGhj+gZvYGMCrGUdHOiXGYOlNGJGT2pWjNNL3BLxTECFmHSc0BuYdpgHSGNNj5c4VVAVQSlDQdAJmJ6NCvI/7b7ewhJhGLQxZYNFnUhJaRa2z7vDX9dJOz1E4ZeYrCYt6VC9Y9DAiP4qBf8SBiGlOAwowT+MJXGtPzNa4v3YRMJ7dEEHSGmv9Yr11Jlpe6Y7RJ6GbDWuCIB/Lmx4i6V+tC/lEKQrRaFb0F2tgKBQ6e/hDhH5G0mEX5Kk6h9VQxlPKBJ3OMPApuS1CpPQCozDI1bGl5+oOUG95CQ9aqKrz6WdN86rJKGGlQR3EDiKGKj6kGwNsAK4BQTsRVxvA8qYBe2SQKNAaY8OZhH8qHjOlDSPYJcNQQRJjRVVgJYMNI1JJ/8LUdYJJ0qjq1X0JQVqoWHwZyoCBJGqnfKqQnvGy4aqK8CQRJYmALbKFvNl6Ip6FWJPGbYV5Q8vO/QZdRRKCVX8zC8E5KcFVJlkHa9eCHwLJLe+5w4TFOCCXsG3VoGG/TJABpQCFNT4p8VCRUpHlYlWr+kJQFHYI6sCSzrZ1q7zWA1bFO5QZKkfPKHD+/vWKfqLq4BYGxDuOVNlCHdBClAcR4QJQR5K4t+kq5TKJyTJoODJ8sAvCSo89PXr4V8xXYlJEQa3qO20qp5A2jMLHGaVxHsW4wEPVIzKQ4QCOwJBCIgQkwGJQ6JJk8bIAJH8pMBa4DqKPwOBxDJFbsQU8NASYu8TwWQHXzQX8k8rAj4KNW4p8J2kQGQ9v7WgBoAeV8W4dJABUwGKBwY7KK7g6iGsEgKYKzFH/4ZF5oF8xLJaJ4rBoMJLqXGCjJCKdmLMCJiCCPdEfBIVxj5k8Q9vJIDJp6b4LJ+z4SJfRaMfIMqPvj1Y1PxRWD8WCL5CVokE8hTEbCPfDVJJLNgHbGwU8ywAcfxdQGkR4GZ8kKi8FgH8aFkPM1AchJDKVWnqWbRFCL2h7dQHOHyFGQZECQHOgVJ5Yq0CaJyKBLhO/q+F7eY6ADBJYZYUWg4iahFVyiAJyONUdMIJABKYyKvBQAgOKL6CZWiTKZGWbzONF0M="")');
}
</style>
