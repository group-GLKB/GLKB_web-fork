/**
 * The shape of an attachment as the app keeps it — from an upload response, a history row, a
 * queued follow-up or navigation state. Dependency-free on purpose: history parsing
 * (utils/chatHistory.js) needs it without pulling in the API client. The API side is
 * service/attachments.js, which re-exports these.
 */
const PDF_MIME_TYPE = 'application/pdf';

export const formatBytes = (bytes) => {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
};

/* The backend names each file's `format` ("Python", "Notebook", "Word", ...). These are the
   ones shown with a code icon rather than a document icon. */
const CODE_FORMATS = new Set([
    'python', 'notebook', 'javascript', 'typescript', 'jsx', 'tsx', 'r', 'r markdown', 'julia',
    'matlab', 'java', 'kotlin', 'scala', 'c', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'swift',
    'perl', 'lua', 'shell', 'bash', 'powershell', 'sql', 'json', 'yaml', 'toml', 'xml', 'html',
    'css', 'scss', 'csv', 'tsv', 'latex', 'tex', 'ini', 'config', 'graphql', 'dockerfile',
    'makefile', 'fasta', 'fastq', 'vcf', 'bed', 'sam', 'gff', 'gtf',
]);

export const isCodeFormat = (format) => CODE_FORMATS.has(String(format || '').trim().toLowerCase());

// What a file is called before the backend has said — from its name alone.
const EXTENSION_FORMAT = {
    py: 'Python', ipynb: 'Notebook', js: 'JavaScript', mjs: 'JavaScript', jsx: 'JSX', ts: 'TypeScript',
    tsx: 'TSX', r: 'R', rmd: 'R Markdown', jl: 'Julia', m: 'MATLAB', java: 'Java', kt: 'Kotlin',
    scala: 'Scala', c: 'C', h: 'C', cpp: 'C++', cc: 'C++', hpp: 'C++', cs: 'C#', go: 'Go', rs: 'Rust',
    rb: 'Ruby', php: 'PHP', swift: 'Swift', pl: 'Perl', lua: 'Lua', sh: 'Shell', bash: 'Shell',
    zsh: 'Shell', ps1: 'PowerShell', sql: 'SQL', json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML',
    xml: 'XML', html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', csv: 'CSV', tsv: 'TSV', tex: 'LaTeX',
    md: 'Markdown', txt: 'Text', log: 'Text', rtf: 'Rich text', docx: 'Word', doc: 'Word',
    pptx: 'PowerPoint', ppt: 'PowerPoint', xlsx: 'Excel', xls: 'Excel', pdf: 'PDF', epub: 'EPUB',
    png: 'PNG image', jpg: 'JPEG image', jpeg: 'JPEG image', webp: 'WebP image', gif: 'GIF image',
    fasta: 'FASTA', fa: 'FASTA', fastq: 'FASTQ', vcf: 'VCF', bed: 'BED', gff: 'GFF', gtf: 'GTF',
};

export const formatLabelForName = (name) => {
    const text = String(name || '');
    const dot = text.lastIndexOf('.');
    const ext = dot > 0 ? text.slice(dot + 1).toLowerCase() : '';
    return EXTENSION_FORMAT[ext] || '';
};

/** "Python · 4 KB", "PDF · 4 pages · 2 KB" — what a chip or a sent file says under its name. */
export const attachmentMetaText = (attachment, { fallbackName = '', fallbackSize = null } = {}) => {
    const item = attachment || {};
    const parts = [];
    const format = item.format || formatLabelForName(item.filename || fallbackName);
    if (format) parts.push(format);
    const pages = Number(item.page_count);
    if (item.page_count !== null && item.page_count !== undefined && Number.isFinite(pages) && pages > 0) {
        parts.push(`${pages} page${pages === 1 ? '' : 's'}`);
    }
    const size = formatBytes(item.size_bytes ?? fallbackSize);
    if (size) parts.push(size);
    return parts.join(' · ');
};

/** The fields the app keeps for an attachment, from an upload response or a history row. */
export const normalizeAttachment = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const id = typeof raw.id === 'string' || typeof raw.id === 'number' ? String(raw.id) : '';
    if (!id) return null;
    const mimeType = String(raw.mime_type || raw.mimeType || '');
    // Anything that is neither a picture nor a PDF is a "file" (code, a notebook, Word, text...).
    const kind = raw.kind === 'image' || raw.kind === 'pdf' || raw.kind === 'file'
        ? raw.kind
        : (mimeType === PDF_MIME_TYPE ? 'pdf' : (mimeType.startsWith('image/') ? 'image' : 'file'));
    const num = (value) => (value === null || value === undefined || value === ''
        || !Number.isFinite(Number(value)) ? null : Number(value));
    return {
        id,
        kind,
        mime_type: mimeType,
        filename: String(raw.filename || raw.name
            || (kind === 'image' ? 'image' : (kind === 'pdf' ? 'document.pdf' : 'file'))),
        ...(raw.format ? { format: String(raw.format) } : {}),
        size_bytes: num(raw.size_bytes ?? raw.sizeBytes),
        page_count: num(raw.page_count ?? raw.pageCount),
        ...(raw.char_count !== undefined ? { char_count: num(raw.char_count) } : {}),
        ...(raw.truncated ? { truncated: true } : {}),
    };
};

/** A clean list from whatever a message, a queue entry or a history row carried. */
export const normalizeAttachmentList = (list) => (
    Array.isArray(list) ? list.map(normalizeAttachment).filter(Boolean) : []
);

/** The ids the chat stream is sent. */
export const attachmentIdsOf = (list) => normalizeAttachmentList(list).map((item) => item.id);

/** The question sent when the box is empty but files are attached. */
export const defaultQuestionFor = (list) => (
    (Array.isArray(list) ? list.length : 0) > 1
        ? 'Summarize the attached files.'
        : 'Summarize the attached file.'
);
