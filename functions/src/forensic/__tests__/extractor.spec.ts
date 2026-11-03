import "jest";
import {
  extractQualitativeSections,
  extractTdnetQualitativeHtml,
  cleanText,
} from "../extractor";

describe("extractor", () => {
  it("should extract qualitative sections from iXBRL ix:nonNumeric elements", () => {
    const mockHtml = `
      <html>
        <body>
          <ix:nonNumeric name="jppfs_cor:ManagementAnalysisOfFinancialPositionOperatingResultsAndCashFlowsTextBlock">
            <p>当連結会計年度におけるわが国経済は、円安進行に伴う原材料価格の高騰が見られました。</p>
            <p>売上高は増加したものの、営業利益は減少いたしました。</p>
          </ix:nonNumeric>
          <ix:nonNumeric name="jppfs_cor:BusinessRisksTextBlock">
            <p>（1）為替変動リスク</p>
            <p>海外売上高比率が高いため、為替相場の急激な変動が業績に影響を与える可能性があります。</p>
          </ix:nonNumeric>
          <ix:nonNumeric name="jppfs_cor:EventsOrConditionsThatCastSignificantDoubtOnGoingConcernAssumptionTextBlock">
            <p>継続企業の前提に関する重要な疑義を生じさせるような事象又は状況が存在しております。</p>
          </ix:nonNumeric>
        </body>
      </html>
    `;

    const sections = extractQualitativeSections(mockHtml);

    expect(sections.has("ManagementAnalysisOfFinancialPositionOperatingResultsAndCashFlowsTextBlock")).toBe(true);
    expect(sections.get("ManagementAnalysisOfFinancialPositionOperatingResultsAndCashFlowsTextBlock")?.text).toContain(
      "当連結会計年度におけるわが国経済は"
    );

    expect(sections.has("BusinessRisksTextBlock")).toBe(true);
    expect(sections.get("BusinessRisksTextBlock")?.text).toContain("為替変動リスク");

    expect(sections.has("EventsOrConditionsThatCastSignificantDoubtOnGoingConcernAssumptionTextBlock")).toBe(true);
    expect(sections.get("EventsOrConditionsThatCastSignificantDoubtOnGoingConcernAssumptionTextBlock")?.text).toContain(
      "継続企業の前提に関する重要な疑義"
    );
  });

  it("should extract and split TDnet qualitative.htm content into mda and risk text", () => {
    const mockTdnetHtml = `
      <html>
        <head><title>qualitative</title></head>
        <body>
          <p>１．経営成績等の概況</p>
          <p>当事業年度における当社グループは、新規事業への積極的な先行投資を行いました。</p>
          <p>２．事業等のリスク</p>
          <p>当社の事業展開における主なリスクは以下の通りであります。</p>
        </body>
      </html>
    `;

    const { mdaText, riskText } = extractTdnetQualitativeHtml(mockTdnetHtml);

    expect(mdaText).toContain("経営成績等の概況");
    expect(mdaText).toContain("先行投資を行いました");
    expect(riskText).toContain("事業等のリスク");
    expect(riskText).toContain("主なリスクは以下の通りであります");
  });

  it("should clean and normalize text correctly", () => {
    const dirty = "  Hello \r\n\r\n\r\n World!   \t Multiple   spaces  ";
    const cleaned = cleanText(dirty);
    expect(cleaned).toBe("Hello\n\nWorld! Multiple spaces");
  });
});
