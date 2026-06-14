import type { CanvasObjectState, CanvasObjectType, CanvasState } from '../types/canvas'
import type { CommandPlan, CommandStep } from '../types/commands'

export interface ExecutionResult {
  state: CanvasState
  selectedObjectKey: string
  message: string
  requestedExport?: 'png'
}

export function executeCommandPlan(
  current: CanvasState,
  selectedObjectKey: string,
  plan: CommandPlan,
): ExecutionResult {
  let next = cloneState(current)
  let selected = selectedObjectKey
  let requestedExport: 'png' | undefined

  for (const step of plan.commands) {
    if (step.type === 'create_shape') {
      const object = createShape(step, next.objects.length + 1)
      next = { ...next, objects: [...next.objects, object] }
      selected = object.object_key
    }

    if (step.type === 'create_text') {
      const object = createText(step, next.objects.length + 1)
      next = { ...next, objects: [...next.objects, object] }
      selected = object.object_key
    }

    if (step.type === 'select_object') {
      selected = resolveTargetKey(step, selected, next)
    }

    if (step.type === 'update_object') {
      const targetKey = resolveTargetKey(step, selected, next)
      next = {
        ...next,
        objects: next.objects.map((object) =>
          object.object_key === targetKey
            ? { ...object, properties: { ...object.properties, ...step.args } }
            : object,
        ),
      }
      selected = targetKey
    }

    if (step.type === 'move_object') {
      const targetKey = resolveTargetKey(step, selected, next)
      next = updateObject(next, targetKey, (object) => ({
        ...object,
        properties: {
          ...object.properties,
          left: numberArg(object.properties.left, 0) + numberArg(step.args?.dx, 0),
          top: numberArg(object.properties.top, 0) + numberArg(step.args?.dy, 0),
        },
      }))
      selected = targetKey
    }

    if (step.type === 'resize_object') {
      const targetKey = resolveTargetKey(step, selected, next)
      next = updateObject(next, targetKey, (object) => resizeObject(object, step))
      selected = targetKey
    }

    if (step.type === 'rotate_object') {
      const targetKey = resolveTargetKey(step, selected, next)
      next = updateObject(next, targetKey, (object) => ({
        ...object,
        properties: {
          ...object.properties,
          angle: numberArg(object.properties.angle, 0) + numberArg(step.args?.angle, 15),
        },
      }))
      selected = targetKey
    }

    if (step.type === 'arrange_object') {
      const targetKey = resolveTargetKey(step, selected, next)
      next = arrangeObject(next, targetKey, stringArg(step.args?.position, 'front'))
      selected = targetKey
    }

    if (step.type === 'delete_object') {
      const targetKey = resolveTargetKey(step, selected, next)
      next = { ...next, objects: next.objects.filter((object) => object.object_key !== targetKey) }
      selected = next.objects.at(-1)?.object_key ?? ''
    }

    if (step.type === 'group_objects') {
      const group = createGroup(next.objects, next.objects.length + 1)
      if (group) {
        next = { ...next, objects: [group] }
        selected = group.object_key
      }
    }

    if (step.type === 'ungroup_objects') {
      const targetKey = resolveTargetKey(step, selected, next)
      const target = next.objects.find((object) => object.object_key === targetKey)
      if (target?.object_type === 'group') {
        const children = groupChildren(target)
        next = {
          ...next,
          objects: [
            ...next.objects.filter((object) => object.object_key !== targetKey),
            ...children.map((child, index) => absolutizeGroupedChild(target, child, index)),
          ],
        }
        selected = next.objects.at(-1)?.object_key ?? ''
      } else if (target) {
        const copy = duplicateObject(target, next.objects.length + 1)
        next = { ...next, objects: [...next.objects, copy] }
        selected = copy.object_key
      }
    }

    if (step.type === 'create_canvas') {
      next = {
        width: numberArg(step.args?.width, next.width),
        height: numberArg(step.args?.height, next.height),
        objects: step.args?.clear === false ? next.objects : [],
      }
      selected = next.objects.at(-1)?.object_key ?? ''
    }

    if (step.type === 'export_project') {
      requestedExport = 'png'
    }
  }

  return { state: next, selectedObjectKey: selected, message: plan.feedback, requestedExport }
}

function cloneState(state: CanvasState): CanvasState {
  return {
    ...state,
    objects: state.objects.map((object) => ({
      ...object,
      properties: { ...object.properties },
    })),
  }
}

