const {
    createProxyMiddleware,
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
            target: 'https://backend.glkb.org',
            changeOrigin: true,
            secure: false,
            pathRewrite: {
                '^/api': '/api', // Rewrite /api to /reorg-api/api
            },
        })
    );

};