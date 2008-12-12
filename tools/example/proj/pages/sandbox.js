/*
This is the sandbox page--a place for you to experiment with new widgets.
Add the name of your widget package to the widget_packages array, construct
your widgets in init_widgets, and add it to the "a" panel.
*/

var w = proj.widgets;

juice.page.define(
    {name: 'sandbox',
     path: '/sandbox/',
     layout: proj.layouts.sandbox,
     widget_packages: ['sandbox'],
     init_widgets: function(args) {
         return {a: []};
     }
    });
