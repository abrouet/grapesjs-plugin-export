import JSZip from 'jszip';
import FileSaver from 'file-saver';

export default (editor, opts = {}) => {
  let pfx = editor.getConfig('stylePrefix');
  let btnExp = document.createElement('button');
  let commandName = 'gjs-export-zip';
  let autoprefixer = require('autoprefixer');
  let postcss      = require('postcss');

  let config = {
    addExportBtn: 1,
    btnLabel: 'Export to ZIP',
    filenamePfx: 'grapesjs_template',
    filename: null,
    root: {
      css: {
        'style.css': ed => ed.getCss(),
        'wkhtmltopdf_style.css': ed => {
          const css =  ed.getCss();
            return postcss([autoprefixer({ browsers: 'last 4 versions' })]).process(css).css;
        },
      },
      'index.html': ed =>
        `<!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <link rel="stylesheet" href="./css/style.css">
          </head>
          <body>${ed.getHtml()}</body>
        <html>`,
    },
    isBinary: null,
    ...opts,
  };

  btnExp.innerHTML = config.btnLabel;
  btnExp.className = `${pfx}btn-prim`;

  // Add command
  editor.Commands.add(commandName, {
    createFile(zip, name, content) {
      const opts = {};
      const ext = name.split('.')[1];
      const isBinary = config.isBinary ?
        config.isBinary(content, name) :
        !(ext && ['html', 'css'].indexOf(ext) >= 0) &&
        !/^[\x00-\x7F]*$/.test(content);

      if (isBinary) {
        opts.binary = true;
      }

      editor.log(['Create file', { name, content, opts }],
        { ns: 'plugin-export' });

      zip.file(name, content, opts);
    },

    async createDirectory(zip, root) {
      root = typeof root === 'function' ? await root(editor) : root;

      for (const name in root) {
        if (root.hasOwnProperty(name)) {
          let content = root[name];
          content = typeof content === 'function' ? await content(editor) : content;
          const typeOf = typeof content;

          if (typeOf === 'string') {
            this.createFile(zip, name, content);
          } else if (typeOf === 'object') {
            const dirRoot = zip.folder(name);
            await this.createDirectory(dirRoot, content);
          }
        }
      }
    },

    run(editor) {
      const zip = new JSZip();
      this.createDirectory(zip, config.root).then(() => {
        zip.generateAsync({ type: 'blob' })
        .then(content => {
          const filenameFn = config.filename;
          let filename = filenameFn ?
            filenameFn(editor) : `${config.filenamePfx}_${Date.now()}.zip`;
          FileSaver.saveAs(content, filename);
        });
      });
    }
  });



    function buildEditor(codeName, theme, label, editor) {
       var codeMirror;
        const cm = editor.CodeManager || null;
        var input = document.createElement('textarea');
        !codeMirror && (codeMirror = cm.getViewer('CodeMirror'));

        var el = codeMirror.clone().set({
            label: label,
            codeName: codeName,
            theme: theme,
            input: input
        });

        var $el = new cm.EditorView({
            model: el,
            config: cm.getConfig()
        }).render().$el;

        el.init(input);

        return { el: el, $el: $el };
    }
  // Add button inside export dialog
  if (config.addExportBtn) {

    editor.on('run:export-template', () => {

        var oWkCsslEd = buildEditor('css', 'hopscotch', 'WKHTMLTOPDF CSS', editor);
        var cssWkEditor = oWkCsslEd.el;

        cssWkEditor.setContent(postcss([autoprefixer({ browsers: 'last 4 versions' })]).process(editor.getCss()).css);
        editor.Modal.getContentEl().appendChild(oWkCsslEd.$el[0]);

        editor.Modal.getContentEl().appendChild(btnExp);

        btnExp.onclick = () => {
        editor.runCommand(commandName);
      };
    });
  }
};
