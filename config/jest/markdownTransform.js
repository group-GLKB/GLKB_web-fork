/**
 * Jest counterpart to the `asset/source` webpack rule in craco.config.js: the
 * blog's markdown has to arrive as a string under test too, or the articles
 * render their own file paths.
 */
const crypto = require('crypto');

module.exports = {
    process(sourceText) {
        return { code: `module.exports = ${JSON.stringify(sourceText)};` };
    },
    getCacheKey(sourceText, sourcePath) {
        return crypto
            .createHash('md5')
            .update('blog-markdown-transform')
            .update(sourcePath)
            .update(sourceText)
            .digest('hex');
    },
};
