/** Core resume document structure — the data model for resume content. */

export interface ResumeDocumentField {
	id: string
	text: string
}

export interface ResumeDocumentExperienceEntry {
	id: string
	title: ResumeDocumentField
	company: ResumeDocumentField
	period: ResumeDocumentField
	bullets: ResumeDocumentField[]
}

export interface ResumeDocumentEducationEntry {
	id: string
	degree: ResumeDocumentField
	school: ResumeDocumentField
	period: ResumeDocumentField
}

export interface ResumeDocument {
	name: ResumeDocumentField
	contact: ResumeDocumentField
	summary: ResumeDocumentField
	experience: ResumeDocumentExperienceEntry[]
	education: ResumeDocumentEducationEntry[]
	skills: ResumeDocumentField[]
}
