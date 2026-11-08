> [!IMPORTANT]
> **【重要保守作業】過去フォレンジックデータ（Firestore）の削除・再計算ToDo**
> 過去に旧計算ロジック（単体/連結混在、未正規化の配当性向、旧GC判定等）で計算・保存された `disclosures` および `edinets` コレクションの `forensic` フィールドは計算誤りが含まれているため、**本番データ移行・再評価時に削除（リセット）が必要**です。
> `forensicTrigger.ts` は `if (data.forensic) return;` のスキップガードがあるため、ドキュメントの `forensic: FieldValue.delete()` を実行することで新エンジンによる再計算がトリガーされます。

追加すべき最重要フォレンジック指標は、「総資産アクルーアル比率」「売上債権回転期間指数（DSRI）」「棚卸資産回転期間指数（DSI Index）」「資産の質指数（AQI）」「FCF対配当・営業CFギャップ」「手元流動性・短期負債カバー率」「利益剰余金毀損率」の7つである。

既存の6指標に「売上債権」「棚卸資産」「現金預金」「流動資産」「有形固定資産」「流動負債」「純資産（利益剰余金）」「投資CF」の8つの基礎勘定科目を追加抽出するだけで、Beneish M-Scoreの中核変数、Sloanのアクルーアル異常、および黒字倒産・タコ足配当リスクを単一XBRL（当期・前期比較）から完全に自動判定できる。

---

## 1. 最重要フォレンジック指標一覧（優先度順）

| 優先度・指標名 | フォレンジック上の検知目的 | 取得対象XBRLタグ例（J-GAAP / IFRS） | 判定式・しきい値（Warning / Critical） | 短信取得可否 |
| --- | --- | --- | --- | --- |
| **1. 総資産アクルーアル比率**<br>

