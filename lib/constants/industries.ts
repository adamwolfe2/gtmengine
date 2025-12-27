/**
 * Industry configuration constants
 */

import type { Industry, ContentTone, PrimaryGoal, ToneConfig, ToneConfigMap } from "@/types/form"

// Industry options for company classification
export interface IndustryOption {
  value: Industry
  label: string
}

export const INDUSTRIES: IndustryOption[] = [
  { value: "saas", label: "B2B SaaS" },
  { value: "agency", label: "Agency / Consulting" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "fintech", label: "Fintech" },
  { value: "healthtech", label: "Healthtech" },
  { value: "edtech", label: "Edtech" },
  { value: "marketplace", label: "Marketplace" },
  { value: "coaching", label: "Coaching / Info Products" },
  { value: "other", label: "Other" },
]

// Industry value to label mapping
export const INDUSTRY_LABELS: Record<Industry, string> = {
  saas: "B2B SaaS",
  agency: "Agency / Consulting",
  ecommerce: "E-commerce",
  fintech: "Fintech",
  healthtech: "Healthtech",
  edtech: "Edtech",
  marketplace: "Marketplace",
  coaching: "Coaching / Info Products",
  other: "Other",
}

// Content tone configurations
export const TONE_CONFIGS: ToneConfigMap = {
  professional: {
    opener: "Here's what I've learned:",
    cta: "Thoughts?",
  },
  casual: {
    opener: "Real talk:",
    cta: "What do you think?",
  },
  bold: {
    opener: "Unpopular opinion:",
    cta: "Fight me on this 👇",
  },
  educational: {
    opener: "Let me break this down:",
    cta: "Save this for later.",
  },
  inspiring: {
    opener: "This changed everything for me:",
    cta: "Your turn.",
  },
}

// Content tone options for UI
export interface ToneOption {
  value: ContentTone
  label: string
  description: string
}

export const TONE_OPTIONS: ToneOption[] = [
  {
    value: "professional",
    label: "Professional",
    description: "Polished and business-focused",
  },
  {
    value: "casual",
    label: "Casual",
    description: "Friendly and conversational",
  },
  {
    value: "bold",
    label: "Bold",
    description: "Direct and opinionated",
  },
  {
    value: "educational",
    label: "Educational",
    description: "Informative and instructive",
  },
  {
    value: "inspiring",
    label: "Inspiring",
    description: "Motivational and uplifting",
  },
]

// Primary goal options for UI
export interface GoalOption {
  value: PrimaryGoal
  label: string
  description: string
}

export const GOAL_OPTIONS: GoalOption[] = [
  {
    value: "leads",
    label: "Generate Leads",
    description: "Drive signups and demo requests",
  },
  {
    value: "awareness",
    label: "Build Awareness",
    description: "Increase brand visibility",
  },
  {
    value: "authority",
    label: "Establish Authority",
    description: "Position as industry expert",
  },
  {
    value: "sales",
    label: "Drive Sales",
    description: "Convert prospects to customers",
  },
  {
    value: "community",
    label: "Build Community",
    description: "Foster engagement and loyalty",
  },
  {
    value: "hiring",
    label: "Attract Talent",
    description: "Recruit top candidates",
  },
]

// Company size options for UI
export interface CompanySizeOption {
  value: string
  label: string
}

export const COMPANY_SIZE_OPTIONS: CompanySizeOption[] = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
]

// Content frequency options for UI
export interface FrequencyOption {
  value: string
  label: string
}

export const FREQUENCY_OPTIONS: FrequencyOption[] = [
  { value: "daily", label: "Daily" },
  { value: "2-3x/week", label: "2-3 times per week" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "rarely", label: "Rarely/Never" },
]

// Team size options for UI
export interface TeamSizeOption {
  value: string
  label: string
}

export const TEAM_SIZE_OPTIONS: TeamSizeOption[] = [
  { value: "solo", label: "Solo founder" },
  { value: "2-5", label: "2-5 people" },
  { value: "6-10", label: "6-10 people" },
  { value: "11-25", label: "11-25 people" },
  { value: "26+", label: "26+ people" },
]

// Current channel options for UI
export interface ChannelOption {
  value: string
  label: string
}

export const CHANNEL_OPTIONS: ChannelOption[] = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "Twitter/X" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "email", label: "Email Newsletter" },
  { value: "blog", label: "Blog/Website" },
  { value: "podcast", label: "Podcast" },
  { value: "none", label: "None currently" },
]

// Helper functions
export function getIndustryLabel(value: Industry): string {
  return INDUSTRY_LABELS[value] || value
}

export function getToneConfig(tone: ContentTone): ToneConfig {
  return TONE_CONFIGS[tone] || TONE_CONFIGS.professional
}

export function getGoalLabel(value: PrimaryGoal): string {
  const option = GOAL_OPTIONS.find((g) => g.value === value)
  return option?.label || value
}

export function getToneLabel(value: ContentTone): string {
  const option = TONE_OPTIONS.find((t) => t.value === value)
  return option?.label || value
}
