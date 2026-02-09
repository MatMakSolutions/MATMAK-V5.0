export interface PatternDetailResponse {
  message    : string
  payload    : Payload
  statusCode : number
}

export interface Payload {
  pattern_id            : string
  name                  : string
  car_pattern_region    : string
  regions               : Region[]
  surface               : number
  rating                : number
  compatibilities       : any[]
  bitmap_image          : string
  vector_image          : string
  is_favorite           : boolean
  is_added_to_selection : boolean
  created_date          : string
  Status                : any
  TypeName              : string
  Iswrapped             : boolean
}

export interface Region {
  id        : number
  patternId : string
  regionId  : number
  region    : string
}
