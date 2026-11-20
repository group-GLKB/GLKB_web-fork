/**
 * The Account page's "Connected apps": the outside apps (Claude, ChatGPT, ...) the reader has
 * allowed to use their GLKB account on the consent page (components/OAuthConsent), and a way to
 * take that back (service/oauthConnect.js; glkb-backend `/api/v1/oauth/grants`).
 *
 * Shown once the list has been read, an empty list included. While it loads, and when it cannot
 * be read (a backend without the endpoint), the section is not there at all. Disconnecting asks
 * first; the backend then stops every token that app was given.
 *
 * Behind OAUTH_CONNECT_ENABLED (config/features.js), checked where the page mounts this.
 */
import React, { useCallback, useEffect, useState } from 'react';

import {
    fetchGrants,
    NOT_FOUND,
    revokeGrant,
    scopeTitle,
} from '../../service/oauthConnect';
import { parseServerTime } from '../../utils/serverTime';
import { Dialog } from './Billing';

const formatDate = (value) => {
    const date = parseServerTime(value);
    return date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';
};

/* "Connected Nov 18, 2026 · Last used Nov 19, 2026": each half kept whole, so a narrow row breaks
   between them rather than inside a date. */
const whenParts = (grant) => {
    const connected = formatDate(grant.createdAt);
    const used = formatDate(grant.lastUsedAt);
    const parts = [];
    if (connected) parts.push(`Connected ${connected}`);
    parts.push(used ? `Last used ${used}` : 'Not used yet');
    return parts;
};

const appName = (grant) => grant.clientName || 'An unnamed app';

export default function ConnectedApps({ onDisconnected }) {
    // undefined while loading, null when it could not be read, else the list
    const [grants, setGrants] = useState(undefined);
    const [confirming, setConfirming] = useState(null);
    const [revoking, setRevoking] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let live = true;
        fetchGrants().then((result) => {
            if (live) setGrants(result.ok ? result.grants : null);
        });
        return () => {
            live = false;
        };
    }, []);

    // Stable: the dialog moves focus into itself whenever this changes.
    const closeConfirm = useCallback(() => {
        setConfirming(null);
        setError('');
    }, []);

    const disconnect = async () => {
        if (!confirming || revoking) return;
        setRevoking(true);
        setError('');
        const result = await revokeGrant(confirming.grantId);
        setRevoking(false);
        // Already gone (404) is what was asked for.
        if (result.ok || result.status === 404 || result.code === NOT_FOUND) {
            const gone = confirming;
            setGrants((list) => (Array.isArray(list) ? list.filter((g) => g.grantId !== gone.grantId) : list));
            setConfirming(null);
            onDisconnected?.(`${appName(gone)} disconnected`);
            return;
        }
        setError('It could not be disconnected just now. Check your connection and try again.');
    };

    if (!Array.isArray(grants)) return null;

    return (
        <>
            <h2 className="settings-title">Connected apps</h2>
            {grants.length === 0 ? (
                <div className="settings-row settings-row-last">
                    <span className="settings-row-sub settings-row-sub-wrap connected-apps-empty">
                        No apps are connected. When you let an app such as Claude use your GLKB
                        account, it is listed here, and you can disconnect it.
                    </span>
                </div>
            ) : (
                <ul className="connected-apps" aria-label="Connected apps">
                    {grants.map((grant, index) => (
                        <li
                            key={grant.grantId}
                            className={`settings-row connected-app${index === grants.length - 1 ? ' settings-row-last' : ''}`}
                        >
                            <span className="settings-row-labels">
                                <span className="settings-row-label connected-app-name">{appName(grant)}</span>
                                {grant.scopes.length ? (
                                    <span className="settings-row-sub settings-row-sub-wrap">
                                        Can {grant.scopes.map((id) => scopeTitle(id)).join(', ').replace(/^./, (c) => c.toLowerCase())}
                                    </span>
                                ) : null}
                                <span className="connected-app-when">
                                    {whenParts(grant).map((part, i) => (
                                        <React.Fragment key={part}>
                                            {i > 0 ? ' · ' : null}
                                            <span className="connected-app-when-part">{part}</span>
                                        </React.Fragment>
                                    ))}
                                </span>
                            </span>
                            <button
                                type="button"
                                className="settings-row-action"
                                aria-label={`Disconnect ${appName(grant)}`}
                                onClick={() => { setError(''); setConfirming(grant); }}
                            >
                                Disconnect
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {confirming && (
                <Dialog
                    title={`Disconnect ${appName(confirming)}?`}
                    onClose={closeConfirm}
                    labelId="disconnect-app-title"
                    className="billing-leaving"
                >
                    <p className="billing-text">
                        {appName(confirming)} will no longer be able to use your GLKB account. To
                        use GLKB there again, connect it again from that app.
                    </p>
                    {error ? <p className="billing-field-error" role="alert">{error}</p> : null}
                    <div className="billing-actions">
                        <button type="button" className="billing-btn" onClick={closeConfirm}>Cancel</button>
                        <button
                            type="button"
                            className="billing-btn is-danger"
                            onClick={disconnect}
                            disabled={revoking}
                        >
                            {revoking ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                    </div>
                </Dialog>
            )}
        </>
    );
}
