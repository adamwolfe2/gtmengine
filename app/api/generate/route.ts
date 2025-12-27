import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { buildContentPrompt, buildSinglePostPrompt } from "@/lib/content/prompts"
import { generatedContentSchema, postSchema } from "@/lib/schemas/content"
import type { FormData } from "@/types/form"
import type { Pillar } from "@/types/content"

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Types for request body
interface GenerateFullRequest {
  type: "full"
  formData: FormData
  competitorInsights?: string
}

interface GenerateSingleRequest {
  type: "single"
  formData: FormData
  platform: string
  pillar: Pillar
  currentContent?: string
  feedback?: string
}

type GenerateRequest = GenerateFullRequest | GenerateSingleRequest

/**
 * Extract JSON from Claude's response, handling potential markdown wrapping
 */
function extractJSON(text: string): string {
  // Remove markdown code blocks if present
  let cleaned = text.trim()

  // Handle ```json ... ``` wrapping
  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n")
    lines.shift() // Remove first ``` line
    if (lines[lines.length - 1]?.trim() === "```") {
      lines.pop() // Remove last ``` line
    }
    cleaned = lines.join("\n")
  }

  // Find the first { and last } to extract just the JSON
  const firstBrace = cleaned.indexOf("{")
  const lastBrace = cleaned.lastIndexOf("}")

  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }

  return cleaned
}

/**
 * Attempt to repair common JSON issues from LLM output
 */
function repairJSON(jsonStr: string): string {
  let repaired = jsonStr

  // Fix trailing commas before closing brackets
  repaired = repaired.replace(/,(\s*[}\]])/g, "$1")

  // Fix unescaped newlines in strings (common issue)
  repaired = repaired.replace(/(?<!\\)\n(?=(?:[^"]*"[^"]*")*[^"]*$)/g, "\\n")

  return repaired
}

export async function POST(request: NextRequest) {
  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured", code: "NO_API_KEY" },
        { status: 500 }
      )
    }

    const body: GenerateRequest = await request.json()

    if (body.type === "full") {
      // Generate full content library
      return await generateFullContent(body)
    } else if (body.type === "single") {
      // Regenerate single post
      return await generateSinglePost(body)
    } else {
      return NextResponse.json(
        { error: "Invalid request type" },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Generate API error:", error)
    return NextResponse.json(
      { error: "Failed to generate content", details: String(error) },
      { status: 500 }
    )
  }
}

async function generateFullContent(request: GenerateFullRequest) {
  const { formData, competitorInsights } = request

  // Build the prompt
  const prompt = buildContentPrompt({
    formData,
    competitorInsights,
  })

  console.log("Generating full content for:", formData.companyName)

  // Call Claude API
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  })

  // Extract text content
  const textBlock = message.content.find((block) => block.type === "text")
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude")
  }

  // Parse JSON from response
  let jsonStr = extractJSON(textBlock.text)

  // Attempt to parse
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch (parseError) {
    // Try to repair and parse again
    console.log("Initial parse failed, attempting repair...")
    jsonStr = repairJSON(jsonStr)
    try {
      parsed = JSON.parse(jsonStr)
    } catch (repairError) {
      console.error("JSON parse failed:", textBlock.text.slice(0, 500))
      return NextResponse.json(
        {
          error: "Failed to parse generated content",
          rawResponse: textBlock.text.slice(0, 1000),
        },
        { status: 500 }
      )
    }
  }

  // Validate with Zod schema
  const validation = generatedContentSchema.safeParse(parsed)

  if (!validation.success) {
    console.error("Validation errors:", validation.error.errors)

    // Attempt to fix common issues and return partial content
    const partialContent = attemptPartialRecovery(parsed)
    if (partialContent) {
      return NextResponse.json({
        success: true,
        content: partialContent,
        warnings: validation.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      })
    }

    return NextResponse.json(
      {
        error: "Generated content failed validation",
        validationErrors: validation.error.errors,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    content: validation.data,
  })
}

async function generateSinglePost(request: GenerateSingleRequest) {
  const { formData, platform, pillar, currentContent, feedback } = request

  // Build the prompt
  const prompt = buildSinglePostPrompt(formData, platform, pillar, currentContent, feedback)

  // Call Claude API
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  })

  // Extract text content
  const textBlock = message.content.find((block) => block.type === "text")
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude")
  }

  // Parse JSON from response
  const jsonStr = extractJSON(textBlock.text)
  let parsed: unknown

  try {
    parsed = JSON.parse(jsonStr)
  } catch (parseError) {
    return NextResponse.json(
      { error: "Failed to parse generated post" },
      { status: 500 }
    )
  }

  // Validate with Zod schema
  const parsedPost = parsed as Record<string, unknown>
  const validation = postSchema.safeParse({
    ...parsedPost,
    id: Date.now(), // Generate a new ID
  })

  if (!validation.success) {
    return NextResponse.json(
      {
        error: "Generated post failed validation",
        validationErrors: validation.error.errors,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    post: validation.data,
  })
}

/**
 * Attempt to recover partial content when full validation fails
 */
function attemptPartialRecovery(data: unknown): unknown | null {
  if (typeof data !== "object" || data === null) return null

  const platforms = ["linkedin", "twitter", "threads", "email", "ads"]
  const recovered: Record<string, unknown[]> = {}
  let hasContent = false

  for (const platform of platforms) {
    const posts = (data as Record<string, unknown>)[platform]
    if (Array.isArray(posts)) {
      recovered[platform] = posts
        .map((post, index) => {
          // Try to fix each post
          if (typeof post !== "object" || post === null) return null

          const p = post as Record<string, unknown>
          return {
            id: typeof p.id === "number" ? p.id : index + 1,
            title: typeof p.title === "string" ? p.title : "Untitled",
            pillar: normalizePillar(p.pillar) || "Product Journey",
            status: p.status === "review" ? "review" : "ready",
            content: typeof p.content === "string" ? p.content : "",
          }
        })
        .filter((p) => p !== null && p.content.length > 0)

      if (recovered[platform].length > 0) {
        hasContent = true
      }
    } else {
      recovered[platform] = []
    }
  }

  return hasContent ? recovered : null
}

function normalizePillar(value: unknown): string | null {
  if (typeof value !== "string") return null

  const pillarMap: Record<string, string> = {
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
  return pillarMap[normalized] || value
}
