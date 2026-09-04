/**
 * The server's timestamps and the browser's are not on the same clock.
 *
 * `chat_histories.last_accessed_time` and every other time the API returns is written with
 * `datetime.utcnow()` (or SQLite's `CURRENT_TIMESTAMP`, which is also UTC) into a column that
 * carries no offset. Pydantic serialises that naive value verbatim — `"2026-09-02T03:38:37"`,
 * with no `Z` and no `+00:00`.
 *
 * `new Date()` reads a date-time string with no timezone designator as LOCAL time. So in
 * America/Detroit that string parses to 07:38 UTC: every server timestamp reads four hours
 * into the future, and eight hours into the past for a reader in Shanghai.
 *
 * On its own that would only make the times displayed wrong. What made it a bug is that the
 * app also writes timestamps of its own — `updateConversationMessages` dates the conversation
 * being answered `new Date().toISOString()`, which is correct UTC, to lift it to the top of
 * the sidebar — and then SORTS the two kinds against each other. West of UTC the server's
 * inflated values win, so the conversation being answered right now lost to every conversation
 * merely opened in the last few hours, and `fetchConversations`' "keep the newer of the two"
 * merge threw the local timestamp away on the next refresh. The lift worked, then silently
 * came undone; which of the two the reader saw depended on when the list last refreshed.
 *
 * The fix is to put both on one clock at the boundary where server values enter the app: a
 * datetime string with no designator means UTC, because that is what the backend writes.
 * Everything downstream then compares and formats plain ISO-UTC strings.
 *
 * Its own module, with no imports, so the rule can be tested without pulling the app in.
 */

/* A date-time that already says which clock it is on: a trailing `Z`, or a `+hh:mm` / `-hh:mm`
   offset after the time part. The offset has to be matched after the `T` — a bare date like
   `2026-09-02` has hyphens of its own, and treating those as offsets would leave it alone when
   it should be read as UTC midnight. */
const HAS_TIMEZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const LOOKS_LIKE_ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/;

/**
 * The same instant, said in a way `new Date()` cannot misread.
 *
 * Strings the server wrote without a designator gain a `Z`. Anything else — a value that
 * already carries an offset, a number of milliseconds, a `Date` — is handed back untouched,
 * because it is already unambiguous and this must not second-guess it.
 *
 * @param {string|number|Date|null|undefined} value
 * @returns {string|number|Date|null|undefined} the value, disambiguated
 */
export const withServerTimezone = (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (HAS_TIMEZONE.test(trimmed)) return trimmed;
    if (!LOOKS_LIKE_ISO_DATE.test(trimmed)) return value;
    // A space separator is legal in the API's output but not in the ISO form `Date` parses
    // strictly, so it is normalised at the same time.
    return `${trimmed.replace(' ', 'T')}Z`;
};

/**
 * A server timestamp as a `Date`, or null when it does not name a moment.
 *
 * Null rather than an Invalid Date: callers sort and subtract with these, and NaN propagating
 * through a comparator is how a list silently stops being ordered at all.
 */
export const parseServerTime = (value) => {
    if (value == null || value === '') return null;
    const date = new Date(withServerTimezone(value));
    return Number.isNaN(date.getTime()) ? null : date;
};

/** Milliseconds since the epoch, or null. The form a comparator wants. */
export const serverTimeMs = (value) => {
    const date = parseServerTime(value);
    return date ? date.getTime() : null;
};

/**
 * A server timestamp as an unambiguous ISO-UTC string, for storing alongside timestamps the
 * app writes itself. Returns null when the value does not name a moment, so a caller can fall
 * back rather than store something that will not parse.
 */
export const toIsoUtc = (value) => {
    const date = parseServerTime(value);
    return date ? date.toISOString() : null;
};

export default parseServerTime;