function createShape(step: CommandStep, index: number): CanvasObjectState {
  const shape = stringArg(step.args?.shape, 'circle') as CanvasObjectType
  const fill = stringArg(step.args?.fill, '#2563eb')
  const stroke = stringArg(step.args?.stroke, '#111827')
  const base = {
    object_key: `obj_${Date.now()}_${index}`,
    name: objectName(shape, index),
    properties: {
      fill,
      stroke,
      stroke_width: numberArg(step.args?.stroke_width, 0),
      left: numberArg(step.args?.x, 640),
      top: numberArg(step.args?.y, 360),
      angle: numberArg(step.args?.angle, 0),
      opacity: numberArg(step.args?.opacity, 1),
    },
  }

  if (shape === 'rect') {
    return {
      ...base,
      object_type: 'rect',
      properties: {
        ...base.properties,
        width: numberArg(step.args?.width, 240),
        height: numberArg(step.args?.height, 150),
      },
    }
  }

  if (shape === 'process') {
    return {
      ...base,
      object_type: 'process',
      properties: {
        ...base.properties,
        text: stringArg(step.args?.text, '流程节点'),
        text_fill: stringArg(step.args?.text_fill, '#ffffff'),
        width: numberArg(step.args?.width, 260),
        height: numberArg(step.args?.height, 120),
        stroke_width: numberArg(step.args?.stroke_width, 0),
      },
    }
  }

  if (shape === 'sticky') {
    return {
      ...base,
      object_type: 'sticky',
      properties: {
        ...base.properties,
        text: stringArg(step.args?.text, '便签'),
        text_fill: stringArg(step.args?.text_fill, '#111827'),
        width: numberArg(step.args?.width, 220),
        height: numberArg(step.args?.height, 160),
        stroke: stringArg(step.args?.stroke, '#f59e0b'),
        stroke_width: numberArg(step.args?.stroke_width, 2),
      },
    }
  }

  if (shape === 'ellipse') {
    return {
      ...base,
      object_type: 'ellipse',
      properties: {
        ...base.properties,
        width: numberArg(step.args?.width, 260),
        height: numberArg(step.args?.height, 150),
        rx: numberArg(step.args?.rx, 130),
        ry: numberArg(step.args?.ry, 75),
      },
    }
  }

  if (shape === 'triangle' || shape === 'diamond') {
    return {
      ...base,
      object_type: shape,
      properties: {
        ...base.properties,
        width: numberArg(step.args?.width, shape === 'triangle' ? 180 : 200),
        height: numberArg(step.args?.height, 160),
      },
    }
  }

  if (shape === 'star') {
    return {
      ...base,
      object_type: 'star',
      properties: {
        ...base.properties,
        radius: numberArg(step.args?.radius, 86),
      },
    }
  }

  if (shape === 'image_placeholder') {
    return {
      ...base,
      object_type: 'image_placeholder',
      properties: {
        ...base.properties,
        fill: stringArg(step.args?.fill, '#e2e8f0'),
        stroke: stringArg(step.args?.stroke, '#64748b'),
        stroke_width: numberArg(step.args?.stroke_width, 2),
        width: numberArg(step.args?.width, 260),
        height: numberArg(step.args?.height, 170),
        text: stringArg(step.args?.text, '图片占位'),
      },
    }
  }

  if (shape === 'line' || shape === 'arrow') {
    return {
      ...base,
      object_type: shape,
      properties: {
        ...base.properties,
        fill: 'transparent',
        width: numberArg(step.args?.width, shape === 'arrow' ? 260 : 240),
        stroke_width: numberArg(step.args?.stroke_width, 4),
      },
    }
  }

  return {
    ...base,
    object_type: 'circle',
    properties: {
      ...base.properties,
      radius: numberArg(step.args?.radius, 80),
    },
  }
}

function createText(step: CommandStep, index: number): CanvasObjectState {
  return {
    object_key: `obj_${Date.now()}_${index}`,
    object_type: 'text',
    name: '文字',
    properties: {
      text: stringArg(step.args?.text, '文字'),
      fill: stringArg(step.args?.fill, '#111827'),
      left: numberArg(step.args?.x, 640),
      top: numberArg(step.args?.y, 360),
      width: numberArg(step.args?.width, 280),
      font_size: numberArg(step.args?.font_size, 32),
      angle: numberArg(step.args?.angle, 0),
      opacity: numberArg(step.args?.opacity, 1),
    },
  }
}

