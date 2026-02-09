export interface UserSettingsResponse {
  update_preference_request: UpdatePreferenceRequest
  update_profile_request: UpdateProfileRequest
  vouchers: any
  view_voucher_client_request: any
  invoices: any
  credit: Credit
}

export interface UpdatePreferenceRequest {
  language: number
  currency: number
  unit_of_measure: number
  user_roll_types: UserRollType[]
  is_roll_type: boolean
}

export interface UserRollType {
  name: string
  width: number
  purchase_price: number
  sales_coefficient: number
}

export interface UpdateProfileRequest {
  user_id: string
  first_name: string
  last_name: string
  company: string
  email: string
  postal_code: string
  country_code: string
  phone_number: string
  country_id: number
  region_id: number
  ProfileImage: any
  ProfileImageName: any
  ProfileImageStr: any
  profile_image_path: any
  vat_number: any
  is_subscribed: boolean
  subscription_type: number
  subscription_plan: string
  cancel_at: any
  expires_at: string
  user_type: number
  has_voucher_applied: boolean
  discounted_amount: number
  voucher_group_id: any
}

export interface Credit {
  availableCredit: number
}
