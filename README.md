# PostCSS Split [![Build Status][ci-img]][ci]

[PostCSS] plugin for splitting css into multiple css files with sourcemaps support for preventing limitation of shinny ie9.

[PostCSS]: https://github.com/postcss/postcss
[ci-img]:  https://travis-ci.org/vitaliyr/postcss-split.svg
[ci]:      https://travis-ci.org/vitaliyr/postcss-split

```css
.foo {
    /* Input example */
}
```

```css
.foo {
  /* Output example */
}
```

## Usage

```js
postcss([ require('postcss-split') ])
```

See [PostCSS] docs for examples for your environment.

## Options
* maxSelectors
* fileName

## TODO
* Check if atRules are affecting selectors count
