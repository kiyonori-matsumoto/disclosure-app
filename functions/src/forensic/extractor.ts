import * as cheerio from "cheerio";

export interface QualitativeSection {
  tag: string;
  label: string;
  text: string;
}

// 監視・抽出対象とする定性タグ（EDINET および TDnet）
export const TARGET_SECTIONS: Record<string, string> = {
  BusinessRisksTextBlock: "事業等のリスク",
  PolicyEnvironmentIssuesToAddressEtcTextBlock: "対処すべき課題等",
  ManagementAnalysisOfFinancialPositionOperatingResultsAndCashFlowsTextBlock: "経営成績等の状況の分析",
  EventsOrConditionsThatCastSignificantDoubtOnGoingConcernAssumptionTextBlock: "継続企業の前提に関する重要事象等",
  ChangesInAccountingPoliciesTextBlock: "会計方針の変更",
  SignificantSubsequentEventsTextBlock: "重要な後発事象",
  OpinionTextBlock: "監査意見",
};

/**
 * iXBRL (.htm) または HTML文字列から定性セクションを抽出する
 */
export function extractQualitativeSections(htmlContent: string): Map<string, QualitativeSection> {
  const $ = cheerio.load(htmlContent);
  const results = new Map<string, QualitativeSection>();

  // 1. ix:nonNumeric または nonNumeric 要素を走査 (EDINET / TDnet iXBRL)
  $("ix\\:nonnumeric, nonnumeric").each((_, elem) => {
    const $elem = $(elem);
    const nameAttr = $elem.attr("name") || "";

    for (const [key, label] of Object.entries(TARGET_SECTIONS)) {
      if (nameAttr.includes(key)) {
        $elem.find("br").replaceWith("\n");
        $elem.find("p, div, tr").each((_, block) => {
          $(block).append("\n");
        });

        const rawText = $elem.text();
        const cleaned = cleanText(rawText);
        if (cleaned.length > 0) {
          results.set(key, {
            tag: nameAttr,
            label,
            text: cleaned,
          });
        }
      }
    }
  });

  return results;
}

/**
 * TDnet の qualitative.htm (プレーンHTML構造の定性情報) からテキストを抽出・整形
 */
export function extractTdnetQualitativeHtml(htmlContent: string): { mdaText: string; riskText: string } {
  const $ = cheerio.load(htmlContent);

  // 改行補正
  $("br").replaceWith("\n");
  $("p, div, tr").each((_, block) => {
    $(block).append("\n");
  });

  const fullText = cleanText($.root().text());

  // 簡易見出し分割（「１．経営成績等の概況」「２．今後の見通し」等）
  let mdaText = fullText;
  let riskText = "";

  const riskKeywords = ["事業等のリスク", "リスク要因", "経営リスク"];
  for (const kw of riskKeywords) {
    const idx = fullText.indexOf(kw);
    if (idx !== -1) {
      mdaText = fullText.slice(0, idx);
      riskText = fullText.slice(idx);
      break;
    }
  }

  return { mdaText, riskText };
}

/**
 * テキストの正規化
 */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}
