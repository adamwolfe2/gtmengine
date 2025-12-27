/**
 * Client-side LLM content generation utilities
 */

import type { FormData } from "@/types/form"
import type { GeneratedContent, Post, Pillar } from "@/types/content"

export interface GenerationResult {
  success: boolean
  content?: GeneratedContent
  post?: Post
  error?: string
  warnings?: string[]
}

export interface GenerationProgress {
  stage: "preparing" | "generating" | "validating" | "complete" | "error"
  message: string
  progress: number
}

/**
 * Generate full content library using LLM
 */
export async function generateContentWithLLM(
  formData: FormData,
  competitorInsights?: string,
  onProgress?: (progress: GenerationProgress) => void
): Promise<GenerationResult> {
  try {
    onProgress?.({
      stage: "preparing",
      message: "Preparing your company profile...",
      progress: 10,
    })

    await delay(500)

    onProgress?.({
      stage: "generating",
      message: "AI is crafting personalized content...",
      progress: 30,
    })

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "full",
        formData,
        competitorInsights,
      }),
    })

    onProgress?.({
      stage: "validating",
      message: "Validating and formatting content...",
      progress: 80,
    })

    const data = await response.json()

    if (!response.ok) {
      onProgress?.({
        stage: "error",
        message: data.error || "Generation failed",
        progress: 100,
      })

      return {
        success: false,
        error: data.error || "Failed to generate content",
      }
    }

    onProgress?.({
      stage: "complete",
      message: "Content generated successfully!",
      progress: 100,
    })

    return {
      success: true,
      content: data.content,
      warnings: data.warnings,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    onProgress?.({
      stage: "error",
      message: errorMessage,
      progress: 100,
    })

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Regenerate a single post using LLM
 */
export async function regeneratePostWithLLM(
  formData: FormData,
  platform: string,
  pillar: Pillar,
  currentContent?: string,
  feedback?: string
): Promise<GenerationResult> {
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "single",
        formData,
        platform,
        pillar,
        currentContent,
        feedback,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to regenerate post",
      }
    }

    return {
      success: true,
      post: data.post,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Check if LLM generation is available (API key configured)
 */
export async function checkLLMAvailability(): Promise<boolean> {
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "check",
      }),
    })

    // If we get NO_API_KEY error, LLM is not available
    if (!response.ok) {
      const data = await response.json()
      return data.code !== "NO_API_KEY"
    }

    return true
  } catch {
    return false
  }
}

// Helper function
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Generation mode type
 */
export type GenerationMode = "template" | "llm"

/**
 * Storage key for generation mode preference
 */
export const GENERATION_MODE_KEY = "gtm_generation_mode"

/**
 * Get saved generation mode preference
 */
export function getGenerationMode(): GenerationMode {
  if (typeof window === "undefined") return "template"
  const saved = localStorage.getItem(GENERATION_MODE_KEY)
  return saved === "llm" ? "llm" : "template"
}

/**
 * Save generation mode preference
 */
export function setGenerationMode(mode: GenerationMode): void {
  if (typeof window === "undefined") return
  localStorage.setItem(GENERATION_MODE_KEY, mode)
}