function resizeObject(object: CanvasObjectState, step: CommandStep): CanvasObjectState {
  const scale = numberArg(step.args?.scale, 1)
  const resizeNumber = (key: string, fallback: number) =>
    numberArg(step.args?.[key], numberArg(object.properties[key], fallback) * scale)

  if (object.object_type === 'circle') {
    return { ...object, properties: { ...object.properties, radius: resizeNumber('radius', 80) } }
  }
  if (object.object_type === 'ellipse') {
    return {
      ...object,
      properties: {
        ...object.properties,
        rx: resizeNumber('rx', 130),
        ry: resizeNumber('ry', 75),
        width: resizeNumber('width', 260),
        height: resizeNumber('height', 150),
      },
    }
  }
  if (object.object_type === 'text') {
    return {
      ...object,
      properties: {
        ...object.properties,
        width: resizeNumber('width', 280),
        font_size: resizeNumber('font_size', 32),
      },
    }
  }
  return {
    ...object,
    properties: {
      ...object.properties,
      width: resizeNumber('width', 240),
      height: object.object_type === 'line' || object.object_type === 'arrow' ? object.properties.height : resizeNumber('height', 150),
    },
  }
}

function duplicateObject(object: CanvasObjectState, index: number): CanvasObjectState {
  return {
    ...object,
    object_key: `obj_${Date.now()}_${index}`,
    name: `${object.name ?? object.object_type} 副本`,
    properties: {
      ...object.properties,
      left: numberArg(object.properties.left, 0) + 36,
      top: numberArg(object.properties.top, 0) + 36,
    },
  }
}

function createGroup(objects: CanvasObjectState[], index: number): CanvasObjectState | null {
  if (objects.length === 0) {
    return null
  }
  const bounds = boundsForObjects(objects)
  const centerX = bounds.left + bounds.width / 2
  const centerY = bounds.top + bounds.height / 2

  return {
    object_key: `obj_${Date.now()}_${index}`,
    object_type: 'group',
    name: `分组 ${index}`,
    properties: {
      left: centerX,
      top: centerY,
      width: bounds.width,
      height: bounds.height,
      children: objects.map((object) => ({
        ...object,
        properties: {
          ...object.properties,
          left: numberArg(object.properties.left, centerX) - centerX,
          top: numberArg(object.properties.top, centerY) - centerY,
        },
      })),
    },
  }
}

function groupChildren(object: CanvasObjectState): CanvasObjectState[] {
  return Array.isArray(object.properties.children)
    ? object.properties.children.filter(isCanvasObjectState)
    : []
}

function absolutizeGroupedChild(group: CanvasObjectState, child: CanvasObjectState, index: number): CanvasObjectState {
  return {
    ...child,
    object_key: `${child.object_key}_ungrouped_${Date.now()}_${index}`,
    properties: {
      ...child.properties,
      left: numberArg(group.properties.left, 0) + numberArg(child.properties.left, 0),
      top: numberArg(group.properties.top, 0) + numberArg(child.properties.top, 0),
    },
  }
}

function isCanvasObjectState(value: unknown): value is CanvasObjectState {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'object_key' in value &&
      'object_type' in value &&
      'properties' in value,
  )
}

function boundsForObjects(objects: CanvasObjectState[]) {
  const boxes = objects.map(objectBounds)
  const left = Math.min(...boxes.map((box) => box.left))
  const top = Math.min(...boxes.map((box) => box.top))
  const right = Math.max(...boxes.map((box) => box.left + box.width))
  const bottom = Math.max(...boxes.map((box) => box.top + box.height))
  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  }
}

function objectBounds(object: CanvasObjectState) {
  const left = numberArg(object.properties.left, 0)
  const top = numberArg(object.properties.top, 0)
  const width = objectWidth(object)
  const height = objectHeight(object)
  return {
    left: left - width / 2,
    top: top - height / 2,
    width,
    height,
  }
}

function objectWidth(object: CanvasObjectState) {
  if (object.object_type === 'circle' || object.object_type === 'star') {
    return numberArg(object.properties.radius, 80) * 2
  }
  if (object.object_type === 'ellipse') {
    return numberArg(object.properties.rx, 130) * 2
  }
  return numberArg(object.properties.width, 220)
}

function objectHeight(object: CanvasObjectState) {
  if (object.object_type === 'circle' || object.object_type === 'star') {
    return numberArg(object.properties.radius, 80) * 2
  }
  if (object.object_type === 'ellipse') {
    return numberArg(object.properties.ry, 75) * 2
  }
  if (object.object_type === 'line' || object.object_type === 'arrow') {
    return numberArg(object.properties.stroke_width, 4) + 24
  }
  return numberArg(object.properties.height, 140)
}

