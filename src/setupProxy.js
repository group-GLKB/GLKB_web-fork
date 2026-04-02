const {
    createProxyMiddleware,
    responseInterceptor,
} = require('http-proxy-middleware');

module.exports = function (app) {
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        next();
    });

    // Proxy /api requests to /reorg-api on the backend
    app.use(
        '/api',
        createProxyMiddleware({
            target: 'https://glkb.dcmb.med.umich.edu',
            changeOrigin: true,
            secure: false,
            pathRewrite: {
                '^/api': '/reorg-api/api', // Rewrite /api to /reorg-api/api
            },
        })
    );

    // Proxy API docs and inject a background override for the embedded view
    app.use(
        '/api-docs',
        createProxyMiddleware({
            target: 'https://glkb.dcmb.med.umich.edu',
            changeOrigin: true,
            secure: false,
            selfHandleResponse: true,
            pathRewrite: {
                '^/api-docs': '/docs',
            },
            onProxyRes: responseInterceptor(async (responseBuffer, proxyRes) => {
                delete proxyRes.headers['x-frame-options'];
                delete proxyRes.headers['content-security-policy'];
                delete proxyRes.headers['content-security-policy-report-only'];

                const contentType = proxyRes.headers['content-type'] || '';
                if (!contentType.includes('text/html')) {
                    return responseBuffer;
                }

                const html = responseBuffer.toString('utf8');
                const styleTag = '<style>body{background:#FAFCFF !important;}</style>';
                if (html.includes('</head>')) {
                    return html.replace('</head>', `${styleTag}</head>`);
                }
                return `${styleTag}${html}`;
            }),
        })
    );

    // Ensure absolute /docs asset requests resolve in the proxy
    app.use(
        '/docs',
        createProxyMiddleware({
            target: 'https://glkb.dcmb.med.umich.edu',
            changeOrigin: true,
            secure: false,
        })
    );
};