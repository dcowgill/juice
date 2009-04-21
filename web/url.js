(function(juice) {

     var
     build_query_string,
     canonicalize_path,
     lib,
     parse_location,
     parse_url;

     juice.url = lib = {};

     parse_url = function(url) {
         var result, answer;

         result = /^(?:([a-z]+):)\/\/([a-z\d.\-\_]+)?(?::(\d+))?(\/[^?#]*)?(?:\?([^#]*))?(?:#(.*))?$/i.exec(url);
         if (!result) {
             return null;
         }

         answer = {
             url:    result[0],
             scheme: result[1],
             host:   result[2],
             port:   result[3],
             path:   result[4] || "",
             query:  result[5] || "",
             hash:   result[6] || "",
             args:   {}
         };

         if (answer.query) {
             answer.args =
                 juice.pairs_to_dict(
                     juice.map(answer.query.split('&'),
                              function(s) {
                                  var kv = s.split('=');
                                  return [kv[0], unescape(kv[1])];
                              }));
         }

         answer.base = answer.scheme + '://' +
             (answer.host ? answer.host : '') +
             (answer.port ? (':' + answer.port) : '');

         return answer;
     };

     build_query_string = function(args) {
         return juice.map_dict(args, function(k, v) { return k + '=' + escape(v); }).join('&');
     };

     canonicalize_path = function(path) {
         if (path) {
             if (/\/[^\/.]+$/.test(path)) {
                 path += '/';
             }
             if (path.charAt(path.length-1) === '/') {
                 path += 'index.html';
             }
         }
         return path;
     };

     parse_location = function(location) {
         var parts = parse_url(location);
         parts.path = canonicalize_path(parts.path);
         return parts;
     };

     lib.request = function() {
         return parse_location(window.location);
     };

     lib.make = function(spec) {
         var that, parsed_url, parts;
         if (!spec) {
             juice.error.raise("empty url");
         }

         if (!juice.is_object(spec)) {
             parsed_url = parse_url(spec);
             spec = {base: parsed_url.base,
                     path: parsed_url.path,
                     port: parsed_url.port,
                     args: parsed_url.args};
         }

         spec = juice.spec(spec, {base: site.settings.base_url,
                                  path: "",
                                  port: null,
                                  args: {}});

         if (juice.is_undefined(spec.base)) {
             juice.error.raise("base arg for url was undefined");
         }

         // Normalize that.base and that.path
         spec.base = spec.base.replace(/\/+$/, "");
         spec.path = "/" + spec.path.replace(/^\/+/, "");

         if (parsed_url) {
             spec.host = parsed_url.host;
         }
         else {
             // Extract host from the base url
             spec.host = parse_url(spec.base).host;
         }

         that = {
             base: spec.base,
             host: spec.host,
             port: spec.port,
             path: spec.path,
             args: spec.args
         };

         that.to_string = function() {
             var string = [that.base];
             string.push(that.path);
             if (!juice.empty(that.args)) {
                 string.push("?" + build_query_string(that.args));
             }
             return string.join("");
         };

         that.path_join = function() {
             var args = [that.path].concat(juice.args(arguments));
             return lib.make({base: that.base,
                              port: that.port,
                              path: juice.path_join.apply(this, args),
                              args: that.args});
         };

         that.toString = that.to_string;

         that.redirect = function() {
             window.location = that.to_string();
         };

         return that;
     };


     lib.reload_current = function() {
         window.location.reload();
     };

 })(juice);
