const { createProxyMiddleware } = require('http-proxy-middleware');

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
};