# MF-UavPilot

**简体中文** | [English](./README.en.md)

> 一个基于 Cesium 的固定翼无人机飞行监视与模拟界面

> 服务地址 :<https://fengtianxi001.github.io/MF-UavPilot/#/home>

<h1>
  <img src="https://github.com/fengtianxi001/MF-UavPilot/blob/master/screenshots/screenshot01.png?raw=true" title="screenshot">
</h1>

<h1>
  <img src="https://github.com/fengtianxi001/MF-UavPilot/blob/master/screenshots/screenshot02.png?raw=true" title="screenshot">
</h1>

## 更新日志

##### v3.0.1

- [x] 接入 Cesium 三维地球,加载 ArcGIS 卫星影像与真实地形
- [x] 地形服务不可用时自动回退椭球地形
- [x] 配置太阳光照、动态大气与软阴影,并按位置时间初始化日照
- [x] 加载 glb 无人机模型,按真实翼展定标并随油门驱动螺旋桨旋转
- [x] 实现固定翼飞行模型:升力、阻力、推力、重力与 ISA 大气密度
- [x] 加入油门响应滞后、姿态惯性回中、低速操纵衰减与迎角失速
- [x] 支持抬头、压坡度、油门、暂停与重开的键盘操控
- [x] 新增姿态仪与顶部真航向指南针,带目标方位标记
- [x] 新增飞行参数面板:空速、地速、离地高度、升降率、迎角与过载等
- [x] 新增 ECharts 高度曲线,支持历史高度与前方地形两种视图
- [x] 新增 Leaflet 二维地图,支持跟随飞机、航向朝上与航迹绘制
- [x] 新增飞行起终点规划,支持经纬度输入与地图选点
- [x] 选点弹窗支持按省 / 市 / 区县快速定位
- [x] 新增初始离地高度、到达半径、航段距离与剩余距离统计
- [x] 新增到达终点判定与重新开始流程
- [x] 新增飞行告警:前方地形风险、低空、快速下降、失速与触地
- [x] 新增前方地形采样预测与地形探针触地检测
- [x] 新增晴空、阴天、雷雨、浓雾四套天气预设
- [x] 新增雨幕与雾幕图层,以及稳定风叠加阵风的风场
- [x] 新增后上方跟随、座舱与自由观察三种视角
- [x] 新增中英文切换与大屏自适应缩放
