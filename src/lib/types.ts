export type IpoType = "mainboard" | "sme";
export type IpoStatus = "upcoming" | "open" | "closed" | "listed";
export type ApplicationCategory = "retail" | "shni" | "bhni";
export type AllotmentStatus = "pending" | "alloted" | "not_alloted";

export type Ipo = {
  id: string;
  name: string;
  type: IpoType;
  open_date: string | null;
  close_date: string | null;
  listing_date: string | null;
  price_band_min: number | null;
  price_band_max: number | null;
  lot_size: number | null;
  status: IpoStatus;
};

export type PanCard = {
  id: string;
  owner_id: string;
  pan_number: string;
  label: string | null;
  created_at: string;
};

export type Pool = {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
};

export type ProfitRecord = {
  id: string;
  profile_id: string;
  pan_card_id: string | null;
  ipo_id: string | null;
  amount_deducted: number;
  amount_received: number;
  gross_profit: number;
  tax: number;
  net_profit: number;
  created_at: string;
  ipos?: { name: string } | null;
};

export function maskPan(pan: string) {
  if (pan.length < 10) return pan;
  return `${pan.slice(0, 3)}****${pan.slice(-1)}`;
}
