/// <reference types="vite/client" />

interface ImportMetaEnv {
  // 服务器地址
  VITE_API_DOMAIN: string
  // 可选：Cesium 地形服务地址，优先于 ion Token。
  VITE_CESIUM_TERRAIN_URL?: string
  // 可选：Cesium ion Token，用于加载全球地形。
  VITE_CESIUM_ION_TOKEN?: string
}
