import { computed, reactive } from 'vue'

export type Locale = 'zh-CN' | 'en-US'

const STORAGE_KEY = 'mf-uavpilot-locale'
const savedLocale =
  typeof localStorage !== 'undefined'
    ? (localStorage.getItem(STORAGE_KEY) as Locale | null)
    : null

export const localeState = reactive<{ locale: Locale }>({
  locale: savedLocale === 'en-US' ? 'en-US' : 'zh-CN',
})

const translations: Record<string, string> = {
  English: 'English',
  中文: '中文',
  '打开 GitHub': 'Open GitHub',
  '真空速 TAS': 'True Airspeed',
  '地速 GS': 'Ground Speed',
  '离地高度 AGL': 'Above Ground Level',
  升降率: 'Vertical Speed',
  航向: 'Heading',
  俯仰角: 'Pitch',
  坡度: 'Bank',
  滚转角: 'Roll',
  '迎角 AoA': 'Angle of Attack',
  油门: 'Throttle',
  推力: 'Thrust',
  气动过载: 'Load Factor',
  '风 / 漂移': 'Wind / Drift',
  '正在查询起点地形，按离地高度初始化…':
    'Loading start terrain and initializing by AGL…',
  初始化失败: 'Initialization failed',
  '可点击下方按钮或按 R 重试。': 'Click the button below or press R to retry.',
  '已到达终点 · 本次飞行完成': 'Destination reached · flight complete',
  '点击下方按钮或按 R 重新开始。':
    'Click the button below or press R to restart.',
  重新开始: 'Restart',
  '耗时 ': 'Elapsed ',
  '· 航程 ': '· Distance ',
  分: 'm',
  起点经度: 'Start longitude',
  起点纬度: 'Start latitude',
  初始离地高度: 'Initial AGL',
  终点经度: 'Destination longitude',
  终点纬度: 'Destination latitude',
  终点到达半径: 'Arrival radius',
  高度曲线类型: 'Altitude chart type',
  '按省 / 市 / 区县快速定位': 'Search province / city / district',
  平均风速: 'Mean wind speed',
  阵风幅度: 'Gust amplitude',
  阵风周期: 'Gust period',
  晴空: 'Clear',
  '能见度良好，轻风': 'Good visibility, light wind',
  阴天: 'Overcast',
  '漫射光照，阴影变浅': 'Diffuse light, softer shadows',
  雷雨: 'Thunderstorm',
  '能见度低，强阵风': 'Low visibility, strong gusts',
  浓雾: 'Dense fog',
  '能见度很低，风较弱': 'Very low visibility, light wind',
  良好: 'Good',
  中等: 'Moderate',
  低: 'Low',
  很低: 'Very low',
  '距目标 ': 'Distance to target ',
  已选起点: 'Start selected',
  已选终点: 'Destination selected',
  秒: 's',
  米: 'm',
  度: 'deg',
  历史高度: 'Altitude History',
  前方地形: 'Terrain Ahead',
  起点地形查询中: 'Loading start terrain',
  '飞行已结束 · 预测停止': 'Flight ended · prediction stopped',
  '采样快照 · ': 'Terrain snapshot · ',
  秒前: 's ago',
  '数据已过期 · 等待更新': 'Data stale · waiting for update',
  '初始化失败 · 未记录': 'Initialization failed · not recorded',
  '已到达 · 记录结束': 'Arrived · recording stopped',
  '已触地 · 记录结束': 'Ground contact · recording stopped',
  已暂停: 'Paused',
  '地形未就绪 · 暂无离地数据': 'Terrain not ready · no AGL data',
  每秒采样: 'Sampling every second',
  缺测: 'Missing data',
  预测秒: 'Forecast seconds',
  '椭球高度(米)': 'Ellipsoid height (m)',
  地形: 'Terrain',
  '净空参考+100m': 'Clearance reference +100m',
  预计飞行轨迹: 'Projected flight path',
  '风险 ': 'Risk ',
  '离地高度 AGL (米)': 'AGL (m)',
  离地高度: 'AGL',
  '低空参考 100 m': 'Low altitude reference 100 m',
  重置: 'Reset',
  暂停: 'Pause',
  继续: 'Resume',
  触地: 'Ground contact',
  到达: 'Arrived',
  开始: 'Start',
  姿态仪: 'Attitude indicator',
  '俯仰 ': 'Pitch ',
  '· 坡度 ': ' · Roll ',
  已触地: 'Ground contact',
  失速警告: 'STALL WARNING',
  镜头模式: 'Camera mode',
  后上方跟随: 'Chase view',
  座舱视角: 'Cockpit view',
  自由观察: 'Free view',
  恢复默认机位: 'Reset camera',
  '飞行居中 · 拖动环绕 · 滚轮缩放 · 中键调整俯仰':
    'Aircraft centered · orbit drag · wheel zoom · middle drag pitch',
  '机头第一人称 · 无座舱内饰': 'Forward view · no cockpit interior',
  顶部真航向指南针: 'Top heading tape',
  真航向: 'Heading',
  目标范围内: 'Within target range',
  '目标 ': 'Target ',
  '目的地方位 ': 'Target bearing ',
  对准目标: 'On target',
  向左: 'Turn left',
  向右: 'Turn right',
  操作提示: 'Controls',
  '抬头 / 低头': 'Pitch up / down',
  '左 / 右压坡度': 'Bank left / right',
  '增加 / 减少油门': 'Increase / decrease throttle',
  '暂停 / 继续': 'Pause / resume',
  按已设起点重开: 'Restart from set origin',
  切换镜头视角: 'Switch camera',
  切换天气: 'Switch weather',
  空格: 'Space',
  飞行起终点: 'Flight route',
  起点: 'Start',
  终点: 'Destination',
  地图选起点: 'Pick start on map',
  取消选点: 'Cancel picking',
  地图选终点: 'Pick destination on map',
  '经度 ': 'Longitude ',
  '纬度 ': 'Latitude ',
  '初始离地高度 m': 'Initial AGL (m)',
  '终点到达半径 m': 'Arrival radius (m)',
  '已设航段 ': 'Planned leg ',
  ' · 距目标 ': ' · target ',
  当前位置作起点: 'Use current position as start',
  应用并重新开始: 'Apply and restart',
  '正在查询起点地形…': 'Loading start terrain…',
  查询起点地形中: 'Loading start terrain',
  '初始化失败，请重试': 'Initialization failed, retry',
  '已到达终点 · 飞行完成': 'Destination reached · flight complete',
  '已触地 · 飞行结束': 'GROUND CONTACT · FLIGHT ENDED',
  飞行暂停: 'Flight paused',
  飞行中: 'Flying',
  '前方地形：净空不足': 'Terrain ahead: insufficient clearance',
  '前方地形：本次采样净空充足': 'Terrain ahead: clearance sufficient',
  '前方地形：等待查询 / 数据不可用': 'Terrain ahead: waiting / unavailable',
  '模拟耗时 ': 'Elapsed ',
  航程: 'Distance',
  '到达只判定水平范围，不代表降落。地形预警为演示预测。':
    'Arrival is a horizontal-range check, not landing. Terrain warning is an estimate.',
  '已填入当前位置；高程未知，离地高度保留原设置。':
    'Current position filled; AGL retained because terrain is unknown.',
  '已填入当前位置和离地高度，点击应用后生效。':
    'Current position and AGL filled; apply to use them.',
  '修改后点击应用，重置航迹与飞行状态。':
    'Apply changes to reset flight and track.',
  '请完整填写起终点坐标和初始高度。':
    'Please fill in route coordinates and initial AGL.',
  '已应用配置，正在查询起点高程。失败可按 R 或重新应用重试。':
    'Configuration applied; loading terrain. Press R or apply again on failure.',
  已选: 'Selected ',
  '，点击应用后生效；初始高度保持不变。':
    '; click apply; initial altitude unchanged.',
  '请在弹窗地图中选点并确认，Esc 可取消。':
    'Pick a point in the map dialog and confirm; Esc cancels.',
  '已取消选点，草稿未更改。': 'Point picking cancelled; draft unchanged.',
  '高度不是离地高度，请避开山体；终点仅作标记，不自动驾驶或降落。':
    'Altitude is not AGL; avoid terrain. Destination is a marker only; no autopilot or landing.',
  飞行任务统计: 'Mission statistics',
  天气与风场: 'Weather & wind',
  天气预设: 'Weather preset',
  '能见度 ': 'Visibility ',
  '只影响画面与风场，不改变气动力。':
    'Affects visuals and wind only; aerodynamics unchanged.',
  风场状态: 'Wind state',
  启用风场: 'Wind enabled',
  关闭风场: 'Wind disabled',
  '风向（来向）': 'Wind from',
  当前风速: 'Current wind speed',
  '来向 °': 'From °',
  '平均风速 m/s': 'Mean wind m/s',
  '阵风幅度 m/s': 'Gust amplitude m/s',
  '阵风周期 s': 'Gust period s',
  '北风 · 000°': 'North wind · 000°',
  '东北风 · 045°': 'NE wind · 045°',
  '东风 · 090°': 'East wind · 090°',
  '东南风 · 135°': 'SE wind · 135°',
  '南风 · 180°': 'South wind · 180°',
  '西南风 · 225°': 'SW wind · 225°',
  '西风 · 270°': 'West wind · 270°',
  '西北风 · 315°': 'NW wind · 315°',
  '风只改变地速与航迹，不改变真空速和气动力。稳定风叠加双正弦阵风，':
    'Wind affects ground speed and track, not airspeed or aerodynamics. Stable wind plus sinusoidal gusts;',
  '属演示模型，不是真实气象数据。':
    'demonstration model, not real weather data.',
  跟随飞机: 'Follow aircraft',
  航向朝上: 'Heading up',
  待加载: 'Loading',
  选择: 'Select',
  '目标终点（手动飞行）': 'Destination (manual flight)',
  飞行起点: 'Flight origin',
  请点击地图选择位置: 'Click the map to select a position',
  确认选点: 'Confirm point',
  取消: 'Cancel',
  地图选择: 'Select on map',
  '起点地形 ': 'Start terrain ',
  '米，已按离地高度开始飞行。': ' m; initialized with AGL.',
  '地形高程未就绪 · 暂不能判定触地':
    'Terrain unavailable · contact check disabled',
  迎角失速: 'STALL',
  离地高度过低: 'LOW AGL',
  快速下沉: 'RAPID DESCENT',
  前方地形风险: 'TERRAIN AHEAD',
  '降低机头减小迎角，适当增加油门，避免急转弯。':
    'Lower the nose, reduce AoA, add throttle, avoid sharp turns.',
  '注意前方地形并留出爬升余量。': 'Watch terrain ahead and keep climb margin.',
  '检查姿态、空速及离地高度。': 'Check attitude, airspeed and AGL.',
}

const messages = {
  brand: 'UavPilot',
  language: 'English',
  github: '打开 GitHub',
} as const

export function useI18n() {
  const locale = computed(() => localeState.locale)
  const t = (key: string) =>
    localeState.locale === 'zh-CN' ? key : translations[key] ?? key
  const message = (key: keyof typeof messages) => t(messages[key])
  const toggleLocale = () => {
    localeState.locale = localeState.locale === 'zh-CN' ? 'en-US' : 'zh-CN'
    if (typeof localStorage !== 'undefined')
      localStorage.setItem(STORAGE_KEY, localeState.locale)
    if (typeof document !== 'undefined')
      if (typeof document !== 'undefined')
        document.documentElement.lang = localeState.locale
  }

  return { locale, t, message, toggleLocale }
}

if (typeof document !== 'undefined')
  document.documentElement.lang = localeState.locale
