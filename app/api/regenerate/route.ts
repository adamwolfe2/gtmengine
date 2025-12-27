import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import type { FormData } from "@/types/form"

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface RegenerateRequest {
  content: string
  platform: string
  feedback?: string
  formData: FormData
}

/**
 * Extract content from Claude's response (handle markdown code blocks)
 */
function extractContent(text: string): string {
  let cleaned = text.trim()

  // Handle ```markdown or ``` wrapping
  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n")
    lines.shift() // Remove opening ```
    if (lines[lines.length - 1]?.trim() === "```") {
      lines.pop() // Remove closing ```
    }
    cleaned = lines.join("\n")
  }

  return cleaned.trim()
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured", code: "NO_API_KEY" },
        { status: 500 }
      )
    }

    const body: RegenerateRequest = await request.json()
    const { content, platform, feedback, formData } = body

    if (!content || !platform || !formData) {
      return NextResponse.json(
        { error: "Missing required fields: content, platform, formData" },
        { status: 400 }
      )
    }

    console.log(`Regenerating ${platform} post for ${formData.companyName}${feedback ? " with feedback" : ""}`)

    const prompt = buildRegeneratePrompt(content, platform, formData, feedback)

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

    const newContent = extractContent(textBlock.text)

    return NextResponse.json({
      success: true,
      newContent,
    })
  } catch (error) {
    console.error("Regenerate API error:", error)
    return NextResponse.json(
      { error: "Failed to regenerate content", details: String(error) },
      { status: 500 }
    )
  }
}

function buildRegeneratePrompt(
  originalContent: string,
  platform: string,
  formData: FormData,
  feedback?: string
): string {
  const platformGuidelines: Record<string, string> = {
    linkedin: `LinkedIn Guidelines:
- Professional but personal tone
- 1300-2000 characters optimal (max 3000)
- Use white space and line breaks
- Strong hook in first line
- 3-5 relevant hashtags at the end
- End with engagement driver (question or CTA)`,
    twitter: `Twitter/X Guidelines:
- 240-280 characters max
- Punchy and direct
- No hashtags or max 1-2
- Strong opening hook
- Clear single point`,
    threads: `Threads Guidelines:
- Casual, authentic tone
- 400-500 characters optimal
- Personal storytelling style
- Conversational language
- No hashtags`,
    email: `Email Guidelines:
- Personal, one-to-one feeling
- Clear single CTA
- 200-400 words optimal
- Scannable paragraphs
- Value-first approach`,
    ads: `Ad Copy Guidelines:
- Lead with pain point or desire
- Specific claims
- Under 125 characters primary text
- Clear value proposition
- Strong CTA`,
  }

  let prompt = `You are a content writer. Rewrite the following ${platform} post to make it better and more engaging.

## ORIGINAL POST
${originalContent}

## COMPANY CONTEXT
- Company: ${formData.companyName}
- Industry: ${formData.industry || "Not specified"}
- Audience: ${formData.targetAudience || "Not specified"}
- Tone: ${formData.contentTone || "professional"}
- Goal: ${formData.primaryGoal || "engagement"}

## PLATFORM REQUIREMENTS
${platformGuidelines[platform] || "Follow platform best practices."}

`

  if (feedback) {
    prompt += `## USER FEEDBACK
The user wants the following changes:
${feedback}

`
  }

  prompt += `## INSTRUCTIONS
${feedback ? "Incorporate the user's feedback while maintaining platform best practices." : "Improve the hook, clarity, and engagement potential while keeping the core message."}

Return ONLY the new post content. Do not include any explanation or additional text. Just the post content ready to copy and paste.`

  return prompt
}
