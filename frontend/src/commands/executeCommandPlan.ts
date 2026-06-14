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
      next = { ...next, objects: [] }
      selected = ''
    }

    if (step.type === 'ungroup_objects') {
      const targetKey = resolveTargetKey(step, selected, next)
      const original = next.objects.find((object) => object.object_key === targetKey)
      if (original) {
        const copy = duplicateObject(original, next.objects.length + 1)
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

function arrangeObject(state: CanvasState, targetKey: string, position: string): CanvasState {
  const target = state.objects.find((object) => object.object_key === targetKey)
  if (!target) {
    return state
  }
  const rest = state.objects.filter((object) => object.object_key !== targetKey)
  if (position === 'back' || position === 'bottom') {
    return { ...state, objects: [target, ...rest] }
  }
  return { ...state, objects: [...rest, target] }
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
  }
  return `${names[type] ?? '对象'} ${index}`
}

function numberArg(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringArg(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}
