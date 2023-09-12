# Shrub Router

![A cartoon illustration of a fruit-bearing bush](images/hawaii_ohelo_berry.png)

Shrub is a minimal clientside router that still works without Javascript. Shrub is only 3KB gzipped and allows you to:

* implement clientside navigation with almost no configuration,
* preserve full server side routing so that everything still works without Javascript,
* keep all your HTML on the server side and avoid bundling your HTML into your `.js` files, and
* avoid using a large framework like vue-router.

Normally, when you click links on a page, your browser navigates to the linked page, which reloads the entire page. You
might not the entire page to reload — for example, maybe you want a music player to keep playing. A clientside router
allows your users to navigate between pages without having to reload the entire page. Instead of having the browser
navigate to a different page, the clientside router loads that page on its own, in this case with a `fetch()` request to
the server for the new HTML, and replaces the old HTML with the new HTML.

## Implementation Details

Shrub intercepts all click events and tries to determine whether that click would result in navigation. In simple terms,
this means adding some special behaviour when `<a>` elements are clicked, when a `<button>` is clicked inside a
`<form>`, and so on.

When such a navigating click is intercepted, Shrub will figure out which URL the action would navigate to, for example
the `href` on an `<a>`, or the `action` on a `<form>`. Shrub will then make a request to that page using `fetch()`.

When using a clientside router, it's usually desirable to be able to only navigate the main content of the page, not to
replace the HTML of the entire page. Shrub does this by identifying the body of the old page and the body of the new
page, and replacing the former with the latter. Shrub does this by looking for an element with a specific node name, by
default `<main>`. Therefore, everything in the old `<main>` will be replaced with the new `<main>` from the fetched
page. This means that you don't need to serve the body of the page at some specific template URL — Shrub will simply
make a request for the new page at the usual URL the user will navigate to. This behaviour can be customised — see
“Customising Content Transformation” below.

TODO: Get rid of `.dynamic-scripts` by reloading scripts in place.

## Usage

```
import ShrubRouter from 'shrub-router'
ShrubRouter.addView('/');
ShrubRouter.addView('/admin');
ShrubRouter.addView('/admin/tracks');
ShrubRouter.addView('/admin/track/:id');
ShrubRouter.addView('/search');
ShrubRouter.setTransformContent(pickMain);
ShrubRouter.init();
```

```
window.addEventListener('shrub:loaded', () => {
	PetiteVue.createApp({
		Inputset,
		track: !{JSON.stringify(track)},
		keywords: !{JSON.stringify(keywords)},
		tracks: !{JSON.stringify(tracks)},
	}).mount();
});
```

## Useful Notes

There are various ways in which you can customise Shrub's behaviour.

### Customising Server Side Behaviour

When making requests for pages using `fetch()`, Shrub adds a `Shrub-Router: true` header, which you can use to add
custom behaviour for requests made by Shrub on the server side.

### Customising Content Transformation

## Limitations

The interception of click events could be further improved:

* Clicks on `<input type="submit">` elements should be intercepted
* Clicks on `<button type="button">` elements should not be intercepted. A button with `type="button"` inside a form
	should not submit the form, hence should not navigate, and therefore should not be intercepted at all.

Some new features could be added for ease of use:

* Users that want Shrub to intercept navigation for _all_ pages should be allowed to specify this instead of manually
	calling `.add()`. This would give Shrub a truly zero-configuration option.

## Acknowledgements

Written by [Vlad-Stefan Harbuz](https://vladh.net).

MIT-licensed.

Originally based on [Pinecone Router](https://github.com/pinecone-router/router), which is MIT-licensed.
