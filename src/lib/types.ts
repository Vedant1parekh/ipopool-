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

export type IpoDetails = Ipo & {
  symbol: string | null;
  slug: string | null;
  logo_url: string | null;
  about: string | null;
  strengths: string[] | null;
  risks: string[] | null;
  schedule: { event: string; date: string }[] | null;
  issue_size: string | null;
  min_amount: number | null;
  prospectus_url: string | null;
  nse_info_url: string | null;
  bse_info_url: string | null;
  type_of_issue: string | null;
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
  ipo_id: string;
  category: ApplicationCategory;
  created_at: string;
};

export type ApplicationMember = {
  profile_id: string;
  pan_card_id: string | null;
  profiles: { display_name: string } | null;
  pan_cards: { pan_number: string; label: string | null } | null;
};

// A permanent snapshot of an alloted application (see migration 0029) —
// frozen at alloted-time and kept in sync with amount/payment/remarks
// edits for as long as the source pool_applications row still exists.
// application_id/pool_id turn null once the source pool is deleted; the
// row itself never is, so this is what the Allotments and Profit & Loss
// pages fall back to once a pool is gone.
export type AllotmentRecord = {
  id: string;
  application_id: string | null;
  pool_id: string | null;
  ipo_id: string | null;
  pan_card_id: string | null;
  pool_name: string;
  ipo_name: string;
  listing_date: string | null;
  category: ApplicationCategory;
  pan_number: string;
  pan_label: string | null;
  applicant_profile_id: string;
  applicant_name: string;
  amount_deducted: number | null;
  amount_received: number | null;
  gross_profit: number | null;
  tax: number | null;
  net_profit: number | null;
  payment_status: string;
  remarks: string | null;
  last_modified_by: string | null;
  alloted_at: string;
};

export type AllotmentRecordMember = {
  allotment_record_id: string;
  profile_id: string;
  member_name: string;
  pan_card_id: string | null;
  pan_number: string | null;
  pan_label: string | null;
};

// Only the first and last character stay visible, e.g. "ABCDE1234F" -> "A********F".
export function maskPan(pan: string) {
  if (pan.length <= 2) return pan;
  return `${pan[0]}${"*".repeat(pan.length - 2)}${pan[pan.length - 1]}`;
}
