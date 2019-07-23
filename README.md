# Structured Data Testing Tool

Helps inspect and test web pages for Structured Data.

* Checks pages for Schema.org markup in HTML (with microdata), JSON-LD and RDFa.
* Checks `<meta>` tags for specific tags and values.
* Comes with common build-in presets, which you can extend - or you can create your own.
* Has both a Command Line Interface (`sdtt`) and an API.
* API can be used with a headless browser to test Structured Data injected client side (e.g. via Google Tag Manager).

This tool uses [web-auto-extractor](https://www.npmjs.com/package/web-auto-extractor) and [jmespath](https://www.npmjs.com/package/jmespath).

## Install

    npm i structured-data-testing-tool -g

## Features

* You can pass in any URL or a file to test.
* Any schemas found that are supported will be automatically tested (unless otherwise specified).
* You can optionally pass in specific presets to look for.
* Using custom presets with the API you can also easily test for non-schema markup (e.g. Twitter, Facebook, App Store tags…).

## Usage

### Command Line Interface

_Note: The API supports additional options not currently exposed in the CLI tool._

```
Usage: sdtt --url <url> [--presets <presets>]

Options:
  -u, --url              Inspect a URL
  -f, --file             Inspect a file
  -p, --presets          Test a URL for specific markup from a list of presets
  -d, --disable-presets  Disable auto-detection of presets - will only evaluate explicitly specified presets
  -h, --help             Show help
  -v, --version          Show version number

Examples:
  sdtt --url "https://example.com/article"               Inspect a URL
  sdtt --url <url> --presets "Article,Twitter,Facebook"  Test a URL for Article schema and social metatags
  sdtt --presets                                         List supported presets
```

Inspect a URL to see what markup is found:

    sdtt --url <url>

Inspect a file to see what markup is found:

    sdtt --file <path to file>

Test a URL contains specific markup:

    sdtt --url <url> --presets "Article,Twitter,Facebook"

#### Example output from CLI

```
$ sdtt -u https://www.bbc.co.uk/news/world-us-canada-49060410
Tests

  ReportageNewsArticle Passed 14 of 14 (100%)
    ✓  ReportageNewsArticle
    ✓  ReportageNewsArticle[*]."@type"
    ✓  ReportageNewsArticle[*].url
    ✓  ReportageNewsArticle[*].mainEntityOfPage
    ✓  ReportageNewsArticle[*].datePublished
    ✓  ReportageNewsArticle[*].dateModified
    ✓  ReportageNewsArticle[*].author
    ✓  ReportageNewsArticle[*].author.name
    ✓  ReportageNewsArticle[*].image
    ✓  ReportageNewsArticle[*].headline
    ✓  ReportageNewsArticle[*].publisher
    ✓  ReportageNewsArticle[*].publisher."@type"
    ✓  ReportageNewsArticle[*].publisher.name
    ✓  ReportageNewsArticle[*].publisher.logo

Statistics

  Number of Metatags: 38
  Schemas in JSON-LD: 1
     Schemas in HTML: 0
      Schema in RDFa: 0
       Schemas found: ReportageNewsArticle
     Test suites run: ReportageNewsArticle
     Total tests run: 14

Results

    Passed: 14 (100%)
  Warnings: 0 (0%)
    Failed: 0 (0%)

  ✓ 14 tests passed.
```

### API

#### How to test a URL

You can integrate Structured Data Testing Tool with a CD/CI pipeline by using the API.

```javascript
const { structuredDataTest } = require('structured-data-testing-tool')
const { ReportageNewsArticle, Twitter, Facebook } = require('./presets')

const url = 'https://www.bbc.co.uk/news/world-us-canada-49060410'

structuredDataTest(url, { presets: [ ReportageNewsArticle, Twitter, Facebook ] })
.then(response => {
  // If you end up here, then there were no errors
  console.log("All tests passed.")
  console.log('Passed:',response.passed.length)
  console.log('Failed:',response.failed.length)
  console.log('Warnings:',response.warnings.length)
})
.catch(err => {
  // If any test fails, the promise is rejected
  if (err.type === 'VALIDATION_FAILED') {
    console.log("Some tests failed.")
    console.log('Passed:',err.passed.length)
    console.log('Failed:',err.failed.length)
    console.log('Warnings:',err.warnings.length)  
    // Loop over validation errors
    err.failed.forEach(test => {
      console.error(test)
    })
  } else {
    // Handle other errors here (e.g. an error fetching a URL)
    console.log(err)
  }
})
```

#### How to test a local HTML file

You can also test HTML in a file by passing it as a string, a stream or a readable buffer.

```javascript
const html = fs.readFileSync('./example.html')
structuredDataTest(html)
…
```

### How to define your own tests

The built-in presets only cover some use cases and are only able to check if values are defined (not what they contain).

With the API you can use [JMESPath query syntax](http://jmespath.org) to define your own tests to check for additional properties and specific values. You can mix and match tests with presets.

```javascript
const url = 'https://www.bbc.co.uk/news/world-us-canada-49060410'

const options = {
  tests: [
    { test: 'NewsArticle', expect: true, type: 'jsonld' }, // Check 'NewsArticle' schema exists in JSON-LD
    { test: 'NewsArticle[*].url', expect: url }, // Expect specific value for 'url' property, fail if value doesn't match
    { test: 'NewsArticle[*].mainEntityOfPage', expect: url, warning: true }, // Warn but don't fail if test doesn't pass
    { test: '"twitter:domain"' expect: 'www.bbc.co.uk', type: 'metatag' } // Test for twitter meta tag with specific value
  ]
}

structuredDataTest(url, options)
…
```

### How to define your own presets

A preset is a collection of tests.

There are built-in presets you can use, you can also easily define your own presets.

Presets must have a `name` (which should ideally be unique, but does not have to be) and `description` and an array of `test` objects in `tests`. Both `name` and `description` be arbitrary strings, `tests` should be an array of valid `test` objects.

You can optionally group tests by specifying a value for `group` and set a default schema to use for all tests in `schema`. These can be arbitrary strings, though it's recommended schemas reflect Schema.org schema names.

If a test explicitly defines it's own `group` or `schema`, that will override the default value for the preset for that specific test (which may impact how results are grouped).

```javascript
const url = 'https://www.bbc.co.uk/news/world-us-canada-49060410'

const MyCustomPreset = {
  name: 'My Custom Preset', // Required
  description: 'Test NewsArticle JSON-LD data is defined and twitter metadata was found', // Required
  tests: [ // Required
    { test: 'NewsArticle', type: 'jsonld', schema: 'NewsArticle' },
    { test: '"twitter:card"', type: 'metatag' },
    { test: '"twitter:domain"', expect: 'www.bbc.co.uk', type: 'metatag', }
  ],
  // group: 'A Group Name', // Optional: A group name can be used to group test results (defaults to preset name)
  // schema: 'NewsArticle', // Optional: A default schema for tests (useful if all tests in a preset are for the same schema)
}

const options = {
  presets: [ MyCustomPreset ]
}

structuredDataTest(url, options)
…
```

### Test options

#### test
```
Type: string
Required: true
```

The value for `test` should be a valid [JMESPath query](http://jmespath.org).

Examples of JMESPath queries:

`Article`  
Test `Article` schema found.

`Article[*].url`  
Test `url` property of any `Article` schema found.

`Article[0].headline`  
Test `headline` property of first `Article` schema found.

`Article[1].headline`  
Test `headline` property of second `Article` schema found.

`Article[*].publisher.name`  
Test `name` value of `publisher` on any `Article` schema found.

`Article[*].publisher."@type"`  
Test `@type` value of `publisher` on any `Article` schema found.

Tips:

* Use double quotes to escape special characters in property names.
* You can `console.log()` the `stucturedData` property of the response object from `structuredDataTest()` to see what sort of meta tags and structured data was found to help with writing your own tests.

#### type
```
Type: string ('json'|'rdfa'|'microdata'|'any')
Required: false
Default: 'any'
```

You can specify a `type` to indicate if markup should be in `jsonld`, `rdfa` or `microdata` (HTML) format.

You can also specify a value of `metatag` to check `<meta>` tags.

If you do not specify a type for a test, a default of `any` will be assumed and all types will be checked.

#### expect
```
Type: boolean|string
Required: false
Default: true
```

You can specify a value for `expect` that is either `true`, `false` or a string.

A value of `true` is a boolean that indicates the property must exist, but does not check value.

A value of `false` is a boolean that indicates the value must not exist.

Any other value is treated as a string that indicates the value should match the string found.

The default is `true`.

_NB: Future releases may support passing an evaluating function to `expect`._

#### warning
```
Type: boolean
Required: false
Default: false
```

When `warning` is set to `true`, if the test does not pass it will only result in a warning.

The default is `false`, meaning if the test fails it will be counted as a failure.

#### schema
```
Type: string
Required: false
Default: undefined
```

You can pass a `schema` value that indicates what schema a test is for.

This is only used to group test results and the value is not checked for validity.

Tests in different presets can test the same schema. This allows test results by schema or group.

If a test is part of a preset and the preset has a schema specifed, then the value for a test will override the preset's schema value for the test

#### group
```
Type: string
Required: false
Default: undefined
```

You can pass a a value for `group` value to indicate how tests should be grouped in results. This value can be any string.

If a test is part of a preset and the preset has a group specifed, then the value for a test will override the preset's group value for the test.

#### disablePresets
```
Type: boolean
Required: false
Default: false
```

Set `disablePresets` to `true` to disable auto-detection of presets (defaults to `false`).

If set to `true` will only run tests for presets explicitly specified via the `presets` argument and will not test other schemas it finds.

### Testing with client side rendering

If a page uses JavaScript with client side rendering to generate Structured Data, you can use a tool like [Puppeteer](https://github.com/GoogleChrome/puppeteer) (a headless Chrome API) to fetch the HTML and allow any client side JavaScript to run and then test the rendered page with the Structured Data Testing Tool.

Note:

* Puppeteer is a large package (~272 MB) and must be installed separately.
* You can only use Puppeteer with the API, not the Command Line Interface.

Example of how to use `puppeteer` with `structured-data-testing-tool` :

```javascript
const { structuredDataTest } = require('structured-data-testing-tool')
const puppeteer = require('puppeteer');

(async () => {
  const url = 'https://www.bbc.co.uk/news/world-us-canada-49060410'
  
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  const html = await page.evaluate(() => document.body.innerHTML);
  await browser.close();
  
  structuredDataTest(html)
  .then(response => {
    console.log("All tests passed.")
  })
  .catch(err => {
    console.log("Some tests failed.")
  })
})();
```

### Contributing

Contributions are welcome!

This can include bug reports, feature requests, ideas, pull requests, examples of how you have used this tool (etc).

Please see the [Code of Conduct](https://github.com/glitchdigital/structured-data-testing-tool/blob/master/CODE_OF_CONDUCT.md) and complete the issue and/or Pull Request templates when reporting bugs, requesting enhancements or contributing code.

General feedback on how you use Structured Data Testing Tool is also very helpful.
