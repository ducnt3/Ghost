// # Get Helper
// Usage: `{{#get "posts" limit="5"}}`, `{{#get "tags" limit="all"}}`
// Fetches data from the API
var _               = require('lodash'),
    hbs             = require('express-hbs'),
    Promise         = require('bluebird'),
    logging         = require('../logging'),
    api             = require('../api'),
    jsonpath        = require('jsonpath'),
    labs            = require('../utils/labs'),
    i18n            = require('../i18n'),
    resources,
    pathAliases,
    get;

// Endpoints that the helper is able to access
resources =  ['posts', 'tags', 'users'];

// Short forms of paths which we should understand
pathAliases     = {
    'post.tags': 'post.tags[*].slug',
    'post.author': 'post.author.slug'
};

/**
 * ## Is Browse
 * Is this a Browse request or a Read request?
 * @param {Object} resource
 * @param {Object} options
 * @returns {boolean}
 */
function isBrowse(resource, options) {
    var browse = true;

    if (options.id || options.slug) {
        browse = false;
    }

    return browse;
}

/**
 * ## Resolve Paths
 * Find and resolve path strings
 *
 * @param {Object} data
 * @param {String} value
 * @returns {String}
 */
function resolvePaths(data, value) {
    var regex = /\{\{(.*?)\}\}/g;

    value = value.replace(regex, function (match, path) {
        var result;

        // Handle aliases
        path = pathAliases[path] ? pathAliases[path] : path;
        // Handle Handlebars .[] style arrays
        path = path.replace(/\.\[/g, '[');

        // Do the query, and convert from array to string
        result = jsonpath.query(data, path).join(',');

        return result;
    });

    return value;
}

/**
 * ## Parse Options
 * Ensure options passed in make sense
 *
 * @param {Object} data
 * @param {Object} options
 * @returns {*}
 */
function parseOptions(data, options) {
    if (_.isString(options.filter)) {
        options.filter = resolvePaths(data, options.filter);
    }

    return options;
}

/**
 * ## Get
 * @param {Object} resource
 * @param {Object} options
 * @returns {Promise}
 */
get = function get(resource, options) {
    options = options || {};
    options.hash = options.hash || {};
    options.data = options.data || {};

    var self = this,
        data = hbs.handlebars.createFrame(options.data),
        apiOptions = options.hash,
        apiMethod;

    if (!options.fn) {
        data.error = i18n.t('warnings.helpers.get.mustBeCalledAsBlock');
        logging.warn(data.error);
        return Promise.resolve();
    }

    if (!_.includes(resources, resource)) {
        data.error = i18n.t('warnings.helpers.get.invalidResource');
        logging.warn(data.error);
        return Promise.resolve(options.inverse(self, {data: data}));
    }

    // Determine if this is a read or browse
    apiMethod = isBrowse(resource, apiOptions) ? api[resource].browse : api[resource].read;
    // Parse the options we're going to pass to the API
    apiOptions = parseOptions(this, apiOptions);

    return apiMethod(apiOptions).then(function success(result) {
        var blockParams;

        // If no result is found, call the inverse or `{{else}}` function
        if (_.isEmpty(result[resource])) {
            return options.inverse(self, {data: data});
        }

        // block params allows the theme developer to name the data using something like
        // `{{#get "posts" as |result pageInfo|}}`
        blockParams = [result[resource]];
        if (result.meta && result.meta.pagination) {
            result.pagination = result.meta.pagination;
            blockParams.push(result.meta.pagination);
        }

        // Call the main template function
        return options.fn(result, {
            data: data,
            blockParams: blockParams
        });
    }).catch(function error(err) {
        data.error = err.message;
        return options.inverse(self, {data: data});
    });
};

module.exports = function getWithLabs(resource, options) {
    var self = this,
        err;

    if (labs.isSet('publicAPI') === true) {
        // get helper is  active
        return get.call(self, resource, options);
    } else {
        err = new Error();
        err.message = i18n.t('warnings.helpers.get.helperNotAvailable');
        err.context = i18n.t('warnings.helpers.get.apiMustBeEnabled');
        err.help = i18n.t('warnings.helpers.get.seeLink', {url: 'http://support.ghost.org/public-api-beta'});
        logging.error(err);

        return Promise.resolve(function noGetHelper() {
            return '<script>console.error(' + JSON.stringify(err) + ');</script>';
        });
    }
};
