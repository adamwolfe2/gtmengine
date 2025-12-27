/**
 * Competitor analysis utilities
 */

import type { FormData } from "@/types/form"

export interface CompetitorInfo {
  name: string
  website?: string
  linkedinUrl?: string
  twitterHandle?: string
}

export interface CompetitorPost {
  platform: "linkedin" | "twitter"
  content: string
  engagement?: {
    likes?: number
    comments?: number
    shares?: number
  }
  postedAt?: string
}

export interface CompetitorAnalysis {
  competitor: string
  strengths: Array<{
    strength: string
    example: string
  }>
  weaknesses: Array<{
    weakness: string
    opportunity: string
  }>
  contentPatterns: Array<{
    pattern: string
    frequency: string
    effectiveness: "High" | "Medium" | "Low"
  }>
  topPerformingContent: string[]
}

export interface CompetitorInsights {
  competitors: CompetitorAnalysis[]
  recommendedAngles: Array<{
    angle: string
    rationale: string
    differentiator: string
  }>
  avoidList: Array<{
    tactic: string
    reason: string
  }>
  summary: string
  generatedAt: string
}

/**
 * Parse competitor names from form data
 */
export function parseCompetitors(formData: FormData): CompetitorInfo[] {
  const competitorStr = formData.competitors || ""

  // Split by common separators
  const names = competitorStr
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return names.map((name) => {
    // Try to extract URL if included
    const urlMatch = name.match(/https?:\/\/[^\s]+/)
    const cleanName = name.replace(/https?:\/\/[^\s]+/, "").trim()

    return {
      name: cleanName || name,
      website: urlMatch?.[0],
    }
  })
}

/**
 * Generate search queries for competitor research
 */
export function generateSearchQueries(competitor: CompetitorInfo, industry: string): string[] {
  const queries = [
    `${competitor.name} ${industry}`,
    `${competitor.name} linkedin posts`,
    `${competitor.name} company updates`,
    `${competitor.name} product features`,
    `site:linkedin.com/company/${competitor.name.toLowerCase().replace(/\s+/g, "-")}`,
  ]

  if (competitor.website) {
    queries.push(`site:${new URL(competitor.website).hostname}`)
  }

  return queries
}

/**
 * Format competitor insights for use in content generation prompt
 */
export function formatInsightsForPrompt(insights: CompetitorInsights): string {
  if (!insights || insights.competitors.length === 0) {
    return ""
  }

  let formatted = "## Competitor Analysis\n\n"

  // Summary
  formatted += `**Summary:** ${insights.summary}\n\n`

  // Key patterns to differentiate from
  formatted += "**Competitor Content Patterns:**\n"
  for (const competitor of insights.competitors) {
    formatted += `\n### ${competitor.competitor}\n`

    if (competitor.strengths.length > 0) {
      formatted += "Strengths to learn from:\n"
      for (const s of competitor.strengths.slice(0, 2)) {
        formatted += `- ${s.strength}: "${s.example}"\n`
      }
    }

    if (competitor.weaknesses.length > 0) {
      formatted += "Gaps to exploit:\n"
      for (const w of competitor.weaknesses.slice(0, 2)) {
        formatted += `- ${w.weakness} → Opportunity: ${w.opportunity}\n`
      }
    }
  }

  // Recommended angles
  if (insights.recommendedAngles.length > 0) {
    formatted += "\n**Recommended Differentiating Angles:**\n"
    for (const angle of insights.recommendedAngles.slice(0, 3)) {
      formatted += `- ${angle.angle}: ${angle.rationale}\n`
    }
  }

  // What to avoid
  if (insights.avoidList.length > 0) {
    formatted += "\n**Tactics to Avoid:**\n"
    for (const avoid of insights.avoidList.slice(0, 3)) {
      formatted += `- Don't ${avoid.tactic}: ${avoid.reason}\n`
    }
  }

  return formatted
}

/**
 * Storage key for competitor insights
 */
export const COMPETITOR_INSIGHTS_KEY = "gtm_competitor_insights"

/**
 * Save competitor insights to localStorage
 */
export function saveCompetitorInsights(insights: CompetitorInsights): void {
  if (typeof window === "undefined") return
  localStorage.setItem(COMPETITOR_INSIGHTS_KEY, JSON.stringify(insights))
}

/**
 * Load competitor insights from localStorage
 */
export function loadCompetitorInsights(): CompetitorInsights | null {
  if (typeof window === "undefined") return null
  const saved = localStorage.getItem(COMPETITOR_INSIGHTS_KEY)
  if (!saved) return null

  try {
    return JSON.parse(saved)
  } catch {
    return null
  }
}

/**
 * Check if insights are stale (older than 7 days)
 */
export function areInsightsStale(insights: CompetitorInsights | null): boolean {
  if (!insights) return true

  const generatedAt = new Date(insights.generatedAt)
  const now = new Date()
  const daysDiff = (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60 * 24)

  return daysDiff > 7
}
