declare module 'leaflet' {
  interface MapOptions {
    rotate?: boolean
    bearing?: number
    rotateControl?: boolean
    shiftKeyRotate?: boolean
    pitchDrag?: boolean
    touchRotate?: boolean
  }
  interface Map {
    setBearing(degrees: number): void
    getBearing(): number
  }
}
export {}
