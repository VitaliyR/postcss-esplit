# PostCSS eSplit [![Build Status][ci-img]][ci]

[PostCSS] plugin for splitting css into multiple css files with sourcemaps support for preventing limitation of shinny ie9.

[PostCSS]: https://github.com/postcss/postcss
[ci-img]:  https://travis-ci.org/VitaliyR/postcss-esplit.svg?branch=master
[ci]:      https://travis-ci.org/VitaliyR/postcss-esplit

```css
/* Input example - style.css */
@charset "UTF-8";

.someClass {
    display: block;
}

@media (max-width: 768px) {
    p {
        color: red;
    }

    em {
        color: blue;
    }
}
```

```css
/* Output example with maxSelectors = 2 */

/* style.css */
@charset "UTF-8";
@import url(style-0.css);

@media (max-width: 768px) {
    em {
        color: blue;
    }
}


/* style-0.css */
.someClass {
    display: block;
}

@media (max-width: 768px) {
    p {
        color: red;
    }
}

```

## Install
```
npm install postcss-esplit --save
```

## Usage

```js
postcss([ require('postcss-split')(/*opts*/) ])
```

See [PostCSS] docs for examples for your environment.

Also, starting from version 0.0.2 there are no need to place the plugin in the end of the
processor plugins list.


## Options
* `maxSelectors`    *{number=4000}* count of selectors exceeding which css file should be separated
* `fileName` *{string=%original%-%i%}* template for retrieving name of separated files
    * `%original%` *{string}* name of original file
    * `%i%` *{number}* index of separated file
* `writeFiles` *{boolean=true}* separated files should be written to the disk
* `writeSourceMaps` *{boolean=true}* source maps of separated files should be written to the disk
* `writeImport` *{boolean=true}* original css source should have import declaration for separated files
* `quiet` *{boolean-false}* toggling console output
