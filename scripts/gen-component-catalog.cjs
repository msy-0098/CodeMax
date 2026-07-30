/**
 * 扫描 src/main/tools/Design/ui-components/ 目录，
 * 为每个组件提取元数据（名称、分类、依赖、文件列表），
 * 生成 ui-components-catalog.json。
 */
const fs = require('fs')
const path = require('path')

const BASE = path.resolve(__dirname, '../src/main/tools/Design/ui-components')

// 中文名称映射
const CN_NAMES = {
  // Components
  'AnimatedList': '动画列表', 'BorderGlow': '边框发光', 'BounceCards': '弹跳卡片',
  'BubbleMenu': '气泡菜单', 'CardNav': '卡片导航', 'CardSwap': '卡片交换',
  'Carousel': '轮播', 'ChromaGrid': '色度网格', 'CircularGallery': '环形画廊',
  'Counter': '计数器', 'CurvedInput': '弯曲输入框', 'DecayCard': '衰变卡片',
  'Dock': '扩展坞', 'DomeGallery': '穹顶画廊', 'ElasticSlider': '弹性滑块',
  'FlowingMenu': '流动菜单', 'FluidGlass': '流动玻璃', 'FlyingPosters': '飞行海报',
  'Folder': '文件夹', 'GlassIcons': '玻璃图标', 'GlassSurface': '玻璃表面',
  'GooeyNav': '粘性导航', 'InfiniteMenu': '无限菜单', 'Lanyard': '挂绳',
  'LineSidebar': '线条侧边栏', 'MagicBento': '魔法便当', 'Masonry': '瀑布流',
  'ModelViewer': '3D 模型查看器', 'OptionWheel': '选项轮', 'PillNav': '药丸导航',
  'PixelCard': '像素卡片', 'ProfileCard': '个人资料卡', 'ReflectiveCard': '反射卡片',
  'ScrollStack': '滚动堆叠', 'SpecularButton': '高光按钮', 'SpotlightCard': '聚光灯卡片',
  'Stack': '堆叠卡片', 'StaggeredMenu': '交错菜单', 'Stepper': '步骤器',
  'TiltedCard': '倾斜卡片',
  // Animations
  'AnimatedContent': '动画内容', 'Antigravity': '反重力', 'BlobCursor': '斑点光标',
  'ClickSpark': '点击火花', 'Crosshair': '十字准星', 'Cubes': '立方体',
  'CursorGrid': '光标网格', 'ElectricBorder': '电光边框', 'FadeContent': '淡入内容',
  'GhostCursor': '幽灵光标', 'GlareHover': '眩光悬停', 'GradualBlur': '渐变模糊',
  'ImageTrail': '图片拖尾', 'LaserFlow': '激光流', 'LogoLoop': 'Logo 循环',
  'MagicRings': '魔法光环', 'Magnet': '磁吸', 'MagnetLines': '磁吸线条',
  'MetaBalls': '元球', 'MetallicPaint': '金属漆', 'Noise': '噪点',
  'OrbitImages': '轨道图片', 'PixelTrail': '像素拖尾', 'PixelTransition': '像素过渡',
  'Ribbons': '丝带', 'ShapeBlur': '形状模糊', 'SplashCursor': '飞溅光标',
  'StarBorder': '星形边框', 'StickerPeel': '贴纸剥离', 'Strands': '链束',
  'TargetCursor': '目标光标',
  // Backgrounds
  'Aurora': '极光', 'Balatro': '扑克牌', 'Ballpit': '球池',
  'Beams': '光束', 'ColorBends': '色彩弯曲', 'DarkVeil': '暗面纱',
  'Dither': '抖动', 'DotField': '点场', 'DotGrid': '点阵网格',
  'EvilEye': '邪眼', 'FaultyTerminal': '故障终端', 'Ferrofluid': '铁磁流体',
  'FloatingLines': '浮动线条', 'Galaxy': '星系', 'GradientBlinds': '渐变百叶窗',
  'Grainient': '颗粒渐变', 'GridDistortion': '网格扭曲', 'GridMotion': '网格运动',
  'GridScan': '网格扫描', 'Hyperspeed': '超光速', 'Iridescence': '虹彩',
  'LetterGlitch': '字母故障', 'Lightfall': '光瀑', 'Lightning': '闪电',
  'LightPillar': '光柱', 'LightRays': '光线', 'LineWaves': '线条波浪',
  'LiquidChrome': '液态铬', 'LiquidEther': '液态以太', 'Orb': '光球',
  'Particles': '粒子', 'PixelBlast': '像素爆炸', 'PixelSnow': '像素雪',
  'Plasma': '等离子', 'PlasmaWave': '等离子波', 'Prism': '棱镜',
  'PrismaticBurst': '棱镜爆发', 'Radar': '雷达', 'RippleGrid': '涟漪网格',
  'ShapeGrid': '形状网格', 'SideRays': '侧光', 'Silk': '丝绸',
  'SoftAurora': '柔和极光', 'Threads': '丝线', 'Waves': '波浪',
  // TextAnimations
  'ASCIIText': 'ASCII 文字', 'BlurText': '模糊文字', 'CircularText': '环形文字',
  'CountUp': '数字递增', 'CurvedLoop': '弯曲循环', 'DecryptedText': '解密文字',
  'FallingText': '坠落文字', 'FuzzyText': '模糊文字', 'GlitchText': '故障文字',
  'GradientText': '渐变文字', 'RotatingText': '旋转文字', 'ScrambledText': '乱码文字',
  'ScrollFloat': '滚动浮动', 'ScrollReveal': '滚动揭示', 'ScrollVelocity': '滚动速度',
  'ShinyText': '闪亮文字', 'Shuffle': '洗牌文字', 'SplitText': '分割文字',
  'TextCursor': '文字光标', 'TextPressure': '文字压力', 'TextType': '打字机',
  'TrueFocus': '真焦点', 'VariableProximity': '可变邻近',
}

