# PostCSS Split [![Build Status][ci-img]][ci]

[PostCSS] plugin for splitting css into multiple css files with sourcemaps support for preventing limitation of shinny ie9.

[PostCSS]: https://github.com/postcss/postcss
[ci-img]:  https://travis-ci.org/VitaliyR/postcss-split.svg
[ci]:      https://travis-ci.org/VitaliyR/postcss-split

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
postcss([ require('postcss-split')(/*opts*/) ])
```

See [PostCSS] docs for examples for your environment.

## Options
* `maxSelectors` *{number=4000}* count of selectors exceeding which css file should be separated
* `fileName` *{string=%original%-%i%}* template for retrieving name of separated files
    * `%original%` *{string}* name of original file
    * `%i%` *{number}* index of separated file
* `writeFiles` *{boolean=true}* separated files should be written to the disk
* `writeSourceMaps` *{boolean=true}* source maps of separated files should be written to the disk
* `writeImport` *{boolean=true}* original css source should have import declaration for separated files
* `quiet` *{boolean-false}* toggling console output

## TODO
* Check if atRules are affecting selectors count
* Play with source maps settings
* Separate functions to lib
* Write more tests to cover the functions from the lib
