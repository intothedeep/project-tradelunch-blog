# how to use remark, rehype, and highlight.js

## nextjs

```sh
yarn add highlight.js
```

```js
// inside markdown react component
// import "highlight.js/styles/atom-one-dark.min.css";
import 'highlight.js/styles/github-dark.css';
```

```js
<div
    dangerouslySetInnerHTML={{ __html: rendered }}
    className="prose"
></div>
```
