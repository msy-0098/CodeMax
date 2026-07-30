// ====== 转场动画类型（无依赖） ======

/** 粒子变量模板值：[最小值, 最大值, 单位] */
export type ParticleVarRange = [number, number, string]

/** 转场动画文件 — 可导出/导入的自包含动画定义 */
export interface TransitionAnimationFile {
  /** 动画名称 */
  name: string
  /** 格式版本 */
  version: 1
  /** 粒子元素的 CSS class 名 */
  particleClass: string
  /** 原始 CSS 文本（含 .particleClass 样式 + @keyframes），注入到 <style> 标签 */
  css: string
  /** 粒子变量模板：CSS 自定义属性名 → [min, max, unit] */
  vars: Record<string, ParticleVarRange>
}
