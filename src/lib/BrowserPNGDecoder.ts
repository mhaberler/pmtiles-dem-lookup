// Browser-native PNG decoder for DEM tiles
// This avoids the need for Node.js polyfills by using native browser APIs

export interface ImageData {
  width: number
  height: number
  data: Uint8Array
}

export class BrowserPNGDecoder {
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

  async decodePNG(pngData: ArrayBuffer): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      // Create a blob from the PNG data
      const blob = new Blob([pngData], { type: 'image/png' })
      const url = URL.createObjectURL(blob)
      
      // Create an image element to load the PNG
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
        reject(new Error('Failed to load PNG image'))
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
}
