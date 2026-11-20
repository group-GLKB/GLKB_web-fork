/**
 * `/oauth/authorize?request=<id>` — where an outside app (Claude, ChatGPT, ...) asks to use the
 * reader's GLKB account, and the reader says yes or no.
 *
 * The app sends the browser to glkb-backend's `/oauth/authorize`, which checks the request and
 * hands it on to this page (service/oauthConnect.js). The page:
 *
 *   1. makes sure the reader is signed in to GLKB. Signed out, it opens the site's own sign-in
 *      overlay; Google finishes in place, an emailed code comes back here from /verify-code with
 *      the same `?request=` (Auth/returnTo.js). An expired sign-in (401) is treated the same way.
 *   2. says who is asking — the name the app gives itself, and the site it will return to, which
 *      is what lets a reader spot a fake — what it may do, what a report costs, and what it may not
 *      do.
 *   3. sends the answer, then follows the backend's `redirect_to` (the app's own address).
 *
 * A request lasts ten minutes and is answered once; after that the backend says 404 and the page
 * says so, with nothing left to press.
 *
 * Standalone, like the sign-in pages: no sidebar, no chat. Behind OAUTH_CONNECT_ENABLED
 * (config/features.js): on glkb.org it sends the reader home.
 */
import './scoped.css';

import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import { Helmet } from 'react-helmet-async';
import {
    Link,
    Navigate,
    useLocation,
} from 'react-router-dom';

import { OAUTH_CONNECT_ENABLED } from '../../config/features';
import logoIcon from '../../img/GLKB_logo_icon.png';
import logoWordmark from '../../img/navbar/logo.png';
import {
    approveOAuthRequest,
    denyOAuthRequest,
    fetchOAuthRequest,
    followRedirect,
    NOT_FOUND,
    SIGNED_OUT,
} from '../../service/oauthConnect';
import { useAuth } from '../Auth/AuthContext';
import LoginModal from '../Auth/LoginModal';

const SIGN_IN_REASON = 'An app is asking to use your GLKB account. Sign in to see what it wants.';

const formatCredits = (n) => `${n.toLocaleString('en-US')} credit${n === 1 ? '' : 's'}`;

/* What the app cannot do. Written here, not sent by the backend: it is true of the one scope
   there is (`investigate`), and has to be re-read if another is added. */
const CANNOT = [
    'Read your other GLKB conversations',
    'Change your account or settings',
    'Spend your credits on anything other than Investigate reports',
];

