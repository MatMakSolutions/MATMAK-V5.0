export interface MvdRaw {
  name         : string
  originalPath : string
  widthInMm    : number
  heightInMm   : number
  widthInVu    : number
  heightInVu   : number
  paths        : Path[]
}

export interface Path {
  path       : string
  transform ?: string
}