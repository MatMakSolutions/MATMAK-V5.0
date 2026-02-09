export interface TSearchResult {
  needReload : boolean
  searchId   : string;
  message    : string
  payload    : Payload
  statusCode : number
}

export interface Payload {
  productSearchRequest      : ProductSearchRequest
  car_id                    : string
  carName                   : string
  carImage                  : string
  precutpatternListResponse : PrecutpatternListResponse
}

export interface ProductSearchRequest {
  category_id : number
  make_id     : number
  series_id   : number
  model_id    : number
  year_id     : number
  version_id  : number
  region_id   : number
  filters     : Filters
}

export interface Filters {
  search_text : string
  page        : number
  page_size   : number
  sort_column : string
  sort_order  : string
  filters     : string
  user_id     : string
}

export interface PrecutpatternListResponse {
  data            : PatternFile[]
  number_of_pages : number
  current_page    : number
  page_size       : number
  record_count    : number
  page_list       : number[]
}

export interface PatternFile {
  guid              ?: string
  pattern_id         : string
  name               : string
  regions            : any
  surface            : number
  rating             : number
  bitmap_image       : string
  vector_image       : string
  is_favorite        : boolean
  is_added_cart      : boolean
  car_pattern_region : string
  created_date       : string
  Status             : any
  TypeName           : string
  Iswrapped          : boolean
}