<br>(Sloan's Accruals) | 架空売上・費用繰延による「キャッシュを伴わない見せかけの利益」の検知 | 既存取得済タグのみ<br>

<br>（`netIncome`, `operatingCashFlow`, `totalAssets`） | `式`: (当期純利益 － 営業CF) ÷ 総資産<br>

<br>`Warn`: 0.08（8%）超<br>

<br>`Crit`: 0.15（15%）超 | **可**<br>

<br>（CF記載時） |
| **2. 売上債権回転期間指数**<br>

<br>(Beneish DSRI) | 期末の押し込み販売（チャネル・スタッフィング）、架空売上の計上、回収不能債権の滞留検知 | `J-GAAP`: NotesAndAccountsReceivableTradeAndContractAssets 等<br>

<br>`IFRS`: TradeAndOtherCurrentReceivables 等 | `式`: (当期売上債権 ÷ 当期売上高) ÷ (前期売上債権 ÷ 前期売上高)<br>

<br>`Warn`: 1.20 超<br>

<br>`Crit`: 1.465 超 | **可** |
| **3. 棚卸資産回転期間指数**<br>

<br>(DSI Index) | 架空在庫の計上、製造原価の棚卸資産への不正付け替え（原価圧縮）、不良在庫の滞留検知 | `J-GAAP`: Inventories（または商品・仕掛品・原材料の合算）<br>

<br>`IFRS`: Inventories | `式`: (当期棚卸資産 ÷ 当期売上高) ÷ (前期棚卸資産 ÷ 前期売上高)<br>

<br>`Warn`: 1.25 超<br>

<br>`Crit`: 1.50 超 | **可** |
| **4. 資産の質指数**<br>

<br>(Beneish AQI) | 費用とすべき支出の無形資産・長期前払費用・仮払金・のれん等への不正な資産計上（繰延）の検知 | `J-GAAP`: CurrentAssets, PropertyPlantAndEquipment<br>

<br>`IFRS`: CurrentAssets, PropertyPlantAndEquipment | `式`: 当期非流動・非有形資産比率 ÷ 前期同比率（※詳細式は後述）<br>

<br>`Warn`: 1.15 超<br>

<br>`Crit`: 1.254 超 | **可** |
| **5. FCF・配当ギャップ**<br>

<br>(タコ足配当・資金枯渇) | 本業のFCFや利益剰余金を無視した借入金依存の無理な配当維持（ポンジ・スキーム的還元）の検知 | `J-GAAP`: NetCashProvidedByUsedInInvestingActivities, RetainedEarnings<br>

<br>`IFRS`: CashFlowsFromUsedInInvestingActivities, RetainedEarnings | `式`: FCF（営業CF＋投資CF）＜ 0 かつ 配当性向 ＞ 50%（または利益剰余金マイナス）<br>

<br>`Warn`: FCF赤字＋有配<br>

<br>`Crit`: 営業CF赤字＋配当性向100%超 | **可**<br>

<br>（CF記載時） |
| **6. 短期流動性ショック率**<br>

<br>(資金ショート予兆) | 急激な現預金の流出と短期債務の膨張による、1年以内の黒字倒産・資金ショートリスクの検知 | `J-GAAP`: CashAndDeposits, CurrentLiabilities<br>

<br>`IFRS`: CashAndCashEquivalents, CurrentLiabilities | `式`: 手元現預金 ÷ 流動負債（および現預金の前期比増減率）<br>

<br>`Warn`: 比率 0.15 未満 かつ 現預金30%減<br>

<br>`Crit`: 比率 0.08 未満 かつ 営業CF赤字 | **可** |
| **7. 純資産・利益剰余金毀損率**<br>

<br>(債務超過リスク) | 継続的な赤字や減損による自己資本の急減、上場維持基準抵触・期限の利益喪失リスクの検知 | `J-GAAP`: NetAssets, RetainedEarnings<br>

<br>`IFRS`: EquityAttributableToOwnersOfParent, RetainedEarnings | `式`: 当期純資産 ÷ 前期純資産、および 自己資本比率（純資産 ÷ 総資産）<br>

<br>`Warn`: 自己資本比率 10%未満<br>

<br>`Crit`: 利益剰余金マイナス かつ 純資産30%以上減少 | **可** |

---

## 2. 会計基準別 XBRL要素名（タクソノミタグ）マッピング

EDINET（`jppfs_cor`, `jpcrp_cor`, `jpigp_cor`）および TDnet（`tse-ed-t` 等）では、企業の業種や開示粒度によってタグが分岐する。`ix:nonfraction` の `name` 属性に対して、コロンの後ろのローカル名（Local Name）を以下の優先順位リスト（フォールバック方式）または合算ルールで抽出する設計が最も安定する。

### 基礎勘定科目のタグ抽出定義

* **売上債権（Trade Receivables）**
* **J-GAAP**: 2021年の収益認識会計基準適用以降、`NotesAndAccountsReceivableTradeAndContractAssets`（受取手形、売掛金及び契約資産）が主流。一括掲記されない場合は、`NotesAndAccountsReceivableTrade`、`NotesReceivableTrade`（受取手形）、`AccountsReceivableTrade`（売掛金）、`ContractAssets`（契約資産）、`ElectronicallyRecordedMonetaryClaimsOperating`（電子記録債権）の存在するものを合算する。
* **IFRS**: `TradeAndOtherCurrentReceivables`（営業債権及びその他の債権）を第一候補とし、なければ `TradeReceivables` を取得。
* **US-GAAP**: `AccountsReceivableNetCurrent` または `ReceivablesNetCurrent`。


* **棚卸資産（Inventories）**
* **J-GAAP**: 一括掲記タグ `Inventories` があればそれを採用。内訳表示の企業が多いため、`Inventories` が存在しない場合は `MerchandiseAndFinishedGoods`（商品及び製品）、`Merchandise`（商品）、`FinishedGoods`（製品）、`WorkInProcess`（仕掛品）、`RawMaterialsAndSupplies`（原材料及び貯蔵品）、および不動産業向けの `RealEstateForSale`（販売用不動産）、`RealEstateForSaleInProcess`（仕掛販売用不動産）を合算する。
* **IFRS**: `Inventories`（IFRSは原則としてBS上で一括掲記されるため単一タグで安定取得可能）。
* **US-GAAP**: `InventoryNet`。


* **現金及び預金（Cash and Cash Equivalents）**
* **J-GAAP**: BSタグの `CashAndDeposits` を第一候補とし、欠損時はCFタグの `CashAndCashEquivalents` で代替。
* **IFRS**: `CashAndCashEquivalents`。
* **US-GAAP**: `CashAndCashEquivalentsAtCarryingValue`。


* **流動資産（Current Assets） / 有形固定資産（PPE）**
* **J-GAAP**: `CurrentAssets` / `PropertyPlantAndEquipment`
* **IFRS**: `CurrentAssets` / `PropertyPlantAndEquipment`
* **US-GAAP**: `AssetsCurrent` / `PropertyPlantAndEquipmentNet`


* **流動負債（Current Liabilities）**
* **J-GAAP**: `CurrentLiabilities`
* **IFRS**: `CurrentLiabilities`
* **US-GAAP**: `LiabilitiesCurrent`


* **投資活動によるキャッシュ・フロー（Investing CF）**
* **J-GAAP**: `NetCashProvidedByUsedInInvestingActivities`（またはサマリー用の `CashFlowsFromUsedInInvestingActivities`）
* **IFRS**: `CashFlowsFromUsedInInvestingActivities`
* **US-GAAP**: `NetCashProvidedByUsedInInvestingActivities`


* **純資産（Net Assets） / 利益剰余金（Retained Earnings）**
* **J-GAAP**: `NetAssets` / `RetainedEarnings`
* **IFRS**: `EquityAttributableToOwnersOfParent`（親会社の所有者に帰属する持分）または `Equity` / `RetainedEarnings`
* **US-GAAP**: `StockholdersEquity` / `RetainedEarningsAccumulatedDeficit`



---

## 3. 定量判定ルールとしきい値の財務的根拠

単一の開示ファイル内にある当期コンテキスト（`CurrentYearInstant` / `CurrentYearDuration`）と前期コンテキスト（`Prior1YearInstant` / `Prior1YearDuration`）を用いて算出する。以下の数式において、添字 $t$ は当期、$t-1$ は前期を表す。

### ① 総資産アクルーアル比率（Sloan's Accruals）

$$\text{Accruals Ratio} = \frac{\text{NetIncome}_t - \text{OperatingCF}_t}{\text{TotalAssets}_t}$$

* **判定基準**: Warning: `0.08` 超 / Critical: `0.15` 超
* **財務的根拠**: 会計上の利益とキャッシュフローの乖離（会計発生高）を総資産規模で標準化した指標。通常、健全な企業のアクルーアル比率はマイナス（減価償却費等の非資金費用により 営業CF ＞ 純利益 となるため）からプラス数%の範囲に収まる。これが8%〜15%を超える状態は、現金回収を伴わない売上計上や、減価償却・引当金の過少計上、費用の資産化が異常な規模で行われていることを示す。日本企業の過去の粉飾事例（オリンパス、東芝、グレイステクノロジー等）でも例外なく高止まりが観測される。

### ② 売上債権回転期間指数（DSRI: Days Sales in Receivables Index）

$$\text{DSRI} = \frac{\text{Receivables}_t / \text{Revenue}_t}{\text{Receivables}_{t-1} / \text{Revenue}_{t-1}}$$

* **判定基準**: Warning: `1.20` 超 / Critical: `1.465` 超
* **財務的根拠**: 売上高に対する売掛金・契約資産の比率が前期比でどれだけ膨張したかを示す。Beneish教授のオリジナル論文における不正企業の平均値が `1.465`（非不正企業は `1.031`）。売上が伸びているにもかかわらずDSRIが急上昇している場合、実態のない架空売上の計上（入金されないため売掛金としてBSに残る）や、期末の押し込み販売により回収サイトが長期化している可能性が極めて高い。

### ③ 棚卸資産回転期間指数（DSI Index）

$$\text{DSI Index} = \frac{\text{Inventories}_t / \text{Revenue}_t}{\text{Inventories}_{t-1} / \text{Revenue}_{t-1}}$$


※XBRLから売上原価（`CostOfSales`）は業種別タグ分岐が多く取得漏れが起きやすいため、実装安定性を優先して分母に `Revenue`（売上高）を使用する（粗利率が一定なら数学的に同義であり、仮に粗利率を不正に引き上げていればさらに検知感度が上がる）。

* **判定基準**: Warning: `1.25` 超 / Critical: `1.50` 超
* **財務的根拠**: 売上規模に対して在庫が異常に積み上がっている状態を示す。小売・製造業等における典型的な粉飾手口である「期末棚卸資産の水増しによる売上原価の過少計上（利益の捏造）」や、陳腐化した不良在庫の評価損計上先送りを直接あぶり出す。

### ④ 資産の質指数（AQI: Asset Quality Index）

$$\text{NonRealizableRatio}_t = 1 - \frac{\text{CurrentAssets}_t + \text{PPE}_t}{\text{TotalAssets}_t}$$

$$\text{AQI} = \frac{\text{NonRealizableRatio}_t}{\text{NonRealizableRatio}_{t-1}}$$

* **判定基準**: Warning: `1.15` 超 / Critical: `1.254` 超（ただし当期の $\text{NonRealizableRatio}_t$ が `0.15` 未満の軽微な場合は除外）
* **財務的根拠**: 総資産に占める「流動資産」と「有形固定資産（PPE）」以外の資産（＝無形固定資産、のれん、ソフトウェア仮勘定、投資その他の資産、繰延資産など、換金性や実在性の検証が難しい資産）の割合の増加率。Beneishモデルの不正企業平均である `1.254` をCritical基準とする。本来PLで費用処理すべき販管費や開発費を「ソフトウェア」や「長期前払費用」「関係会社貸付金」としてBSに退避させる粉飾手口（費用の資産化）を検知する。

### ⑤ FCF・配当ギャップ ＆ 利益剰余金毀損（タコ足配当検知）

$$\text{FCF}_t = \text{OperatingCF}_t + \text{InvestingCF}_t$$

* **判定基準**:
* Warning: $\text{FCF}_t$ がマイナス かつ $\text{PayoutRatio}_t$ が `50%` 超
* Critical: （$\text{OperatingCF}_t$ がマイナス かつ $\text{PayoutRatio}_t$ が `100%` 超）または（$\text{RetainedEarnings}_t$ がマイナス かつ 有配）


* **財務的根拠**: 既存の「配当性向100%超」だけでは、純利益が粉飾（架空計上）されている場合にタコ足配当を見逃す。キャッシュフローベース（FCF）および累積利益（利益剰余金）とクロスチェックすることで、「帳簿上の利益は出ているが現金は流出しており、借入金や増資で調達した資金をそのまま配当に回している」という極めて危険な資金繰り悪化を検知する。

### ⑥ 短期流動性ショック率（手元流動性カバー率）

$$\text{CashToCurrentLiabilities}_t = \frac{\text{Cash}_t}{\text{CurrentLiabilities}_t}, \quad \text{CashChangeRate} = \frac{\text{Cash}_t - \text{Cash}_{t-1}}{\text{Cash}_{t-1}}$$

* **判定基準**:
* Warning: $\text{CashToCurrentLiabilities}_t$ が `0.15` 未満 かつ $\text{CashChangeRate}$ が `-0.30`（30%減）以下
* Critical: $\text{CashToCurrentLiabilities}_t$ が `0.08` 未満 かつ $\text{OperatingCF}_t$ がマイナス


* **財務的根拠**: 1年以内に返済・支払期限が到来する流動負債に対し、即座に動かせる現預金が8%未満しかなく、かつ営業CFが赤字で資金が自然流入しない状態は、銀行からの追加融資やリスケジュールが止まった瞬間に不渡り・黒字倒産に至る直前状態を示す。

---

## 4. 実装上の注意点と業種・四半期考慮

### ① 一般事業会社と金融業（銀行・証券・保険）の分岐処理

* **金融業の除外・別ロジック化が必須**: 銀行業（`jpcrp_cor` 等の業種コードや、`OrdinaryIncomeBNK` 等の銀行専用タグの有無で判定）や保険業・証券業は、BSが流動・固定に区分されない（分類不明BS）ため、`CurrentAssets` や `CurrentLiabilities`、`Inventories` が存在しない。また、融資残高の増減が営業CFに直結するため、一般事業会社と同じ基準でアクルーアルや営業CFマイナスを判定すると大量の誤検知（False Positive）が発生する。
* **対策**: XBRLのタクソノミ名前空間または勘定科目に `BNK`（銀行）、`SEC`（証券）、`INS`（保険）が含まれる場合、あるいは `CurrentAssets` タグが存在しない場合は、DSRI・DSI・AQI・アクルーアル判定をスキップし、「純資産毀損率」と「配当性向異常」のみを適用するガード節を設ける。

### ② 決算短信（第1Q〜第3Q四半期短信）における期間ミスマッチの補正

* **PLとBSの期間非対称性**: 四半期決算短信（1Q/2Q/3Q）に含まれる比較用BSの「前期値」は、前年同四半期末ではなく「前事業年度末（本決算期末）」の数値（コンテキストID: `Prior1YearInstant`）である。一方、PLの売上高は「当第X四半期累計期間（`CurrentYTDDuration`）」と「前年同四半期累計期間（`Prior1YTDDuration`）」である。
* **回転期間指数（DSRI / DSI）の整合性確保**:
* 1Q〜3Qの短信単体からDSRIやDSIを計算する場合、分子の「当期売上債権 ÷ 当期累計売上高」と、分母の「前期末売上債権 ÷ 前年同期累計売上高」を比較しても、両者ともに同じ累計月数（3ヶ月・6ヶ月・9ヶ月）の売上高で割っているため、**年換算係数は約分されて消去される**。したがって、計算式自体はそのまま適用可能である。
* **例外（季節変動バイアス）**: ただし、分母のBS値が「前事業年度末（3月末など）」、分子のBS値が「四半期末（6月末や12月末など）」となるため、売上に強い季節性がある企業（3月に売上が集中する建設・IT等）では、四半期末と本決算期末の比較でDSRIが歪む。四半期短信ではDSRI/DSIのしきい値を **1.2倍緩和（例: Criticalを 1.465 から 1.75 へ引き上げ）** するか、本決算・有報のみCriticalを発火させ四半期はWarning留めとする制御が実務上最もノイズが少ない。


* **四半期短信でのCF計算書省略への対応**: 東証の四半期開示見直しにより、第1Q・第3Q決算短信ではキャッシュ・フロー計算書の添付を省略する企業が増えている。`operatingCashFlow` が `null` または `undefined` となるケースを正常系として扱い、アクルーアル比率やFCF判定を安全にスキップするNull安全設計にする必要がある。

---

## 5. TypeScript 実装コード（インターフェース・抽出定義・判定ロジック）

既存の `cheerio` 解析エンジンにそのまま統合できる型定義と判定ロジックの実装案を以下に示す。

```typescript
/**
 * 会計基準の識別型
 */
export type AccountingStandard = 'J-GAAP' | 'IFRS' | 'US-GAAP';

/**
 * 開示期間の種別（四半期補正用）
 */
export type FiscalPeriodType = 'FY' | 'Q1' | 'Q2' | 'Q3';

/**
 * 単一時点（当期または前期）の財務数値セット（単位：千円に正規化済）
 */
export interface FinancialSnapshot {
  // --- 既存取得指標 ---
  revenue: number | null;              // 売上高
  operatingIncome: number | null;      // 営業利益
  netIncome: number | null;            // 当期純利益（親会社株主帰属）
  operatingCashFlow: number | null;    // 営業活動によるCF
  payoutRatio: number | null;          // 配当性向（%）
  totalAssets: number | null;          // 総資産

  // --- フェーズ1 追加取得指標 ---
  tradeReceivables: number | null;     // 売上債権（受取手形＋売掛金＋契約資産＋電子記録債権）
  inventories: number | null;          // 棚卸資産
  cashAndDeposits: number | null;      // 現金及び預金（手元流動性）
  currentAssets: number | null;        // 流動資産合計
  propertyPlantAndEquipment: number | null; // 有形固定資産合計
  currentLiabilities: number | null;   // 流動負債合計
  netAssets: number | null;            // 純資産（または親会社所有者帰属持分）
  retainedEarnings: number | null;     // 利益剰余金
  investingCashFlow: number | null;    // 投資活動によるCF
}

/**
 * 単一XBRLから抽出された当期・前期のペアデータ
 */
export interface KeyFinancialMetrics {
  standard: AccountingStandard;
  periodType: FiscalPeriodType;
  isFinancialIndustry: boolean;        // 銀行・証券・保険フラグ
  current: FinancialSnapshot;          // 当期実績
  prior: FinancialSnapshot;            // 前期実績（BSは前期末、PL/CFは前年同期）
}

/**
 * フォレンジック検知アラートの型定義
 */
export type Severity = 'WARNING' | 'CRITICAL';

export interface ForensicRedFlag {
  code:
    | 'ACCRUALS_ANOMALY'
    | 'DSRI_SPIKE'
    | 'INVENTORY_BLOAT'
    | 'ASSET_QUALITY_DETERIORATION'
    | 'UNSOUNDS_DIVIDEND_FCF_GAP'
    | 'LIQUIDITY_CRUNCH'
    | 'EQUITY_EROSION';
  severity: Severity;
  metricName: string;
  calculatedValue: number;
  threshold: number;
  description: string;
}

/**
 * XBRLローカル要素名（name属性のコロン以降）の抽出マッピング定義
 * mode: 'FIRST_MATCH' は配列順で最初にヒットしたタグを採用、'SUM_IF_NO_TOTAL' は代表タグがなければ内訳を合算
 */
export const XBRL_TAG_DICTIONARY = {
  tradeReceivables: {
    totalTags: [
      'NotesAndAccountsReceivableTradeAndContractAssets', // J-GAAP 収益認識基準後
      'NotesAndAccountsReceivableTrade',                  // J-GAAP 旧基準・一般
      'TradeAndOtherCurrentReceivables',                  // IFRS
      'TradeReceivables',                                 // IFRS
      'AccountsReceivableNetCurrent',                     // US-GAAP
      'ReceivablesNetCurrent',                            // US-GAAP
    ],
    componentTags: [
      'NotesReceivableTrade',                             // 受取手形
      'AccountsReceivableTrade',                          // 売掛金
      'ContractAssets',                                   // 契約資産
      'ElectronicallyRecordedMonetaryClaimsOperating',    // 電子記録債権（営業）
    ],
  },
  inventories: {
    totalTags: [
      'Inventories',                                      // J-GAAP一括 / IFRS
      'InventoryNet',                                     // US-GAAP
    ],
    componentTags: [
      'MerchandiseAndFinishedGoods',                      // 商品及び製品
      'Merchandise',                                      // 商品
      'FinishedGoods',                                    // 製品
      'WorkInProcess',                                    // 仕掛品
      'RawMaterialsAndSupplies',                          // 原材料及び貯蔵品
      'RealEstateForSale',                                // 販売用不動産
      'RealEstateForSaleInProcess',                       // 仕掛販売用不動産
    ],
  },
  cashAndDeposits: {
    totalTags: [
      'CashAndDeposits',                                  // J-GAAP BS
      'CashAndCashEquivalents',                           // IFRS / J-GAAP CF
      'CashAndCashEquivalentsAtCarryingValue',            // US-GAAP
    ],
  },
  currentAssets: {
    totalTags: ['CurrentAssets', 'AssetsCurrent'],
  },
  propertyPlantAndEquipment: {
    totalTags: ['PropertyPlantAndEquipment', 'PropertyPlantAndEquipmentNet'],
  },
  currentLiabilities: {
    totalTags: ['CurrentLiabilities', 'LiabilitiesCurrent'],
  },
  netAssets: {
    totalTags: [
      'NetAssets',                                        // J-GAAP
      'EquityAttributableToOwnersOfParent',               // IFRS（親会社帰属優先）
      'Equity',                                           // IFRS
      'StockholdersEquity',                               // US-GAAP
    ],
  },
  retainedEarnings: {
    totalTags: [
      'RetainedEarnings',                                 // J-GAAP / IFRS
      'RetainedEarningsAccumulatedDeficit',               // US-GAAP
    ],
  },
  investingCashFlow: {
    totalTags: [
      'NetCashProvidedByUsedInInvestingActivities',       // J-GAAP / US-GAAP
      'CashFlowsFromUsedInInvestingActivities',           // IFRS / 短信サマリー
    ],
  },
} as const;

/**
 * 財務フォレンジック判定エンジン
 */
export function evaluateForensicRisks(data: KeyFinancialMetrics): ForensicRedFlag[] {
  const flags: ForensicRedFlag[] = [];
  const { current: cur, prior: pri, periodType, isFinancialIndustry } = data;

  // 四半期（Q1〜Q3）の場合は季節変動ノイズを抑えるため回転期間系のしきい値を1.2倍に緩和
  const seasonalMultiplier = periodType === 'FY' ? 1.0 : 1.2;

  // ---------------------------------------------------------------------------
  // 1. 総資産アクルーアル比率 (Sloan's Accruals) ※金融業は除外
  // ---------------------------------------------------------------------------
  if (
    !isFinancialIndustry &&
    cur.netIncome !== null &&
    cur.operatingCashFlow !== null &&
    cur.totalAssets !== null &&
    cur.totalAssets > 0
  ) {
    // 四半期累計の場合は年換算して総資産と比較
    const annualizeFactor =
      periodType === 'Q1' ? 4 : periodType === 'Q2' ? 2 : periodType === 'Q3' ? 4 / 3 : 1;
    const accrualsRatio =
      ((cur.netIncome - cur.operatingCashFlow) * annualizeFactor) / cur.totalAssets;

    if (accrualsRatio > 0.15) {
      flags.push({
        code: 'ACCRUALS_ANOMALY',
        severity: 'CRITICAL',
        metricName: '総資産アクルーアル比率',
        calculatedValue: Number(accrualsRatio.toFixed(4)),
        threshold: 0.15,
        description: `利益と営業CFの乖離が総資産の${(accrualsRatio * 100).toFixed(1)}%に達しており、架空利益計上または費用の不正繰延の強い兆候がある。`,
      });
    } else if (accrualsRatio > 0.08) {
      flags.push({
        code: 'ACCRUALS_ANOMALY',
        severity: 'WARNING',
        metricName: '総資産アクルーアル比率',
        calculatedValue: Number(accrualsRatio.toFixed(4)),
        threshold: 0.08,
        description: `キャッシュの裏付けがない会計上の利益（アクルーアル）が高水準（対総資産${(accrualsRatio * 100).toFixed(1)}%）となっている。`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. 売上債権回転期間指数 (Beneish DSRI) ※金融業は除外
  // ---------------------------------------------------------------------------
  if (
    !isFinancialIndustry &&
    cur.tradeReceivables !== null &&
    cur.revenue !== null &&
    cur.revenue > 0 &&
    pri.tradeReceivables !== null &&
    pri.revenue !== null &&
    pri.revenue > 0 &&
    pri.tradeReceivables > 0
  ) {
    const curTurnover = cur.tradeReceivables / cur.revenue;
    const priTurnover = pri.tradeReceivables / pri.revenue;
    const dsri = curTurnover / priTurnover;

    const critThreshold = Number((1.465 * seasonalMultiplier).toFixed(3));
    const warnThreshold = Number((1.20 * seasonalMultiplier).toFixed(3));

    if (dsri > critThreshold) {
      flags.push({
        code: 'DSRI_SPIKE',
        severity: 'CRITICAL',
        metricName: '売上債権回転期間指数 (DSRI)',
        calculatedValue: Number(dsri.toFixed(3)),
        threshold: critThreshold,
        description: `売上規模に対する売上債権が前期比${dsri.toFixed(2)}倍に急膨張。期末の押し込み販売・架空売上・回収不能債権滞留の危険域。`,
      });
    } else if (dsri > warnThreshold) {
      flags.push({
        code: 'DSRI_SPIKE',
        severity: 'WARNING',
        metricName: '売上債権回転期間指数 (DSRI)',
        calculatedValue: Number(dsri.toFixed(3)),
        threshold: warnThreshold,
        description: `売上債権の回転期間が前期比${dsri.toFixed(2)}倍に悪化しており、回収サイトの長期化が見られる。`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 3. 棚卸資産回転期間指数 (DSI Index) ※金融業は除外
  // ---------------------------------------------------------------------------
  if (
    !isFinancialIndustry &&
    cur.inventories !== null &&
    cur.revenue !== null &&
    cur.revenue > 0 &&
    pri.inventories !== null &&
    pri.revenue !== null &&
    pri.revenue > 0 &&
    pri.inventories > 0
  ) {
    const curInvRatio = cur.inventories / cur.revenue;
    const priInvRatio = pri.inventories / pri.revenue;
    const dsiIndex = curInvRatio / priInvRatio;

    const critThreshold = Number((1.50 * seasonalMultiplier).toFixed(3));
    const warnThreshold = Number((1.25 * seasonalMultiplier).toFixed(3));

    if (dsiIndex > critThreshold) {
      flags.push({
        code: 'INVENTORY_BLOAT',
        severity: 'CRITICAL',
        metricName: '棚卸資産回転期間指数 (DSI Index)',
        calculatedValue: Number(dsiIndex.toFixed(3)),
        threshold: critThreshold,
        description: `売上対比の棚卸資産が前期比${dsiIndex.toFixed(2)}倍に異常増加。架空在庫計上・原価付け替え・不良在庫滞留の強い疑い。`,
      });
    } else if (dsiIndex > warnThreshold) {
      flags.push({
        code: 'INVENTORY_BLOAT',
        severity: 'WARNING',
        metricName: '棚卸資産回転期間指数 (DSI Index)',
        calculatedValue: Number(dsiIndex.toFixed(3)),
        threshold: warnThreshold,
        description: `棚卸資産の滞留期間が前期比${dsiIndex.toFixed(2)}倍に長期化している。`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 4. 資産の質指数 (Beneish AQI) ※金融業は除外
  // ---------------------------------------------------------------------------
  if (
    !isFinancialIndustry &&
    cur.currentAssets !== null &&
    cur.propertyPlantAndEquipment !== null &&
    cur.totalAssets !== null &&
    cur.totalAssets > 0 &&
    pri.currentAssets !== null &&
    pri.propertyPlantAndEquipment !== null &&
    pri.totalAssets !== null &&
    pri.totalAssets > 0
  ) {
    const curOtherAssetsRatio =
      1 - (cur.currentAssets + cur.propertyPlantAndEquipment) / cur.totalAssets;
    const priOtherAssetsRatio =
      1 - (pri.currentAssets + pri.propertyPlantAndEquipment) / pri.totalAssets;

    // 非流動・非有形資産が総資産の15%以上を占める場合のみ評価（微小値での割り算による発散防止）
    if (curOtherAssetsRatio >= 0.15 && priOtherAssetsRatio > 0.05) {
      const aqi = curOtherAssetsRatio / priOtherAssetsRatio;
      if (aqi > 1.254) {
        flags.push({
          code: 'ASSET_QUALITY_DETERIORATION',
          severity: 'CRITICAL',
          metricName: '資産の質指数 (AQI)',
          calculatedValue: Number(aqi.toFixed(3)),
          threshold: 1.254,
          description: `無形資産・のれん・その他資産の比率が前期比${aqi.toFixed(2)}倍に急増。費用の不正な資産計上（繰延処理）の疑い。`,
        });
      } else if (aqi > 1.15) {
        flags.push({
          code: 'ASSET_QUALITY_DETERIORATION',
          severity: 'WARNING',
          metricName: '資産の質指数 (AQI)',
          calculatedValue: Number(aqi.toFixed(3)),
          threshold: 1.15,
          description: `換金性の低い非有形固定資産の割合が前期比${aqi.toFixed(2)}倍に増加している。`,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. FCF・配当ギャップ（タコ足配当・外部資金流出リスク）
  // ---------------------------------------------------------------------------
  if (cur.operatingCashFlow !== null && cur.investingCashFlow !== null) {
    const fcf = cur.operatingCashFlow + cur.investingCashFlow;
    const isDividendPaying = cur.payoutRatio !== null && cur.payoutRatio > 0;

    if (
      (cur.operatingCashFlow < 0 && cur.payoutRatio !== null && cur.payoutRatio > 100) ||
      (cur.retainedEarnings !== null && cur.retainedEarnings < 0 && isDividendPaying)
    ) {
      flags.push({
        code: 'UNSOUNDS_DIVIDEND_FCF_GAP',
        severity: 'CRITICAL',
        metricName: 'タコ足配当・キャッシュ流出異常',
        calculatedValue: fcf,
        threshold: 0,
        description: `営業CF赤字下の過剰配当、または利益剰余金マイナス状態での配当実施。財務基盤を直接毀損している。`,
      });
    } else if (fcf < 0 && cur.payoutRatio !== null && cur.payoutRatio > 50) {
      flags.push({
        code: 'UNSOUNDS_DIVIDEND_FCF_GAP',
        severity: 'WARNING',
        metricName: 'FCF赤字下の高配当性向',
        calculatedValue: fcf,
        threshold: 0,
        description: `フリーCFがマイナス（${fcf.toLocaleString()}千円）であるにもかかわらず配当性向が${cur.payoutRatio}%と高く、借入や手元資金の取り崩しで還元を維持している。`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 6. 短期流動性ショック率（資金ショート予兆）※金融業は除外
  // ---------------------------------------------------------------------------
  if (
    !isFinancialIndustry &&
    cur.cashAndDeposits !== null &&
    cur.currentLiabilities !== null &&
    cur.currentLiabilities > 0
  ) {
    const cashCoverage = cur.cashAndDeposits / cur.currentLiabilities;
    const cashDropRate =
      pri.cashAndDeposits && pri.cashAndDeposits > 0
        ? (cur.cashAndDeposits - pri.cashAndDeposits) / pri.cashAndDeposits
        : 0;

    if (cashCoverage < 0.08 && cur.operatingCashFlow !== null && cur.operatingCashFlow < 0) {
      flags.push({
        code: 'LIQUIDITY_CRUNCH',
        severity: 'CRITICAL',
        metricName: '対流動負債現預金比率',
        calculatedValue: Number(cashCoverage.toFixed(4)),
        threshold: 0.08,
        description: `流動負債に対する手元現預金が${(cashCoverage * 100).toFixed(1)}%しかなく営業CFも赤字。資金ショート（黒字倒産含む）の危険性が極めて高い。`,
      });
    } else if (cashCoverage < 0.15 && cashDropRate <= -0.3) {
      flags.push({
        code: 'LIQUIDITY_CRUNCH',
        severity: 'WARNING',
        metricName: '対流動負債現預金比率',
        calculatedValue: Number(cashCoverage.toFixed(4)),
        threshold: 0.15,
        description: `手元現預金が前期末比${Math.abs(cashDropRate * 100).toFixed(1)}%急減し、対流動負債比率が${(cashCoverage * 100).toFixed(1)}%まで低下している。`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 7. 純資産・利益剰余金毀損率（債務超過リスク）
  // ---------------------------------------------------------------------------
  if (cur.netAssets !== null && cur.totalAssets !== null && cur.totalAssets > 0) {
    const equityRatio = cur.netAssets / cur.totalAssets;
    const netAssetsDropRate =
      pri.netAssets && pri.netAssets > 0 ? (cur.netAssets - pri.netAssets) / pri.netAssets : 0;

    if (
      cur.netAssets <= 0 ||
      (cur.retainedEarnings !== null && cur.retainedEarnings < 0 && netAssetsDropRate <= -0.3)
    ) {
      flags.push({
        code: 'EQUITY_EROSION',
        severity: 'CRITICAL',
        metricName: '自己資本比率 / 純資産維持率',
        calculatedValue: Number(equityRatio.toFixed(4)),
        threshold: 0.0,
        description: `債務超過、または累積赤字（利益剰余金マイナス）下で純資産が前期比${Math.abs(netAssetsDropRate * 100).toFixed(1)}%急減しており、継続企業の前提に重大な疑義が生じる水準。`,
      });
    } else if (!isFinancialIndustry && equityRatio < 0.1) {
      flags.push({
        code: 'EQUITY_EROSION',
        severity: 'WARNING',
        metricName: '自己資本比率',
        calculatedValue: Number(equityRatio.toFixed(4)),
        threshold: 0.1,
        description: `自己資本比率が${(equityRatio * 100).toFixed(1)}%と10%を割り込んでおり、財務レバレッジが過剰な状態にある。`,
      });
    }
  }

  return flags;
}

```
