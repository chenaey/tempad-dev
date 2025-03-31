import { options, activePlugin } from '@/ui/state'
import { getComponentMapping } from './componentMap'
import { codegen } from './codegen'
import { getDesignComponent } from './component'
import { toDecimalPlace } from './index'

// UI Node 类型定义
interface UINode {
  id: string
  name: string
  type: string
  // 自定义组件信息
  custom_component?: {
    name: string // 组件名称（如 ProductItem）
    importPath: string // 导入路径
    description?: string // 组件描述
    props?: string[] // 组件支持的属性列表
  }
  layout: {
    x: number
    y: number
    width?: number
    height?: number
    rotation?: number
    constraints?: {
      horizontal: string
      vertical: string
    }
    layoutMode?: string
    layoutAlign?: string
    padding?: {
      top: number
      right: number
      bottom: number
      left: number
    }
  }
  style: {
    fills?: Array<{
      type: string
      color?: string
      opacity?: number
      visible?: boolean
      blendMode?: string
    }>
    strokes?: Array<{
      type: string
      color: string
      width: number
      position?: string
    }>
    effects?: Array<{
      type: string
      color?: string
      offset?: { x: number; y: number }
      radius?: number
      visible?: boolean
    }>
    cornerRadius?:
      | number
      | {
          topLeft: number
          topRight: number
          bottomRight: number
          bottomLeft: number
        }
  }
  text?: {
    content: string
    fontSize: number
    fontFamily: string
    fontWeight: number
    letterSpacing: number
    lineHeight: number | { value: number; unit: string }
    textAlignHorizontal: string
    textAlignVertical: string
    textCase?: string
    textDecoration?: string
  }
  children?: UINode[]
  // 添加自定义样式字段
  customStyle?: string[]
}

