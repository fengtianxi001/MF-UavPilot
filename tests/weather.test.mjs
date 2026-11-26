import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WEATHER_PRESETS,
  getWeatherPreset,
  weatherRenderParams,
  rainParams,
  fogParams,
} from '../src/hooks/weather.ts'

test('预设数量、唯一标识和必要字段完整', () => {
  assert.equal(WEATHER_PRESETS.length, 4)
  const ids = WEATHER_PRESETS.map((item) => item.id)
  assert.deepEqual(ids, ['clear', 'overcast', 'storm', 'fog'])
  assert.equal(new Set(ids).size, ids.length)
  for (const preset of WEATHER_PRESETS) {
    assert.ok(preset.label.length > 0)
    assert.ok(Number.isFinite(preset.fogDensity) && preset.fogDensity > 0)
    assert.ok(preset.lightIntensity > 0)
    assert.ok(preset.shadowDarkness >= 0 && preset.shadowDarkness <= 1)
    assert.ok(preset.wind.speed >= 0 && preset.wind.gustSpeed >= 0)
    assert.ok(preset.wind.gustPeriodSeconds >= 2)
  }
})

test('恶劣天气雾更浓、光照更暗、风更大', () => {
  const clear = getWeatherPreset('clear')
  for (const id of ['overcast', 'storm', 'fog']) {
    const preset = getWeatherPreset(id)
    assert.ok(preset.fogDensity > clear.fogDensity, id)
  }
  assert.ok(getWeatherPreset('storm').lightIntensity < clear.lightIntensity)
  assert.ok(
    getWeatherPreset('storm').wind.speed >
      getWeatherPreset('overcast').wind.speed
  )
  assert.ok(
    getWeatherPreset('storm').wind.gustSpeed >
      getWeatherPreset('overcast').wind.gustSpeed
  )
  assert.ok(
    getWeatherPreset('fog').wind.speed < getWeatherPreset('storm').wind.speed
  )
})

test('已移除的降雨与轻霾预设回退为晴空', () => {
  assert.equal(getWeatherPreset('rain').id, 'clear')
  assert.equal(getWeatherPreset('hazy').id, 'clear')
  assert.ok(!WEATHER_PRESETS.some((preset) => preset.id === 'rain'))
  assert.ok(!WEATHER_PRESETS.some((preset) => preset.id === 'hazy'))
})

test('未知预设回退到晴空，渲染参数与预设一致', () => {
  assert.equal(getWeatherPreset('unknown').id, 'clear')
  const params = weatherRenderParams('overcast')
  const preset = getWeatherPreset('overcast')
  assert.equal(params.fogDensity, preset.fogDensity)
  assert.equal(params.lightIntensity, preset.lightIntensity)
  assert.equal(params.shadowDarkness, preset.shadowDarkness)
  assert.equal(params.brightness, preset.brightness)
  assert.equal(params.saturation, preset.saturation)
})

test('预设风向为合法来向角度', () => {
  for (const preset of WEATHER_PRESETS) {
    assert.ok(preset.wind.fromDegrees >= 0 && preset.wind.fromDegrees < 360)
  }
})

test('只有雷雨绘制雨幕', () => {
  const raining = WEATHER_PRESETS.filter((p) => p.rainCount > 0).map(
    (p) => p.id
  )
  assert.deepEqual(raining, ['storm'])
  for (const id of ['clear', 'overcast', 'fog']) {
    const params = rainParams(id)
    assert.equal(params.count, 0, id)
    assert.equal(params.opacity, 0, id)
  }
  const storm = rainParams('storm')
  assert.ok(storm.count > 0)
  assert.ok(storm.speed > 0)
  assert.ok(storm.opacity > 0 && storm.opacity <= 1)
})

test('雨强不超过图层上限 1200，参数为有限正数', () => {
  for (const preset of WEATHER_PRESETS) {
    assert.ok(preset.rainCount <= 1200, preset.id)
    assert.ok(Number.isFinite(preset.rainSpeed) && preset.rainSpeed > 0)
    assert.ok(preset.rainOpacity >= 0 && preset.rainOpacity <= 1)
  }
})

test('浓雾绘制最明显的雾幕，晴空不绘制', () => {
  assert.equal(fogParams('clear').opacity, 0)
  const fog = fogParams('fog')
  const storm = fogParams('storm')
  const overcast = fogParams('overcast')
  assert.ok(fog.opacity > 0.5)
  assert.ok(fog.opacity > storm.opacity)
  assert.ok(storm.opacity > overcast.opacity)
  assert.ok(overcast.opacity > 0)
  // 浓雾飘动更慢、雾团更大。
  assert.ok(fog.speed < storm.speed)
  assert.ok(fog.scale < storm.scale)
})

test('雾幕参数在合法范围内且为有限值', () => {
  for (const preset of WEATHER_PRESETS) {
    assert.ok(preset.fogOpacity >= 0 && preset.fogOpacity <= 1, preset.id)
    const params = fogParams(preset.id)
    assert.ok(params.opacity >= 0 && params.opacity <= 1)
    assert.ok(params.speed > 0 && params.speed < 2)
    assert.ok(params.scale > 0 && params.scale <= 10)
  }
})
