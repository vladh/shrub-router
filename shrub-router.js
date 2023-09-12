// (c) 2023 Vlad-Stefan Harbuz. MIT license.

let routes = [];
let contentNodeName = 'main';
let dynamicScriptContainerSelector = '.dynamic-scripts';

function transformContent(html) {
    const openLoc = html.indexOf(`<${contentNodeName}`);
    const closeLoc = html.indexOf(`</${contentNodeName}>`);
    const closeOffset = `</${contentNodeName}>`.length;
    return html.substring(openLoc, closeLoc + closeOffset);
}

function segmentize(url) {
    return url.replace(/(^\/+|\/+$)/g, '').split('/');
}

function matchRoute(url, routePath) {
    const reg = /(?:\?([^#]*))?(#.*)?$/;
    const c = url.match(reg);
    let matches = {};
    let ret = true;
    if (c && c[1]) {
        const p = c[1].split('&');
        for (let i = 0; i < p.length; i++) {
            const r = p[i].split('=');
            matches[decodeURIComponent(r[0])] = decodeURIComponent(r.slice(1).join('='));
        }
    }
    const urlSeg = segmentize(url.replace(reg, ''));
    const route = segmentize(routePath || '');
    const max = Math.max(urlSeg.length, route.length);
    for (let i = 0; i < max; i++) {
        if (route[i] && route[i].charAt(0) === ':') {
            const param = route[i].replace(/(^:|[+*?]+$)/g, '');
            const flags = (route[i].match(/[+*?]+$/) || {}).toString()[0];
            const plus = ~flags.indexOf('+');
            const star = ~flags.indexOf('*');
            const val = urlSeg[i] || '';
            if (!val && !star && (flags.indexOf('?') < 0 || plus)) {
                ret = false;
                break;
            }
            matches[param] = decodeURIComponent(val);
            if (plus || star) {
                matches[param] = urlSeg
                    .slice(i)
                    .map(decodeURIComponent)
                    .join('/');
                break;
            }
        } else if (route[i] !== urlSeg[i]) {
            ret = false;
            break;
        }
    }
    if (!ret) {
        return false;
    }
    return matches;
}

function makeUrl(href) {
    if (typeof URL === 'function' && window.location) {
        return new URL(href, window.location.toString());
    } else {
        const a = document.createElement('a');
        a.href = href;
        return a;
    }
}

function isHrefSameOrigin(href) {
    const loc = window.location;
    if (!href || !loc) {
        return false;
    }
    const url = makeUrl(href);
    return (
        loc.protocol === url.protocol &&
        loc.hostname === url.hostname &&
        loc.port === url.port
    );
}

function isLinkToCurrentLocation(elA) {
    const loc = window.location;
    if (!loc) {
        return false;
    }
    return elA.pathname === loc.pathname && elA.search === loc.search;
}

function isLinkInsideSvg(el) {
    return typeof el.href === 'object' && el.href.constructor.name === 'SVGAnimatedString';
}

function shouldPassthroughAnchor(el, href) {
    return (
        !href ||
        el.hasAttribute('data-nointercept') ||
        isLinkInsideSvg(el) ||
        el.hasAttribute('download') ||
        el.getAttribute('rel') === 'external' ||
        !isHrefSameOrigin(href) ||
        href.indexOf('mailto:') > -1
    );
}

function handleAnchorClick(e, el, composedPath) {
    const href = el.getAttribute('href');
    if (shouldPassthroughAnchor(el, href)) {
        return;
    }
    const shouldDisregard = isLinkToCurrentLocation(el);
    let didNavigate = false;
    if (!shouldDisregard) {
        didNavigate = navigate({
            path: href,
            method: 'get',
            data: {},
        });
    }
    if (shouldDisregard || didNavigate) {
        e.preventDefault();
    }
}

function handleButtonClick(e, el, composedPath) {
    const [_, elForm] = findClosestInPathByNodeName(composedPath, ['a', 'form']);
    if (!elForm) {
        return;
    }
    const method = elForm.method.toLowerCase();
    const formData = new FormData(elForm);
    let path = elForm.getAttribute('action');
    if (method === 'get') {
        path += '?' + new URLSearchParams(formData);
    }
    const didNavigate = navigate({
        path,
        method,
        data: formData,
    });
    e.preventDefault();
}

function findClosestInPathByNodeName(eventPath, nodeNames) {
    if (!eventPath) {
        return [undefined, undefined];
    }
    nodeNames = nodeNames.map((n) => n.toLowerCase())
    for (let i = 0; i < eventPath.length; i++) {
        const node = eventPath[i];
        if (!node.nodeName) {
            continue;
        }
        const nodeName = node.nodeName.toLowerCase();
        if (nodeNames.includes(nodeName)) {
            return [nodeName, node];
        }
    };
    return [undefined, undefined];
}

function clickHandler(e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) {
        return;
    }
    const composedPath = e.composedPath();
    const [nodeName, el] = findClosestInPathByNodeName(composedPath, ['a', 'button']);
    if (!el || !nodeName) {
        return;
    } else if (nodeName === 'a') {
        handleAnchorClick(e, el, composedPath);
    } else if (nodeName === 'button') {
        handleButtonClick(e, el, composedPath);
    }
};

function interceptNavigation() {
    document.documentElement.addEventListener('click', clickHandler);
}

function renderContent(content) {
    const elDynamicScriptContainer = document.querySelector(
        dynamicScriptContainerSelector);
    elDynamicScriptContainer.innerHTML = '';

    const elTarget = document.querySelector(contentNodeName);
    elTarget.outerHTML = content;
    const elNew = document.querySelector(contentNodeName);

    // HACK: We need to create all of the new script tags ourselves,
    // otherwise the browser won't run them.
    //
    // > script elements inserted using innerHTML do not execute when they
    // > are inserted.
    // - HTML5 spec, 2.5.2
    //   https://www.w3.org/TR/2008/WD-html5-20080610/dom.html#innerhtml0
    elNew.querySelectorAll('script').forEach((el) => {
        const elNewScript = document.createElement('script');
        elNewScript.innerHTML = el.innerHTML;
        el.remove();
        elDynamicScriptContainer.appendChild(elNewScript);
    });

    const elAutofocusTarget = elNew.querySelector('[autofocus]');
    if (elAutofocusTarget) {
        elAutofocusTarget.focus();
    }
}

async function navigate({ path, method, data, shouldSkipHistory }) {
    if (!path) {
        return;
    }
    let routeParams = {};
    const route = routes.find(function(route) {
        const match = matchRoute(path, route.path);
        if (!!match) {
            routeParams = match;
            return true;
        }
        return false;
    });
    if (!route || !route.handler) {
        return false;
    }
    if (!shouldSkipHistory) {
        history.pushState({ path }, '', path);
    }
    await route.handler({ route, path, method, data, routeParams });
    window.dispatchEvent(new Event('shrub:loaded'));
    return true;
}

async function viewHandler({ route, path, method, data, routeParams }) {
    let fetchOptions = {
        method,
        headers: {
            'Shrub-Router': 'true',
        },
    };
    if (method === 'post') {
        fetchOptions.body = JSON.stringify(Object.fromEntries(data));
        fetchOptions.headers["Content-Type"] = "application/json";
    }
    const response = await fetch(path, fetchOptions);
    if (!response.ok) {
        console.error(`[shrub-router] fetch error: ${err}`)
    }
    const content = await response.text();
    renderContent(transformContent(content));
}

function add(path, handler, options) {
    if (routes.find(function(r) { return r.path === path; })) {
        throw new Error('Tried to add route, but one already exists with the same path');
    }
    routes.push({ path, handler, options });
}

function addView(path, options) {
    add(path, viewHandler, { ...options });
}

function remove(path) {
    routes = routes.filter(function(r) { return r.path !== path; });
}

async function initCurrentPage() {
    await navigate({
        path: window.location.pathname + window.location.search + window.location.hash,
        shouldSkipHistory: true,
    });
}

async function init() {
    window.addEventListener('popstate', async () => {
        await initCurrentPage();
    });
    await initCurrentPage();
    interceptNavigation();
}

export default {
    setContentNodeName(val) {
        contentNodeName = val;
    },
    setDynamicScriptContainerSelector(val) {
        dynamicScriptContainerSelector = val;
    },
    setTransformContent(val) {
        transformContent = val;
    },
    add,
    addView,
    remove,
    init,
};
