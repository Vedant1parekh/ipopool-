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
