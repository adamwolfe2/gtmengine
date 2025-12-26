/**
 * Content-related type definitions for the GTM Content Engine
 */

import type { PlatformId } from "./form"

// Post status for content review workflow
export type PostStatus = "ready" | "review"

// Content pillar categories for organizing posts
export type Pillar =
  | "Product Journey"
  | "Founder Story"
  | "Growth Metrics"
  | "Industry Insights"
  | "Community Wins"
  | "Culture/BTS"
  | "Engagement"

// Pillar ID for internal references
export type PillarId =
  | "product"
  | "founder"
  | "metrics"
  | "insights"
  | "community"
  | "culture"
  | "engagement"

// Individual content post structure
export interface Post {
  id: number
  title: string
  pillar: Pillar
  status: PostStatus
  content: string
}

// Generated content organized by platform
export interface GeneratedContent {
  linkedin: Post[]
  twitter: Post[]
  threads: Post[]
  email: Post[]
  ads: Post[]
}

// Default empty generated content
export const defaultGeneratedContent: GeneratedContent = {
  linkedin: [],
  twitter: [],
  threads: [],
  email: [],
  ads: [],
}

// Platform configuration for UI rendering
export interface PlatformConfig {
  id: PlatformId
  name: string
  icon: string // Icon component name from lucide-react
  color: string // Tailwind color class
}

// Pillar configuration for UI rendering
export interface PillarConfig {
  id: PillarId
  name: Pillar
  pct: number // Target percentage of content
  color: string // Tailwind color class
  desc: string // Short description
}

// Daily task tracking
export interface DailyTask {
  id: number
  title: string
  description: string
  platform?: PlatformId
}

// Stored task completion state
export type StoredTaskData = Record<number, boolean>

// App data structure for import/export
export interface AppData {
  formData: import("./form").FormData
  generatedContent: GeneratedContent
  dailyTasks: StoredTaskData
  readyState: boolean
  exportDate: string
  version: string
}

// Content statistics by platform
export interface PlatformStats {
  total: number
  ready: number
  review: number
}

// Content statistics by pillar
export interface PillarStats {
  pillar: Pillar
  count: number
  percentage: number
}

// Overall content library statistics
export interface ContentStats {
  totalPosts: number
  byPlatform: Record<PlatformId, PlatformStats>
  byPillar: PillarStats[]
  readyCount: number
  reviewCount: number
}

// Calendar event for content scheduling
export interface CalendarEvent {
  id: string
  date: Date
  platform: PlatformId
  post: Post
  status: "scheduled" | "posted" | "draft"
}

// Content generation mode
export type GenerationMode = "template" | "llm"
