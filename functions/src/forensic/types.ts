export type RiskLevel = "critical" | "warning" | "normal";

export type RedFlagType =
  | "going_concern" // 継続企業の前提に関する注記・疑義 (GC注記)
  | "covenant_breach" // 財務制限条項への抵触
  | "unsustainable_payout" // 利益超過分配・タコ足配当
  | "negative_operating_cf" // 営業CFマイナス・本業での現金流出
  | "inventory_receivable_surge" // 棚卸資産・売上債権の急増 (DSRI / DSI 異常)
  | "accruals_anomaly" // 総資産アクルーアル比率の異常（ペーパー利益・利益の質の劣化）
  | "asset_quality_deterioration" // 資産の質指数 (AQI) 悪化・費用の資産化
  | "liquidity_crunch" // 短期流動性ショック・資金ショート危機
  | "equity_erosion" // 純資産・利益剰余金毀損・債務超過リスク
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

export type AccountingStandard = "J-GAAP" | "IFRS" | "US-GAAP";
export type FiscalPeriodType = "FY" | "Q1" | "Q2" | "Q3";

/**
 * 単一時点（当期または前期）の財務数値セット（単位：千円）
 */
export interface FinancialSnapshot {
  revenue?: number; // 売上高
  operatingIncome?: number; // 営業利益
  netIncome?: number; // 当期純利益（親会社株主帰属）
  operatingCashFlow?: number; // 営業活動によるキャッシュフロー
  payoutRatio?: number; // 配当性向 (%)
  totalAssets?: number; // 総資産
  tradeReceivables?: number; // 売上債権（受取手形＋売掛金＋契約資産＋電子記録債権）
  inventories?: number; // 棚卸資産
  cashAndDeposits?: number; // 現金及び預金（手元流動性）
  currentAssets?: number; // 流動資産合計
  propertyPlantAndEquipment?: number; // 有形固定資産合計
  currentLiabilities?: number; // 流動負債合計
  netAssets?: number; // 純資産
  retainedEarnings?: number; // 利益剰余金
  investingCashFlow?: number; // 投資活動によるキャッシュフロー
}

export interface QuantitativeCalculations {
  accrualsRatio?: number; // 総資産アクルーアル比率
  dsri?: number; // 売上債権回転期間指数
  dsiIndex?: number; // 棚卸資産回転期間指数
  aqi?: number; // 資産の質指数
  fcf?: number; // フリーキャッシュフロー
  cashCoverage?: number; // 対流動負債現預金比率
  cashDropRate?: number; // 現預金前期比増減率
  equityRatio?: number; // 自己資本比率
  netAssetsDropRate?: number; // 純資産前期比増減率
}

export interface KeyFinancialMetrics {
  // 既存プロパティ（下位互換性維持）
  revenue?: number; // 売上高 (千円)
  operatingIncome?: number; // 営業利益 (千円)
  netIncome?: number; // 当期純利益 (千円)
  operatingCashFlow?: number; // 営業活動によるキャッシュフロー (千円)
  payoutRatio?: number; // 配当性向 (%)
  totalAssets?: number; // 総資産 (千円)
  unit: "千円";

  // フェーズ1 拡張プロパティ
  standard?: AccountingStandard;
  periodType?: FiscalPeriodType;
  isFinancialIndustry?: boolean;
  current?: FinancialSnapshot;
  prior?: FinancialSnapshot;
  calculations?: QuantitativeCalculations;
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
