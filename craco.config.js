const fs = require('fs');
const path = require('path');

// Only the blog's markdown. The API docs import their .md files for the URL and
// fetch them at runtime, which CRA's catch-all asset rule already handles.
const BLOG_CONTENT = path.resolve(__dirname, 'src/components/Blog/content');

/**
 * react-markdown and the unified/remark stack it pulls in ship ESM only, which
 * jest cannot load untransformed — webpack handles them fine, so this is a test
 * concern alone. The list is derived rather than hand-written: naming the forty
 * or so packages by hand goes stale the moment a transitive dependency changes.
 */
const esmPackages = (roots) => {
    const seen = new Set();
    const esm = new Set();

    /** npm hoists unevenly, so resolve a dependency the way node would. */
    const locate = (name, fromDir) => {
        let dir = fromDir;
        for (;;) {
            const candidate = path.join(dir, 'node_modules', name);
            if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
            const parent = path.dirname(dir);
            if (parent === dir || dir === __dirname) return null;
            dir = parent;
        }
    };

    const visit = (name, fromDir) => {
        const key = `${name}@${fromDir}`;
        if (seen.has(key)) return;
        seen.add(key);

        const dir = locate(name, fromDir);
        if (!dir) return;

        const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
        // Name-based, because that is all the ignore pattern can match on: if any
        // installed copy is ESM, every copy has to go through babel.
        if (manifest.type === 'module') esm.add(name);
        Object.keys(manifest.dependencies || {}).forEach((dep) => visit(dep, dir));
    };

    roots.forEach((name) => visit(name, __dirname));
    return [...esm].map((name) => name.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('|');
};

module.exports = {
    devServer: {
        allowedHosts: 'all',
    },
    webpack: {
        configure: (webpackConfig) => {
            const rules = webpackConfig.module.rules.find((rule) => Array.isArray(rule.oneOf));
            if (!rules) throw new Error('craco: CRA oneOf rule list not found');
            rules.oneOf.unshift({
                test: /\.md$/,
                include: BLOG_CONTENT,
                type: 'asset/source',
            });
            return webpackConfig;
        },
    },
    jest: {
        configure: (jestConfig) => ({
            ...jestConfig,
            transformIgnorePatterns: [
                `[/\\\\]node_modules[/\\\\](?!(${esmPackages(['react-markdown', 'remark-gfm'])})[/\\\\]).+\\.(js|mjs|jsx|ts|tsx)$`,
                '^.+\\.module\\.(css|sass|scss)$',
            ],
            moduleNameMapper: {
                // jest's resolver understands neither the conditional subpath
                // exports nor the "#name" imports these packages declare, so
                // the node variants are pointed at by hand.
                '^unist-util-visit-parents/do-not-use-color$':
                    '<rootDir>/node_modules/unist-util-visit-parents/lib/color.js',
                '^#min(path|proc|url)$': '<rootDir>/node_modules/vfile/lib/min$1.js',
                ...jestConfig.moduleNameMapper,
            },
            // Ours has to be matched before CRA's catch-all file transform, which
            // would otherwise hand the article its own filename.
            transform: {
                '\\.md$': path.resolve(__dirname, 'config/jest/markdownTransform.js'),
                ...jestConfig.transform,
            },
        }),
    },
};
