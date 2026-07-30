/**
 * 预编译 UI 组件脚本
 *
 * 读取 ui-components 目录下所有 JSX 组件源码，
 * 使用 @babel/standalone 编译为纯 JS，
 * 输出 ui-components-precompiled.json 缓存文件。
 *
 * 运行: node scripts/precompile-components.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ─── 路径解析 ───────────────────────────────────────────

const UI_COMPONENTS_DIR = join(ROOT, 'src/main/tools/Design/ui-components')
const CATALOG_PATH = join(ROOT, 'src/renderer/src/components/design/ui-components-catalog.json')
const OUTPUT_PATH = join(ROOT, 'src/renderer/src/components/design/ui-components-precompiled.json')

// ─── Babel 编译 ────────────────────────────────────────

// @babel/standalone 在 Node.js 中的 ESM 加载方式
let babelTransform = null

async function getBabelTransform() {
  if (babelTransform) return babelTransform
  const mod = await import('@babel/standalone')
  babelTransform = mod.transform
  return babelTransform
}

// ─── 依赖检测 (与 DesignPreviewPanel.tsx 保持一致) ──────

function detectDependencies(code) {
  return {
    motion: /from\s+['"]motion\/react['"]/.test(code) || /from\s+['"]framer-motion['"]/.test(code),
    gsap: /from\s+['"]gsap['"]/.test(code) || /from\s+['"]gsap\//.test(code),
    gsapScrollTrigger: /from\s+['"]gsap\/ScrollTrigger['"]/.test(code),
    gsapSplitText: /from\s+['"]gsap\/SplitText['"]/.test(code),
    gsapScrambleText: /from\s+['"]gsap\/ScrambleTextPlugin['"]/.test(code),
    gsapReact: /from\s+['"]@gsap\/react['"]/.test(code),
    gsapDraggable: /from\s+['"]gsap\/Draggable['"]/.test(code),
    gsapInertiaPlugin: /from\s+['"]gsap\/InertiaPlugin['"]/.test(code),
    ogl: /from\s+['"]ogl['"]/.test(code),
    three: /from\s+['"]three['"]/.test(code) || /from\s+['"]three\/examples/.test(code) || /from\s+['"]three\/src/.test(code),
    r3f: /from\s+['"]@react-three\/fiber['"]/.test(code),
    drei: /from\s+['"]@react-three\/drei['"]/.test(code),
    postprocessing: /from\s+['"]postprocessing['"]/.test(code) || /from\s+['"]@react-three\/postprocessing['"]/.test(code),
    matter: /from\s+['"]matter-js['"]/.test(code),
    reactIcons: /from\s+['"]react-icons/.test(code),
    lucide: /from\s+['"]lucide-react['"]/.test(code),
    reactRouter: /from\s+['"]react-router-dom['"]/.test(code),
    faceApi: /from\s+['"]face-api.js['"]/.test(code),
    chakra: /from\s+['"]@chakra-ui\/react['"]/.test(code),
    useGesture: /from\s+['"]@use-gesture\/react['"]/.test(code),
    maath: /from\s+['"]maath['"]/.test(code),
    glMatrix: /from\s+['"]gl-matrix['"]/.test(code),
    meshline: /from\s+['"]meshline['"]/.test(code),
    rapier: /from\s+['"]@react-three\/rapier['"]/.test(code),
    lenis: /from\s+['"]lenis['"]/.test(code),
  }
}

// ─── 剥离 ES Module 语法 ───────────────────────────────

function stripEsModuleSyntax(code) {
  return code
    .replace(/^\s*['"]use client['"];?\s*\n?/gm, '')
    .replace(/import\s+\*\s+as\s+\w+\s+from\s+['"][^'"]+['"];?\n?/g, '')
    .replace(/import\s+[^;]*?from\s+['"][^'"]+['"];?\n?/g, '')
    .replace(/import\s+['"][^'"]+['"];?\n?/g, '')
    .replace(/export\s+default\s+/g, '')
    .replace(/export\s+(const|let|var|function|class)\s/g, '$1 ')
    .replace(/export\s+default\s+\w+;?\n?/g, '')
}

// ─── 构建全局变量声明 ──────────────────────────────────
// 传入 strippedCode 以检测组件内已定义的变量名,避免 const 重复声明冲突

function buildGlobalDecls(deps, strippedCode) {
  // 检测组件代码中已定义的变量名（const/let/var/function/class）
  const definedInCode = new Set()
  const re = /\b(?:const|let|var|function|class)\s+(\w+)/g
  let m
  while ((m = re.exec(strippedCode))) {
    definedInCode.add(m[1])
  }

  const decls = [
    'const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect, useId, forwardRef, useImperativeHandle, createElement, Children, cloneElement, memo, StrictMode, Fragment, Suspense, createContext, useContext, useReducer, useDebugValue, useDeferredValue, useTransition, useSyncExternalStore } = React;',
    // 占位图 data URI 全局常量
    PH_IMG_DECL,
    // react-icons 全局 stub
    'const __IconStub = (p) => React.createElement("span", {...p, style:{display:"inline-block",width:"1em",height:"1em",fontSize:"inherit",verticalAlign:"middle"}});',
    'const __RI = new Proxy({}, { get: () => __IconStub });',
    'const GoArrowUpRight = __IconStub; const FiChevronLeft = __IconStub; const FiChevronRight = __IconStub; const RiSliderHorizontalLine = __IconStub;',
    // lucide-react 全局 stub
    'const __LI = new Proxy({}, { get: () => __IconStub });',
    'const Fingerprint = __IconStub; const Activity = __IconStub; const Lock = __IconStub;',
  ]

  if (deps.motion) {
    // 仅解构组件代码中未自行定义的 motion 导出
    const motionExports = ['motion', 'AnimatePresence', 'useMotionValue', 'useSpring', 'useTransform', 'useAnimationFrame', 'useInView', 'useAnimation', 'useScroll', 'useMotionValueEvent', 'useVelocity', 'useReducedMotion']
    const available = motionExports.filter(e => !definedInCode.has(e))
    if (available.length > 0) {
      decls.push(`const _M = window.Motion || window.FramerMotion || {};
    const { ${available.join(', ')} } = _M;`)
    }
  }

  if (deps.gsap) {
    if (!definedInCode.has('gsap')) decls.push('const gsap = window.gsap;')
    if (deps.gsapScrollTrigger && !definedInCode.has('ScrollTrigger')) {
      decls.push('const ScrollTrigger = window.ScrollTrigger; if (window.gsap && window.ScrollTrigger) { window.gsap.registerPlugin(window.ScrollTrigger); }')
    }
    if (deps.gsapSplitText && !definedInCode.has('SplitText')) {
      decls.push(`class SplitText { constructor(el, opts) { this.el = el; this.lines = [el]; this.words = [el]; this.chars = el ? Array.from(el.textContent || '') : []; } revert() {} }`)
    }
    if (deps.gsapScrambleText && !definedInCode.has('ScrambleTextPlugin')) {
      decls.push('const ScrambleTextPlugin = {}; if (window.gsap) { window.gsap.registerPlugin({}); }')
    }
    if (!definedInCode.has('Draggable')) decls.push(`const Draggable = window.Draggable || class Draggable { constructor() {} static create() { return []; } };`)
    if (!definedInCode.has('InertiaPlugin')) decls.push('const InertiaPlugin = window.InertiaPlugin || {};')
  }

  if (deps.gsapReact && !definedInCode.has('useGSAP')) {
    decls.push(`const useGSAP = (callback, deps) => { React.useEffect(() => { if (window.gsap) { const ctx = window.gsap.context(callback); return () => ctx.revert(); } callback(); }, deps || []); };`)
  }

  // ogl 解构在 ESM prefix 中完成,此处不再重复

  if (deps.three) {
    if (!definedInCode.has('THREE')) decls.push('const THREE = window.THREE;')
    // Three.js 命名导入 — 仅解构组件中未自行定义的
    const threeNames = ['WebGLRenderer','Scene','OrthographicCamera','Color','BufferGeometry','Float32BufferAttribute','Points','PointsMaterial','Line','LineBasicMaterial','Group','Object3D','Vector2','Vector3','Vector4','Matrix4','Quaternion','Raycaster','PlaneGeometry','SphereGeometry','BoxGeometry','CylinderGeometry','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','Mesh','ShaderMaterial','TextureLoader','Texture','CanvasTexture','DataTexture','AdditiveBlending','DoubleSide','FrontSide','BackSide','RepeatWrapping','ClampToEdgeWrapping','RGBAFormat','FloatType','UnsignedByteType','Uniform','UniformsUtils','Clock','Fog','FogExp2','AmbientLight','DirectionalLight','PointLight','SpotLight','RectAreaLight','HemisphereLight','MeshPhysicalMaterial','PCFSoftShadowMap','sRGBEncoding','LinearEncoding','NoToneMapping','ACESFilmicToneMapping']
    const availThree = threeNames.filter(n => !definedInCode.has(n))
    if (availThree.length > 0) {
      decls.push(`const { ${availThree.join(', ')} } = THREE;`)
    }
  }

  if (deps.r3f) {
    decls.push('const R3F = window.ReactThreeFiber || {};')
    const r3fNames = ['Canvas','useFrame','useThree','useLoader','invalidate','extend']
    const availR3f = r3fNames.filter(n => !definedInCode.has(n))
    if (availR3f.length > 0) {
      decls.push(`const { ${availR3f.join(', ')} } = R3F;`)
    }
  }

  if (deps.drei) {
    decls.push('const Drei = window.Drei || {};')
    const dreiNames = ['OrbitControls','useGLTF','useFBX','useProgress','Html','Environment','ContactShadows','Float','Text','MeshDistortMaterial','MeshWobbleMaterial','shaderMaterial','useTrailTexture','PerspectiveCamera','Lightformer','Sphere','Box','Center']
    const availDrei = dreiNames.filter(n => !definedInCode.has(n))
    if (availDrei.length > 0) {
      decls.push(`const { ${availDrei.join(', ')} } = Drei;`)
    }
  }

  if (deps.matter) {
    if (!definedInCode.has('Matter')) decls.push(`const Matter = window.Matter || {};`)
    const matterNames = ['Engine','Render','Runner','World','Bodies','Body','Composite','Mouse','MouseConstraint','Events','Constraint','Vertices','Bounds','Common','Sleeping','Plugin','Vector']
    const availMatter = matterNames.filter(n => !definedInCode.has(n))
    if (availMatter.length > 0) {
      decls.push(`const { ${availMatter.join(', ')} } = Matter;`)
    }
  }

  if (deps.reactRouter && !definedInCode.has('Link')) {
    decls.push('const Link = (p) => React.createElement("a", p);')
  }

  if (deps.chakra) {
    decls.push('const ChakraUI = new Proxy({}, { get: () => (p) => React.createElement("div", p) });')
  }

  if (deps.useGesture) {
    decls.push('const useGesture = { useDrag: () => [{}], usePinch: () => [{}], useScroll: () => [{}] };')
  }

  if (deps.maath) {
    decls.push('const maath = {};')
  }

  if (deps.glMatrix) {
    decls.push('const glMatrix = {};')
  }

  if (deps.meshline) {
    decls.push('const MeshLine = (p) => React.createElement("mesh", p);')
  }

  if (deps.rapier) {
    decls.push('const Rapier = {};')
  }

  if (deps.lenis) {
    decls.push('const Lenis = class { constructor() {} destroy() {} };')
  }

  if (deps.faceApi) {
    decls.push('const faceapi = {};')
  }

  if (deps.postprocessing) {
    decls.push('const PostProcessing = window.postprocessing || {};')
  }

  return decls
}

// ─── 构建 CDN 脚本标签 ──────────────────────────────────

function buildCdnScripts(deps) {
  const scripts = []
  if (deps.motion) {
    scripts.push('https://cdn.jsdelivr.net/npm/framer-motion@11/dist/framer-motion.js')
  }
  if (deps.gsap) {
    scripts.push('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js')
  }
  if (deps.gsapScrollTrigger) {
    scripts.push('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js')
  }
  if (deps.three || deps.r3f || deps.drei) {
    scripts.push('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')
  }
  // R3F / drei / postprocessing 没有UMD包,改用esm.sh ESM加载(见DesignPreviewPanel)
  if (deps.matter) {
    scripts.push('https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js')
  }
  return scripts
}

// ─── Demo 渲染逻辑 (从 DesignTemplatePanel.tsx 移植) ─────

// PH_IMG 作为全局常量在 iframe 中定义,避免在 JSX 中内联 data URI
const PH_IMG_CONST = '__PH_IMG__'
// 全局声明中添加 PH_IMG 常量
const PH_IMG_DECL = `const __PH_IMG__ = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23cbd5e1'/%3E%3C/svg%3E";`

function generateDemoProps(comp) {
  const { id, props } = comp
  const has = (p) => props.includes(p)
  if (has('images')) return `images={[${PH_IMG_CONST},${PH_IMG_CONST},${PH_IMG_CONST},${PH_IMG_CONST}]}`
  if (has('items')) {
    switch (id) {
      case 'GooeyNav': case 'LineSidebar': return `items={['Home','About','Work','Contact']}`
      case 'FlowingMenu': return `items={[{text:'Home',href:'#'},{text:'About',href:'#'},{text:'Work',href:'#'}]}`
      case 'ChromaGrid': return `items={[{image:${PH_IMG_CONST},title:'Alex',subtitle:'Developer',handle:'@alex',borderColor:'#4F46E5',gradient:'linear-gradient(145deg,#4F46E5,#000)',url:'#'}]}`
      case 'Masonry': return `items={[{image:${PH_IMG_CONST},title:'Item 1'},{image:${PH_IMG_CONST},title:'Item 2'},{image:${PH_IMG_CONST},title:'Item 3'}]}`
      case 'CircularGallery': case 'FlyingPosters': return `items={[{image:${PH_IMG_CONST},title:'A'},{image:${PH_IMG_CONST},title:'B'},{image:${PH_IMG_CONST},title:'C'}]}`
      case 'GlassIcons': return `items={[{icon:'★',label:'Star'},{icon:'♥',label:'Heart'},{icon:'✓',label:'Check'}]}`
      case 'InfiniteMenu': return `items={[{label:'Home'},{label:'About'},{label:'Work'}]}`
      case 'BubbleMenu': case 'CardNav': case 'PillNav': case 'StaggeredMenu': return `items={[{label:'Home',href:'#'},{label:'About',href:'#'},{label:'Work',href:'#'}]}`
      case 'ImageTrail': return `items={[${PH_IMG_CONST},${PH_IMG_CONST},${PH_IMG_CONST}]}`
      default: return `items={['Item 1','Item 2','Item 3']}`
    }
  }
  return ''
}

function generateDemoJsx(comp, componentName) {
  const { category, id, props } = comp
  const has = (p) => props.includes(p)
  const ep = generateDemoProps(comp)
  const wrapStyle = category === 'Backgrounds' ? "{{position:'fixed',inset:0}}" : "{{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',padding:'40px'}}"

  if (category === 'TextAnimations') {
    if (has('text')) return `ReactDOM.createRoot(document.getElementById('root')).render(<div style=${wrapStyle}><${componentName} text="Hello World" /></div>);`
    if (has('to') && has('from')) return `ReactDOM.createRoot(document.getElementById('root')).render(<div style=${wrapStyle}><${componentName} to={1000} from={0} duration={3} /></div>);`
    if (has('children')) return `ReactDOM.createRoot(document.getElementById('root')).render(<div style=${wrapStyle}><${componentName}>Hello World</${componentName}></div>);`
    return `ReactDOM.createRoot(document.getElementById('root')).render(<div style=${wrapStyle}><${componentName} /></div>);`
  }

  if (has('imageSrc')) return `ReactDOM.createRoot(document.getElementById('root')).render(<div style=${wrapStyle}><${componentName} imageSrc={__PH_IMG__} captionText="${comp.nameCn}" /></div>);`
  if (has('children')) {
    if (id === 'Dock') return `ReactDOM.createRoot(document.getElementById('root')).render(<div style=${wrapStyle}><${componentName} items={[{icon:'🏠',label:'Home'},{icon:'🔍',label:'Search'},{icon:'⚙️',label:'Settings'},{icon:'📁',label:'Files'}]} /></div>);`
    return `ReactDOM.createRoot(document.getElementById('root')).render(<div style=${wrapStyle}><${componentName}><div style={{padding:'20px 40px',color:'#fff',fontSize:'18px'}}>Click Me</div></${componentName}></div>);`
  }

  return `ReactDOM.createRoot(document.getElementById('root')).render(<div style=${wrapStyle}><${componentName} ${ep} /></div>);`
}

// ─── 主流程 ─────────────────────────────────────────────

async function main() {
  console.log('🔍 预编译 UI 组件...')
  console.log(`   组件目录: ${UI_COMPONENTS_DIR}`)
  console.log(`   输出路径: ${OUTPUT_PATH}`)

  const babel = await getBabelTransform()
  if (!babel) {
    console.error('❌ 无法加载 @babel/standalone')
    process.exit(1)
  }

  // 读取目录
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')).components || []
  const result = {}
  let successCount = 0
  let errorCount = 0

  for (const comp of catalog) {
    const { id, category } = comp
    const compDir = join(UI_COMPONENTS_DIR, category, id)
    const jsxPath = join(compDir, `${id}.jsx`)
    const cssPath = join(compDir, `${id}.css`)

    if (!existsSync(jsxPath)) {
      console.log(`  ⚠️  ${id}: JSX 文件不存在,跳过`)
      result[id] = { error: 'JSX not found' }
      errorCount++
      continue
    }

    try {
      const jsxSource = readFileSync(jsxPath, 'utf8')
      const cssSource = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : null

      // 剥离 import/export
      const strippedCode = stripEsModuleSyntax(jsxSource)

      // 检测依赖
      const deps = detectDependencies(jsxSource)
      const cdnScripts = buildCdnScripts(deps)
      const globalDecls = buildGlobalDecls(deps, strippedCode)

      // 提取组件名
      const componentName = (jsxSource.match(/export\s+default\s+function\s+(\w+)/) ||
        jsxSource.match(/export\s+default\s+(\w+)/) ||
        jsxSource.match(/export\s+const\s+(\w+)\s*=/) ||
        jsxSource.match(/const\s+(\w+)\s*=\s*\(/) ||
        jsxSource.match(/function\s+(\w+)\s*\(/))?.[1] || id

      // 检测是否自带 render 调用
      const hasRenderCall = /ReactDOM\.createRoot\s*\(/.test(jsxSource)

      // 生成 demo 渲染调用（根据组件分类和 props 自动生成 demo 数据）
      const demoRender = hasRenderCall ? '' : generateDemoJsx(comp, componentName)

      // 组合完整源码
      const fullSource = `${globalDecls.join('\n')}\n${strippedCode}\n${demoRender}`

      // Babel 编译
      const compiled = babel(fullSource, {
        presets: ['react'],
        filename: `${id}.jsx`,
      })

      result[id] = {
        js: compiled.code || '',
        css: cssSource || null,
        deps,
        cdnScripts,
        componentName,
        isModule: deps.ogl || deps.r3f || deps.drei || deps.postprocessing, // 需要 ESM 动态导入的包
      }
      successCount++
      console.log(`  ✅ ${id} → ${deps.ogl ? 'ESM' : 'script'}${Object.values(deps).some(Boolean) ? ' [' + Object.entries(deps).filter(([,v]) => v).map(([k]) => k).join(',') + ']' : ''}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result[id] = { error: msg }
      errorCount++
      console.log(`  ❌ ${id}: ${msg.slice(0, 120)}`)
    }
  }

  // 写入缓存
  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 0), 'utf8')

  const fileSize = (Buffer.byteLength(JSON.stringify(result)) / 1024).toFixed(0)
  console.log(`\n✨ 预编译完成: ${successCount} 成功, ${errorCount} 失败`)
  console.log(`   缓存文件: ${OUTPUT_PATH} (${fileSize} KB)`)
}

main().catch(err => {
  console.error('预编译失败:', err)
  process.exit(1)
})