function Check() {
    return (
        <svg className="consent-mark is-yes" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function Cross() {
    return (
        <svg className="consent-mark is-no" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M6 6l8 8M14 6l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

/**
 * The card every state of the page is shown in. Its heading takes the focus when the state
 * changes, so a screen reader hears what the page now says (not while the sign-in overlay is
 * opening over it: `focus={false}`).
 */
function Card({ title, children, viewKey, focus = true }) {
    const headingRef = useRef(null);
    useEffect(() => {
        if (focus) headingRef.current?.focus();
    }, [viewKey, focus]);
    return (
        <section className="consent-card" aria-labelledby="consent-title">
            <h1 className="consent-title" id="consent-title" tabIndex={-1} ref={headingRef}>{title}</h1>
            {children}
        </section>
    );
}

function Expired() {
    return (
        <Card title="This link has expired" viewKey="expired">
            <p className="consent-text">
                A link to connect an app lasts 10 minutes and can be answered once. If you still
                want to connect, go back to the app and connect GLKB again.
            </p>
        </Card>
    );
}

function ConsentPage() {
    const location = useLocation();
    const {
        user,
        isAuthenticated,
        loading: authLoading,
        openLoginModal,
        logout,
    } = useAuth();
    const requestId = (new URLSearchParams(location.search).get('request') || '').trim();
    const here = `${location.pathname}${location.search}`;

    // loading | ready | expired | failed
    const [phase, setPhase] = useState('loading');
    const [request, setRequest] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);
    // 'allow' | 'deny' while an answer is on its way; then the host being returned to.
    const [busy, setBusy] = useState('');
    const [leavingTo, setLeavingTo] = useState('');
    const [answerError, setAnswerError] = useState('');

    // AuthContext hands out new functions on every render; the effects below must not re-run for that.
    const authRef = useRef({ logout, openLoginModal });
    authRef.current = { logout, openLoginModal };

    /* A sign-in the server no longer accepts. The axios interceptor has already cleared the stored
       token (and, on this page only, left the address alone); this brings the app's idea of the
       session in line, which shows the sign-in again. */
    const signedOutByServer = useCallback(() => {
        authRef.current.logout();
    }, []);

    // Open the sign-in on arrival, once, when there is a request to answer.
    const openedSignIn = useRef(false);
    useEffect(() => {
        if (authLoading || isAuthenticated || !requestId || openedSignIn.current) return;
        openedSignIn.current = true;
        authRef.current.openLoginModal(SIGN_IN_REASON);
    }, [authLoading, isAuthenticated, requestId]);

    useEffect(() => {
        if (authLoading || !isAuthenticated || !requestId) return undefined;
        let live = true;
        setPhase('loading');
        setAnswerError('');
        fetchOAuthRequest(requestId).then((result) => {
            if (!live) return;
            if (result.ok) {
                setRequest(result.request);
                setPhase('ready');
                return;
            }
            if (result.code === SIGNED_OUT) {
                signedOutByServer();
                return;
            }
            setPhase(result.code === NOT_FOUND || result.status === 404 ? 'expired' : 'failed');
        });
        return () => {
            live = false;
        };
    }, [authLoading, isAuthenticated, requestId, reloadKey, signedOutByServer]);

    const respond = async (verb) => {
        if (busy || leavingTo) return;
        setBusy(verb);
        setAnswerError('');
        const result = await (verb === 'allow' ? approveOAuthRequest : denyOAuthRequest)(requestId);
        if (result.ok) {
            let host = request?.redirectHost || '';
            try {
                host = host || new URL(result.redirectTo).host;
            } catch (error) { /* the generic line below */ }
            setLeavingTo(host || 'the app');
            setBusy('');
            followRedirect(result.redirectTo);
            return;
        }
        setBusy('');
        if (result.code === SIGNED_OUT) {
            signedOutByServer();
            return;
        }
        if (result.code === NOT_FOUND || result.status === 404) {
            setPhase('expired');
            return;
        }
        setAnswerError(result.code === 'BAD_REDIRECT'
            ? 'GLKB could not send you back to the app. Go back to it and try connecting again.'
            : 'That did not go through. Check your connection and try again.');
    };

    const switchAccount = async () => {
        await logout();
        openLoginModal(SIGN_IN_REASON);
    };

    let body;
    if (!requestId) {
        body = (
            <Card title="This link is incomplete" viewKey="missing">
                <p className="consent-text">
                    It is missing the part that says which app is asking. Go back to the app and
                    connect GLKB again.
                </p>
            </Card>
        );
    } else if (authLoading) {
        body = null;
    } else if (!isAuthenticated) {
        body = (
            <Card title="Sign in to connect an app" viewKey="signed-out" focus={false}>
                <p className="consent-text">
                    An app wants to use your GLKB account. Sign in first. Then you will see what it
                    is asking for, and nothing happens until you allow it.
                </p>
                <div className="consent-actions is-single">
                    <button type="button" className="consent-btn is-primary" onClick={() => openLoginModal(SIGN_IN_REASON)}>
                        Sign in to GLKB
                    </button>
                </div>
            </Card>
        );
    } else if (phase === 'expired') {
        body = <Expired />;
    } else if (phase === 'failed') {
        body = (
            <Card title="This request could not be loaded" viewKey="failed">
                <p className="consent-text">Check your connection and try again.</p>
                <div className="consent-actions is-single">
                    <button type="button" className="consent-btn" onClick={() => setReloadKey((n) => n + 1)}>
                        Try again
                    </button>
                </div>
            </Card>
        );
    } else if (phase === 'loading' || !request) {
        body = (
            <section className="consent-card" aria-busy="true">
                <p className="consent-text" role="status">Loading…</p>
            </section>
        );
    } else {
        const appName = request.clientName || 'An app';
        const { priceCredits, creditsRemaining } = request;
        const short = priceCredits !== null && creditsRemaining !== null && creditsRemaining < priceCredits;
        body = (
            <Card title={`${appName} wants to use your GLKB account`} viewKey="ready">
                <div className="consent-app">
                    <span className="consent-app-mark" aria-hidden="true">
                        {(appName.match(/[A-Za-z0-9]/)?.[0] || '?').toUpperCase()}
                    </span>
                    <span className="consent-app-lines">
                        <span className="consent-app-name">{appName}</span>
                        {request.redirectHost ? (
                            <span className="consent-app-host">
                                Will return you to <strong>{request.redirectHost}</strong>
                            </span>
                        ) : null}
                    </span>
                </div>
                <p className="consent-note">
                    Apps choose their own names.
                    {request.redirectHost
                        ? ` Allow this only if you came here from ${request.redirectHost}.`
                        : ' Allow this only if you came here from that app.'}
                </p>

                <p className="consent-signed-in">
                    Signed in as <strong>{user?.email || user?.username || 'you'}</strong>
                    {' '}
                    <button type="button" className="consent-link-btn" onClick={switchAccount} disabled={Boolean(busy || leavingTo)}>
                        Use another account
                    </button>
                </p>

                <h2 className="consent-subtitle">It will be able to</h2>
                <ul className="consent-list">
                    {request.scopes.map((scope) => (
                        <li key={scope.id || scope.title} className="consent-item">
                            <Check />
                            <span>
                                <span className="consent-item-title">{scope.title}</span>
                                {scope.description ? (
                                    <span className="consent-item-text">{scope.description}</span>
                                ) : null}
                            </span>
                        </li>
                    ))}
                </ul>

                {priceCredits !== null ? (
                    <div className="consent-cost">
                        <dl className="consent-cost-figures">
                            <div className="consent-cost-row">
                                <dt>Each report costs</dt>
                                <dd>{formatCredits(priceCredits)}</dd>
                            </div>
                            {creditsRemaining !== null ? (
                                <div className="consent-cost-row">
                                    <dt>You have</dt>
                                    <dd>{formatCredits(creditsRemaining)}</dd>
                                </div>
                            ) : null}
                        </dl>
                        {short ? (
                            <p className="consent-cost-note">
                                That is not enough for a report yet. You can still connect, and add
                                credits on your Account page before you ask for one.
                            </p>
                        ) : null}
                    </div>
                ) : null}

                <h2 className="consent-subtitle">It will not be able to</h2>
                <ul className="consent-list">
                    {CANNOT.map((line) => (
                        <li key={line} className="consent-item">
                            <Cross />
                            <span className="consent-item-text is-plain">{line}</span>
                        </li>
                    ))}
                </ul>

                <p className="consent-text consent-small">
                    You can disconnect it at any time under Connected apps on your Account page.
                </p>

                {answerError ? <p className="consent-error" role="alert">{answerError}</p> : null}

                {leavingTo ? (
                    <p className="consent-leaving" role="status">Taking you back to {leavingTo}…</p>
                ) : (
                    <div className="consent-actions" aria-busy={Boolean(busy)}>
                        <button
                            type="button"
                            className="consent-btn"
                            onClick={() => respond('deny')}
                            disabled={Boolean(busy)}
                        >
                            Don’t allow
                        </button>
                        <button
                            type="button"
                            className="consent-btn is-primary"
                            onClick={() => respond('allow')}
                            disabled={Boolean(busy)}
                        >
                            {busy === 'allow' ? 'Allowing…' : 'Allow'}
                        </button>
                    </div>
                )}
            </Card>
        );
    }

    return (
        <div className="consent-page">
            <Helmet>
                <title>Connect an app | GLKB</title>
            </Helmet>
            <main className="consent-main">
                <Link to="/" className="consent-logo" aria-label="GLKB home">
                    <img src={logoIcon} alt="" className="consent-logo-icon" />
                    <img src={logoWordmark} alt="" className="consent-logo-wordmark" />
                </Link>
                {body}
            </main>
            {/* Only this page's overlay is mounted here (it sits outside the app layout). */}
            <LoginModal returnTo={here} />
        </div>
    );
}

export default function OAuthConsent() {
    if (!OAUTH_CONNECT_ENABLED) return <Navigate to="/" replace />;
    return <ConsentPage />;
}
