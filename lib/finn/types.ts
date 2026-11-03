export type Category =
  | "results"
  | "M&A"
  | "fund_raise"
  | "management_change"
  | "litigation"
  | "insider_trading"
  | "earnings_call"
  | "investor_meetings"
  | "credit_rating"
  | "dividend"
  | "bonus_split"
  | "capex"
  | "press_release"
  | "postal_ballot"
  | "agm_egm"
  | "pledging"
  | "unclassified";
export type Company = {
  symbol: string;
  name: string;
  sector: string;
  color: string;
};
export type PriceBar = { date: string; close: number; volume: number };
export type Quote = {
  symbol: string;
  currency: string;
  bars: PriceBar[];
  fetchedAt: string;
  source: string;
};
export type Filing = {
  id: string;
  symbol: string;
  company: string;
  subject: string;
  summary: string;
  publishedAt: string;
  url: string;
  category: Category;
  score: number;
  reason: string;
};
export type SourceDocument = {
  id: string;
  symbol: string;
  title: string;
  type: "annual_report" | "transcript" | "results";
  url: string;
  status: "ready" | "failed" | "discovered";
  pages: number;
  error?: string;
  fetchedAt?: string;
};
export type Chunk = {
  id: string;
  documentId: string;
  page: number;
  text: string;
};
export type ResearchPack = {
  symbol: string;
  name: string;
  documents: SourceDocument[];
  chunks: Chunk[];
  fetchedAt: string;
  discoveryUrl: string;
  warnings: string[];
};
export type Rules = {
  pricePercent: number;
  volumeMultiple: number;
  categories: Category[];
  pollMinutes: number;
};
export type Settings = {
  symbols: string[];
  rules: Rules;
  saved: string[];
  dismissed: string[];
};
export type Signal = {
  id: string;
  symbol: string;
  kind: "price" | "volume" | "filing";
  title: string;
  detail: string;
  date: string;
  score: number;
  url?: string;
  filing?: Filing;
  reason: string;
};
export type Evidence = Chunk & {
  score: number;
  title: string;
  url: string;
  type: SourceDocument["type"];
};
export type Snapshot = {
  fetchedAt: string;
  windowStart: string;
  windowEnd: string;
  quotes: Record<string, Quote>;
  filings: Filing[];
  errors: string[];
};
