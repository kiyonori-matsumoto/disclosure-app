export type RiskLevel = "critical" | "warning" | "normal";

export type RedFlagType =
  | "going_concern" // 継続企業の前提に関する注記・疑義 (GC注記)
  | "covenant_breach" // 財務制限条項への抵触
  | "unsustainable_payout" // 利益超過分配・タコ足配当
  | "negative_operating_cf" // 営業CFマイナス・本業での現金流出
  | "inventory_receivable_surge" // 棚卸資産・売上債権の急増
  | "impairment_loss" // 減損損失・兆候
  | "interest_debt_pressure" // 利払い負担増・借入急増
  | "subsequent_events"; // 重大な後発事象

export type ToneTag =
  | "blame_external_macro" // 為替・原材料高など外部環境への全責任転嫁
  | "blame_temporary_one_off" // 一過性の先行投資・システム切替費用等と主張
  | "unfounded_optimism" // 「足元底打ち」「下期回復」等具体的数値根拠を欠く楽観表現
  | "risk_materialized" // 損害賠償・訴訟・不正等リスク顕在化
  | "new_major_risk" // 新規重大リスク項目の追加
  | "tone_retreat"; // 強気文言の削除・慎重表現への後退

export type CauseTag =
  | "fx_fluctuation" // 為替変動
  | "raw_material_energy" // 原材料・光熱費高騰
  | "weather_or_disaster" // 天候不順・災害
  | "market_or_geopolitics" // 市況悪化・地政学リスク
  | "upfront_investment" // 先行投資・システム切替費用等
  | "weak_sales_or_churn" // 販売数量減・顧客離れ
  | "delayed_price_pass"; // 価格転嫁（値上げ）の遅れ

export type BlameAttribution =
  | "external_macro_dominant"
  | "temporary_one_off"
  | "internal_acknowledged"
  | "none";

export interface KeyFinancialMetrics {
  revenue?: number; // 売上高 (千円)
  operatingIncome?: number; // 営業利益 (千円)
  netIncome?: number; // 当期純利益 (千円)
  operatingCashFlow?: number; // 営業活動によるキャッシュフロー (千円)
  payoutRatio?: number; // 配当性向 (%)
  totalAssets?: number; // 総資産 (千円)
  unit: "千円";
}

export interface ForensicResult {
  version: 1;
  analyzedAt: number; // Unix timestamp (秒)
  riskLevel: RiskLevel;
  tags: (RedFlagType | ToneTag)[];
  causes: CauseTag[];
  metrics?: KeyFinancialMetrics;
  details: {
    blameAttribution: BlameAttribution;
    unfoundedOptimism: boolean;
    hasNegativeFactors: boolean;
  };
}
