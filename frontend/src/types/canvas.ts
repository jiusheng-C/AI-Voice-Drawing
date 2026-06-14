export type CanvasObjectType =
  | 'circle'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'triangle'
  | 'diamond'
  | 'star'
  | 'sticky'
  | 'process'
  | 'image_placeholder'
  | 'text'

export interface CanvasObjectState {
  object_key: string
  object_type: CanvasObjectType
  name?: string
  properties: Record<string, unknown>
}

export interface CanvasState {
  width: number
  height: number
  objects: CanvasObjectState[]
}
