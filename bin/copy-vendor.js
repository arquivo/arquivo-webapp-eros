'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function mkdir(dir) {
  fs.mkdirSync(path.join(root, dir), { recursive: true });
}

function copy(src, dest) {
  fs.copyFileSync(path.join(root, 'node_modules', src), path.join(root, dest));
}

function copyDir(src, dest) {
  const srcPath = path.join(root, 'node_modules', src);
  const destPath = path.join(root, dest);
  fs.mkdirSync(destPath, { recursive: true });
  for (const entry of fs.readdirSync(srcPath, { withFileTypes: true })) {
    if (entry.isFile()) {
      fs.copyFileSync(path.join(srcPath, entry.name), path.join(destPath, entry.name));
    }
  }
}

mkdir('public/vendor/js');
mkdir('public/vendor/css');
mkdir('public/vendor/fonts');

// jQuery
copy('jquery/dist/jquery.js', 'public/vendor/js/jquery-1.12.4.js');

// jQuery UI (pre-built distribution)
copy('jquery-ui-dist/jquery-ui.js', 'public/vendor/js/jquery-ui.js');
copy('jquery-ui-dist/jquery-ui.min.css', 'public/vendor/css/jquery-ui.min.css');

// jQuery UI Touch Punch
copy('jquery-ui-touch-punch/jquery.ui.touch-punch.min.js', 'public/vendor/js/jquery.ui.touch-punch.min.js');

// jQuery Modal
copy('jquery-modal/jquery.modal.min.js', 'public/vendor/js/jquery.modal.min.js');
copy('jquery-modal/jquery.modal.min.css', 'public/vendor/css/jquery.modal.min.css');

// AnyPicker
copy('anypicker/dist/anypicker.min.js', 'public/vendor/js/anypicker.min.js');
copy('anypicker/dist/anypicker.min.css', 'public/vendor/css/anypicker.min.css');
copy('anypicker/dist/anypicker-ios.css', 'public/vendor/css/anypicker-ios.css');

// InputMask
copy('inputmask/dist/jquery.inputmask.bundle.js', 'public/vendor/js/jquery.inputmask.bundle.js');

// SheetJS
copy('xlsx/dist/xlsx.full.min.js', 'public/vendor/js/xlsx.full.min.js');

// Roboto via Fontsource — CSS files alongside their files/ directory
mkdir('public/vendor/fonts/roboto');
for (const weight of ['300', '400', '500', '700']) {
  copy(`@fontsource/roboto/${weight}.css`, `public/vendor/fonts/roboto/${weight}.css`);
}
copyDir('@fontsource/roboto/files', 'public/vendor/fonts/roboto/files');

// Font Awesome 6 Free — CSS + webfonts (served locally, no CDN kit)
mkdir('public/vendor/webfonts');
copy('@fortawesome/fontawesome-free/css/all.min.css', 'public/vendor/css/fontawesome-all.min.css');
copyDir('@fortawesome/fontawesome-free/webfonts', 'public/vendor/webfonts');

console.log('vendor assets copied to public/vendor/');
