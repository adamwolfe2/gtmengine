import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { buildContentPrompt } from "@/lib/content/prompts"
import type { FormData } from "@/types/form"

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface StreamRequest {
  formData: FormData
  competitorInsights?: string
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured", code: "NO_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const body: StreamRequest = await request.json()
    const { formData, competitorInsights } = body

    // Build the prompt
    const prompt = buildContentPrompt({
      formData,
      competitorInsights,
    })

    console.log("Starting streaming generation for:", formData.companyName)

    // Create a streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial status
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "status", message: "Starting content generation..." })}\n\n`)
          )

          // Stream from Claude
          const streamResponse = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 16000,
            stream: true,
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
          })

          let fullText = ""
          let tokenCount = 0

          for await (const event of streamResponse) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              fullText += event.delta.text
              tokenCount++

              // Send progress update every 50 tokens
              if (tokenCount % 50 === 0) {
                // Estimate progress based on typical response length
                const estimatedProgress = Math.min(90, Math.floor((tokenCount / 800) * 100))
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "progress",
                      progress: estimatedProgress,
                      message: `Generating content... (${tokenCount} tokens)`,
                    })}\n\n`
                  )
                )
              }

              // Send text chunk
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "chunk", text: event.delta.text })}\n\n`
                )
              )
            }
          }

          // Parse the complete response
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "status", message: "Parsing generated content..." })}\n\n`)
          )

          // Extract and parse JSON
          const jsonContent = extractJSON(fullText)
          let parsed

          try {
            parsed = JSON.parse(jsonContent)
          } catch (parseError) {
            // Try to repair JSON
            const repaired = repairJSON(jsonContent)
            try {
              parsed = JSON.parse(repaired)
            } catch {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "error", error: "Failed to parse generated content" })}\n\n`
                )
              )
              controller.close()
              return
            }
          }

          // Send completion
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "complete", content: parsed })}\n\n`
            )
          )

          controller.close()
        } catch (error) {
          console.error("Stream error:", error)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: String(error) })}\n\n`
            )
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Generate stream API error:", error)
    return new Response(
      JSON.stringify({ error: "Failed to start generation", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

/**
 * Extract JSON from Claude's response
 */
function extractJSON(text: string): string {
  let cleaned = text.trim()

  // Handle ```json ... ``` wrapping
  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n")
    lines.shift()
    if (lines[lines.length - 1]?.trim() === "```") {
      lines.pop()
    }
    cleaned = lines.join("\n")
  }

  // Find the first { and last }
  const firstBrace = cleaned.indexOf("{")
  const lastBrace = cleaned.lastIndexOf("}")

  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }

  return cleaned
}

/**
 * Attempt to repair common JSON issues
 */
function repairJSON(jsonStr: string): string {
  let repaired = jsonStr

  // Fix trailing commas before closing brackets
  repaired = repaired.replace(/,(\s*[}\]])/g, "$1")

  // Fix unescaped newlines in strings
  repaired = repaired.replace(/(?<!\\)\n(?=(?:[^"]*"[^"]*")*[^"]*$)/g, "\\n")

  return repaired
}
