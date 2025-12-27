/**
 * Typed localStorage utilities for the GTM Content Engine
 */

import type { FormData } from "@/types/form"
import type { GeneratedContent, StoredTaskData, AppData } from "@/types/content"
import { defaultFormData } from "@/types/form"
import { defaultGeneratedContent } from "@/types/content"

// Storage keys
export const STORAGE_KEYS = {
  FORM_DATA: "gtm_form_data",
  GENERATED_CONTENT: "gtm_generated_content",
  DAILY_TASKS: "gtm_daily_tasks",
  READY_STATE: "gtm_ready_state",
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

// Type-safe storage interface
interface StorageData {
  [STORAGE_KEYS.FORM_DATA]: FormData
  [STORAGE_KEYS.GENERATED_CONTENT]: GeneratedContent
  [STORAGE_KEYS.DAILY_TASKS]: StoredTaskData
  [STORAGE_KEYS.READY_STATE]: boolean
}

// Check if we're in a browser environment
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

// Generic get function with type safety
export function getStorageItem<K extends StorageKey>(key: K): StorageData[K] | null {
  if (!isBrowser()) return null

  try {
    const item = localStorage.getItem(key)
    if (item === null) return null
    return JSON.parse(item) as StorageData[K]
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error)
    return null
  }
}

// Generic set function with type safety
export function setStorageItem<K extends StorageKey>(key: K, value: StorageData[K]): boolean {
  if (!isBrowser()) return false

  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.error(`Error writing to localStorage key "${key}":`, error)
    return false
  }
}

// Remove a storage item
export function removeStorageItem(key: StorageKey): boolean {
  if (!isBrowser()) return false

  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.error(`Error removing localStorage key "${key}":`, error)
    return false
  }
}

// Form data utilities
export function getFormData(): FormData {
  const data = getStorageItem(STORAGE_KEYS.FORM_DATA)
  return data ?? defaultFormData
}

export function setFormData(data: FormData): boolean {
  return setStorageItem(STORAGE_KEYS.FORM_DATA, data)
}

export function updateFormData(updates: Partial<FormData>): boolean {
  const current = getFormData()
  return setFormData({ ...current, ...updates })
}

// Generated content utilities
export function getGeneratedContent(): GeneratedContent {
  const data = getStorageItem(STORAGE_KEYS.GENERATED_CONTENT)
  return data ?? defaultGeneratedContent
}

export function setGeneratedContent(content: GeneratedContent): boolean {
  return setStorageItem(STORAGE_KEYS.GENERATED_CONTENT, content)
}

// Daily tasks utilities
export function getDailyTasks(): StoredTaskData {
  const data = getStorageItem(STORAGE_KEYS.DAILY_TASKS)
  return data ?? {}
}

export function setDailyTasks(tasks: StoredTaskData): boolean {
  return setStorageItem(STORAGE_KEYS.DAILY_TASKS, tasks)
}

export function toggleTaskStatus(taskId: number): boolean {
  const tasks = getDailyTasks()
  const newTasks = { ...tasks, [taskId]: !tasks[taskId] }
  return setDailyTasks(newTasks)
}

// Ready state utilities
export function getReadyState(): boolean {
  const data = getStorageItem(STORAGE_KEYS.READY_STATE)
  return data ?? false
}

export function setReadyState(ready: boolean): boolean {
  return setStorageItem(STORAGE_KEYS.READY_STATE, ready)
}

// Clear all app data
export function clearAllData(): boolean {
  if (!isBrowser()) return false

  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key)
    })
    return true
  } catch (error) {
    console.error("Error clearing all data:", error)
    return false
  }
}

// Export all app data
export function exportAppData(): AppData {
  return {
    formData: getFormData(),
    generatedContent: getGeneratedContent(),
    dailyTasks: getDailyTasks(),
    readyState: getReadyState(),
    exportDate: new Date().toISOString(),
    version: "1.0.0",
  }
}

// Import app data
export function importAppData(data: AppData): boolean {
  try {
    if (data.formData) {
      setFormData(data.formData)
    }
    if (data.generatedContent) {
      setGeneratedContent(data.generatedContent)
    }
    if (data.dailyTasks) {
      setDailyTasks(data.dailyTasks)
    }
    if (typeof data.readyState === "boolean") {
      setReadyState(data.readyState)
    }
    return true
  } catch (error) {
    console.error("Error importing app data:", error)
    return false
  }
}

// Validate imported data structure
export function validateImportData(data: unknown): data is AppData {
  if (typeof data !== "object" || data === null) return false

  const obj = data as Record<string, unknown>

  // Check required fields exist
  if (!obj.formData || typeof obj.formData !== "object") return false
  if (!obj.generatedContent || typeof obj.generatedContent !== "object") return false
  if (typeof obj.readyState !== "boolean") return false

  // Check generated content structure
  const content = obj.generatedContent as Record<string, unknown>
  const platforms = ["linkedin", "twitter", "threads", "email", "ads"]
  for (const platform of platforms) {
    if (!Array.isArray(content[platform])) return false
  }

  return true
}

// Storage event listener for cross-tab sync
export function onStorageChange(callback: (key: StorageKey, newValue: unknown) => void): () => void {
  if (!isBrowser()) return () => {}

  const handler = (event: StorageEvent) => {
    if (event.key && Object.values(STORAGE_KEYS).includes(event.key as StorageKey)) {
      try {
        const newValue = event.newValue ? JSON.parse(event.newValue) : null
        callback(event.key as StorageKey, newValue)
      } catch (error) {
        console.error("Error parsing storage event:", error)
      }
    }
  }

  window.addEventListener("storage", handler)
  return () => window.removeEventListener("storage", handler)
}

// Calculate storage usage
export function getStorageUsage(): { used: number; available: number; percentage: number } {
  if (!isBrowser()) return { used: 0, available: 0, percentage: 0 }

  try {
    let used = 0
    Object.values(STORAGE_KEYS).forEach((key) => {
      const item = localStorage.getItem(key)
      if (item) {
        used += item.length * 2 // UTF-16 encoding
      }
    })

    // Estimate available (typically 5-10MB)
    const available = 5 * 1024 * 1024 // 5MB estimate
    const percentage = Math.round((used / available) * 100)

    return { used, available, percentage }
  } catch (error) {
    console.error("Error calculating storage usage:", error)
    return { used: 0, available: 0, percentage: 0 }
  }
}
