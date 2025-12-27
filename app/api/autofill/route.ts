import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import {
  autofillResponseSchema,
  normalizeIndustry,
  normalizeGoal,
  normalizeTone,
  calculateCompleteness,
} from "@/lib/schemas/autofill"

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface AutofillRequest {
  companyName: string
  website?: string
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

    const body: AutofillRequest = await request.json()
    const { companyName, website } = body

    if (!companyName) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      )
    }

    console.log(`Autofilling for: ${companyName} (${website || "no website"})`)

    const prompt = buildAutofillPrompt(companyName, website)

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
    let parsed: Record<string, unknown>

    try {
      parsed = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      console.error("Raw response:", textBlock.text.slice(0, 500))

      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      )
    }

    // Normalize industry, goal, and tone values
    if (parsed.industry) {
      parsed.industry = normalizeIndustry(parsed.industry as string)
    }
    if (parsed.primaryGoal) {
      parsed.primaryGoal = normalizeGoal(parsed.primaryGoal as string)
    }
    if (parsed.contentTone) {
      parsed.contentTone = normalizeTone(parsed.contentTone as string)
    }

    // Validate with schema (lenient - we'll accept partial data)
    const validation = autofillResponseSchema.safeParse(parsed)

    // Calculate completeness
    const completeness = calculateCompleteness(parsed as any)

    // Determine data quality
    let dataQuality: "excellent" | "good" | "partial" | "limited"
    if (completeness.percentage >= 90) {
      dataQuality = "excellent"
    } else if (completeness.percentage >= 70) {
      dataQuality = "good"
    } else if (completeness.percentage >= 40) {
      dataQuality = "partial"
    } else {
      dataQuality = "limited"
    }

    return NextResponse.json({
      success: true,
      data: validation.success ? validation.data : parsed,
      completeness,
      dataQuality,
      companyFound: completeness.percentage > 20,
      warnings: validation.success
        ? undefined
        : validation.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    })
  } catch (error) {
    console.error("Autofill API error:", error)
    return NextResponse.json(
      { error: "Failed to research company", details: String(error) },
      { status: 500 }
    )
  }
}

function buildAutofillPrompt(companyName: string, website?: string): string {
  return `You are a business research assistant. Research the company "${companyName}"${website ? ` (website: ${website})` : ""} and provide information to fill out a GTM (Go-To-Market) content engine form.

Based on your knowledge of this company, provide the following information. If you're not certain about something, make an educated guess based on the industry and company type. If you truly cannot determine something, leave it empty.

Return ONLY valid JSON in this exact format:

{
  "productDescription": "2-3 sentences about what the product/service does and the problem it solves",
  "targetAudience": "Description of ideal customer profile - who buys this product",
  "jobTitles": "3-5 target job titles, comma-separated (e.g., 'CEO, VP Marketing, Head of Growth')",
  "painPoints": "Top 3 customer pain points, each on a new line",
  "uniqueValue": "What makes this company different from competitors",
  "keyBenefits": "Top 3 benefits, each on a new line",
  "competitors": "2-4 main competitors, comma-separated",
  "industry": "One of: saas, agency, ecommerce, fintech, healthtech, edtech, marketplace, coaching, other",
  "companySize": "Target customer company size: 1-10, 11-50, 51-200, 201-1000, or 1000+",
  "primaryGoal": "Most likely primary goal: leads, awareness, authority, sales, community, or hiring",
  "contentTone": "Recommended tone: professional, casual, bold, educational, or inspiring"
}

Important:
- Be specific to ${companyName}, not generic
- For pain points and benefits, put each item on a new line
- If this is a well-known company, use accurate information
- If less known, make reasonable inferences from the industry and website
- Do not make up specific metrics or claims you can't verify

Research ${companyName} now and return the JSON:`
}

/**
 * GET endpoint to check if autofill is available
 */
export async function GET() {
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY

  return NextResponse.json({
    available: hasApiKey,
    message: hasApiKey
      ? "AI autofill is available"
      : "ANTHROPIC_API_KEY not configured",
  })
}
