(function(self) {
     var juice, id_seq = 0;

     // ie 6 workaround: global doesn't have hasOwnProperty

     if (typeof(self.juice) !== "undefined") {
         juice = self.juice;
     }
     else {
         self.juice = juice = {};
     }

     self.site = {
         layouts:    {},
         lib:        {},
         pages:      {},
         settings:   {}
     };

     juice.args = function(a, n) {
         return Array.prototype.slice.apply(a, [arguments.length === 1 ? 0 : n]);
     };

     juice.newid = function() {
         return '_juice_id' + id_seq++;
     };

     // Returns a function that is identical to f except that it will only
     // work once; the second and subsequent calls will have no effect.

     juice.once = function(f) {
         var first_time = true;
         return function() {
             if (first_time) {
                 first_time = false;
                 return f.apply(this, juice.args(arguments));
             }
             return null;
         };
     };

     // Logs a message based on the operating environment. In a browser, it
     // writes to the error console if one is available, and shows an alert
     // dialog otherwise. On the command line, it prints to stdout.

     juice.log = (function() {
                      if (typeof console !== "undefined" && console.log) {
                          return function(msg) {
                              console.log("%o", msg);
                          };
                      }
                      if (typeof window !== "undefined" && typeof window.opera !== "undefined") {
                          return function(msg) {
                              window.opera.postError(msg);
                          };
                      }
                      if (typeof print !== "undefined" && (typeof window === "undefined" || (window && !window.print))) {
                          return function(msg) {
                              print(msg);
                          };
                      }
                      if (juice.hasOwnProperty("debug") && juice.debug()) {
                          return function(msg) {
                              alert(juice.dump(msg));
                          };
                      }
                      return function() {};
                  })();

     juice.is_boolean = function(a) {
         return typeof a === 'boolean';
     };

     juice.is_null = function(a) {
         return typeof a === 'object' && !a;
     };

     juice.is_number = function(a) {
         return typeof a === 'number' && isFinite(a);
     };

     juice.is_string = function(a) {
         return typeof a === 'string';
     };

     juice.is_undefined = function(a) {
         return typeof a === 'undefined';
     };

     juice.is_function = function(a) {
         return typeof a === 'function';
     };

     juice.is_object = function(a) {
         return (a && typeof a === 'object') || juice.is_function(a);
     };

     juice.is_array = function(value) {
         return value &&
             typeof value === 'object' &&
             typeof value.length === 'number' &&
             typeof value.splice === 'function' &&
             !value.propertyIsEnumerable('length');
     };

     juice.looks_like_integer = function(s) {
         return (/^-?\d+$/).test(s);
     };

     // Tests whether the given value is empty. For an array, this means
     // having length=0. For a dictionary, this means not having any
     // properties. For any other type, it is simply converted to a bool.

     juice.empty = function(o) {
         var k;
         if (juice.is_array(o)) {
             return o.length === 0;
         }
         else if (juice.is_object(o)) {
             for (k in o) {
                 if (o.hasOwnProperty(k)) {
                     return false;
                 }
             }
             return true;
         }
         else {
             return Boolean(o);
         }
     };

     // Returns a[i] except when i is out of bounds, in which case it throws
     // an "out_of_bounds" exception.

     juice.at = function(a, i) {
         if (i < 0 || i >= a.length) {
             throw ({what: 'out_of_bounds', i: i, bounds: [0, a.length-1]});
         }
         return a[i];
     };

     // Tests whether an element is in a given array.

     juice.inlist = function(elem, list) {
         var i;
         for (i = 0; i < list.length; i++) {
             if (elem === list[i]) {
                 return true;
             }
         }
         return false;
     };

     // Returns the first index in the given array or dictionary.  (Note: The
     // de facto order of iteration in dictionaries is based on the order in
     // which properties were defined.)

     juice.first_key = function(dict) {
         var i;
         for (i in dict) {
             if (dict.hasOwnProperty(i)) {
                 return i;
             }
         }
         return null;
     };

     // Like first_key, but returns the value instead.

     juice.first = function(dict) {
         var i = juice.first_key(dict);
         if (juice.is_null(i)) {
             return null;
         }
         return dict[i];
     };

     // Like first_key, but returns the last key instead.

     juice.last_key = function(dict) {
         var keys = juice.keys(dict);
         return keys[keys.length - 1];
     };

     // If a is undefined or null, returns b. Otherwise, returns a.

     juice.nvl = function(a, b) {
         return (juice.is_undefined(a) || juice.is_null(a)) ? b : a;
     };

     // If `a` is an array, calls `f(v)` for each value `v` in `a` until
     // `f(v)` returns a non-undefined value, which is then returned. If `a`
     // is an object, calls `f(k,v)` for each key-value pair `k`:`v` in a
     // until `f(k,v)` returns a non-undefined value, which is then returned.

     juice.find = function(a, f) {
         var i, v;
         if (juice.is_array(a)) {
             for (i = 0; i < a.length; i++) {
                 if (typeof (v = f(a[i])) !== 'undefined') {
                     return v;
                 }
             }
         }
         else if (juice.is_object(a)) {
             for (i in a) {
                 if (a.hasOwnProperty(i)) {
                     if (typeof (v = f(i, a[i])) !== 'undefined') {
                         return v;
                     }
                 }
             }
         }
         return undefined;
     };

     // If a is an array, calls f(v) for each value v in a. If a is an object,
     // calls f(k,v) for each key-value pair k:v in a.

     juice.foreach = function(a, f) {
         juice.find(a, function(k,v) { f(k,v); });
     };

     // If a is an array, returns a list containing f(v) for each value v in
     // a. If a is an object, returns an object containing a key-value pair
     // k:f(v) for each k:v pair in a.

     juice.map = function(a, f) {
         var answer;

         if (juice.is_array(a)) {
             answer = [];
             juice.foreach(a, function(v) { answer.push(f(v)); });
         }
         else if (juice.is_object(a)) {
             answer = {};
             juice.foreach(a, function(k, v) { answer[k] = f(v); });
         }
         return answer;
     };

     // Returns an array containing f(k,v) for each key-value pair k:v in the
     // object dict.

     juice.map_dict = function(dict, f) {
         var answer = [];
         juice.foreach(dict, function(k, v) { answer.push(f(k, v)); });
         return answer;
     };

     // Returns an array containing the keys in the object dict.

     juice.keys = function(dict) {
         return juice.map_dict(dict, function(k) { return k; });
     };

     // Like keys, but returns values.

     juice.values = function(dict) {
         return juice.map_dict(dict, function(k, v) { return v; });
     };

     // Calls a function n times, passing it the values 0 through n-1. Returns
     // an array containing the function's return values.

     juice.ntimes = function(n, f) {
         var answer = [], i;
         for (i = 0; i < n; i++) {
             answer.push(f(i));
         }
         return answer;
     };

     // If a is an array, returns an array containing only those values v
     // where p(v) is true. If a is an object, returns an object containing
     // only those key-value pairs k:v where p(k,v) is true. If p is not
     // supplied, this function filters values that evaluate to false.

     juice.filter = function(a, p) {
         var answer;
         if (!p) {
             p = function(v) { return !!v; };
         }
         if (juice.is_array(a)) {
             answer = [];
             juice.foreach(a, function(v) { if (p(v)) { answer.push(v); } });
         }
         else if (juice.is_object(a)) {
             answer = {};
             juice.foreach(a, function(k, v) { if (p(k, v)) { answer[k] = v; } });
         }
         return answer;
     };

     // Similar to juice.filter, but only returns values (or pairs whose keys,
     // if a is an object) that are strictly NOT equal to x.

     juice.filter_value = function(a, x) {
         return juice.filter(a, function(y) { return x !== y; });
     };


     juice.group_by = function(a, f) {
         var answer = {};
         juice.foreach(a,
                       function(v) {
                           var group = f(v);
                           if (!answer.hasOwnProperty(group)) {
                               answer[group] = [];
                           }
                           answer[group].push(v);
                       });
         return answer;
     };

     // Given an array containing any number of recusively nested arrays,
     // flattens the arrays, returning an array containing all scalar elements
     // (or, more accurately, only non-array elements). For example, given the
     // array [[1, [2]], 3, [4, [5, [6, [7]]]]], returns [1,2,3,4,5,6,7].

     juice.flatten = function(a) {
         if (!juice.is_array(a)) {
             return [a];
         }
         if (a.length === 0) {
             return [];
         }
         if (!juice.is_array(a[0])) {
             return [a[0]].concat(juice.flatten(a.slice(1)));
         }
         return juice.flatten(a[0]).concat(juice.flatten(a.slice(1)));
     };

     // Returns true if and only if the predicate p(v) is true for any values
     // v in a, or, if a is an object, the predicate p(k,v) is true for any
     // key-value pairs k:v in a.

     juice.any = function(a, p) {
         var i;
         if (juice.is_array(a)) {
             for (i = 0; i < a.length; i++) {
                 if (p(a[i])) {
                     return true;
                 }
             }
         }
         else if (juice.is_object(a)) {
             for (i in a) {
                 if (a.hasOwnProperty(i) && p(i, a[i])) {
                     return true;
                 }
             }
         }
         return false;
     };

     // Works exactly like juice.any except the predicate must return true for
     // everything in a.

     juice.all = function(a, p) {
         return !juice.any(a,
                           function() {
                               return !p.apply(this, juice.args(arguments));
                           });
     };


     // Given a list of pairs, returns an object whose key-value pairs are
     // those pairs.

     juice.pairs_to_dict = function(pairs) {
         var answer = {};
         juice.foreach(pairs, function(pair) { answer[pair[0]] = pair[1]; });
         return answer;
     };

     // Returns an object whose keys are taken from the array a and whose
     // corresponding values are taken from the array b. If a or b is longer
     // than the other, the extra values are ignored.

     juice.combine = function(a, b) {
         var i, n, answer = {};
         for (i = 0, n = Math.min(a.length, b.length); i < n; i++) {
             answer[a[i]] = b[i];
         }
         return answer;
     };

     // Returns a dictionary containing only those key-value pairs from `dict`
     // whose keys are in the array `keys`.

     juice.dict_intersect_keys = function(dict, keys) {
         var answer = {};
         juice.foreach(keys, function(k) { answer[k] = dict[k]; });
         return answer;
     };

     // Given zero or more dictionary arguments, returns a single dictionary
     // containing all of their key-value pairs. If two dictionaries contain
     // conflicting keys, the one appearing last in the argument list takes
     // precedence.

     juice.merge_dicts = function() {
         var answer = {};
         juice.foreach(juice.args(arguments),
                       function(dict) {
                           juice.foreach(dict, function(k,v) { answer[k] = v; });
                       });
         return answer;
     };

     // Converts the value o to a reasonable string representation.

     juice.dump = function(o) {
         var parts = [];

         if (juice.is_function(o) && o.hasOwnProperty("toSource")) {
             return o.toSource();
         }
         if (juice.is_array(o)) {
             juice.foreach(o, function(v) { parts.push(juice.dump(v)); });
             return "[" + parts.join(", ") + "]";
         }
         if (juice.is_object(o)) {
             juice.foreach(o, function(k, v) { parts.push(juice.dump(k) + ": " + juice.dump(v)); });
             return "{" + parts.join(", ") + "}";
         }
         if (juice.is_string(o)) {
             return '"' + o.replace('"', '\\"') + '"';
         }

         return "" + o; // coerce to string
     };

     // Parses a JSON string and returns the resulting object; on failure,
     // returns `otherwise`.

     juice.json_parse_safe = function(js, otherwise) {
         var answer;
         try {
             answer = JSON.parse(js);
         }
         catch (e) {
             // fall through
         }
         if (juice.is_object(answer)) {
             return answer;
         }
         if (juice.is_undefined(otherwise)) {
             return {};
         }
         return otherwise;
     };

     // Returns an array containing numeric values between low and high
     // (inclusive). If step is not given, it defaults to 1. Otherwise, the
     // difference between successive values will be equal to step.

     juice.range = function(low, high, step) {
         var answer = [], i;
         step = step || 1;
         if (low <= high) {
             for (i = low; i <= high; i += step) {
                 answer.push(i);
             }
         }
         else {
             for (i = low; i >= high; i -= step) {
                 answer.push(i);
             }
         }
         return answer;
     };

     // Returns a new object containing the key-value pairs in `obj`.

     juice.copy_object = function(obj) {
         var copy = {};
         juice.foreach(obj, function(k,v) { copy[k] = v; });
         return copy;
     };

     // Add key-value pairs to a target object, taking them from one or more
     // additional objects. This function accepts a variable number of
     // arguments, e.g. juice.extend(target, object1, ... objectN). Note that
     // the target object is copied and returned, not modified in place.

     juice.extend = function() {
         var answer = juice.copy_object(arguments[0]), copy, i;
         copy = function(k,v) { answer[k] = v; };
         for (i = 1; i < arguments.length; i++) {
             juice.foreach(arguments[i], copy);
         }
         return answer;
     };

     // Performs a recursive copy of `x` and returns the result. If `x` is a
     // scalar data type, this function simply returns `x`. If `x` is an
     // array, returns a list containing `juice.deep_copy(v)` for each value
     // `v` in `x`. Finally, if `x` is an object, returns an object containing
     // `k:juice.deep_copy(v)` for each key-value pair `k:v` in `x`.

     juice.deep_copy = function(x) {
         return (juice.is_object(x) || juice.is_array(x)) ? juice.map(x, juice.deep_copy) : x;
     };

     // Accepts 1 or more arrays and returns an array consisting of the unique
     // items. Only works with items that can be used as associative array
     // keys. NOTE: preserves order.

     juice.unique = function() {
         var arrays = juice.args(arguments), s = {}, uniqued = [];
         juice.foreach(arrays,
                       function(array) {
                           juice.foreach(array,
                                         function(k) {
                                             if (!s.hasOwnProperty(k)) {
                                                 s[k] = 1;
                                                 uniqued.push(k);
                                             }
                                         });
                       });
         return uniqued;
     };

     // Given a Date object, returns the corresponding UNIX timestamp.

     juice.date_to_unix = function(d) {
         return Math.floor(((d || new Date()).getTime() / 1000).toFixed());
     };

     // A generalized equality function. Unlike the === operator this function
     // performs a deep comparison when given two collections (instead of
     // comparing references). It is otherwise identical to ===.

     juice.equals = function(a, b) {
         var i, k, num_keys;

         if (typeof a !== typeof b) {
             return false;
         }

         if (juice.is_array(a)) {
             if (a.length !== b.length) {
                 return false;
             }
             for (i = 0; i < a.length; i++) {
                 if (!juice.equals(a[i], b[i])) {
                     return false;
                 }
             }
             return true;
         }
         else if (juice.is_object(a)) {
             num_keys = 0;
             for (k in a) {
                 if (a.hasOwnProperty(k)) {
                     if (!b.hasOwnProperty(k)) {
                         return false;
                     }
                     if (!juice.equals(a[k], b[k])) {
                         return false;
                     }
                 }
                 num_keys++;
             }
             if (num_keys !== juice.keys(b).length) {
                 return false;
             }
             return true;
         }
         else {
             return a === b;
         }
     };

     (function() {
          var make_spec_fn = function(forbid_unrecog_keys) {
              return function(spec) {
                  var copy_of_spec, meta_specs, unrecog_keys = [];

                  // Copy spec into a copy, defaulting values from meta_specs.

                  meta_specs = juice.args(arguments).slice(1);
                  spec = spec || {};
                  copy_of_spec = {};
                  juice.foreach(meta_specs,
                                function(meta_spec) {
                                    juice.foreach(meta_spec,
                                                  function(k, v) {
                                                      if (juice.is_undefined(v)) {  // argument k is required
                                                          if (!spec.hasOwnProperty(k)) {
                                                              throw new Error("missing required spec argument: " + k);
                                                          }
                                                          copy_of_spec[k] = spec[k];
                                                      }
                                                      else {                        // argument k is optional
                                                          copy_of_spec[k] = spec.hasOwnProperty(k) ? spec[k] : meta_spec[k];
                                                      }
                                                  });
                                });

                  if (forbid_unrecog_keys) {
                      juice.foreach(spec,
                                    function(key) {
                                        if (!copy_of_spec.hasOwnProperty(key)) {
                                            unrecog_keys.push(key);
                                        }
                                    });

                      if (unrecog_keys.length > 0) {
                          throw new Error("spec contained unrecognized keys: " + unrecog_keys.join(", "));
                      }
                  }
                  else {
                      juice.foreach(spec,
                                    function(k, v) {
                                        if (!copy_of_spec.hasOwnProperty(k)) {
                                            copy_of_spec[k] = v;
                                        }
                                    });
                  }

                  return copy_of_spec;
              };
          };

          // juice.spec makes a copy of a dictionary, but verifies that it
          // only contains keys from an expected set. It also makes it
          // possible to set default values for certain keys in the set.

          juice.spec = make_spec_fn(true);

          // juice.sloppy_spec is like juice.spec, but allows unrecognized
          // parameters to be passed through.

          juice.sloppy_spec = make_spec_fn(false);

      })();

     // Multi-dimensional object manipulation/accessors functions:
     //
     //     juice.mset(a, v, dims)
     //
     //         Sets a value in an object using a multi-dimensional key. For
     //         example:
     //
     //             var o = {};
     //             juice.mset(o, "foo", ["a", "b", "c"]);
     //             print(juice.dump(o));
     //
     //         The above code prints: {"a": {"b": {"c": "foo"}}}
     //
     //     juice.mdef(a, v, dims)
     //
     //         Works exactly like mset, except it will not overwrite a value
     //         that already exists. For example:
     //
     //             var o = {};
     //             juice.mset(o, "foo", ["x"]);
     //             juice.mdef(o, "bar", ["x"]);  // does NOT change `o`
     //             juice.mset(o, "baz", ["x"]);  // changes `o`
     //
     //     juice.mget(a, dims)
     //
     //         Retrieves a value from a multi-dimensional object. For
     //         example:
     //
     //             var o = {};
     //             juice.mset(o, "foo", ["a", "b", "c"]);
     //             var x = juice.mget(o, ["a", "b"])/
     //             print(juice.dump(x));
     //             juice.mget(o, ["a", "d"]);  // throws an exception!
     //
     //         The above code prints: {"c": "foo"} (then throws an exception,
     //         when the second call to juice.mget fails).
     //
     //     juice.mhas(a, dims)
     //
     //         Similar to mget, but this function only returns a boolean:
     //         true if a value at the specified dimensions exists, false
     //         otherwise. Unlike mget, it cannot throw an exception.

     (function() {
          var setfn = function(a, v, dims, overwrite) {
              var b = a, d, i;
              for (i = 0; i < dims.length; i++) {
                  d = dims[i];
                  if (i === dims.length-1) {
                      if (!b.hasOwnProperty(d) || overwrite) {
                          b[d] = v;
                      }
                  }
                  else if (!b.hasOwnProperty(d)) {
                      b[d] = {};
                  }
                  else if (!juice.is_object(b[d])) {
                      throw new Error('mset path error (dims='+juice.dump(dims)+')');
                  }
                  b = b[d];
              }
          };

          juice.mdef = function(a, v) {
              setfn(a, v, juice.flatten(juice.args(arguments, 2)), false);
          };

          juice.mset = function(a, v) {
              setfn(a, v, juice.flatten(juice.args(arguments, 2)), true);
          };

          juice.mget = function(a) {
              var i, b = a, dims = juice.flatten(juice.args(arguments, 1));
              for (i = 0; i < dims.length; i++) {
                  if (!b.hasOwnProperty(dims[i])) {
                      throw new Error('mget access error (dims='+juice.dump(dims)+')');
                  }
                  b = b[dims[i]];
              }
              return b;
          };

          juice.mhas = function(a) {
              var b = a, d, dims, i;
              dims = juice.flatten(juice.args(arguments, 1));
              for (i = 0; i < dims.length-1; i++) {
                  d = dims[i];
                  if (!b.hasOwnProperty(d)) {
                      return false;
                  }
                  b = b[d];
              }
              return b.hasOwnProperty(dims[dims.length-1]);
          };
      })();

     // Joins all arguments with the path separator character. Collapses
     // repeated leading and trailing separator chars.

     juice.path_join = function() {
         return juice.args(arguments).join("/").replace(/\/{2,}/g, "/");
     };

     // JUICE is relatively formal about the way it handles URL paths. (Note
     // that we're NOT talking about filesystem paths here.) In JUICE, paths
     // should: never begin with a leading slash; always end with a trailing
     // slash or filename; never end with the default index filename, e.g.
     // "index.html". They also never include consecutive slashes.
     //
     // FIXME: "index.html" should be a site setting, not hardcoded here.

     juice.canonicalize_path = function(path) {
         if (!juice.is_string(path) || path === "") {
             return "";                                 // we were given an empty or invalid path
         }
         if (/\/[^\/.]+$/.test(path)) {                 // if path ends with neither slash nor filename
             path += "/";                               // ...end it with a slash
         }
         else if (/(^|\/)index[.]html$/.test(path) ) {  // otherwise, if it ends with "index.html"
             path = path.slice(0, -10);                 // ...remove the filename
         }
         return path.replace(/^\/+/, "")                // delete leading slashes
             .replace(/\/{2,}/g, "/");                  // collapse consecutive slashes
     };

     juice.use = function(lib_obj) {
         var i, parts = lib_obj.split("."), o;
         o = site.lib;
         for (i = 0; i < parts.length; i++) {
             if (juice.is_undefined(o[parts[i]])) {
                 throw new Error("site.juice." + lib_obj + " is not defined!");
             }
             o = o[parts[i]];
         }
         return o;
     };

 })(this);
