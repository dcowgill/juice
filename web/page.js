(function(juice, proj, jQuery) {

     var
     active_layout,
     create_page,
     dynamic_path_var_re,
     global_script_urls,
     global_stylesheet_urls,
     global_widget_packages,
     page_404;

     dynamic_path_var_re = /\[\[(\w+) (.*?)\]\]/g;

     global_stylesheet_urls = [];
     global_script_urls = [];
     global_widget_packages = [];

     create_page = function(spec) {
         var extract_args, my = {}, that = {};

         my.init_widgets    = spec.init_widgets;
         my.layout          = spec.layout;
         my.name            = spec.name;
         my.parameters      = spec.parameters || [];
         my.path            = spec.path;
         my.script_urls     = spec.script_urls || [];
         my.stylesheet_urls = spec.stylesheet_urls || [];
         my.title           = spec.title || 'untitled';
         my.widget_packages = spec.widget_packages || [];

         extract_args = function(args) {
             var recognized = {}, missing = [];

             juice.foreach(my.parameters,
                          function(k) {
                              if (args.hasOwnProperty(k)) {
                                  recognized[k] = args[k];
                              }
                              else {
                                  missing.push(k);
                              }
                          });

             return {recognized: recognized, missing: missing};
         };

         that.title = function() {
             return my.title;
         };

         that.path = function() {
             return my.path;
         };

         that.path_is_dynamic = function() {
             return dynamic_path_var_re.test(my.path);
         };

         that.script_urls = function() {
             return global_script_urls.concat(my.script_urls);
         };

         that.stylesheet_urls = function() {
             return global_stylesheet_urls.concat(my.stylesheet_urls);
         };

         that.widget_packages = function() {
             return global_widget_packages.concat(my.widget_packages);
         };

         that.url = function(args) {
             var cmp, path, path_args, query_args;

             cmp = extract_args(args);
             if (cmp.missing.length !== 0) {
                 juice.error.raise('missing_parameters', {page_name: name, parameters: cmp.missing});
             }

             path = my.path;
             path_args = {};
             juice.foreach(cmp.recognized,
                          function(k, v) {
                              var match, re;
                              re = new RegExp('\\[\\[' + k + ' (.*?)\\]\\]');
                              for (;;) {
                                  match = re.exec(path);
                                  if (!match) {
                                      break;
                                  }
                                  if (!((new RegExp(match[1])).test(v))) {
                                      juice.error.raise('argument_pattern_mismatch', {argument: v, pattern: match[1]});
                                  }
                                  path = path.replace(match[0], v);
                                  path_args[k] = true;
                              }
                          });

             query_args = juice.filter(cmp.recognized, function(k, v) { return !path_args[k]; });
             return juice.url.make({path: path, args: query_args});
         };

         // If this page's URL matches the request, return the dictionary of
         // parameters expected by the page. Otherwise, returns null.

         that.match_url = function(req) {
             var
             args = {},
             keys_re,       // matches dynamic path variable names
             vals_re,       // matches dynamic path variable values
             keys,          // dynamic path variable names
             cmp,
             dynamic_path_args,
             match_result;

             juice.foreach(req.args, function(k,v) { args[k] = v; });

             if (that.path_is_dynamic()) {
                 vals_re = new RegExp('^' + my.path.replace(dynamic_path_var_re, '($2)') + '$');
                 if (!(match_result = req.path.match(vals_re))) {
                     return null;
                 }
                 keys_re = new RegExp('^' + my.path.replace(dynamic_path_var_re, '\\[\\[($1).*?\\]\\]') + '$');
                 keys = my.path.match(keys_re).slice(1);
                 dynamic_path_args = juice.combine(keys, match_result.slice(1));
                 juice.foreach(dynamic_path_args, function(k, v) { args[k] = v; });
             }

             cmp = extract_args(args);
             return cmp.missing.length === 0 ? cmp.recognized : null;
         };

         that.draw = function(container, args) {
             var panels_and_widgets;
             active_layout = my.layout(my.name);
             container.html(active_layout.to_html());
             try {
                 panels_and_widgets = my.init_widgets(args);
             }
             catch (e) {
                 juice.error.handle(e);
                 return;
             }
             juice.foreach(panels_and_widgets,
                           function(panel, widgets) {
                               juice.foreach(widgets, function(w) {
                                                 juice.page.add_widget(panel, w);
                                             });
                           });

         };

         that.init = function(container) {
             // Ensure that any unhandled errors still make it some where
             // window.onerror = function(msg, url, linenumber) {
             //     var e = new Error();
             //     e.message = msg;
             //     e.fileName = url;
             //     e.lineNumber = linenumber;
             //     juice.error.handle(e);
             //     return true;
             // };

             var args = that.match_url(juice.url.request());
             if (args) {
                     that.draw(container, args);
                 }
                 else if (page_404) {
                     page_404.draw(container);
                 }
                 else {
                     juice.error.raise('404_page_not_defined');
                 }
                 juice.event.subscribe(undefined,
                                       'service-failure',
                                       function(event) {
                                           juice.util.message('Backend failure: ' + juice.dump(event));
                                       });
                 juice.rpc.start();
         };

         return that;
     };

     juice.page = {

         define: function(spec) {
             proj.pages[spec.name] = create_page(spec);
         },

         define_404: function(spec) {
             spec.name = '_404';
             page_404 = create_page(spec);
         },

         add_widget: function(panel, widget) {
             if (!active_layout) {
                 juice.error.raise('page_not_initialized');
             }
             active_layout.add_widget(panel, widget);
         },

         add_global_script_url: function(url) {
             global_script_urls.push(url);
         },

         add_global_stylesheet_url: function(url) {
             global_stylesheet_urls.push(url);
         },

         add_global_widget_package: function(url) {
             global_widget_packages.push(url);
         }
     };

 })(juice, proj, jQuery);
