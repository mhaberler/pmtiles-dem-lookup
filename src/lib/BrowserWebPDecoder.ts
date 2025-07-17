// Browser-native WebP decoder for DEM tiles
// This uses the same Canvas API approach as PNG but for WebP format

export interface ImageData {
  width: number
  height: number
  data: Uint8Array
}

export class BrowserWebPDecoder {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor() {
    this.canvas = document.createElement('canvas')
    const ctx = this.canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get 2D canvas context')
    }
    this.ctx = ctx
  }

  async decodeWebP(webpData: ArrayBuffer): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      // Create a blob from the WebP data
      const blob = new Blob([webpData], { type: 'image/webp' })
      const url = URL.createObjectURL(blob)
      
      // Create an image element to load the WebP
      const img = new Image()
      
      img.onload = () => {
        try {
          // Set canvas size to match image
          this.canvas.width = img.width
          this.canvas.height = img.height
          
          // Draw the image to canvas
          this.ctx.drawImage(img, 0, 0)
          
          // Get the image data
          const imageData = this.ctx.getImageData(0, 0, img.width, img.height)
          
          // Clean up
          URL.revokeObjectURL(url)
          
          // Return our custom format
          resolve({
            width: img.width,
            height: img.height,
            data: new Uint8Array(imageData.data)
          })
        } catch (error) {
          URL.revokeObjectURL(url)
          reject(error)
        }
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load WebP image - browser may not support WebP format'))
      }
      
      img.src = url
    })
  }

  // Extract RGBA values at specific pixel coordinates
  getPixel(imageData: ImageData, x: number, y: number): { r: number, g: number, b: number, a: number } {
    const index = (y * imageData.width + x) * 4
    return {
      r: imageData.data[index],
      g: imageData.data[index + 1], 
      b: imageData.data[index + 2],
      a: imageData.data[index + 3]
    }
  }

  // Check if browser supports WebP format
  static async checkWebPSupport(): Promise<boolean> {
    return new Promise((resolve) => {
      const webp = new Image()
      webp.onload = webp.onerror = () => {
        resolve(webp.height === 2)
      }
      webp.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA'
    })
  }
}
