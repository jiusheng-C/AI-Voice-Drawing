export type CanvasObjectType = 'circle' | 'rect' | 'text'

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
