const {
    createProxyMiddleware,
} = require('http-proxy-middleware');

module.exports = function (app) {
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        next();
    });

    // Dev-only proxy for relative /api/* requests.
    // Note: axiosConfig sets absolute baseURL (…/reorg-api), so normal axios calls
    // bypass this proxy. This path only helps fetch()/relative clients and CRA.
    //
    // Express mounts at '/api' and strips that prefix before HPM sees req.url,
    // so rewrite must use '^/' not '^/api' (otherwise /v1/... is forwarded bare → 404).
    app.use(
        '/api',
        createProxyMiddleware({
            target: process.env.REACT_APP_API_PROXY_TARGET || 'https://jieliulab3.dcmb.med.umich.edu',
            changeOrigin: true,
            secure: false,
            pathRewrite: {
                '^/': '/reorg-api/api/',
            },
        })
    );
};
