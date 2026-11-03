import type { Company, Settings } from "./types";
export const COMPANIES: Company[] = [
  {
    symbol: "RELIANCE",
    name: "Reliance Industries",
    sector: "Energy & retail",
    color: "#7771a6",
  },
  {
    symbol: "HDFCBANK",
    name: "HDFC Bank",
    sector: "Banking",
    color: "#4e6d9b",
  },
  { symbol: "INFY", name: "Infosys", sector: "Technology", color: "#267b94" },
  {
    symbol: "TCS",
    name: "Tata Consultancy Services",
    sector: "Technology",
    color: "#a75675",
  },
  {
    symbol: "ICICIBANK",
    name: "ICICI Bank",
    sector: "Banking",
    color: "#c5844e",
  },
  {
    symbol: "SUNPHARMA",
    name: "Sun Pharmaceutical",
    sector: "Healthcare",
    color: "#c17a5b",
  },
  {
    symbol: "LT",
    name: "Larsen & Toubro",
    sector: "Industrials",
    color: "#92914c",
  },
  { symbol: "ITC", name: "ITC", sector: "Consumer staples", color: "#627498" },
  {
    symbol: "MARUTI",
    name: "Maruti Suzuki",
    sector: "Automobiles",
    color: "#6a9c97",
  },
  {
    symbol: "TITAN",
    name: "Titan Company",
    sector: "Consumer discretionary",
    color: "#518c82",
  },
  {
    symbol: "BHARTIARTL",
    name: "Bharti Airtel",
    sector: "Telecom",
    color: "#b76068",
  },
  {
    symbol: "TATASTEEL",
    name: "Tata Steel",
    sector: "Materials",
    color: "#6d8ba6",
  },
  {
    symbol: "BEL",
    name: "Bharat Electronics",
    sector: "Defence",
    color: "#76894a",
  },
  {
    symbol: "DIXON",
    name: "Dixon Technologies",
    sector: "Electronics",
    color: "#6d7dca",
  },
  {
    symbol: "POLYCAB",
    name: "Polycab India",
    sector: "Electricals",
    color: "#b4925e",
  },
  {
    symbol: "CDSL",
    name: "Central Depository Services",
    sector: "Financial services",
    color: "#7d66a2",
  },
  {
    symbol: "CAMS",
    name: "Computer Age Management",
    sector: "Financial services",
    color: "#6b908b",
  },
  {
    symbol: "KAYNES",
    name: "Kaynes Technology",
    sector: "Electronics",
    color: "#8d7863",
  },
  {
    symbol: "KPITTECH",
    name: "KPIT Technologies",
    sector: "Technology",
    color: "#7a964e",
  },
  { symbol: "TRENT", name: "Trent", sector: "Retail", color: "#7b7ca6" },
  {
    symbol: "PERSISTENT",
    name: "Persistent Systems",
    sector: "Technology",
    color: "#c17d4c",
  },
  {
    symbol: "APLAPOLLO",
    name: "APL Apollo Tubes",
    sector: "Materials",
    color: "#727a82",
  },
];
export const DEFAULT_SETTINGS: Settings = {
  symbols: COMPANIES.slice(0, 18).map((c) => c.symbol),
  rules: {
    pricePercent: 3,
    volumeMultiple: 2,
    categories: [
      "results",
      "M&A",
      "management_change",
      "litigation",
      "capex",
      "fund_raise",
      "pledging",
    ],
    pollMinutes: 5,
  },
  saved: [],
  dismissed: [],
};
export const CATEGORY_LABELS: Record<string, string> = {
  results: "Results",
  "M&A": "Mergers & acquisitions",
  fund_raise: "Capital & buybacks",
  management_change: "Management",
  litigation: "Regulatory & litigation",
  insider_trading: "Insider trades",
  earnings_call: "Earnings call",
  investor_meetings: "Investor meetings",
  credit_rating: "Credit rating",
  dividend: "Dividend",
  bonus_split: "Bonus & split",
  capex: "Capital expenditure",
  press_release: "Business update",
  postal_ballot: "Postal ballot",
  agm_egm: "Shareholder meeting",
  pledging: "Promoter pledging",
  unclassified: "Routine compliance",
};
export function company(symbol: string): Company {
  return (
    COMPANIES.find((c) => c.symbol === symbol) ?? {
      symbol,
      name: symbol,
      sector: "NSE listed company",
      color: "#60867a",
    }
  );
}
