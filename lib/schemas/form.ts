/**
 * Zod schemas for form validation
 */

import { z } from "zod"

// Industry schema
export const industrySchema = z.enum([
  "saas",
  "agency",
  "ecommerce",
  "fintech",
  "healthtech",
  "edtech",
  "marketplace",
  "coaching",
  "other",
])

// Content tone schema
export const contentToneSchema = z.enum([
  "professional",
  "casual",
  "bold",
  "educational",
  "inspiring",
])

// Primary goal schema
export const primaryGoalSchema = z.enum([
  "leads",
  "awareness",
  "authority",
  "sales",
  "community",
  "hiring",
])

// Platform ID schema
export const platformIdSchema = z.enum([
  "linkedin",
  "twitter",
  "threads",
  "email",
  "ads",
])

// Step 1: Company validation schema
export const companyStepSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  website: z.string().url("Must be a valid URL").or(z.literal("")),
  industry: z.string().min(1, "Industry is required"),
  productDescription: z.string().min(10, "Please provide a brief product description"),
  logo: z.string().optional(),
})

// Step 2: Audience validation schema
export const audienceStepSchema = z.object({
  targetAudience: z.string().min(10, "Please describe your target audience"),
  jobTitles: z.string().min(1, "Please list target job titles"),
  companySize: z.string().min(1, "Please select company size"),
  painPoints: z.string().min(10, "Please describe key pain points"),
})

// Step 3: Positioning validation schema
export const positioningStepSchema = z.object({
  uniqueValue: z.string().min(10, "Please describe your unique value proposition"),
  keyBenefits: z.string().min(10, "Please list key benefits"),
  competitors: z.string().optional(),
  pricingModel: z.string().optional(),
})

// Step 4: Current State validation schema
export const currentStateStepSchema = z.object({
  currentChannels: z.array(z.string()).min(1, "Please select at least one channel"),
  contentFrequency: z.string().min(1, "Please select content frequency"),
  teamSize: z.string().min(1, "Please select team size"),
})

// Step 5: Goals validation schema
export const goalsStepSchema = z.object({
  primaryGoal: z.string().min(1, "Please select a primary goal"),
  contentTone: z.string().min(1, "Please select a content tone"),
  targetPlatforms: z.array(platformIdSchema).min(1, "Please select at least one platform"),
})

// Complete form data schema
export const formDataSchema = z.object({
  // Step 1: Company
  companyName: z.string().min(1, "Company name is required"),
  website: z.string().url("Must be a valid URL").or(z.literal("")),
  industry: z.string().min(1, "Industry is required"),
  productDescription: z.string().min(10, "Please provide a brief product description"),
  logo: z.string().default(""),

  // Step 2: Audience
  targetAudience: z.string().min(10, "Please describe your target audience"),
  jobTitles: z.string().min(1, "Please list target job titles"),
  companySize: z.string().min(1, "Please select company size"),
  painPoints: z.string().min(10, "Please describe key pain points"),

  // Step 3: Positioning
  uniqueValue: z.string().min(10, "Please describe your unique value proposition"),
  keyBenefits: z.string().min(10, "Please list key benefits"),
  competitors: z.string().default(""),
  pricingModel: z.string().default(""),

  // Step 4: Current State
  currentChannels: z.array(z.string()).default([]),
  contentFrequency: z.string().default(""),
  teamSize: z.string().default(""),

  // Step 5: Goals
  primaryGoal: z.string().min(1, "Please select a primary goal"),
  contentTone: z.string().min(1, "Please select a content tone"),
  targetPlatforms: z.array(platformIdSchema).min(1, "Please select at least one platform"),
})

// Partial form data for incremental saving
export const partialFormDataSchema = formDataSchema.partial()

// AI autofill response schema
export const aiAutofillResponseSchema = z.object({
  productDescription: z.string().optional(),
  targetAudience: z.string().optional(),
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

// Type exports
export type IndustryType = z.infer<typeof industrySchema>
export type ContentToneType = z.infer<typeof contentToneSchema>
export type PrimaryGoalType = z.infer<typeof primaryGoalSchema>
export type PlatformIdType = z.infer<typeof platformIdSchema>
export type FormDataType = z.infer<typeof formDataSchema>
export type PartialFormDataType = z.infer<typeof partialFormDataSchema>
export type AIAutofillResponseType = z.infer<typeof aiAutofillResponseSchema>

// Validation helpers
export function validateStep(step: number, data: Partial<FormDataType>): boolean {
  try {
    switch (step) {
      case 1:
        companyStepSchema.parse(data)
        return true
      case 2:
        audienceStepSchema.parse(data)
        return true
      case 3:
        positioningStepSchema.parse(data)
        return true
      case 4:
        currentStateStepSchema.parse(data)
        return true
      case 5:
        goalsStepSchema.parse(data)
        return true
      default:
        return false
    }
  } catch {
    return false
  }
}

export function getStepErrors(step: number, data: Partial<FormDataType>): string[] {
  try {
    switch (step) {
      case 1:
        companyStepSchema.parse(data)
        break
      case 2:
        audienceStepSchema.parse(data)
        break
      case 3:
        positioningStepSchema.parse(data)
        break
      case 4:
        currentStateStepSchema.parse(data)
        break
      case 5:
        goalsStepSchema.parse(data)
        break
    }
    return []
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.errors.map((e) => e.message)
    }
    return ["Validation error"]
  }
}
