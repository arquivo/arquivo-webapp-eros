// A fake backend for the public/js scripts that load content from the server, for the
// jsdom tests. It replaces window.fetch (jsdom has none) and records every request.
//
//     const server = fakeServer();
//     server.respond('/partials/modal-datepicker', { body: '<section>...</section>' });
//     server.respond('/services/citationsaver', { status: 500, statusText: 'Internal Server Error' });
//     server.respond('/x', { networkError: true });
//     ... // run the script
//     await flush();
//     expect(server.requests).toEqual([...]);
//
// A route matches when the request URL contains its string; the last matching route
// wins. Unmatched requests get a 404.
'use strict';

function fakeServer() {
    const routes = [];
    const requests = [];

    const respond = (match, response = {}) => routes.push({ match, response });

    const find = (url) => {
        const route = [...routes].reverse().find(({ match }) => url.includes(match));
        return route ? route.response : { status: 404, statusText: 'Not Found', body: 'Not Found' };
    };

    window.fetch = async (input, init = {}) => {
        const url = String(input);
        requests.push({ url, method: (init.method || 'GET').toUpperCase(), body: init.body, init });
        const response = find(url);
        if (response.networkError) {
            throw new TypeError('Failed to fetch');
        }
        const status = response.status ?? 200;
        const body = response.body ?? '';
        return {
            ok: status >= 200 && status < 300,
            status,
            statusText: response.statusText ?? (status === 200 ? 'OK' : ''),
            url,
            text: async () => body,
            json: async () => JSON.parse(body),
        };
    };

    return {
        requests,
        respond,
        restore() {
            delete window.fetch;
        },
    };
}

// Let pending promises and zero-delay timers run.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

module.exports = { fakeServer, flush };
