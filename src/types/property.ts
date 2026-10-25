export interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  down_payment_percent: number;
  monthly_payment: number;
  term_months: number;
  image_urls: string[];
  interested_count: number;
  status: string;
  category?: string;
  location?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  garages?: number;
  year?: number;
  make?: string;
  car_model?: string;
  mileage?: number;
  transmission?: string;
  fuel_type?: string;
  property_url?: string;
}

export interface CustomPropertyRequest {
  id: string;
  category: string;
  external_url: string;
  location: string;
  total_price: number;
  upfront_deposit: number;
  is_national_or_resident: boolean;
  begin_documentation_immediately: boolean;
  term_months: number;
  monthly_payment: number;
  status: string;
  created_at: string;
}

export interface PropertyInvestment {
  id: string;
  user_id: string;
  property_id: string;
  amount_paid: number;
  remaining_balance: number;
  down_payment_paid: boolean;
  status: string;
  term_months: number;
  monthly_payment: number;
  created_at?: string;
  property?: {
    title: string;
  };
}

export type PropertyCategoryTab = 'House' | 'Car';

export interface PropertyFilterState {
  searchQuery: string;
  minPrice: string;
  maxPrice: string;
  minBeds: string;
  minBaths: string;
  carTrans: string;
  carFuel: string;
}
