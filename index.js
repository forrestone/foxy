var respMod   = require("resp-modifier");
var httpProxy = require("http-proxy");
var http      = require("http");
var url       = require("url");
var utils     = require("./lib/utils");

/**
 * @param opts
 * @param [additionalRules]
 * @param [additionalMiddleware]
 * @returns {*}
 * @param errHandler
 */
function init(target, config) {

    config = config || {};
    var urlObj      = url.parse(target);
    var target      = urlObj.protocol + "//" + urlObj.hostname;
    var hostDomain;

    if (urlObj.port) {
        target += ":" + urlObj.port;
    }

    var proxyServer = httpProxy.createProxyServer();
    var hostHeader  = utils.getProxyHost(urlObj);
    var host = false;

    if (!config.errHandler) {
        config.errHandler = function (err) {
            console.log(err.message);
        }
    }

    var server = http.createServer(function(req, res) {

        if (!host) {
            host = req.headers.host;
        }
        var middleware  = respMod({
            rules: getRules(req.headers.host),
            ignorePaths: config.ignorePaths
        });

        var next = function () {
            proxyServer.web(req, res, {
                target: target,
                headers: {
                    host: hostHeader,
                    "accept-encoding": "identity",
                    agent: false
                }
            });
        };

        if (config.middleware) {
            config.middleware(req, res, function (success) {
                if (success) {
                    return;
                }
                utils.handleIe(req);
                middleware(req, res, next);
            });
        } else {
            utils.handleIe(req);
            middleware(req, res, next);
        }
    }).on("error", config.errHandler);

    // Handle proxy errors
    proxyServer.on("error", config.errHandler);

    // Remove headers
    proxyServer.on("proxyRes", function (res) {
         if (host){
                hostDomain = hostDomain || host.split(':')[0];
            }
        var override = urlObj.hostname;

        if (res.statusCode === 302 || res.statusCode === 301) {
            if (urlObj.port && urlObj.port !== 443) {
                override = urlObj.hostname + ':' + urlObj.port;
            }
             
            if(config.redirectRules){
              if( override.match(config.redirectRules.match)){
                    host = config.redirectRules.location;
                }
            } 
            res.headers.location = res.headers.location.replace(override, host);
        }
        
        if(typeof(res.headers['set-cookie'])!=='undefined'){
            var urlArray = (urlObj.host).split('.'),
                urlArarylength =  urlArray.length;
            var domain =  urlArray[urlArarylength-2].concat('.',urlArray[urlArarylength-1]);
            for (var i = res.headers['set-cookie'].length-1;i>=0;i-- ){
               res.headers['set-cookie'][i] = res.headers['set-cookie'][i].replace('domain='+domain,hostDomain);
            };          
        }
        utils.removeHeaders(res.headers, ["content-length", "content-encoding"]);

        host = false;
    });

    function getRules(host) {

        var rules = [utils.rewriteLinks(urlObj, host)];

        if (config.rules) {
            if (Array.isArray(config.rules)) {
                config.rules.forEach(function (rule) {
                    rules.push(rule);
                })
            } else {
                rules.push(config.rules);
            }
        }
        return rules;
    }

    return server;
}

module.exports      = init;
module.exports.init = init;

