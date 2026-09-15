export type BankId = "karimi" | "ycb" | "tadhamon";

export type QuickHighlightConfig = {
  /** Default fill used when marking qualifying credit rows in the quick statement. */
  depositColor: string;
  /** Default fill used by the keyword matching control in the quick statement. */
  keywordColor: string;
  label: string;
};

/**
 * Quick-statement-only visual settings. Official statements and status documents
 * must not consume these values.
 */
export const QUICK_HIGHLIGHT_CONFIG: Record<BankId, QuickHighlightConfig> = {
  tadhamon: { depositColor: "#ffed00", keywordColor: "#dcfce7", label: "بنك التضامن" },
  ycb: { depositColor: "#fef08a", keywordColor: "#fef9c3", label: "البنك التجاري اليمني" },
  karimi: { depositColor: "#e5e7eb", keywordColor: "#e5e7eb", label: "بنك الكريمي" },
};

export function getQuickHighlightConfig(bank: BankId): QuickHighlightConfig {
  return QUICK_HIGHLIGHT_CONFIG[bank];
}
