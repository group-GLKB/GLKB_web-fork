/*
 * Some investigate responses contain an orphan list marker followed by the item text:
 *
 *   -
 *
 *   *Bottom line:* * The conclusion...
 *
 * CommonMark parses that as an empty one-item list and a separate paragraph. Repair only
 * that exact source shape so legitimate spacing and ordinary lists remain untouched.
 */
const ORPHAN_SINGLE_ITEM = /^([ \t]*[-+*])[ \t]*\r?\n(?:[ \t]*\r?\n)+([ \t]*\*[^*\r\n]+\*)[ \t]*\*[ \t]+/gm;

export const repairOrphanSingleItemMarkdown = (content) => {
    if (typeof content !== 'string' || !content) return content;
    return content.replace(ORPHAN_SINGLE_ITEM, '$1 $2 ');
};
