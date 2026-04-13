export type MunicipalityOption = {
  code: string;
  name: string;
  immediateRegion: string;
  intermediateRegion: string;
  state: "MG";
};

export type ProcurementSummary = {
  id: string;
  controlNumber: string;
  organCnpj: string;
  organName: string;
  unitName: string;
  cityCode: string;
  cityName: string;
  year: number;
  sequence: number;
  purchaseNumber: string;
  processNumber: string;
  object: string;
  modalityId: number;
  modalityName: string;
  statusName: string;
  disputeModeName: string | null;
  estimatedValue: number | null;
  homologatedValue: number | null;
  publicationDate: string;
  openingDate: string | null;
  closingDate: string | null;
  updatedAt: string;
  sourceLink: string | null;
};

export type ProcurementSearchResponse = {
  cityCode: string;
  fetchedAt: string;
  windowDays: number;
  partial: boolean;
  total: number;
  contracts: ProcurementSummary[];
};

export type WinnerCompanyAlert = {
  cnpj: string;
  normalizedCnpj: string;
  legalName: string;
  openedAt: string | null;
  referenceDate: string | null;
  referenceLabel: string;
  ageInDays: number | null;
  ageLabel: string;
  isRecentlyOpened: boolean;
  registryStatus: string | null;
};

export type ProcurementItemInsight = {
  itemNumber: number;
  description: string;
  quantity: number | null;
  unit: string | null;
  estimatedUnitValue: number | null;
  totalValue: number | null;
  judgmentCriterion: string | null;
  winnerName: string | null;
  winnerDocument: string | null;
  winnerType: string | null;
  awardDate: string | null;
  awardValue: number | null;
  supplier: WinnerCompanyAlert | null;
  analysisError: string | null;
};

export type ProcurementDetailsResponse = {
  controlNumber: string;
  analyzedAt: string;
  hasRecentCompanyAlert: boolean;
  alertCount: number;
  items: ProcurementItemInsight[];
};