// 分类中文名
const CN_CATEGORIES = {
  'Components': '交互组件',
  'Animations': '动画效果',
  'Backgrounds': '背景特效',
  'TextAnimations': '文字动画',
}

function detectDeps(content) {
  const deps = []
  if (/from\s+['"]motion\/react['"]/.test(content)) deps.push('motion')
  if (/from\s+['"]gsap/.test(content)) deps.push('gsap')
  if (/from\s+['"]ogl['"]/.test(content)) deps.push('ogl')
  if (/from\s+['"]three['"]/.test(content)) deps.push('three')
  if (/from\s+['"]matter-js['"]/.test(content)) deps.push('matter-js')
  if (/from\s+['"]@gsap\/react['"]/.test(content)) deps.push('@gsap/react')
  return deps
}

function extractProps(content) {
  // 从函数签名或解构中提取 props
  const propsMatch = content.match(/function\s+\w+\s*\(\{([^}]*)\}\)/) ||
    content.match(/const\s+\w+\s*=\s*\(\{([^}]*)\}\)/) ||
    content.match(/=\s*\(\{([^}]*)\}\)\s*=>/)
  if (!propsMatch) return []
  return propsMatch[1].split(',').map(s => s.trim().split('=')[0].trim()).filter(Boolean)
}

function scanCategory(categoryDir, categoryName) {
  const components = []
  const entries = fs.readdirSync(categoryDir)

  for (const entry of entries) {
    const compDir = path.join(categoryDir, entry)
    if (!fs.statSync(compDir).isDirectory()) continue

    // Find JSX file
    const jsxFile = fs.readdirSync(compDir).find(f => f.endsWith('.jsx'))
    if (!jsxFile) continue

    const jsxPath = path.join(compDir, jsxFile)
    const content = fs.readFileSync(jsxPath, 'utf8')
    const deps = detectDeps(content)
    const props = extractProps(content)

    // Find CSS file
    const cssFile = fs.readdirSync(compDir).find(f => f.endsWith('.css'))

    // Find other assets
    const assets = fs.readdirSync(compDir).filter(f =>
      !f.endsWith('.jsx') && !f.endsWith('.css') && !f.endsWith('.md')
    )

    components.push({
      id: entry,
      name: entry,
      nameCn: CN_NAMES[entry] || entry,
      category: categoryName,
      categoryCn: CN_CATEGORIES[categoryName] || categoryName,
      dependencies: deps,
      props,
      files: {
        jsx: jsxFile,
        css: cssFile || null,
        assets: assets.length > 0 ? assets : null,
      },
    })
  }

  return components
}

const catalog = {
  version: '1.0.0',
  source: 'react-bits-main',
  categories: [
    { id: 'Components', nameCn: '交互组件' },
    { id: 'Animations', nameCn: '动画效果' },
    { id: 'Backgrounds', nameCn: '背景特效' },
    { id: 'TextAnimations', nameCn: '文字动画' },
  ],
  dependencies: {
    'motion': { cdn: 'https://cdn.jsdelivr.net/npm/framer-motion@11/dist/framer-motion.js', global: 'Motion' },
    'gsap': { cdn: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js', global: 'gsap' },
    'ogl': { cdn: 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/dist/ogl.umd.js', global: 'OGL' },
    'three': { cdn: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', global: 'THREE' },
    'matter-js': { cdn: 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js', global: 'Matter' },
    '@gsap/react': { cdn: null, global: 'useGSAP', note: '需要从 window 上获取或模拟' },
  },
  components: [],
}

const categories = ['Components', 'Animations', 'Backgrounds', 'TextAnimations']
for (const cat of categories) {
  const catDir = path.join(BASE, cat)
  if (!fs.existsSync(catDir)) continue
  const comps = scanCategory(catDir, cat)
  catalog.components.push(...comps)
}

catalog.totalCount = catalog.components.length

const outPath = path.resolve(__dirname, '../src/main/tools/Design/ui-components-catalog.json')
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2), 'utf8')
console.log(`Generated catalog with ${catalog.totalCount} components → ${outPath}`)
