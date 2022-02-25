## webpack-tencent-cos

webpack腾讯云COS上传

### Install

```
yarn add webpack-tencent-cos -D
```

### Usage

``` js
// webpack.config.js

const CosPlugin = require("webpack-tencent-cos");

plugins: [
    new CosPlugin({
      secretId: 'AKID4NRFm45rNcaGgphJhofGbfRwBF2YnlSs',
      secretKey: 'DBsISMzLQDj00jBMGtGMD0WljQpyrTos',
      bucket: 'lintcode-react-1256418761',
      region: 'ap-shanghai',
      path: 'react/',
    })
]
```
