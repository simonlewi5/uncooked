/** Resume record data transfer objects — database DTOs and persistence types. */

import type { ResumeDocument } from './resumeDocument'

export type ResumeRecordStatus = 'pending_parse' | 'parsed' | 'partial' | 'failed' | 'edited'

export interface ResumeRecordDto {
	id: string
	userId: string
	title: string
	structuredContent: ResumeDocument | null
	filePath: string | null
	fileName: string | null
	fileMimeType: string | null
	fileSize: number | null
	status: ResumeRecordStatus
	parseError: string | null
	isPrimary: boolean
	createdAt: string
	updatedAt: string
}
