// This code is duplicated for robustness. We don't want a syntax error in
// build.js to mess up this test.
quit(typeof File !== 'undefined' ? 0 : 2);
