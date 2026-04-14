-- Add typed, structured resume persistence fields while keeping legacy content TEXT.
ALTER TABLE resumes
	ADD COLUMN structured_content JSONB NOT NULL DEFAULT '{}'::jsonb,
	ADD COLUMN source_file_path TEXT,
	ADD COLUMN source_file_name TEXT,
	ADD COLUMN source_file_mime TEXT,
	ADD COLUMN source_file_size INTEGER,
	ADD COLUMN parse_status TEXT NOT NULL DEFAULT 'pending_parse',
	ADD COLUMN parse_error TEXT;

ALTER TABLE resumes
	ADD CONSTRAINT resumes_parse_status_check
	CHECK (parse_status IN ('pending_parse', 'parsed', 'partial', 'failed', 'edited'));

ALTER TABLE resumes
	ADD CONSTRAINT resumes_source_file_size_non_negative
	CHECK (source_file_size IS NULL OR source_file_size >= 0);

CREATE INDEX resumes_parse_status_idx ON resumes(parse_status);

COMMENT ON COLUMN resumes.content IS 'DEPRECATED: legacy unstructured content string. Use structured_content JSONB.';
COMMENT ON COLUMN resumes.structured_content IS 'Canonical structured editable resume content used by editor and auto-tailor.';
