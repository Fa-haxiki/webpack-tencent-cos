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
      secretId: '********************',
      secretKey: '********************',
      bucket: 'lintcode-react-*********',
      region: 'ap-shanghai',
      path: 'react/',
    })
]
```
