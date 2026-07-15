// The ECharts runtime is CDN-injected at load time (see render.ts), exposed as the global
// `echarts`. This ambient declaration types that global so render.ts can call echarts.init/etc
// without a value import (which would pull ECharts into the bundle). Type-only imports of
// 'echarts' in pure modules are erased at build and do not create a runtime dependency.
declare const echarts: typeof import('echarts')
