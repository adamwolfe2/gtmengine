/**
 * Zod schemas for content validation
 */

import { z } from "zod"

// Pillar schema
export const pillarSchema = z.enum([
  "Product Journey",
  "Founder Story",
  "Growth Metrics",
  "Industry Insights",
  "Community Wins",
  "Culture/BTS",
  "Engagement",
])

// Post status schema
export const postStatusSchema = z.enum(["ready", "review"])

// Individual post schema
export const postSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1, "Title is required"),
  pillar: pillarSchema,
  status: postStatusSchema.default("ready"),
  content: z.string().min(50, "Content must be at least 50 characters").max(3000, "Content must be less than 3000 characters"),
})

// Platform-specific post schemas with count constraints
export const linkedinPostsSchema = z.array(postSchema).min(15).max(25)
export const twitterPostsSchema = z.array(postSchema).min(8).max(15)
export const threadsPostsSchema = z.array(postSchema).min(3).max(5)
export const emailPostsSchema = z.array(postSchema).min(4).max(6)
export const adsPostsSchema = z.array(postSchema).min(4).max(6)

// Generated content schema
export const generatedContentSchema = z.object({
  linkedin: z.array(postSchema).min(15).max(25),
  twitter: z.array(postSchema).min(8).max(15),
  threads: z.array(postSchema).min(3).max(5),
  email: z.array(postSchema).min(4).max(6),
  ads: z.array(postSchema).min(4).max(6),
})

// Relaxed content schema for partial/incremental generation
export const partialGeneratedContentSchema = z.object({
  linkedin: z.array(postSchema).optional(),
  twitter: z.array(postSchema).optional(),
  threads: z.array(postSchema).optional(),
  email: z.array(postSchema).optional(),
  ads: z.array(postSchema).optional(),
})

// Stored task data schema
export const storedTaskDataSchema = z.record(z.coerce.number(), z.boolean())

// App data schema for import/export
export const appDataSchema = z.object({
  formData: z.record(z.unknown()),
  generatedContent: generatedContentSchema,
  dailyTasks: storedTaskDataSchema,
  readyState: z.boolean(),
  exportDate: z.string(),
  version: z.string(),
})

// Type exports
export type PillarType = z.infer<typeof pillarSchema>
export type PostStatusType = z.infer<typeof postStatusSchema>
export type PostType = z.infer<typeof postSchema>
export type GeneratedContentType = z.infer<typeof generatedContentSchema>
export type PartialGeneratedContentType = z.infer<typeof partialGeneratedContentSchema>
export type StoredTaskDataType = z.infer<typeof storedTaskDataSchema>
export type AppDataType = z.infer<typeof appDataSchema>

// Validation helpers
export function validatePost(data: unknown): { success: boolean; data?: PostType; errors?: string[] } {
  const result = postSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.errors.map((e) => e.message),
  }
}

export function validateGeneratedContent(data: unknown): { success: boolean; data?: GeneratedContentType; errors?: string[] } {
  const result = generatedContentSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  }
}

// Repair utilities for LLM-generated content
export function repairPost(post: Partial<PostType>, index: number): PostType | null {
  try {
    // Attempt to fix common issues
    const repaired = {
      id: post.id ?? index + 1,
      title: post.title?.trim() || "Untitled Post",
      pillar: normalizePillar(post.pillar) ?? "Product Journey",
      status: post.status === "review" ? "review" : "ready",
      content: post.content?.trim() || "",
    }

    // Validate the repaired post
    const result = postSchema.safeParse(repaired)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function normalizePillar(value: unknown): PillarType | null {
  if (typeof value !== "string") return null

  const pillarMap: Record<string, PillarType> = {
    product: "Product Journey",
    "product journey": "Product Journey",
    founder: "Founder Story",
    "founder story": "Founder Story",
    metrics: "Growth Metrics",
    "growth metrics": "Growth Metrics",
    growth: "Growth Metrics",
    insights: "Industry Insights",
    "industry insights": "Industry Insights",
    industry: "Industry Insights",
    community: "Community Wins",
    "community wins": "Community Wins",
    culture: "Culture/BTS",
    "culture/bts": "Culture/BTS",
    bts: "Culture/BTS",
    engagement: "Engagement",
  }

  const normalized = value.toLowerCase().trim()
  return pillarMap[normalized] ?? null
}

// Content statistics calculator
export function calculateContentStats(content: GeneratedContentType) {
  const platforms = ["linkedin", "twitter", "threads", "email", "ads"] as const
  const byPlatform: Record<string, { total: number; ready: number; review: number }> = {}

  let totalPosts = 0
  let readyCount = 0
  let reviewCount = 0

  for (const platform of platforms) {
    const posts = content[platform] || []
    const ready = posts.filter((p) => p.status === "ready").length
    const review = posts.filter((p) => p.status === "review").length

    byPlatform[platform] = {
      total: posts.length,
      ready,
      review,
    }

    totalPosts += posts.length
    readyCount += ready
    reviewCount += review
  }

  // Calculate pillar distribution
  const pillarCounts: Record<string, number> = {}
  for (const platform of platforms) {
    for (const post of content[platform] || []) {
      pillarCounts[post.pillar] = (pillarCounts[post.pillar] || 0) + 1
    }
  }

  const byPillar = Object.entries(pillarCounts).map(([pillar, count]) => ({
    pillar: pillar as PillarType,
    count,
    percentage: totalPosts > 0 ? Math.round((count / totalPosts) * 100) : 0,
  }))

  return {
    totalPosts,
    byPlatform,
    byPillar,
    readyCount,
    reviewCount,
  }
}
