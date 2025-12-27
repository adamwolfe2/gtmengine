import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { buildContentCritiquePrompt } from "@/lib/content/prompts"
import type { FormData } from "@/types/form"

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface CritiqueRequest {
  content: string
  platform: string
  formData: FormData
  competitorBenchmark?: string
}

export interface CritiqueResult {
  overallScore: number
  hookScore: number
  clarityScore: number
  ctaScore: number
  strengths: string[]
  weaknesses: string[]
  specificFixes: Array<{
    issue: string
    currentText: string
    suggestedText: string
  }>
  rewrittenVersion: string
}

/**
 * Extract JSON from Claude's response
 */
function extractJSON(text: string): string {
  let cleaned = text.trim()

  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n")
    lines.shift()
    if (lines[lines.length - 1]?.trim() === "```") {
      lines.pop()
    }
    cleaned = lines.join("\n")
  }

  const firstBrace = cleaned.indexOf("{")
  const lastBrace = cleaned.lastIndexOf("}")

  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }

  return cleaned
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured", code: "NO_API_KEY" },
        { status: 500 }
      )
    }

    const body: CritiqueRequest = await request.json()
    const { content, platform, formData, competitorBenchmark } = body

    if (!content || !platform || !formData) {
      return NextResponse.json(
        { error: "Missing required fields: content, platform, formData" },
        { status: 400 }
      )
    }

    console.log(`Critiquing ${platform} post for: ${formData.companyName}`)

    // Build the prompt
    const prompt = buildContentCritiquePrompt(formData, content, platform, competitorBenchmark)

    // Call Claude API
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
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
    let parsed: CritiqueResult

    try {
      parsed = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      console.error("Raw response:", textBlock.text.slice(0, 500))

      return NextResponse.json(
        { error: "Failed to parse critique response" },
        { status: 500 }
      )
    }

    // Validate the response structure
    if (typeof parsed.overallScore !== "number" || !Array.isArray(parsed.strengths)) {
      return NextResponse.json(
        { error: "Invalid critique response structure" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      critique: parsed,
    })
  } catch (error) {
    console.error("Critique API error:", error)
    return NextResponse.json(
      { error: "Failed to critique content", details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check if critique is available
 */
export async function GET() {
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY

  return NextResponse.json({
    available: hasApiKey,
    message: hasApiKey
      ? "Content critique is available"
      : "ANTHROPIC_API_KEY not configured",
  })
}
