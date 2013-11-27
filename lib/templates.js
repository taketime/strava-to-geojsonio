var _ = require('underscore');
var fs = require('fs');
var path = require('path');

module.exports = fs.readdirSync(__dirname + '/../templates').sort().reduce(function(memo, basename) {
    if (path.extname(basename) !== '._') return memo;
    memo[basename.split('.').shift()] = _(fs.readFileSync(__dirname + '/../templates/' + basename, 'utf8')).template();
    return memo;
}, {});
