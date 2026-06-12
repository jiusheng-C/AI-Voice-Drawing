import type { CanvasObjectState, CanvasState } from '../types/canvas'
import type { CommandPlan, CommandStep } from '../types/commands'

export interface ExecutionResult {
  state: CanvasState
  selectedObjectKey: string
  message: string
}

export function executeCommandPlan(
  current: CanvasState,
  selectedObjectKey: string,
  plan: CommandPlan,
): ExecutionResult {
  let next = cloneState(current)
  let selected = selectedObjectKey

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
      const dx = numberArg(step.args?.dx, 0)
      const dy = numberArg(step.args?.dy, 0)
      next = {
        ...next,
        objects: next.objects.map((object) => {
          if (object.object_key !== targetKey) {
            return object
          }
          return {
            ...object,
            properties: {
              ...object.properties,
              left: numberArg(object.properties.left, 0) + dx,
              top: numberArg(object.properties.top, 0) + dy,
            },
          }
        }),
      }
      selected = targetKey
    }
  }

  return { state: next, selectedObjectKey: selected, message: plan.feedback }
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
  const shape = stringArg(step.args?.shape, 'circle')
  const fill = stringArg(step.args?.fill, '#2563eb')
  const base = {
    object_key: `obj_${Date.now()}_${index}`,
    name: shape === 'rect' ? 'Rectangle' : 'Circle',
    properties: {
      fill,
      left: numberArg(step.args?.x, 640),
      top: numberArg(step.args?.y, 360),
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
    name: 'Text',
    properties: {
      text: stringArg(step.args?.text, 'Text'),
      fill: stringArg(step.args?.fill, '#111827'),
      left: numberArg(step.args?.x, 640),
      top: numberArg(step.args?.y, 360),
      font_size: numberArg(step.args?.font_size, 32),
    },
  }
}

function resolveTargetKey(step: CommandStep, selectedObjectKey: string, state: CanvasState) {
  if (step.target?.type === 'explicit_id' && step.target.object_id) {
    return step.target.object_id
  }
  if (step.target?.reference === 'last_object') {
    return state.objects.at(-1)?.object_key ?? selectedObjectKey
  }
  return selectedObjectKey || state.objects.at(-1)?.object_key || ''
}

function numberArg(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringArg(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}
