'use strict';

const fs = require('fs');
const COS = require('cos-nodejs-sdk-v5');
const path = require('path');
const ora = require('ora');

// Constants
const REGEXP_HASH = /\[hash(?::(\d+))?\]/gi;

// Uploading progress tip
const tip = (uploaded, total) => {
    let percentage = total === 0 ? 0 : Math.round((uploaded / total) * 100);
    return `Uploading to Tencent COS: ${percentage === 0 ? '' : percentage + '% '}${uploaded}/${total} files uploaded`;
};

// Replace path variable by hash with length
const withHashLength = replacer => {
    return function(_, hashLength) {
        const length = hashLength && parseInt(hashLength, 10);
        const hash = replacer.apply(this, arguments);
        return length ? hash.slice(0, length) : hash;
    };
};

// Perform hash replacement
const getReplacer = (value, allowEmpty) => {
    return function(match) {
        // last argument in replacer is the entire input string
        const input = arguments[arguments.length - 1];
        if (value === null || value === undefined) {
            if (!allowEmpty) throw new Error(`Path variable ${match} not implemented in this context of qn-webpack plugin: ${input}`);
            return '';
        } else {
            return `${value}`;
        }
    };
};

module.exports = class CosPlugin {
    constructor(options) {
        this.options = Object.assign({}, options);
    }

    apply(compiler) {
        compiler.hooks.afterEmit.tap('CosPlugin', (compilation) => {
            let basePath = path.basename(compiler.outputPath);
            let assets = compilation.assets;
            let hash = compilation.hash;
            let uploadPath = this.options.path || '[hash]';
            let batch = this.options.batch || 20;
            let cos = new COS({
                SecretId: this.options.secretId,
                SecretKey: this.options.secretKey,
                FileParallelLimit: batch,
                ChunkParallelLimit: batch
            });
            let bucket = this.options.bucket;
            let region = this.options.region;
            uploadPath = uploadPath.replace(REGEXP_HASH, withHashLength(getReplacer(hash)));

            let filesNames = Object.keys(assets);
            let totalFiles = 0;
            let uploadedFiles = 0;

            // Mark finished
            let _finish = err => {
                spinner.stop();
                if (err) {
                    // eslint-disable-next-line no-console
                    console.log('\n upload fail', err);
                    return;
                }
                // eslint-disable-next-line no-console
                console.log('\n all files upload success');
            };

            totalFiles = filesNames.length;

            // eslint-disable-next-line no-console
            console.log('\n');
            let spinner = ora({
                text: tip(0, totalFiles),
                color: 'green'
            }).start();

            // Perform upload to cos
            const performUpload = function(fileName) {
                let file = assets[fileName] || {};
                fileName = basePath + '/' + fileName.replace(/\\/g, '/');
                let key = path.posix.join(uploadPath, fileName);

                return new Promise((resolve, reject) => {
                    let begin = Date.now();
                    cos.putObject(
                        {
                            Bucket: bucket,
                            Region: region,
                            Key: key,
                            Body: fs.createReadStream(fileName),
                            ContentLength: file._size,
                        },
                        function(err, body) {
                            uploadedFiles++;
                            spinner.text = tip(uploadedFiles, totalFiles);

                            if (err) return reject(err);
                            body.duration = Date.now() - begin;
                            resolve(body);
                        }
                    );
                });
            };

            // Execute stack according to `batch` option
            const execStack = function(err) {
                if (err) {
                    // eslint-disable-next-line no-console
                    console.log('\n');
                    return Promise.reject(err);
                }

                // Get 20 files
                let _files = filesNames.splice(0, batch);

                if (_files.length) {
                    return Promise.all(_files.map(performUpload)).then(() => execStack(), execStack);
                } else {
                    return Promise.resolve();
                }
            };

            execStack().then(() => _finish(), _finish);
        });
    }
};
