export type Worker = {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  home_city: string | null;
  is_active: boolean;
  current_site_id: string;
  site_code: string | null;
  site_name: string | null;
  employment_type: string | null;
  contractor_name: string | null;
};

export type SiteOption = { id: string; name: string; code: string };
export type PartyOption = { id: string; name: string; short_code: string | null; type: string };

export type DlgProps<T = object> = {
  worker: Worker | null;
  onClose: () => void;
  onDone: () => void;
} & T;
