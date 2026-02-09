export interface TUserresponse {
  message    : string
  payload    : Payload
  statusCode : number
}

export interface Payload {
  user_name          : string
  last_name          : string
  email              : string
  token              : string
  refresh_token      : string
  user_id            : string
  id                 : number
  user_type          : number
  is_verified        : boolean
  profile_image_path : string
  cart_count         : number
  user_roll_types    : UserRollType[]
  is_subscribed      : boolean
  browser_id         : string
  returnurl          : any
}

export interface UserRollType {
  name              : string
  width             : number
  purchase_price    : number
  sales_coefficient : number
}


export interface TSubscriptionResponse {
  statusCode: number;
}
export interface TUserSettingsResponse {
  update_preference_request: {
    unit_of_measure: 2 | 3;
    user_roll_types:any ;
    currency:any;
  };
}