import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Canvas, Circle, Ellipse, FabricObject, Group, Line, Polygon, Rect, Textbox } from 'fabric'
import type { CanvasObjectState, CanvasState } from '../types/canvas'

interface FabricCanvasProps {
  state: CanvasState
}

export interface FabricCanvasHandle {
  exportPNG: () => string
}

export const FabricCanvas = forwardRef<FabricCanvasHandle, FabricCanvasProps>(function FabricCanvas({ state }, ref) {
  const canvasElement = useRef<HTMLCanvasElement | null>(null)
  const fabricCanvas = useRef<Canvas | null>(null)

  useImperativeHandle(ref, () => ({
    exportPNG: () => fabricCanvas.current?.toDataURL({ format: 'png', multiplier: 2 }) ?? '',
  }))

  useEffect(() => {
    if (!canvasElement.current) {
      return
    }

    const canvas = new Canvas(canvasElement.current, {
      width: state.width,
      height: state.height,
      selection: false,
      backgroundColor: '#ffffff',
    })
    fabricCanvas.current = canvas

    return () => {
      canvas.dispose()
      fabricCanvas.current = null
    }
  }, [state.height, state.width])

  useEffect(() => {
    const canvas = fabricCanvas.current
    if (!canvas) {
      return
    }

    canvas.clear()
    canvas.backgroundColor = '#ffffff'
    state.objects.forEach((object) => {
      const fabricObject = createFabricObject(object)
      if (fabricObject) {
        fabricObject.set({ selectable: false, evented: false })
        canvas.add(fabricObject)
      }
    })
    canvas.requestRenderAll()
  }, [state.objects])

  return (
    <div className="fabric-stage">
      <canvas ref={canvasElement} />
    </div>
  )
})

