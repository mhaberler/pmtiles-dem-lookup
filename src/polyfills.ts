// Minimal browser polyfills for essential functionality
import { Buffer } from 'buffer'
import process from 'process'

// Essential polyfills for browser compatibility
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer;
  (globalThis as any).process = process
} else if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).process = process
}

export {}
