import { useEffect, useRef } from 'react'
import { Canvas, Circle, Rect, Textbox } from 'fabric'
import type { CanvasObjectState, CanvasState } from '../types/canvas'

interface FabricCanvasProps {
  state: CanvasState
}

export function FabricCanvas({ state }: FabricCanvasProps) {
  const canvasElement = useRef<HTMLCanvasElement | null>(null)
  const fabricCanvas = useRef<Canvas | null>(null)

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
}

function createFabricObject(object: CanvasObjectState) {
  const props = object.properties
  const left = numberProp(props.left, 120)
  const top = numberProp(props.top, 120)
  const fill = stringProp(props.fill, '#2563eb')

  if (object.object_type === 'circle') {
    return new Circle({
      left,
      top,
      radius: numberProp(props.radius, 80),
      fill,
      originX: 'center',
      originY: 'center',
    })
  }

  if (object.object_type === 'rect') {
    return new Rect({
      left,
      top,
      width: numberProp(props.width, 240),
      height: numberProp(props.height, 150),
      fill,
      rx: 8,
      ry: 8,
      originX: 'center',
      originY: 'center',
    })
  }

  if (object.object_type === 'text') {
    return new Textbox(stringProp(props.text, object.name ?? '文字'), {
      left,
      top,
      width: numberProp(props.width, 280),
      fill,
      fontSize: numberProp(props.font_size, 32),
      fontFamily: 'Inter, sans-serif',
      originX: 'center',
      originY: 'center',
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
