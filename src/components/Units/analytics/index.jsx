// // Initialize Google Analytics
// export const initGA = () => {
//     window.dataLayer = window.dataLayer || [];
//     function gtag() { dataLayer.push(arguments); }
//     gtag('js', new Date());
//     gtag('config', 'G-9H6T764W1E');
// };

// // Track page views
// export const trackPageView = (page) => {
//     if (window.gtag) {
//         window.gtag('config', 'G-9H6T764W1E', {
//             page_path: page,
//         });
//     }
// };

// // Track events
// export const trackEvent = (category, action, label) => {
//     // Console log for debugging (remove in production)
//     console.log('GA4 Event:', { category, action, label });
//     
//     if (window.gtag) {
//         window.gtag('event', action, {
//             event_category: category,
//             event_label: label,
//         });
//     }
// };