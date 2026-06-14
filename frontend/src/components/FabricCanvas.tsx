import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Canvas, Circle, Ellipse, Group, Line, Polygon, Rect, Textbox } from 'fabric'
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

function createFabricObject(object: CanvasObjectState) {
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

  if (object.object_type === 'ellipse') {
    return new Ellipse({
      ...common,
      rx: numberProp(props.rx, numberProp(props.width, 240) / 2),
      ry: numberProp(props.ry, numberProp(props.height, 140) / 2),
    })
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

  if (object.object_type === 'text') {
    return new Textbox(stringProp(props.text, object.name ?? '文字'), {
      ...common,
      width: numberProp(props.width, 280),
      fontSize: numberProp(props.font_size, 32),
      fontFamily: 'Inter, sans-serif',
      textAlign: 'center',
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
