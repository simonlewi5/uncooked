import { supabase } from '@/lib/supabase'
import type { ResumeDocument, ResumeRecordDto, ResumeRecordStatus } from '@/types'

type UploadedResumeFile = {
  storagePath: string
  fileName: string
  fileSize: number
  mimeType: string
}

type ResumeRow = {
  id: string
  user_id: string
  title: string
  structured_content: ResumeDocument | null
  source_file_path: string | null
  source_file_name: string | null
  source_file_mime: string | null
  source_file_size: number | null
  parse_status: string
  parse_error: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

type CreateParsedResumeInput = {
  userId: string
  title?: string
  structuredContent: ResumeDocument
  filePath: string
  fileName: string
  fileMimeType: string
  fileSize: number
  isPrimary?: boolean
  status?: ResumeRecordStatus
}

const DEFAULT_TITLE = 'Uploaded Resume'
const STORAGE_BUCKET = 'resumes'

const sanitizeFileName = (fileName: string) => fileName.replace(/[^a-zA-Z0-9._-]/g, '_')

const isResumeRecordStatus = (value: string): value is ResumeRecordStatus => {
  return ['pending_parse', 'parsed', 'partial', 'failed', 'edited'].includes(value)
}

const getMimeType = (fileType: string): string => {
  if (fileType && fileType.trim() !== '') {
    return fileType
  }

  return 'application/pdf'
}

export async function uploadResumeFile(file: File, userId: string): Promise<UploadedResumeFile> {
  const safeName = sanitizeFileName(file.name)
  const key = `${userId}/${Date.now()}_${crypto.randomUUID()}_${safeName}`
  const mimeType = getMimeType(file.type)

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(key, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: mimeType,
  })

  if (error) throw error

  return {
    storagePath: `${STORAGE_BUCKET}/${key}`,
    fileName: file.name,
    fileSize: file.size,
    mimeType: mimeType,
  }
}

const mapRowToDto = (row: ResumeRow): ResumeRecordDto => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  structuredContent: row.structured_content,
  filePath: row.source_file_path,
  fileName: row.source_file_name,
  fileMimeType: row.source_file_mime,
  fileSize: row.source_file_size,
  status: isResumeRecordStatus(row.parse_status) ? row.parse_status : 'failed',
  parseError: row.parse_error,
  isPrimary: row.is_primary,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export async function getPrimaryResume(userId: string): Promise<ResumeRecordDto | null> {
  const { data, error } = await supabase
    .from('resumes')
    .select('*')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<ResumeRow>()

  if (error) throw error
  return data ? mapRowToDto(data) : null
}

export async function createParsedResume(input: CreateParsedResumeInput): Promise<ResumeRecordDto> {
  const { data, error } = await supabase
    .from('resumes')
    .insert({
      user_id: input.userId,
      title: input.title?.trim() || DEFAULT_TITLE,
      structured_content: input.structuredContent,
      source_file_path: input.filePath,
      source_file_name: input.fileName,
      source_file_mime: input.fileMimeType,
      source_file_size: input.fileSize,
      parse_status: input.status ?? 'parsed',
      is_primary: input.isPrimary ?? true,
    })
    .select('*')
    .single<ResumeRow>()

  if (error) throw error
  return mapRowToDto(data)
}

export async function saveResumeStructuredContent(
  resumeId: string,
  structuredContent: ResumeDocument,
  status: ResumeRecordStatus = 'edited'
): Promise<ResumeRecordDto> {
  const { data, error } = await supabase
    .from('resumes')
    .update({
      structured_content: structuredContent,
      parse_status: status,
      parse_error: null,
    })
    .eq('id', resumeId)
    .select('*')
    .single<ResumeRow>()

  if (error) throw error
  return mapRowToDto(data)
}