// 提取颜色信息
function extractColor(color: { r: number; g: number; b: number; a?: number }) {
  if (!color) return 'null'
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(
    color.b * 255
  )}, ${color.a ?? 1})`
}

// 提取填充信息
function extractFills(node: any) {
  if (!('fills' in node) || !node.fills || !Array.isArray(node.fills)) return undefined
  return node.fills
    .filter((fill: any) => fill.visible !== false)
    .map((fill: any) => {
      const base = {
        type: fill.type,
        visible: fill.visible !== false,
        opacity: fill.opacity,
        blendMode: fill.blendMode
      }

      if (fill.type === 'SOLID') {
        return {
          ...base,
          color: extractColor(fill.color)
        }
      }

      // 其他类型的填充（如渐变）可以在这里扩展
      return base
    })
}

// 提取描边信息
function extractStrokes(node: any) {
  if (!('strokes' in node) || !node.strokes) return undefined

  return node.strokes
    .filter((stroke: any) => stroke?.visible !== false && stroke?.color)
    .map((stroke: any) => ({
      type: stroke.type,
      color: extractColor(stroke.color),
      width: node.strokeWeight,
      position: node.strokeAlign
    }))
}

// 提取效果信息
function extractEffects(node: any) {
  if (!('effects' in node) || !node.effects) return undefined

  return node.effects
    .filter((effect: any) => effect.visible !== false)
    .map((effect: any) => {
      const base = {
        type: effect.type,
        visible: effect.visible !== false
      }

      if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
        return {
          ...base,
          color: extractColor(effect.color),
          offset: { x: effect.offset.x, y: effect.offset.y },
          radius: effect.radius
        }
      }

      if (effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR') {
        return {
          ...base,
          radius: effect.radius
        }
      }

      return base
    })
}

// 提取圆角信息
function extractCornerRadius(node: any) {
  if (!('cornerRadius' in node)) return undefined

  if (typeof node.cornerRadius === 'number') {
    return node.cornerRadius
  }

  if (
    node.topLeftRadius ||
    node.topRightRadius ||
    node.bottomRightRadius ||
    node.bottomLeftRadius
  ) {
    return {
      topLeft: node.topLeftRadius || 0,
      topRight: node.topRightRadius || 0,
      bottomRight: node.bottomRightRadius || 0,
      bottomLeft: node.bottomLeftRadius || 0
    }
  }

  return undefined
}

// 提取文本信息
function extractText(node: any) {
  if (node.type !== 'TEXT') return undefined

  return {
    content: node.characters,
    fontSize: node.fontSize,
    fontFamily: node.fontName?.family,
    fontWeight: node.fontName?.style,
    letterSpacing: node.letterSpacing?.value || 0,
    lineHeight:
      typeof node.lineHeight === 'number'
        ? node.lineHeight
        : { value: node.lineHeight?.value || 0, unit: node.lineHeight?.unit || 'AUTO' },
    textAlignHorizontal: node.textAlignHorizontal,
    textAlignVertical: node.textAlignVertical,
    textCase: node.textCase,
    textDecoration: node.textDecoration
  }
}

// 判断是否需要添加宽高信息
const shouldAddDimensions = (node: any) => {
  // 1. 检查是否为容器类型
  const isContainer = ['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT', 'TEXT'].includes(node.type)

  // 2. 检查是否有自动布局
  const hasAutoLayout = node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL'

  // 3. 检查约束条件
  const hasFlexibleConstraints =
    node.constraints?.horizontal === 'SCALE' ||
    node.constraints?.vertical === 'SCALE' ||
    node.constraints?.horizontal === 'STRETCH' ||
    node.constraints?.vertical === 'STRETCH'

  // 4. 检查是否为固定尺寸元素（如图标、按钮等）
  const isFixedSizeElement =
    node.type === 'VECTOR' ||
    node.type === 'BOOLEAN_OPERATION' ||
    (node.name.toLowerCase().includes('icon') && !isContainer) ||
    (node.name.toLowerCase().includes('button') && !hasAutoLayout)

  // 返回判断结果
  return isFixedSizeElement || (!isContainer && !hasAutoLayout && !hasFlexibleConstraints)
}

// 提取布局信息
function extractLayout(node: any) {
  const layout: UINode['layout'] = {
    x: toDecimalPlace(node.x),
    y: toDecimalPlace(node.y)
  }

  // 根据判断结果添加宽高
  if (shouldAddDimensions(node)) {
    layout.width = toDecimalPlace(node.width)
    layout.height = toDecimalPlace(node.height)
    // console.log('[UI Node 宽高]', node.type, node.name, '需要固定宽高')
  } else {
    // console.log('[UI Node 宽高]', node.type, node.name, '使用响应式布局')
  }

  if ('rotation' in node) {
    layout.rotation = toDecimalPlace(node.rotation)
  }

  if ('constraints' in node) {
    layout.constraints = {
      horizontal: node.constraints.horizontal,
      vertical: node.constraints.vertical
    }
  }

  if ('layoutMode' in node) {
    layout.layoutMode = node.layoutMode
  }

  if ('layoutAlign' in node) {
    layout.layoutAlign = node.layoutAlign
  }

  // 对于容器节点，保留 padding 信息以便于布局
  if (
    'paddingTop' in node ||
    'paddingRight' in node ||
    'paddingBottom' in node ||
    'paddingLeft' in node
  ) {
    layout.padding = {
      top: node.paddingTop || 0,
      right: node.paddingRight || 0,
      bottom: node.paddingBottom || 0,
      left: node.paddingLeft || 0
    }
  }

  return layout
}

// 提取自定义组件信息
function extractCustomComponent(node: any) {
  if (!node?.name) return undefined

  // 获取组件映射
  const mapping = getComponentMapping(node.name)
  if (!mapping) return undefined

  return {
    ...mapping
  }
}

// 主函数：提取UI节点信息
export async function extractUINode(node: any, maxDepth = Infinity): Promise<UINode | null> {
  // 过滤掉隐藏的节点
  if ('visible' in node && node.visible === false) {
    return null
  }

  const uiNode: UINode = {
    id: node.id,
    name: node.name,
    type: node.type,
    layout: extractLayout(node),
    style: {
      fills: extractFills(node),
      strokes: extractStrokes(node),
      effects: extractEffects(node),
      cornerRadius: extractCornerRadius(node)
    }
  }

  // 提取自定义组件信息
  const customComponent = extractCustomComponent(node)
  if (customComponent) {
    uiNode.custom_component = customComponent
  }

  const textInfo = extractText(node)
  if (textInfo) {
    uiNode.text = textInfo
  }

  try {
    // 获取生成的CSS代码
    const style = await node.getCSSAsync()
    const component = getDesignComponent(node)

    const { cssUnit, project, rootFontSize, scale } = options.value
    const serializeOptions = {
      useRem: cssUnit === 'rem',
      rootFontSize,
      scale,
      project
    }

    // 使用与 CodeSection.vue 相同的参数调用 codegen
    const { codeBlocks } = await codegen(
      style,
      component,
      serializeOptions,
      activePlugin.value?.code || undefined
    )

    // 只保存 css 代码块的 code 字段
    const cssBlock = codeBlocks.find((block) => block.name === 'css')
    if (cssBlock) {
      const needRemoveWidthHeight = shouldAddDimensions(node)
      let styles = cssBlock.code.split('\n')
      if (needRemoveWidthHeight) {
        // 对于容器节点，过滤掉 width 和 height 样式
        styles = styles.filter((line) => {
          // console.log('[UI Node 样式]', line)
          return !line.trim().startsWith('width:') && !line.trim().startsWith('height:')
        })
      }

      uiNode.customStyle = styles
    }
  } catch (error) {
    console.error(`Failed to get CSS for node ${node.id}:`, error)
  }

  // 如果不是自定义组件，才处理子节点
  if (!customComponent && maxDepth > 0 && 'children' in node && node.children) {
    const childNodes = await Promise.all(
      node.children.map((child: any) => extractUINode(child, maxDepth - 1))
    )
    uiNode.children = childNodes.filter((node): node is UINode => node !== null)
  }

  return uiNode
}

// 导出函数：处理选中的节点
export async function extractSelectedNodes(selection: readonly any[]) {
  const nodes = await Promise.all(selection.map((node) => extractUINode(node)))
  // 过滤掉null节点
  return nodes.filter((node): node is UINode => node !== null)
}
