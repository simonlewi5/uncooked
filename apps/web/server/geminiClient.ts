import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  throw new Error(
    'GEMINI_API_KEY is not set. Please add it to your environment (e.g. .env.local or Vercel project settings) before calling Gemini.'
  )
}

const client = new GoogleGenerativeAI(apiKey)

export const getGeminiModel = (model = 'gemini-2.5-flash') =>
  client.getGenerativeModel({ model })

