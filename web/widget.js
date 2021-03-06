(function(juice, site, jQuery) {
     var
     current_namespace,
     enhancers = {},
     lib,
     render_stack = [];

     juice.widget = lib = {};

     lib.define = function(name, constructor) {

         var def, qualified_name = current_namespace.qualify(name);

         if (current_namespace.contains(name)) {
             juice.error.raise(qualified_name + " already defined");
         }

         def = function(spec) {
             var
             container_attribs = {},
             container_element = "div",
             css_classes = {},
             destroy_event_system,
             dispose_of_domified_and_linked_widgets,
             domified_and_linked = [],
             enhancements = {},
             fire_domify_for_linked_widgets,
             id = juice.newid(),
             initially_hidden = false,
             linked = [],
             my = {},
             state = "initial",
             that = {__widget__: true},
             transition;

             if (arguments.length === 0) {
                 spec = {};
             }

             (function() {
                  var
                  assert_registered,
                  is_event_registered,
                  publishers = {},
                  subscribers = {};

                  assert_registered = function(name, where) {
                      if (!juice.is_array(subscribers[name])) {
                          my.raise("event_not_registered: " + name, {where: where});
                      }
                  };

                  destroy_event_system = function() {
                      subscribers = {};
                      juice.event.cancel_subscriptions(that.uuid());
                      juice.foreach(publishers,
                                    function(id, publisher) {
                                        publisher.__remove_subscriber(that.uuid());
                                    });
                  };

                  is_event_registered = function(name) {
                      return subscribers.hasOwnProperty(name);
                  };

                  my.register_event = function() {
                      juice.foreach(juice.args(arguments),
                                    function(name) {
                                        if (is_event_registered(name)) {
                                            my.raise("event already registered", {event_name: name});
                                        }
                                        else {
                                            subscribers[name] = [];
                                        }
                                    });
                  };

                  // Publish the specified event, passing `payload` to each
                  // subscriber. Subscribers are called in FIFO order.

                  my.publish = function(event_name, payload) {
                      assert_registered(event_name, "publish");
                      juice.foreach(subscribers[event_name],
                                    function(subscriber) {
                                        try {
                                            subscriber.fn(payload);
                                        }
                                        catch (e) {
                                            juice.error.handle(e);
                                        }
                                    });
                  };

                  my.subscribe = function(publisher, event_name, fn) {
                      publisher.__add_subscriber(that.uuid(), event_name, fn);
                      publishers[publisher.uuid()] = publisher;
                  };

                  my.unsubscribe = function(publisher, event_name, fn) {
                      publisher.__remove_subscriber_fn(that.uuid(), event_name, fn);
                  };

                  my.subscribe_self = function(event_name, fn) {
                      my.subscribe(that, event_name, fn);
                  };

                  my.unsubscribe_self = function(event_name, fn) {
                      my.unsubscribe(that, event_name, fn);
                  };

                  my.subscribe_to_global_event = function(event_name, fn) {
                      juice.event.subscribe(that.uuid(), event_name, fn);
                  };

                  my.propagate_event = function(publisher, event_name, new_event_name) {
                      var name = new_event_name || event_name;
                      if (!is_event_registered(name)) {
                          my.register_event(name);
                      }
                      my.subscribe(publisher, event_name,
                                   function(e) {
                                       my.publish(name, e);
                                   });
                  };

                  that.__add_subscriber = function(subscriber_uuid, event_name, fn) {
                      assert_registered(event_name, "__add_subscriber");
                      subscribers[event_name].push({id: subscriber_uuid, fn: fn});
                  };

                  that.__remove_subscriber_fn = function(subscriber_uuid, event_name, fn) {
                      subscribers[event_name] =
                          juice.filter(subscribers[event_name],
                                       function(pair) {
                                           return pair.id !== subscriber_uuid || pair.fn != fn;
                                       });
                  };

                  that.__remove_subscriber = function(subscriber_uuid, event_name, fn) {
                      juice.foreach(subscribers,
                                    function(ename, pairs) {
                                        pairs = juice.filter(pairs,
                                                             function(pair) {
                                                                 return pair.id !== subscriber_uuid;
                                                             });
                                    });
                  };

              })();

             my.selector = "#" + id;
             that.qualified_name = qualified_name;
             that.name = name;

             that.uuid = function() {
                 return id;
             };
             that.selector = function() {
                 return my.selector;
             };

             my.raise = function(msg, info) {
                 juice.error.raise(that.qualified_name + " (" + my.selector + "): " + msg, info);
             };

             my.$ = function(selector) {
                 var elems = jQuery(my.selector);
                 my.expect_state("domified");
                 if (elems.length === 0) {
                     my.raise("selector error");
                 }
                 if (!selector) {
                     return elems;
                 }
                 return elems.find(selector);
             };

             that.add_class = function(s) {
                 if (my.state() === "initial") {
                     css_classes[s] = true;
                 }
                 else {
                     my.after_domify(function() { my.$().addClass(s); });
                 }
             };

             that.remove_class = function(s) {
                 if (my.state() === "initial") {
                     delete css_classes[s];
                 }
                 else {
                     my.after_domify(function() { my.$().removeClass(s); });
                 }
             };

             that.show = function() {
                 if (my.state() === "domified") {
                     my.$().show();
                 }
                 else {
                     initially_hidden = false;
                 }
             };

             that.hide = function() {
                 if (my.state() === "domified") {
                     my.$().hide();
                 }
                 else {
                     initially_hidden = true;
                 }
             };

             that.visible = function() {
                 return my.state() === "domified" && my.$().is(":visible");
             };

             that.remove = function() {
                 my.expect_state("domified");
                 my.$().remove();
                 that.dispose();
             };

             that.dispose = function() {
                 if (my.state() === "disposed") {
                     return;
                 }
                 transition("domified", "disposed");
                 my.publish("dispose");
                 dispose_of_domified_and_linked_widgets();
                 destroy_event_system();
                 delete juice.widget.live[id];
             };

             my.state = function() {
                 return state;
             };

             my.expect_state = function() {
                 var args = juice.args(arguments);
                 if (!juice.any(args, function(arg) { return state === arg; })) {
                     my.raise("Bad state: expected " + args.join(", ") +"--actual was " + state + " in " + that.qualified_name);
                 }
             };

             transition = function(from, to) {
                 my.expect_state(from);
                 state = to;
             };

             my.set_container_element = function(t, attribs) {
                 attribs = attribs || {};
                 juice.foreach(["class", "id", "style"],
                               function(k) {
                                   if (attribs.hasOwnProperty(k)) {
                                       my.raise("can't specify "+k+" as a container attribute");
                                   }
                               });
                 container_element = t;
                 container_attribs = attribs;
             };

             (function() {
                  var call_linked_render, render, render_impl;

                  // Default rendering method
                  render = function() {
                      return "";
                  };

                  call_linked_render = function(unsafe, f) {
                      var answer;
                      if (render_stack.length > 0) {
                          render_stack[render_stack.length-1](that);
                      }
                      else if (!unsafe) {
                          my.raise("tried to render while unlinked");
                      }
                      render_stack.push(function(w) { linked.push(w); });
                      answer = f();
                      render_stack.pop();
                      return answer;
                  };

                  render_impl = function(unsafe) {
                      return call_linked_render(
                          unsafe,
                          function() {
                              var attribs = {
                                  "class": qualified_name.toString().replace(/\./g, " "),
                                  "id": id
                              };
                              if (initially_hidden) {
                                  attribs.style = "display: none";
                              }
                              juice.foreach(container_attribs, function(k, v) { attribs[k] = v; });
                              juice.foreach(css_classes, function(k) { attribs["class"] += " " + k; });
                              transition("initial", "rendered");
                              return "<" +
                                  container_element + " " +
                                  juice.map_dict(attribs,
                                                 function(k, v) {
                                                     return k + '="' + v + '"';
                                                 }).join(" ") +
                                  ">" + render() + "</" + container_element + ">";
                          });
                  };

                  my.render = function(content) {
                      if (!juice.is_function(content)) {
                          render = function() {
                              return content;
                          };
                      }
                      else {
                          render = content;
                      }
                  };


                  that.render = function() { return render_impl(false); };
                  that.unsafe_render = function() { return render_impl(true); };
                  that.toString = that.render; // for convenience in templates

                  // my.partial_update provides a safe and convenient way to
                  // refresh specific parts of a widget's DOM tree.

                  my.partial_update = function(selector) {
                      var update = function(p, f) {
                          call_linked_render(
                              true,
                              function() {
                                  var s = p;
                                  if (juice.is_object(s) && s.__widget__) {
                                      s = s.render();   // s is a widget--render it
                                  }
                                  else if (juice.is_function(s)) {
                                      s = s();          // s is a function--call it
                                  }
                                  if (!juice.is_string(s)) {
                                      my.raise("type mismatch: expected String, but actual was " + typeof s);
                                  }
                                  f(s);
                              });
                          fire_domify_for_linked_widgets();
                      };

                      my.expect_state("domified");

                      return {

                          // Insert content after the selected elements.

                          after: function(p) {
                              update(p, function(s) { my.$(selector).after(s); });
                          },

                          // Insert content before the selected elements.

                          before: function(p) {
                              update(p, function(s) { my.$(selector).before(s); });
                          },

                          // Replace the selected elements with new content.

                          html: function(p) {
                              my.partial_update(selector + ">*").remove();
                              update(p, function(s) { my.$(selector).html(s); });
                          },

                          // Append content to the inside of the selected elements.

                          append: function(p) {
                              update(p, function(s) { my.$(selector).append(s); });
                          },

                          // Prepend content to the inside of the selected elements.

                          prepend: function(p) {
                              update(p, function(s) { my.$(selector).prepend(s); });
                          },

                          // Remove the selected elements.

                          remove: function() {
                              var ids = {};

                              // Removing DOM elements is tricky because we
                              // need to make sure any widgets contained
                              // within them are disposed of. We must be
                              // careful to examine both the children of the
                              // selected elements and the selected elements
                              // themselves.

                              my.$(selector).each(
                                  function() {
                                      var e = jQuery(this);
                                      if (e.hasClass("widgets")) {
                                          ids[this.id] = true;
                                      }
                                      else {
                                          e.find(".widgets").each(
                                              function() {
                                                  ids[this.id] = true;
                                              });
                                      }
                                  });

                              // We have got our widget ids; it is now safe to
                              // destroy the DOM subtree.

                              my.$(selector).remove();

                              // Dispose of and remove from
                              // domified_and_linked any widgets that were
                              // found in the search above.

                              domified_and_linked = juice.filter(domified_and_linked,
                                                                 function(w) {
                                                                     if (ids[w.uuid()]) {
                                                                         w.dispose();
                                                                         return false;
                                                                     }
                                                                     return true;
                                                                 });
                          },

                          // Internal function: do not call! This is here only
                          // so that it can be accessed by my.refresh.

                          __html: function(p) {
                              update(p, function(s) { my.$(selector).html(s); });
                          }
                      };
                  };

                  // Calling my.refresh(p) is equivalent to calling
                  // my.partial_update().html(p), i.e. not using a selector.
                  // Because we know we're destroying every one our child
                  // widgets, we can be more efficient.

                  my.refresh = function(p) {
                      dispose_of_domified_and_linked_widgets();
                      my.partial_update().__html(p || render);
                  };

              })();

             my.register_event("domify", "dispose");

             // Transitions this widget into the domified state, publishes its
             // domify event, and recursively domifies its children.

             that.fire_domify = function() {
                 transition("rendered", "domified");
                 fire_domify_for_linked_widgets();
                 my.publish("domify");
             };

             // Calls f and return true if and only if the widget
             // is in the domified state. Otherwise, returns false.

             my.if_domified = function(f) {
                 if (my.state() === "domified") {
                     f();
                     return true;
                 }
                 return false;
             };

             // If the widget is in the domified state, calls f
             // immediately. Otherwise, calls f when the widget
             // becomes domified.

             my.after_domify = function(f) {
                 if (!my.if_domified(f)) {
                     my.subscribe_self("domify", f);
                 }
             };

             // If the widget is in the disposed state, calls f
             // immediately. Otherwise, calls f when the widget
             // is disposed of.

             my.after_dispose = function(f) {
                 if (my.state() === "disposed") {
                     f();
                     return;
                 }
                 my.subscribe_self("dispose", f);
             };

             fire_domify_for_linked_widgets = function() {
                 juice.foreach(linked, function(w) { w.fire_domify(); });
                 domified_and_linked = domified_and_linked.concat(linked);
                 linked = [];
             };

             dispose_of_domified_and_linked_widgets = function() {
                 juice.foreach(domified_and_linked, function(w) { w.dispose(); });
                 domified_and_linked = [];
             };

             that.enhance = function(name, spec) {
                 var css_class;
                 if (that.enhanced(name)) {
                     my.raise("already enhanced");
                 }
                 if (!enhancers[name]) {
                     my.raise("enhancer not defined");
                 }
                 enhancements[name] = true;
                 css_class = "enhancer_" + name.replace(/[.]/g, "_");
                 my.after_domify(function() { my.$().addClass(css_class); });
                 enhancers[name](that, my, spec);
                 return that;
             };

             that.enhanced = function(name) {
                 return !!enhancements[name];
             };

             constructor(that, my, spec);

             juice.widget.live[id] = that;
             return that;
         };

         def.many = function(items) {
             return juice.map(items, function(i) { return def(i); });
         };

         current_namespace.def(name, def);

         return def;
     };

     lib.define_local = function(name, constructor) {
         var def, impl;
         def = lib.define(name, constructor);

         impl = function(spec) {
             juice.error.raise("local widget " + name + " instantiated without local constructor");
         };
         impl.many = function(items) {
             juice.error.raise("many local widgets " + name + " instantiated without local constructor");
         };

         current_namespace.def(name, impl);

         return def;
     };

     lib.define_enhancer = function(name, constructor) {
         var enhancer_name = [current_namespace.lib_name,
                              current_namespace.pkg_name,
                              name].join(".");
         if (enhancers[enhancer_name]) {
             juice.error.raise(enhancer_name + " enhancer already defined");
         }
         enhancers[enhancer_name] = constructor;
     };

     // +---------------------------+
     // | package management system |
     // +---------------------------+

     lib.define_package = function(lib_name, pkg_name, constructor) {
         var namespace = juice.namespace.make(lib_name, "widgets", pkg_name);
         if (current_namespace) {
             juice.error.raise(namespace + " nested inside " + current_namespace);
         }
         current_namespace = namespace;
         try {
             constructor(juice, site, jQuery);
         }
         catch (e) {
             current_namespace = null;
             throw e;
         }

         current_namespace = null;
     };

     // +-------------------------+
     // | debugging and reporting |
     // +-------------------------+

     (function() {
          var diff, prev_report = {}, report;

          // juice.widget.live keeps track of all currently active widgets,
          // i.e. widgets that have been constructed but not yet disposed of.
          // It maps widget uuids to the actual widget objects.

          lib.live = {};

          report = function() {
              var seen = {};
              juice.foreach(lib.live,
                            function(id, w) {
                                var k = w.qualified_name.toString();
                                if (seen.hasOwnProperty(k)) {
                                    seen[k]++;
                                }
                                else {
                                    seen[k] = 1;
                                }
                            });
              return seen;
          };

          diff = function(a, b) {
              var answer = {};
              juice.foreach(a,
                            function(k, a_n) {
                                var b_n = b.hasOwnProperty(k) ? b[k] : 0;
                                if (a_n !== b_n) {
                                    answer[k] = b_n - a_n;
                                }
                            });
              juice.foreach(b,
                            function(k, b_n) {
                                var a_n = a.hasOwnProperty(k) ? a[k] : 0;
                                if (a_n !== b_n) {
                                    answer[k] = b_n - a_n;
                                }
                            });
              return answer;
          };


          // Summarizes the deltas in juice.widget.live between now and the
          // previous call to this function, returning an object that maps
          // qualified widget names (i.e.
          // "{library}.widgets.{package}.{widget}") to the change in the
          // number of widgets of that type that are currently live. This
          // function is handy when tracking down widget leaks.

          lib.report = function() {
              var answer, next_report = report();
              answer = diff(prev_report, next_report);
              prev_report = next_report;
              return answer;
          };
      })();

 })(juice, site, jQuery);
