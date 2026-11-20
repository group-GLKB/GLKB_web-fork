/**
 * Where a reader goes back to after signing in with an emailed code.
 *
 * Google sign-in finishes inside the overlay, so the page underneath simply stays. The emailed
 * code does not: the overlay hands over to `/verify-code`, which used to send everyone on to the
 * chat afterwards. A page that has to be returned to — the consent page an outside app sends the
 * reader to, whose address carries the request being answered — passes its own address to the
 * overlay (`<LoginModal returnTo=... />`), the overlay passes it on in the router state, and
 * `/verify-code` goes back there.
 *
 * Only a path on this site is accepted: never another origin (`//host`, `/\host`, `https://...`),
 * so the value cannot be used to send a freshly signed-in reader somewhere else.
 */
export const safeReturnTo = (value) => {
    if (typeof value !== 'string') return '';
    const path = value.trim();
    if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return '';
    return path;
};
