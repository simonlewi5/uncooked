import { GoogleGenerativeAI } from '@google/generative-ai'

let client: GoogleGenerativeAI | null = null

function getClient(): GoogleGenerativeAI {
  if (client) return client
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. Please add it to your environment (e.g. .env.local or Vercel project settings) before calling Gemini.'
    )
  }
  client = new GoogleGenerativeAI(apiKey)
  return client
}

export const getGeminiModel = (model = 'gemini-2.0-pro-exp') =>
  getClient().getGenerativeModel({ model })