## webpack-tencent-cos

CH: webpack腾讯云COS上传

EN: webpack tencent Cloud Object Storage(COS) plugin

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
      bucket: '*****************',
      region: 'xxxx',
      path: 'xxxxx',
    })
]
```