function arrangeObject(state: CanvasState, targetKey: string, position: string): CanvasState {
  const target = state.objects.find((object) => object.object_key === targetKey)
  if (!target) {
    return state
  }
  if (position.startsWith('align_') || position.startsWith('distribute_')) {
    return arrangeLayout(state, position)
  }
  const rest = state.objects.filter((object) => object.object_key !== targetKey)
  if (position === 'back' || position === 'bottom') {
    return { ...state, objects: [target, ...rest] }
  }
  return { ...state, objects: [...rest, target] }
}

function arrangeLayout(state: CanvasState, position: string): CanvasState {
  if (state.objects.length === 0) {
    return state
  }
  const bounds = boundsForObjects(state.objects)
  const updates = new Map<string, { left?: number; top?: number }>()

  if (position === 'align_left') {
    for (const object of state.objects) {
      updates.set(object.object_key, { left: bounds.left + objectWidth(object) / 2 })
    }
  }
  if (position === 'align_right') {
    const right = bounds.left + bounds.width
    for (const object of state.objects) {
      updates.set(object.object_key, { left: right - objectWidth(object) / 2 })
    }
  }
  if (position === 'align_top') {
    for (const object of state.objects) {
      updates.set(object.object_key, { top: bounds.top + objectHeight(object) / 2 })
    }
  }
  if (position === 'align_bottom') {
    const bottom = bounds.top + bounds.height
    for (const object of state.objects) {
      updates.set(object.object_key, { top: bottom - objectHeight(object) / 2 })
    }
  }
  if (position === 'align_center_x') {
    const centerX = bounds.left + bounds.width / 2
    for (const object of state.objects) {
      updates.set(object.object_key, { left: centerX })
    }
  }
  if (position === 'align_center_y') {
    const centerY = bounds.top + bounds.height / 2
    for (const object of state.objects) {
      updates.set(object.object_key, { top: centerY })
    }
  }
  if (position === 'distribute_horizontal') {
    distributeObjects(state.objects, 'left').forEach((left, objectKey) => updates.set(objectKey, { left }))
  }
  if (position === 'distribute_vertical') {
    distributeObjects(state.objects, 'top').forEach((top, objectKey) => updates.set(objectKey, { top }))
  }

  if (updates.size === 0) {
    return state
  }
  return {
    ...state,
    objects: state.objects.map((object) => {
      const update = updates.get(object.object_key)
      return update
        ? { ...object, properties: { ...object.properties, ...update } }
        : object
    }),
  }
}

function distributeObjects(objects: CanvasObjectState[], axis: 'left' | 'top') {
  const updates = new Map<string, number>()
  if (objects.length < 3) {
    return updates
  }
  const sorted = [...objects].sort(
    (a, b) => numberArg(a.properties[axis], 0) - numberArg(b.properties[axis], 0),
  )
  const first = numberArg(sorted[0].properties[axis], 0)
  const last = numberArg(sorted[sorted.length - 1].properties[axis], 0)
  const step = (last - first) / (sorted.length - 1)
  sorted.forEach((object, index) => {
    updates.set(object.object_key, first + step * index)
  })
  return updates
}

function updateObject(
  state: CanvasState,
  targetKey: string,
  updater: (object: CanvasObjectState) => CanvasObjectState,
): CanvasState {
  return {
    ...state,
    objects: state.objects.map((object) => (object.object_key === targetKey ? updater(object) : object)),
  }
}

function resolveTargetKey(step: CommandStep, selectedObjectKey: string, state: CanvasState) {
  if (step.target?.type === 'explicit_id' && step.target.object_id) {
    return step.target.object_id
  }
  if (step.target?.reference === 'last_object') {
    return state.objects.at(-1)?.object_key ?? selectedObjectKey
  }
  if (step.target?.reference === 'selected_object') {
    return selectedObjectKey || state.objects.at(-1)?.object_key || ''
  }
  if (step.target?.type === 'query') {
    const matched = state.objects.find((object) => {
      const typeMatched = !step.target?.object_type || object.object_type === step.target.object_type
      const colorMatched = !step.target?.color || object.properties.fill === step.target.color
      return typeMatched && colorMatched
    })
    return matched?.object_key ?? selectedObjectKey
  }
  return selectedObjectKey || state.objects.at(-1)?.object_key || ''
}

function objectName(type: string, index: number) {
  const names: Record<string, string> = {
    circle: '圆形',
    rect: '矩形',
    ellipse: '椭圆',
    line: '线条',
    arrow: '箭头',
    triangle: '三角形',
    diamond: '菱形',
    star: '星形',
    sticky: '便签',
    process: '流程节点',
    image_placeholder: '图片占位',
    group: '分组',
  }
  return `${names[type] ?? '对象'} ${index}`
}

function numberArg(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringArg(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}