function createFabricObject(object: CanvasObjectState): FabricObject | null {
  const props = object.properties
  const left = numberProp(props.left, 120)
  const top = numberProp(props.top, 120)
  const fill = stringProp(props.fill, '#2563eb')
  const stroke = stringProp(props.stroke, '#111827')
  const strokeWidth = numberProp(props.stroke_width, 0)
  const opacity = numberProp(props.opacity, 1)
  const angle = numberProp(props.angle, 0)
  const common = {
    left,
    top,
    fill,
    stroke,
    strokeWidth,
    opacity,
    angle,
    originX: 'center' as const,
    originY: 'center' as const,
  }

  if (object.object_type === 'group') {
    const children = Array.isArray(props.children) ? props.children.filter(isCanvasObjectState) : []
    const fabricObjects: FabricObject[] = children
      .map((child) => createFabricObject(child))
      .filter((child): child is FabricObject => Boolean(child))
    return new Group(fabricObjects, {
      left,
      top,
      opacity,
      angle,
      originX: 'center',
      originY: 'center',
    })
  }

  if (object.object_type === 'circle') {
    return new Circle({
      ...common,
      radius: numberProp(props.radius, 80),
    })
  }

  if (object.object_type === 'rect') {
    return new Rect({
      ...common,
      width: numberProp(props.width, 240),
      height: numberProp(props.height, 150),
      rx: 8,
      ry: 8,
    })
  }

  if (object.object_type === 'process') {
    const width = numberProp(props.width, 260)
    const height = numberProp(props.height, 120)
    const box = new Rect({
      width,
      height,
      fill,
      stroke,
      strokeWidth,
      rx: 12,
      ry: 12,
      originX: 'center',
      originY: 'center',
    })
    const label = new Textbox(stringProp(props.text, object.name ?? '流程节点'), {
      width: width - 28,
      fill: stringProp(props.text_fill, '#ffffff'),
      fontSize: numberProp(props.font_size, 26),
      fontWeight: stringProp(props.font_weight, '600'),
      fontFamily: 'Inter, sans-serif',
      textAlign: textAlignProp(props.text_align, 'center'),
      originX: 'center',
      originY: 'center',
      top: -12,
    })
    return new Group([box, label], {
      left,
      top,
      opacity,
      angle,
      originX: 'center',
      originY: 'center',
    })
  }

  if (object.object_type === 'sticky') {
    const width = numberProp(props.width, 220)
    const height = numberProp(props.height, 160)
    const note = new Rect({
      width,
      height,
      fill,
      stroke,
      strokeWidth,
      rx: 8,
      ry: 8,
      originX: 'center',
      originY: 'center',
    })
    const fold = new Polygon(
      [
        { x: width / 2 - 34, y: -height / 2 },
        { x: width / 2, y: -height / 2 },
        { x: width / 2, y: -height / 2 + 34 },
      ],
      {
        fill: '#fde68a',
        stroke,
        strokeWidth: 1,
        originX: 'center',
        originY: 'center',
      },
    )
    const label = new Textbox(stringProp(props.text, object.name ?? '便签'), {
      width: width - 30,
      fill: stringProp(props.text_fill, '#111827'),
      fontSize: numberProp(props.font_size, 24),
      fontWeight: stringProp(props.font_weight, '500'),
      fontFamily: 'Inter, sans-serif',
      textAlign: textAlignProp(props.text_align, 'left'),
      originX: 'center',
      originY: 'center',
      top: 8,
    })
    return new Group([note, fold, label], {
      left,
      top,
      opacity,
      angle,
      originX: 'center',
      originY: 'center',
    })
  }

  if (object.object_type === 'ellipse') {
    return new Ellipse({
      ...common,
      rx: numberProp(props.rx, numberProp(props.width, 240) / 2),
      ry: numberProp(props.ry, numberProp(props.height, 140) / 2),
    })
  }

  if (object.object_type === 'triangle') {
    const width = numberProp(props.width, 180)
    const height = numberProp(props.height, 160)
    return new Polygon(
      [
        { x: 0, y: -height / 2 },
        { x: width / 2, y: height / 2 },
        { x: -width / 2, y: height / 2 },
      ],
      common,
    )
  }

  if (object.object_type === 'diamond') {
    const width = numberProp(props.width, 200)
    const height = numberProp(props.height, 160)
    return new Polygon(
      [
        { x: 0, y: -height / 2 },
        { x: width / 2, y: 0 },
        { x: 0, y: height / 2 },
        { x: -width / 2, y: 0 },
      ],
      common,
    )
  }

  if (object.object_type === 'star') {
    const radius = numberProp(props.radius, 86)
    return new Polygon(createStarPoints(radius, radius * 0.45, 5), common)
  }

  if (object.object_type === 'line') {
    return new Line(
      [
        -numberProp(props.width, 240) / 2,
        0,
        numberProp(props.width, 240) / 2,
        0,
      ],
      {
        left,
        top,
        stroke,
        strokeWidth: numberProp(props.stroke_width, 4),
        opacity,
        angle,
        originX: 'center',
        originY: 'center',
      },
    )
  }

  if (object.object_type === 'arrow') {
    const width = numberProp(props.width, 260)
    const line = new Line([-width / 2, 0, width / 2 - 26, 0], {
      stroke,
      strokeWidth: numberProp(props.stroke_width, 4),
      originX: 'center',
      originY: 'center',
    })
    const head = new Polygon(
      [
        { x: width / 2, y: 0 },
        { x: width / 2 - 30, y: -16 },
        { x: width / 2 - 30, y: 16 },
      ],
      {
        fill: stroke,
        originX: 'center',
        originY: 'center',
      },
    )
    return new Group([line, head], {
      left,
      top,
      opacity,
      angle,
      originX: 'center',
      originY: 'center',
    })
  }

  if (object.object_type === 'image_placeholder') {
    const width = numberProp(props.width, 260)
    const height = numberProp(props.height, 170)
    const frame = new Rect({
      width,
      height,
      fill,
      stroke,
      strokeWidth: numberProp(props.stroke_width, 2),
      rx: 8,
      ry: 8,
      originX: 'center',
      originY: 'center',
    })
    const mountain = new Polygon(
      [
        { x: -width / 2 + 32, y: height / 2 - 28 },
        { x: -width / 5, y: 10 },
        { x: 0, y: height / 2 - 28 },
      ],
      {
        fill: '#94a3b8',
        originX: 'center',
        originY: 'center',
      },
    )
    const mountainTwo = new Polygon(
      [
        { x: -20, y: height / 2 - 28 },
        { x: width / 4, y: -18 },
        { x: width / 2 - 28, y: height / 2 - 28 },
      ],
      {
        fill: '#64748b',
        originX: 'center',
        originY: 'center',
      },
    )
    const sun = new Circle({
      left: width / 2 - 50,
      top: -height / 2 + 42,
      radius: 16,
      fill: '#facc15',
      originX: 'center',
      originY: 'center',
    })
    const label = new Textbox(stringProp(props.text, '图片占位'), {
      width: width - 30,
      top: height / 2 - 46,
      fill: '#475569',
      fontSize: 18,
      fontFamily: 'Inter, sans-serif',
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
    })
    return new Group([frame, mountain, mountainTwo, sun, label], {
      left,
      top,
      opacity,
      angle,
      originX: 'center',
      originY: 'center',
    })
  }

  if (object.object_type === 'text') {
    return new Textbox(stringProp(props.text, object.name ?? '文字'), {
      ...common,
      width: numberProp(props.width, 280),
      fontSize: numberProp(props.font_size, 32),
      fontWeight: stringProp(props.font_weight, '500'),
      fontFamily: 'Inter, sans-serif',
      textAlign: textAlignProp(props.text_align, 'center'),
    })
  }

  return null
}

function numberProp(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringProp(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function textAlignProp(value: unknown, fallback: 'left' | 'center' | 'right') {
  return value === 'left' || value === 'center' || value === 'right' ? value : fallback
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

function createStarPoints(outerRadius: number, innerRadius: number, points: number) {
  return Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius
    const angle = (Math.PI / points) * index - Math.PI / 2
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    }
  })
}
