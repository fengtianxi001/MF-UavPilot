import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchRegions } from '../src/hooks/regionOptions.ts'

const feature = (adcode, name, center, childrenNum, level = 'city') => ({
  properties: { adcode, name, center, childrenNum, level },
})

const stubFetch = (features, status = 200) => {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({ features }),
    }
  }
  return calls
}

test('区划数据转换为可定位选项，保留中心点与层级', async () => {
  const calls = stubFetch([
    feature(330100, '杭州市', [120.153576, 30.287459], 13),
    feature(330102, '上城区', [120.171465, 30.250236], 0, 'district'),
  ])
  const options = await fetchRegions(330000)
  assert.equal(
    calls[0],
    'https://geo.datav.aliyun.com/areas_v3/bound/330000_full.json'
  )
  assert.deepEqual(
    options.map((item) => item.label),
    ['杭州市', '上城区']
  )
  assert.deepEqual(options[0].center, [120.153576, 30.287459])
  assert.equal(options[0].value, 330100)
  assert.equal(options[0].isLeaf, false)
  assert.equal(options[1].isLeaf, true)
})

test('缺少中心点或中心点非法的条目被过滤，避免定位到错误位置', async () => {
  stubFetch([
    feature(1, '无中心', undefined, 0),
    feature(2, '零长度中心', [], 0),
    feature(3, '越界中心', [200, 30], 0),
    feature(4, '非数字中心', ['a', 30], 0),
    feature(5, '有效区县', [120, 30], 0),
  ])
  const options = await fetchRegions(42)
  assert.equal(options.length, 1)
  assert.equal(options[0].label, '有效区县')
})

test('请求失败明确抛出错误，而不是返回空列表假装成功', async () => {
  stubFetch([], 404)
  await assert.rejects(fetchRegions(999999), /HTTP 404/)
})

test('同一层级只请求一次，命中缓存', async () => {
  const calls = stubFetch([feature(11, '某市', [120, 30], 4)])
  await fetchRegions(777)
  const options = await fetchRegions(777)
  assert.equal(calls.length, 1)
  assert.equal(options[0].value, 11)
})
