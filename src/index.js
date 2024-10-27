import React from 'react'
import ReactDOM from 'react-dom'
import HomePage from './components/HomePage'
import AboutPage from './components/AboutPage'  // Add this import
import { Provider } from 'react-globally'
import { createBrowserHistory } from 'history';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initGA, trackPageView } from './components/Units/analytics';

import ResultPage from './components/ResultPage'
import { Result } from 'antd'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'

// const browserHistory = createBrowserHistory();
const initState = {
    searchType: ''
}

ReactDOM.render(
    // <React.StrictMode>
    //     <Provider globalState={initState}>
    //             {/* <App /> */}
    //             {/* <HomePage /> */}
    //             {/* <ResultPage /> */}
    //             {/* <ArticlePage /> */}
    //             {/* <EntityPage /> */}
                <Router>
                    <Routes>
                        <Route path='/result' element={<ResultPage />} />
                        <Route path="/" element={<HomePage />} />
                        <Route path="/about" element={<AboutPage />} />
                    </Routes>
                </Router>,
    //     </Provider>
    // </React.StrictMode>
    // <HomePage />,
    // <ResultPage />,
    document.getElementById('root')
)
