(function(juice, site) {

     var panel_exists = function(panel_name, panels) {
         var i, keys, panel;
         if (panels.hasOwnProperty(panel_name)) {
             return true;
         }
         for (i = 0, keys = juice.keys(panels); i < keys.length; i++) {
             panel = panels[keys[i]];
             if (juice.is_object(panel) && panel_exists(panel_name, panel)) {
                 return true;
             }
         }
         return false;
     };

     juice.layout = {
         define: function(name, panels) {
             site.layouts[name] = function(page_name) {
                 return {
                     to_html: function() {
                         var helper = function(panels) {
                             return juice.map_dict(panels,
                                                   function(panel_name, child_panels) {
                                                       return ['<div class="panel" id="panel_', panel_name,
                                                               '">', helper(child_panels), '</div>'].join('');
                                                   }).join('');
                         };
                         return ['<div class="layout ', name, '" id="page_',
                                 page_name, '">', helper(panels), '</div>'].join('');
                     },
                     add_widget: function(panel_name, widget) {
                         if (!panel_exists(panel_name, panels)) {
                             juice.error.raise('panel "'+panel_name+'" not found in layout "'+name+'"');
                         }
                         if (juice.is_object(panels[panel_name])) {
                             juice.error.raise("Can't add " + widget.name + " to " + panel_name + ", because panel has child panels.");
                         }
                         jQuery('#panel_' + panel_name).append(widget.unsafe_render());
                         widget.fire_domify();
                     }
                 };
             };
         }
     };

 })(juice, site);
