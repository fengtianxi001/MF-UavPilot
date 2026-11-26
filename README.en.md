# MF-UavPilot

[简体中文](./README.md) | **English**

A fixed-wing UAV flight monitoring and simulation interface built with Vue 3, Cesium, and TypeScript.

The project uses a 3D globe as its stage, combining aircraft attitude, flight parameters, mission routes, terrain alerts, weather, and wind data into a single cockpit-style interface. It is suited to flight simulation demos, instrument UI prototypes, and Cesium front-end capability validation.

> **Live demo**: <https://mf-uav-monitor.vercel.app/#/home>
>
> **GitHub Pages**: <https://fengtianxi001.github.io/MF-UavMonitor/>
>
> The first load pulls the Cesium runtime, aircraft model, and map tiles, so it may take a while. If loading stalls, check your network connection and refresh the page.

| Preview | Preview |
| :---: | :---: |
| ![MF-UavPilot preview 1](./screenshots/screenshot01.png) | ![MF-UavPilot preview 2](./screenshots/screenshot02.png) |

## Feature Overview

| Area | Capabilities |
| --- | --- |
| 3D scene | Satellite imagery, real terrain, dynamic sky, sun lighting, and aircraft model |
| Flight simulation | Pitch, bank, throttle, vertical speed, airspeed, and heading control |
| Instrument monitoring | Attitude, heading, altitude, airspeed, angle of attack, load factor, and aerodynamic values |
| Mission planning | Start, destination, waypoints, arrival radius, and flight statistics |
| Safety alerts | Stall, terrain clearance ahead, rapid descent, and ground contact |
| Environment | Weather display and wind data |
| Camera modes | Chase, cockpit, and free-look |
| Data visualization | Flight curves and parameter trends powered by ECharts |

## Getting Started

### Requirements

- Node.js 18 or later
- Yarn
- Network access to the map, terrain, and Cesium resources

### Install dependencies

```bash
yarn install
```

### Start the development server

```bash
yarn dev
```

Open the URL printed in the terminal. The default route is `/home`.

### Build and preview

```bash
yarn build
yarn preview
```

## Deployment

Pushing to `master` triggers GitHub Actions to build and publish to GitHub Pages:

<https://fengtianxi001.github.io/MF-UavMonitor/>

Build output is never committed. The workflow injects `BASE_PATH=/MF-UavMonitor/` for the project-page subpath, while local builds keep the relative `./` base.

To publish manually, run the `Deploy to GitHub Pages` workflow from the Actions tab. The repository's Settings → Pages must use **GitHub Actions** as the source.

## Features

### 3D flight scene

The main view is built on a Cesium 3D globe, combining satellite imagery, terrain data, sky environment, lighting, and the aircraft model. The aircraft updates in real time with position, altitude, heading, pitch, and roll, while the map tracks the current flight area and mission route.

Scene time, sun lighting, and environmental effects update with the flight state. The default configuration favors visibility during demos. Imagery and terrain require a network connection, and the actual result depends on the coverage and availability of the data services.

### Fixed-wing flight simulation

The project provides a fixed-wing model intended for interface demos. The keyboard controls the basic attitude and power state:

- Pitch affects the flight path and speed: climbing consumes airspeed, diving accelerates.
- Bank changes the turn direction; steep turns lose altitude.
- Throttle responds gradually, and releasing the key holds the current setting instead of jumping airspeed.
- Releasing the controls lets the attitude return to level flight gradually with inertia.
- Control authority weakens at low speed, and exceeding the critical angle of attack shows a stall warning.
- The simulation uses a fixed time step to keep speed and trajectory consistent across frame rates.

This model is for interaction demos and functional validation, not a full flight controller, flight-training tool, or engineering-grade aerodynamic simulation.

### Instruments and parameter monitoring

Flight state is split across several panels to make changes easy to observe:

- **Attitude indicator**: pitch, roll, and current attitude changes.
- **Heading and compass**: heading angle with north at 0°, increasing clockwise.
- **Altitude panel**: current altitude, height above ground, and vertical trend.
- **Flight parameters**: airspeed, ground speed, throttle, vertical speed, angle of attack, and load factor.
- **Aerodynamics**: air density, lift, drag, and thrust.
- **Flight curves**: record altitude, speed, or other key parameters, and keep the result state after the flight ends.
- **Alerts panel**: stall, insufficient terrain clearance, ground contact, destination reached, and unavailable data.

### Mission planning and route management

The mission panel configures the start point, destination, and flight parameters for a run, including initial height above ground, arrival radius, and waypoints, and shows the mission area and route on the map.

