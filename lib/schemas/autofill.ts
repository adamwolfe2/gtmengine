/**
 * Zod schemas for AI autofill response validation
 */

import { z } from "zod"
import { industrySchema, contentToneSchema, primaryGoalSchema } from "./form"

// Schema for individual autofill fields with confidence
export const autofillFieldSchema = z.object({
  value: z.string(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  source: z.string().optional(), // Where the info came from
})

// Full autofill response schema
export const autofillResponseSchema = z.object({
  productDescription: z.string().min(10).optional(),
  targetAudience: z.string().min(10).optional(),
  jobTitles: z.string().optional(),
  painPoints: z.string().optional(),
  uniqueValue: z.string().optional(),
  keyBenefits: z.string().optional(),
  competitors: z.string().optional(),
  industry: industrySchema.optional(),
  companySize: z.string().optional(),
  primaryGoal: primaryGoalSchema.optional(),
  contentTone: contentToneSchema.optional(),
})

// Schema with confidence scores for better UX
export const autofillResponseWithConfidenceSchema = z.object({
  productDescription: autofillFieldSchema.optional(),
  targetAudience: autofillFieldSchema.optional(),
  jobTitles: autofillFieldSchema.optional(),
  painPoints: autofillFieldSchema.optional(),
  uniqueValue: autofillFieldSchema.optional(),
  keyBenefits: autofillFieldSchema.optional(),
  competitors: autofillFieldSchema.optional(),
  industry: autofillFieldSchema.optional(),
  companySize: autofillFieldSchema.optional(),
  primaryGoal: autofillFieldSchema.optional(),
  contentTone: autofillFieldSchema.optional(),
  // Metadata
  companyFound: z.boolean(),
  websiteAccessible: z.boolean().optional(),
  dataQuality: z.enum(["excellent", "good", "partial", "limited"]),
  suggestions: z.array(z.string()).optional(),
})

// Type exports
export type AutofillField = z.infer<typeof autofillFieldSchema>
export type AutofillResponse = z.infer<typeof autofillResponseSchema>
export type AutofillResponseWithConfidence = z.infer<typeof autofillResponseWithConfidenceSchema>

// Validation helpers
export function validateAutofillResponse(data: unknown): {
  success: boolean
  data?: AutofillResponse
  errors?: string[]
} {
  const result = autofillResponseSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  }
}

// Map industry string to valid industry value
export function normalizeIndustry(value: string | undefined): string | undefined {
  if (!value) return undefined

  const industryMap: Record<string, string> = {
    "b2b saas": "saas",
    saas: "saas",
    software: "saas",
    "software as a service": "saas",
    agency: "agency",
    consulting: "agency",
    "agency / consulting": "agency",
    ecommerce: "ecommerce",
    "e-commerce": "ecommerce",
    retail: "ecommerce",
    fintech: "fintech",
    "financial technology": "fintech",
    finance: "fintech",
    healthtech: "healthtech",
    "health tech": "healthtech",
    healthcare: "healthtech",
    edtech: "edtech",
    "ed tech": "edtech",
    education: "edtech",
    marketplace: "marketplace",
    platform: "marketplace",
    coaching: "coaching",
    "info products": "coaching",
    "coaching / info products": "coaching",
    other: "other",
  }

  const normalized = value.toLowerCase().trim()
  return industryMap[normalized] || "other"
}

// Map goal string to valid goal value
export function normalizeGoal(value: string | undefined): string | undefined {
  if (!value) return undefined

  const goalMap: Record<string, string> = {
    leads: "leads",
    "generate leads": "leads",
    "lead generation": "leads",
    awareness: "awareness",
    "build awareness": "awareness",
    "brand awareness": "awareness",
    authority: "authority",
    "establish authority": "authority",
    "thought leadership": "authority",
    sales: "sales",
    "drive sales": "sales",
    revenue: "sales",
    community: "community",
    "build community": "community",
    engagement: "community",
    hiring: "hiring",
    "attract talent": "hiring",
    recruitment: "hiring",
  }

  const normalized = value.toLowerCase().trim()
  return goalMap[normalized] || undefined
}

// Map tone string to valid tone value
export function normalizeTone(value: string | undefined): string | undefined {
  if (!value) return undefined

  const toneMap: Record<string, string> = {
    professional: "professional",
    formal: "professional",
    business: "professional",
    casual: "casual",
    friendly: "casual",
    conversational: "casual",
    bold: "bold",
    contrarian: "bold",
    "bold & contrarian": "bold",
    provocative: "bold",
    educational: "educational",
    informative: "educational",
    teaching: "educational",
    inspiring: "inspiring",
    inspirational: "inspiring",
    motivational: "inspiring",
  }

  const normalized = value.toLowerCase().trim()
  return toneMap[normalized] || "professional"
}

// Calculate completeness of autofill response
export function calculateCompleteness(response: AutofillResponse): {
  percentage: number
  filledFields: string[]
  missingFields: string[]
} {
  const fields = [
    "productDescription",
    "targetAudience",
    "jobTitles",
    "painPoints",
    "uniqueValue",
    "keyBenefits",
    "competitors",
    "industry",
    "companySize",
    "primaryGoal",
    "contentTone",
  ]

  const filledFields: string[] = []
  const missingFields: string[] = []

  for (const field of fields) {
    const value = response[field as keyof AutofillResponse]
    if (value && String(value).trim().length > 0) {
      filledFields.push(field)
    } else {
      missingFields.push(field)
    }
  }

  const percentage = Math.round((filledFields.length / fields.length) * 100)

  return { percentage, filledFields, missingFields }
}
