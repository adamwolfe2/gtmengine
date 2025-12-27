/**
 * Form-related type definitions for the GTM Content Engine
 */

// Industry options for company classification
export type Industry =
  | "saas"
  | "agency"
  | "ecommerce"
  | "fintech"
  | "healthtech"
  | "edtech"
  | "marketplace"
  | "coaching"
  | "other"

// Content tone options affecting generated content style
export type ContentTone =
  | "professional"
  | "casual"
  | "bold"
  | "educational"
  | "inspiring"

// Primary business goal for content strategy
export type PrimaryGoal =
  | "leads"
  | "awareness"
  | "authority"
  | "sales"
  | "community"
  | "hiring"

// Platform identifiers for content distribution
export type PlatformId = "linkedin" | "twitter" | "threads" | "email" | "ads"

// Supported content languages
export type ContentLanguage =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "it"
  | "nl"
  | "ja"
  | "ko"
  | "zh"

// Language display names for UI
export const LANGUAGE_OPTIONS: { value: ContentLanguage; label: string; flag: string }[] = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "es", label: "Spanish", flag: "🇪🇸" },
  { value: "fr", label: "French", flag: "🇫🇷" },
  { value: "de", label: "German", flag: "🇩🇪" },
  { value: "pt", label: "Portuguese", flag: "🇵🇹" },
  { value: "it", label: "Italian", flag: "🇮🇹" },
  { value: "nl", label: "Dutch", flag: "🇳🇱" },
  { value: "ja", label: "Japanese", flag: "🇯🇵" },
  { value: "ko", label: "Korean", flag: "🇰🇷" },
  { value: "zh", label: "Chinese", flag: "🇨🇳" },
]

// Tone configuration for content generation
export interface ToneConfig {
  opener: string
  cta: string
}

// Map of tone options to their configurations
export type ToneConfigMap = Record<ContentTone, ToneConfig>

// Main form data structure collected during onboarding
export interface FormData {
  // Step 1: Company
  companyName: string
  website: string
  industry: Industry | string
  productDescription: string
  logo: string // base64 data URL

  // Step 2: Audience
  targetAudience: string
  jobTitles: string
  companySize: string
  painPoints: string // newline-separated list

  // Step 3: Positioning
  uniqueValue: string
  keyBenefits: string
  competitors: string
  pricingModel: string

  // Step 4: Current State
  currentChannels: string[]
  contentFrequency: string
  teamSize: string

  // Step 5: Goals
  primaryGoal: PrimaryGoal | string
  contentTone: ContentTone | string
  targetPlatforms: PlatformId[]

  // Content generation settings
  contentLanguage?: ContentLanguage | string
}

// Initial/default form data values
export const defaultFormData: FormData = {
  companyName: "",
  website: "",
  industry: "",
  productDescription: "",
  logo: "",
  targetAudience: "",
  jobTitles: "",
  companySize: "",
  painPoints: "",
  uniqueValue: "",
  keyBenefits: "",
  competitors: "",
  pricingModel: "",
  currentChannels: [],
  contentFrequency: "",
  teamSize: "",
  primaryGoal: "",
  contentTone: "",
  targetPlatforms: [],
  contentLanguage: "en",
}

// Parsed AI autofill response structure
export interface AIAutofillResponse {
  productDescription?: string
  targetAudience?: string
  jobTitles?: string
  painPoints?: string
  uniqueValue?: string
  keyBenefits?: string
  competitors?: string
  industry?: Industry
  companySize?: string
  primaryGoal?: PrimaryGoal
  contentTone?: ContentTone
}