- Start and destination support longitude/latitude configuration.
- Waypoints are shown with map markers and connecting lines for route inspection.
- Arrival uses horizontal distance, with a default radius of 100 m adjustable from 25 m to 1000 m.
- Entering the destination range ends the simulation and shows the arrival result.
- The panel records elapsed simulation time and horizontal distance; paused, terrain-query, and background time is excluded.
- Restarting resets the flight state, statistics, and altitude curve.

Reaching the destination means entering the configured range, not landing. If ground contact and arrival occur in the same physics step, ground contact takes precedence. Press `R` after the simulation ends to restart.

### Safety alerts

Alerts are computed from the raw physics state without instrument smoothing, so they surface risk earlier than the gauges:

- **Terrain ahead**: predicts the path roughly 2 to 20 seconds ahead from current heading, airspeed, and vertical speed, and warns when clearance drops below 100 m.
- **Low altitude**: warns when altitude is below 100 m.
- **Rapid descent**: warns when vertical speed is below -8 m/s.
- **Stall**: warns beyond the critical angle of attack; lower the nose, reduce AoA, and add throttle.
- **Ground contact**: ends the flight and stops model animation as soon as the terrain probe touches the ground.

Terrain prediction uses discrete centerline sampling. Failed queries, stale samples, or sharp turns show an unknown state.

### Controls

Shortcuts are ignored inside input fields. When the window or tab loses focus, the app clears held keys instead of catching up on background time.

| Key | Action |
| --- | --- |
| `W` / `S` | Pitch up / pitch down |
| `A` / `D` | Bank left / bank right |
| `Q` / `E` | Increase / decrease throttle |
| `P` | Pause / resume simulation |
| `R` | Re-query terrain with the current configuration and restart |

### Camera modes

- **Chase**: follows from behind and above, with a default distance of 28 m and a 45° depression angle, rotating with heading but not roll; the default position can be restored.
- **Cockpit**: an approximate nose-first view that follows heading, pitch, and roll and hides the aircraft model; there is no cockpit interior yet.
- **Free look**: keeps the aircraft centered and allows mouse orbit, wheel zoom, and middle-drag adjustment without pausing the flight.

## Flight Model

The simulation integrates forces for a three-degree-of-freedom point mass with assisted attitude control. It is not a full six-degree-of-freedom rigid body model:

- ISA air density is estimated from altitude, and dynamic pressure is $q = 0.5\rho V^2$.
- Angle of attack is derived from pitch, wing incidence, and flight path angle.
- Lift, drag, thrust, and gravity drive speed and trajectory changes.
- Throttle includes engine lag, and thrust decreases as air density drops.
- Releasing the controls returns the attitude toward level gradually rather than instantly.
- Control authority weakens at low speed, and exceeding the critical angle of attack shows a stall warning.

The main aerodynamic parameters live in [`src/hooks/aerodynamics.ts`](./src/hooks/aerodynamics.ts). They are demo assumptions, not measurements of any real UAV, and are not suitable for real flight control, training, or safety decisions.

## Terrain and Map Configuration

The default setup uses public Cesium/Mars3D sample terrain and Esri World Imagery. Imagery and terrain require a network connection; availability, coverage, and usage limits follow the service provider's terms.

Create or edit `.env.local` in the project root, then restart the dev server:

```dotenv
# Custom Cesium terrain service; must provide a Cesium-compatible layer.json and tiles
VITE_CESIUM_TERRAIN_URL=https://example.com/terrain/

# Fallback to Cesium ion World Terrain when no custom terrain is set
VITE_CESIUM_ION_TOKEN=your-client-token
```

Terrain selection order:

1. `VITE_CESIUM_TERRAIN_URL`
2. `VITE_CESIUM_ION_TOKEN`
3. The built-in public sample terrain

If real terrain fails to initialize, the app falls back to an ellipsoid surface with no real mountain relief. Refresh the page once the service recovers.

> `VITE_` variables are compiled into the browser bundle. Use only restricted client tokens and never place admin, write, or other sensitive keys there.
>
> When using Esri imagery and other public map services, keep the attribution and follow their terms. Public access does not mean unlimited calls, bulk downloads, or unrestricted commercial use are permitted.

## Known Limitations

- The flight model is a simplified teaching and demo model. It omits full inertia tensors, control-surface moments, sideslip, real propeller behavior, landing gear, and complex collision shapes.
- Terrain alerts use discrete centerline sampling and cannot cover lateral corridors, buildings, trees, or all narrow peaks.
- Ground contact uses terrain elevation and an aircraft-model probe; it is not real collision detection or landing judgment.
- Altitude is based on the ellipsoid, not strict height above ground; mountain flights need their own safety margin.
- Public map and terrain services may throttle, fail, or have limited coverage, so they are not recommended as the only production data source.

## License and Data Services

Code, models, screenshots, map imagery, and terrain data in this project may be subject to different licenses. Before redistributing or deploying, verify the licenses and terms for the project dependencies, model assets, and map/terrain services separately.
