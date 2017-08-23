(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

/* jshint node: true */

require('./src/main');

},{"./src/main":7}],2:[function(require,module,exports){
/**
 * Display class module
 * @module class/Display
 */

'use strict';

/**
 * @constructor
 * @param {Node} _document - Document element from DOM
 * @return void
 */
function Display(_document) {
  /**
   * @property {Element}
   */
  this._testDPIElement = null;
  this.document = _document;
  this._setScreenDPI();
}

/**
 * Create the test DPI element
 * @method
 * @private
 */
var _createTestDPIElement = function () {
  if ($('#dpi-test')[0]) {
    this._testDPIElement = $('#dpi-test');
    return;
  }
  this._testDPIElement = $('<div/>')
    .attr('id', 'dpi-test')
    .css({
      position: 'absolute',
      top: '-100%',
      left: '-100%',
      height: '1in',
      width: '1in',
      border: 'red 1px solid'
    });
  $('body').prepend(this._testDPIElement);
};

/**
 * @method
 * @return the screen DPI
 */
Display.prototype._setScreenDPI = function () {
  _createTestDPIElement.call(this);

  if (this._testDPIElement[0].offsetWidth !== this._testDPIElement[0].offsetHeight)
    throw new Error('FATAL ERROR: Bad Screen DPI !');

  this.screenDPI = this._testDPIElement[0].offsetWidth;
};

/**
 * @method
 * @param {String} unit - unit of height
 * @return `_document` body height in `unit` unit
 */
Display.prototype.height = function (unit) {
  if (!unit) throw new Error('Explicit unit for getting document height is required');

  var pixels = $('body', this.document).height();

  if (unit === 'px') return pixels;
  if (unit === 'mm') return this.px2mm(pixels);
};

/**
 * Converts pixels amount to milimeters, in function of current display DPI
 *
 * Calculus rule
 * 1 dpi := pixel / inch
 * 1 in = 25.4 mm
 * size in mm = pixels * 25.4 / DPI
 *
 * @method
 * @param {Number} px   The amount of pixels to Converts
 * @return {Number}   The amount of milimeters converted
 */
Display.prototype.px2mm = function (px) {
  if (!this.screenDPI)
    throw new Error('Screen DPI is not defined. Is Display object instantied ?');
  return px * 25.4 / this.screenDPI;
};

/**
 * Converts milimeters amount in pixels, in function of current display DPI
 *
 * Calculus rule
 * 1 dpi := pixel / inch
 * 1 in = 25.4 mm
 * size in px = mm * DPI / 25.4
 *
 * @method
 * @param {Number} mm   The amount of milimeters to converts
 * @return {Number} px  The amount of pixels converted
 */
Display.prototype.mm2px = function (mm) {
  if (!this.screenDPI)
    throw new Error('Screen DPI is not defined. Is Display object instantied ?');
  return mm * this.screenDPI / 25.4;
};

module.exports = Display;
},{}],3:[function(require,module,exports){
/**
 * Page class module
 * @module class/Page
 */

'use strict';

var Display = require('./Display');
var supportedFormats = require('../utils/page-formats');


var InvalidOrientationLabelError = (function () {
  /**
   * Must be thrown when trying to orientate a page with an invalid orientation label
   * @constructor
   * @param {string} label The invalid orientation label
   */
  function InvalidOrientationLabelError(label) {
    this.name = 'InvalidOrientationLabelError';
    this.message = label + ' is an invalid orientation label !';
    this.stack = (new Error()).stack;
  }
  InvalidOrientationLabelError.prototype = Error.prototype;
  InvalidOrientationLabelError.prototype.name = 'InvalidOrientationLabelError';
  return InvalidOrientationLabelError;
})();

/**
 * @constructor
 * @param {String} formatLabel A supported format mabel. For example: `A4`.
 * @param {Sring} orientation An orientation in `('portrait','landscape')`.
 * @param {Number} rank The page rank `(1..n)`
 * @param {HTMLDivElement} wrappedPageDiv The `div[data-paginator]` HTMLDivElement
 * @param {Editor} ed - The tinymce editor object
 */
function Page(formatLabel, orientation, rank, wrappedPageDiv, ed) {
  this._content = null;
  this.rank = null;

  /**
   * Current editor
   * @property {Editor}
   */
  this._editor = ed;

  /**
   * The Display to manage screen and dimensions
   * @property {Display}
   * @private
   */
  this._display = new Display(ed.getDoc());

  _setPaddings.call(this);

  this.format(formatLabel);
  this.orientate(orientation);

  if (rank !== undefined) {
    this.rank = rank;
  }

  if (wrappedPageDiv !== undefined || wrappedPageDiv !== null) {
    this.content(wrappedPageDiv);
  }

  if (rank) this.setHeadersAndFooters();
}

/**
 * Set of the constant values representing the `margins` of a page.
 * @type {integer}
 */
Page.prototype.MARGIN_Y = 16;

/**
 * Getter-setter for page div content Element
 * @method
 * @param {DOMElement} wrappedPageDiv The content to fill the page
 * @return {DOMElement|void} The page div Element to return in getter usage
 */
Page.prototype.content = function (wrappedPageDiv) {
  if (!wrappedPageDiv) {
    return this._content;
  } else {
    this._content = wrappedPageDiv;
  }
};

/**
 * Get only inner content excluding headers and footers
 * @method
 * @return {DOMElement|void} The page div Element to return in getter usage
 */
Page.prototype.innerContent = function () {
  if (this._content) {
    return $(this._content).children(':not(.pageFooter):not(.pageHeader)');
  }
};

/**
 * Set headers and footers according to settings
 * @method
 * @param {Boolean} firstHeaderAndFooter mannual control over the first initilization
 * @return void
 */
Page.prototype.setHeadersAndFooters = function () {
  var that = this;
  var configs = that._editor.settings.paginate_configs();
  if (!configs) return;

  var spacingsWithHeaders = that.spacingsWithHeaders;
  var spacingsWithoutHeaders = that.spacingsWithoutHeaders;
  var cm1 = Math.ceil(Number(this._display.mm2px(10)) - 1); // -1 is the dirty fix mentionned in the todo tag

  // remove header and footer
  var removed = $(that._content).find('.pageHeader,.pageFooter').remove();
  // default function to cancel drag on header and footer
  function cancelDrag(e) { e.preventDefault(); return false; }

  // Define padding like margin is enabled
  // Headers and footers Disabled (Margins)
  if (configs.margemSuperior)
    spacingsWithoutHeaders.page.pTop = that._display.mm2px(configs.margemSuperior * 10);
  if (configs.margemInferior)
    spacingsWithoutHeaders.page.pBottom = that._display.mm2px(configs.margemInferior * 10);

  // Spacing using Margins
  var spacing = {
    top: spacingsWithoutHeaders.page.pTop,
    right: spacingsWithoutHeaders.page.pRight,
    bottom: spacingsWithoutHeaders.page.pBottom,
    left: spacingsWithoutHeaders.page.pLeft,
    minHeight: that.getInnerHeight()
  };

  var headerAndFooterEnabled = configs.possuiCabecalhoRodape || (removed.length > 0 && configs.headerHtml && configs.possuiCabecalhoRodape !== false);

  // Header, with margins enabled
  var header = document.createElement('div');
  header.className = 'pageHeader';
  header.contentEditable = false;
  header.onmousedown = cancelDrag;
  header.style.width = 'calc(100% - ' + spacingsWithHeaders.page.sumWidth() + 'px)';
  header.style.height = (spacing.top - Math.ceil(cm1 / 2)) + 'px';
  header.style.marginRight = spacingsWithHeaders.header.mRight + 'px';
  header.style.marginLeft = spacingsWithHeaders.header.mLeft + 'px';
  disableSelection(header);

  // Footer, with margins enabled
  var footer = document.createElement('div');
  footer.className = 'pageFooter';
  footer.contentEditable = false;
  footer.onmousedown = cancelDrag;
  footer.style.width = 'calc(100% - ' + spacingsWithHeaders.page.sumWidth() + 'px)';
  footer.style.height = (spacing.bottom - Math.ceil(cm1 / 2)) + 'px';
  footer.style.marginRight = spacingsWithHeaders.footer.mRight + 'px';
  footer.style.marginLeft = spacingsWithHeaders.footer.mLeft + 'px';
  disableSelection(footer);

  // Headers and footers Enabled
  if (headerAndFooterEnabled) {
    // Header, with headers and footers enabled
    header.classList += ' large';
    header.style.height = spacingsWithHeaders.header.height + 'px';
    header.style.paddingTop = spacingsWithHeaders.header.pTop + 'px';
    header.style.paddingBottom = spacingsWithHeaders.header.pBottom + 'px';

    // Footer, with headers and footers enabled
    footer.classList += ' large';
    footer.style.height = spacingsWithHeaders.footer.height + 'px';
    footer.style.paddingTop = spacingsWithHeaders.footer.pTop + 'px';
    footer.style.paddingBottom = spacingsWithHeaders.footer.pBottom + 'px';

    // spacing, with headers and footers enabled
    spacing.top = spacingsWithHeaders.page.pTop;
    spacing.right = spacingsWithHeaders.page.pRight;
    spacing.bottom = spacingsWithHeaders.page.pBottom;
    spacing.left = spacingsWithHeaders.page.pLeft;
    spacing.height = that.getInnerHeight();
  }


  insertHeaderData(header, headerAndFooterEnabled);
  insertFooterData(footer, headerAndFooterEnabled);

  $(that._content)
    .css({
      'padding-top': spacing.top + 'px ',
      'padding-right': spacing.right + 'px ',
      'padding-bottom': spacing.bottom + 'px ',
      'padding-left': spacing.left + 'px',
      'min-height': spacing.minHeight
    })
    .prepend(header)
    .append(footer);

  /**
   * Disable mouse selection for header and footer.
   * @param {HTMLElement} el should be header and footer elements
   */
  function disableSelection(el) {
    $(el).css({
      '-webkit-touch-callout': 'none', /* iOS Safari */
      '-webkit-user-select': 'none', /* Safari */
      '-khtml-user-select': 'none', /* Konqueror HTML */
      '-moz-user-select': 'none', /* Firefox */
      '-ms-user-select': 'none', /* Internet Explorer/Edge */
      'user-select': 'none', /* Non-prefixed version, currently
                                                        supported by Chrome and Opera */
    });
  }

  /**
   * Insert HTML content into header DOM element.
   * @param {HTMLElement} header virtual header DOM element
   */
  function insertHeaderData(header, headerAndFooterEnabled) {
    var _configs = that._editor.settings.paginate_configs();
    if (_configs && _configs.headerHtml) {
      if (typeof _configs.headerHtml !== 'function') throw Error('[tinymce~paginate] configuration "paginate_configs.headerHtml" should be [function] but is [' + typeof _configs.headerHtml + ']');
      _configs.headerHtml(header, headerAndFooterEnabled);
    }
  }
  /**
   * Insert HTML content into header DOM element.
   * @param {HTMLElement} footer virtual header DOM element
   */
  function insertFooterData(footer, headerAndFooterEnabled) {
    var _configs = that._editor.settings.paginate_configs();
    if (_configs && _configs.footerHtml) {
      if (typeof _configs.footerHtml !== 'function') throw Error('[tinymce~paginate] configuration "paginate_configs.footerHtml" should be [function] but is [' + typeof _configs.footerHtml + ']');
      _configs.footerHtml(footer, headerAndFooterEnabled, that.rank);
    }
  }
};

/**
 * Returns wheter this page content is empty or not
 * @method
 * @return {boolean}
 */
Page.prototype.contentIsEmpty = function () {
  var innerContent = this.innerContent();
  var content = 0;
  if (innerContent) {
    content += innerContent.text().replace(/\r?\n|\r/igm).replace(/^\s*$/igm, '').length;
  }
  return innerContent.length === 0;
};

/**
 * Clean all content from this page
 * @method
 * @return {void}
 */
Page.prototype.clean = function () {
  if (this._content) {
    var headersAndFooters = $(this._content).find('.pageFooter,.pageHeader').detach();
    $(this._content).html(headersAndFooters);
  }
};

/**
 * Append the given node list to the page content.
 * @method
 * @param {Array}<Node> nodes The nodes to insert.
 * @returns {Page} `this` page instance.
 */
Page.prototype.append = function (nodes) {
  var configs = this._editor.settings.paginate_configs();

  // Insert after .pageHeader
  if (configs && configs.possuiCabecalhoRodape) $(nodes).insertBefore($(this.content()).find(".pageFooter"));
  // Insert at firstChild
  else $(nodes).appendTo(this.content());

  return this;
};

/**
 * Prepend the given node list to the page content.
 * @method
 * @param {Array}<Node> nodes The nodes to insert.
 * @returns {Page} `this` page instance.
 */
Page.prototype.prepend = function (nodes) {
  var configs = this._editor.settings.paginate_configs();

  // Insert after .pageHeader
  if (configs && configs.possuiCabecalhoRodape) $(nodes).insertAfter($(this.content()).find(".pageHeader"));
  // Insert at firstChild
  else $(nodes).prependTo(this.content());

  return this;
};

/**
 * Get the first element of the page considering header.
 * @method
 * @returns {Node} `this` page instance.
 */
Page.prototype.getFirstElement = function () {
  var configs = this._editor.settings.paginate_configs();
  var children = $(this.content()).contents();

  // Get the first block, considering header
  return (configs && configs.possuiCabecalhoRodape) ? children[1] : children[0];
};

/**
 * Get the last element of the page considering footer.
 * @method
 * @returns {Node} `this` page instance.
 */
Page.prototype.getLastElement = function () {
  var configs = this._editor.settings.paginate_configs();
  var children = $(this.content()).contents();

  // Get the last block, considering footer
  return (configs && configs.possuiCabecalhoRodape) ? children[children.length - 2] : children[children.length - 1];
};

/**
 * getter-setter of the orientation
 * @method
 * @param {string} orientation
 * @return void
 */
Page.prototype.orientate = function (orientation) {
  var inValidType = (typeof (orientation) !== 'string');
  var inValidLabel = (orientation.toLowerCase() !== 'portrait' && orientation.toLowerCase() !== 'paysage');

  if (inValidType || inValidLabel)
    throw new InvalidOrientationLabelError(orientation);

  this.orientation = orientation;

  if (orientation === 'portrait') {
    this.width = this.format().short;
    this.height = this.format().long;
  } else {
    this.width = this.format().long;
    this.height = this.format().short;
  }

};

/**
 * @method getter-setter for the page format
 * @param {String} label The format's label to set if used as setter, undefined to use it as getter
 * @return {Format | Page}
 * - the defined format for the page if used as getter,
 * - or the page instance if used as setter (to permit chaining)
 */
Page.prototype.format = function (label) {
  if (label !== undefined) {
    if (!supportedFormats[label])
      throw new Error('Format ' + label + ' is not supported yet.');

    this._format = supportedFormats[label];
    return this;
  } else return this._format;
};

/**
 * Compute the page default height in pixels.
 * @method
 * @return {Number} The resulted default height in pixels.
 */
Page.prototype.getDefaultHeight = function () {
  var defaultHeightInPx = Number(this._display.mm2px(this.height));
  return Math.ceil(defaultHeightInPx - 1); // -1 is the dirty fix mentionned in the todo tag
};

/**
 * Compute the page default width in pixels.
 * @method
 * @return {Number} The resulted width in pixels.
 */
Page.prototype.getDefaultWidth = function () {
  var defaultWidthInPx = Number(this._display.mm2px(this.width));
  return Math.ceil(defaultWidthInPx - 1); // -1 is the dirty fix mentionned in the todo tag
};

/**
 * Compute the page inner height in pixels.
 * @method
 * @return {Number} The resulted inner height in pixels.
 */
Page.prototype.getInnerHeight = function () {
  var configs = this._editor.settings.paginate_configs(),
    paddings = (configs && configs.possuiCabecalhoRodape) ?
      this.spacingsWithHeaders.page.sumHeight() : this.spacingsWithoutHeaders.page.sumHeight();
  return this.getDefaultHeight() - paddings;
};

/**
 * Compute the page inner width in pixels.
 * @method
 * @return {Number} The resulted inner width in pixels.
 */
Page.prototype.getInnerWidth = function () {
  var configs = this._editor.settings.paginate_configs(),
    paddings = (configs && configs.possuiCabecalhoRodape) ?
      this.spacingsWithHeaders.page.sumWidth() : this.spacingsWithoutHeaders.page.sumWidth();
  return this.getDefaultWidth() - paddings;
};

/**
 * Compute the real height of the page's content. It must equals the page inner height, except the time where the content overflows it, juste before to be repaged by the `Paginator::_repage()` method that bring back the content height to the page inner one.
 * @method
 * @returns {Number} The resulted height in pixels.
 */
Page.prototype.getRealHeight = function () {
  var height = $(this.content()).css('height');
  var inPixels = height.split('px').join('');
  return Number(inPixels);
};

/**
 * Compute the available height of the page's content, considering bottom padding (for absolute footer).
 * @method
 * @returns {Number} The resulted height in pixels.
 */
Page.prototype.getAvailableHeight = function () {
  var pageDefaultHeight = this.getDefaultHeight(),
    contentHeight = this.getContentHeight(),
    availableHeight = pageDefaultHeight - contentHeight;
  return availableHeight;
};

/**
 * Compute the page content height.
 * @method
 * @returns {Number} The resulted height in pixels.
 */
Page.prototype.getContentHeight = function () {
  var lastElement = this.getLastElement(),
    lastElementObj = {
      offsetTop: lastElement.offsetTop,
      height: Number($(lastElement).css('height').split('px').join('')),
      margin: Number($(lastElement).css('margin-bottom').split('px').join('')),
      border: Number($(lastElement).css('border-bottom-width').split('px').join('')),
      sum: function () { return this.offsetTop + this.height + this.border + this.margin; }
    },
    pageBottomPadding = Number($(this.content()).css('padding-bottom').split('px').join('')),
    contentHeight = pageBottomPadding + lastElementObj.sum();
  return contentHeight;
};

/**
 * Set the default paddings of a page
 * @method
 * @private
 * @return void
 */
var _setPaddings = function () {
  var that = this;
  var cm1 = Math.ceil(Number(this._display.mm2px(10)) - 1); // -1 is the dirty fix mentionned in the todo tag

  // spacings with headers
  this.spacingsWithHeaders = {
    page: {
      pTop: cm1 * 5, // will match the header outer height
      pRight: cm1,
      pBottom: cm1 * 3, // will match the footer outer height
      pLeft: cm1,
      sumHeight: function () { return this.pTop + this.pBottom; },
      sumWidth: function () { return this.pRight + this.pLeft; }
    }
  };
  // header
  this.spacingsWithHeaders.header = {
    pTop: cm1,
    mRight: this.spacingsWithHeaders.page.pRight,
    pBottom: cm1,
    mLeft: this.spacingsWithHeaders.page.pLeft,
    mBottom: Math.ceil(cm1 / 2),
    sumHeight: function () { return this.pTop + this.pBottom + this.mBottom + 1; } // 1px = border
  };
  this.spacingsWithHeaders.header.height = this.spacingsWithHeaders.page.pTop - this.spacingsWithHeaders.header.sumHeight();
  // footer
  this.spacingsWithHeaders.footer = {
    pTop: Math.ceil(cm1 / 2),
    mRight: this.spacingsWithHeaders.page.pRight,
    pBottom: Math.ceil(cm1 / 2),
    mLeft: this.spacingsWithHeaders.page.pLeft,
    mTop: Math.ceil(cm1 / 2),
    sumHeight: function () { return this.pTop + this.pBottom + this.mTop + 1; } // 1px = border
  };
  this.spacingsWithHeaders.footer.height = this.spacingsWithHeaders.page.pBottom - this.spacingsWithHeaders.footer.sumHeight();

  // spacings without headers
  this.spacingsWithoutHeaders = {
    page: {
      pTop: cm1 * 3,
      pRight: cm1,
      pBottom: cm1 * 2,
      pLeft: cm1,
      sumHeight: function () { return this.pTop + this.pBottom; },
      sumWidth: function () { return this.pRight + this.pLeft; }
    }
  };
};

module.exports = Page;
},{"../utils/page-formats":8,"./Display":2}],4:[function(require,module,exports){
/**
 * Paginator class module
 * @module classes/Paginator
 */

'use strict';

// var _ = require('lodash');
var Display = require('./Display');
var Page = require('./Page');
var parser = require('./paginator/parser');

var errors = require('./paginator/errors');
var InvalidPageRankError = errors.InvalidPageRankError;
var InvalidFocusedRangeError = errors.InvalidFocusedRangeError;
var InvalidPageHeightError = errors.InvalidPageHeightError;
var InvalidCursorPosition = errors.InvalidCursorPosition;


/**
 * Paginator is the page manager
 * @constructor
 * @param {string} pageFormatLabel The label of the paper format for all pages. For example, 'A4'
 * @param {string} pageOrientation The label of the orientation for all pages. May be 'portait' or 'landscape'
 * @param {Object} ed The editor object given by the tinymce API
 *
 * @example
 paginator = new Paginator('A4','portait', editor.getDoc());
 *
 * @see utils/page-formats
 */
function Paginator(pageFormatLabel, pageOrientation, ed) {

  /**
   * The list of pages
   * @property {Array}
   */
  this._pages = [];

  /**
   * Current editor
   * @property {Editor}
   */
  this._editor = ed;
  if (!this._editor.settings.paginate_configs) this._editor.settings.paginate_configs = function () { return null; };

  /**
   * The DOMDocument given in the constructor
   * @property {DOMDocument}
   * @private
   */
  this._document = ed.getDoc();
  /**
   * The Display to manage screen and dimensions
   * @property {Display}
   * @private
   */
  this._display = new Display(this._document);
  /**
   * The default abstract page from all real pages inherits
   * @property {Page}
   * @private
   */
  this._defaultPage = new Page(pageFormatLabel, pageOrientation, null, null, ed);
  /**
   * The body element of the full document
   * @property {Element}
   * @private
   */
  this._body = this._document.getElementsByTagName('body');

}

Paginator.prototype.destroy = function () {
  this._pages = null;
  this._editor = null;
  this._document = null;
  this._display = null;
  this._defaultPage = null;
  this._body = null;
};

/**
 * Set of the two constant values representing the `origin` or the `end` of possible ranges to focus when focusing/navigating to a page.
 * @type {object}
 * @property {string} ORIGIN equals 'ORIGIN'
 * @property {string} END equals 'END'
 */
Paginator.prototype.CURSOR_POSITION = { ORIGIN: 'ORIGIN', END: 'END' };

/**
 * Initialize the paginator. The editor and its content has to be loaded before initialize the paginator
 * @method
 * @return void
 */
Paginator.prototype.init = function () {
  var that = this;
  that._previousNodeOffsetTop = 0;

  // load or update pages
  that.initPages();

  // set document height and width based on page size
  $(that._document.body).css('min-width', that._defaultPage.getDefaultWidth());
  if (that._editor.settings.paginate_set_default_height)
    $(that._editor.iframeElement).css('height', that._defaultPage.getDefaultHeight() + this._defaultPage.MARGIN_Y * 4);

  // save initial content
  that.setInitialSnapshot();

  // remove all previous undos
  that._editor.undoManager.clear();
};

/**
 * Create new pages for paginator.
 * @method
 * @return {undefined}
 */
Paginator.prototype.initPages = function () {
  var that = this;

  function findPageWrappers() { return $('div[data-paginator-page-rank]', that._body); }

  // search the paginator page wrappers
  var wrappedPages = findPageWrappers();

  that._pages = [];

  // wrap unwrapped content
  if (!wrappedPages.length) {
    var inner = $(that._body).find("p").detach();
    _createNextPage.call(this, inner);
  } else {
    $.each(wrappedPages, function (i, el) {
      var page = new Page(that._defaultPage.format().label, that._defaultPage.orientation, i + 1, el, that._editor);
      that._pages.push(page);
    });
  }
};

/**
 * Load or create new pages for paginator.
 * @method
 * @return {undefined}
 */
Paginator.prototype.updatePages = function () {
  var _self_paginator = this,
    _tinymce_pages = _self_paginator._body.tinymce.children;

  // replace _self_paginator._pages[].content with _body.tinymce.children[]
  for (var i = 0; i < _tinymce_pages.length; i++) {
    try {
      var cp = _self_paginator.getPage(i + 1);
      cp.content(_tinymce_pages[i]);
    } catch (e) {
      // creates page if needed
      _createNexPageFromRank.call(_self_paginator, _tinymce_pages[i], i + 1);
    }
  }
  // remove pages
  _self_paginator._pages.splice(_tinymce_pages.length);

  _self_paginator.watchPage();
};

/**
 * Set an initial snapshot of the content. Should be called in #init()
 * @method
 * @return {void}
 */
Paginator.prototype.setInitialSnapshot = function () {
  this._initial_snapshot = this.currentContent();
};

/**
 * Check if the initial_snapshot has changed.
 * @method
 * @return {boolean} true if it's dirty
 */
Paginator.prototype.isDirty = function () {
  return this._initial_snapshot != this.currentContent();
};

/**
 * Returns if the paginator is empty
 * @method
 * @return {boolean} is empty
 */
Paginator.prototype.isEmpty = function () {
  var content = '';
  $.each(this.getPages(), function (i, el) { content += el.content().innerText; });
  return !content.replace(/\r?\n|\r/igm, '');
};

/**
 * Returns if the paginators content is empty
 * @method
 * @return {boolean} is empty
 */
Paginator.prototype.contentIsEmpty = function () {
  var isEmpty = true;
  $.each(this.getPages(), function (i, page) { isEmpty = page.contentIsEmpty(); });
  return isEmpty;
};

/**
 * Returns the current content.
 * @method
 * @return {string} pages content
 */
Paginator.prototype.currentContent = function () {
  var content = '';
  $.each(this.getPages(), function (i, el) {
    el = el.innerContent().text();
    if (el) content += el;
  });
  return content;
};

/**
 * Get the current page
 * @method
 * @return {Page} the current page loaded in editor
 */
Paginator.prototype.getCurrentPage = function () {
  return this.getFocusedPage();
};

/**
 * Get the focused page
 * @method
 * @return {Page} the focused page loaded in editor
 */
Paginator.prototype.getFocusedPage = function () {
  var focusedPage, focusedDiv;

  try {
    var pageRank;
    focusedDiv = _getFocusedPageDiv.call(this);
    pageRank = $(focusedDiv).attr('data-paginator-page-rank');
    focusedPage = this.getPage(pageRank);

    return focusedPage;
  } catch (err) {
    return null;
  }
};

/**
 * Get the page with the given rank
 * @method
 * @param {Number} rank The requested page rank
 * @return {Page} The requested page
 * @throws {Error}
 * @throws {InvalidPageRankError}
 */
Paginator.prototype.getPage = function (rank) {
  try {
    rank = Number(rank);
  } catch (err) {
    throw new InvalidPageRankError(rank);
  }
  if (!this._pages.length)
    throw new Error('Paginator pages length in null. Can\'t iterate on it.');

  var ret;
  var isLower = rank - 1 < 0;
  var isGreater = rank - 1 > this._pages.length;

  if (isLower || isGreater) throw new InvalidPageRankError(rank);
  else {
    $.each(this._pages, function (i, page) {
      if (page.rank === rank) ret = page;
    });
    return ret;
  }
};

/**
 * Get all pages in paginator
 * @method
 * @return {Array<Page>} all paginator pages
 */
Paginator.prototype.getPages = function () {
  return this._pages;
};

/**
 * Return the previous page
 * @method
 * @return {Page} The previous page
 */
Paginator.prototype.getPrevious = function () {
  try {
    return this.getPage(this.getCurrentPage().rank - 1);
  } catch (err) {
    return null;
  }
};

/**
 * Get the next page
 * @method
 * @return {Page} The next page
 */
Paginator.prototype.getNext = function () {
  try {
    return this.getPage(this.getCurrentPage().rank + 1);
  } catch (err) {
    return null;
  }
};

/**
 * Navigate to the given page
 * @method
 * @param {Page} toPage - The page to navigate to
 * @param {string} [cursorPosition] - The requested cursor  position to set after navigating to
 * @return void
 */
Paginator.prototype.gotoPage = function (toPage, cursorPosition) {

  /**
   * Set cursor location to the bottom of the destination page
   * @function
   * @inner
   * @return void
   */
  function focusToBottom() {

    /**
     * Get all text nodes from a given node
     * @function
     * @inner
     * @param {Node} node The parent, given node
     * @param {number} nodeType The number matching the searched node type
     * @param {array} result The result passed for recursive iteration
     */
    function getTextNodes(node, nodeType, result) {
      var children = node.childNodes;
      nodeType = nodeType ? nodeType : 3;
      result = !result ? [] : result;
      if (node.nodeType === nodeType) {
        result.push(node);
      }
      if (children) {
        for (var i = 0; i < children.length; i++) {
          result = getTextNodes(children[i], nodeType, result);
        }
      }
      return result;
    }

    // get all Textnodes from lastchild, calc length
    var content, lastChild, textNodes, lastNode, locationOffset;
    content = toPage.content();
    if (content.length) {
      lastChild = content[0].lastChild;
    } else {
      lastChild = content.lastChild;
    }
    if (lastChild) {
      textNodes = getTextNodes(lastChild);
      if (textNodes.length) {
        lastNode = textNodes[textNodes.length - 1];
        locationOffset = lastNode.textContent.length;
      } else {
        lastNode = lastChild;
        locationOffset = 0;
      }
    } else {
      lastNode = content;
      locationOffset = 0;
    }
    // set Cursor to last position
    that._editor.selection.setCursorLocation(lastNode, locationOffset);
  }

  /**
   * Set cursor location to the bottom of the destination page
   * @function
   * @inner
   * @return void
   */
  function focusToTop() {
    var content, firstNode;
    content = toPage.content();
    firstNode = content.firstChild;
    // set Cursor to last position
    that._editor.selection.setCursorLocation(firstNode, 0);
  }

  function focusToNode(node) {
    var textNode = node;
    while (true) {
      if (textNode.nodeType === 3 || !!$(textNode).attr('data-mce-bogus')) break;
      textNode = $(textNode).contents().last()[0];
    }
    that._editor.selection.setCursorLocation(textNode, textNode.textContent.length || 0);
  }

  var that = this;
  var toPageContent = this.getPage(toPage.rank).content();
  var fromPage = this.getCurrentPage();
  var fromPageContent;
  if (fromPage) {
    fromPageContent = this.getPage(fromPage.rank).content();
  }

  if (!toPage) throw new Error('Cant navigate to undefined page');

  if (toPage !== fromPage) {

    /* Do not hide pages
    $.each(this.getPages(),function(i,page){
      if (page.rank === toPage.rank) {
        $(toPageContent).css({ display:'block' });
      } else if (fromPage && page.rank === fromPage.rank) {
        $(fromPageContent).css({ display:'none' });
      } else {
        $(that.getPage(page.rank).content()).css({ display:'none' });
      }
    }); */

    // cursorPosition may be a DOM Element, `ORIGIN`, `END` or undefined
    if (typeof (cursorPosition) === 'object') {
      //console.info('focus to node',cursorPosition);
      focusToNode(cursorPosition);
    } else if (cursorPosition === this.CURSOR_POSITION.ORIGIN) {
      //console.info('focus to top');
      focusToTop();
    } else if (cursorPosition === this.CURSOR_POSITION.END) {
      //console.info('focus to bottom');
      focusToBottom();
    } else if (cursorPosition !== undefined) {
      console.error('InvalidCursorPosition');
      throw new InvalidCursorPosition(cursorPosition);
    } else {
      console.error('no valid cursor position');
      console.log(cursorPosition);
    }

    this._editor.focus();

    this._editor.dom.fire(this._editor.getDoc(), 'PageChange', {
      fromPage: fromPage,
      toPage: toPage,
      timestamp: new Date().getTime()
    });

  }

};

/**
 * Go to the page having the focus
 * @method
 * @return void
 */
Paginator.prototype.gotoFocusedPage = function () {
  var focusedPage, focusedDiv;

  try {
    var pageRank;
    focusedDiv = _getFocusedPageDiv.call(this);
    pageRank = $(focusedDiv).attr('data-paginator-page-rank');
    focusedPage = this.getPage(pageRank);
  } catch (e) {
    // if there is no focused page div, focus to the first page
    focusedPage = this.getPage(1);
    focusedDiv = focusedPage.content();
    this._editor.selection.select(focusedDiv, true);
  } finally {
    this.gotoPage(focusedPage, this.CURSOR_POSITION.END);
  }
};

/**
 * Navigate to the previous page
 * @method
 * @param {string} [cursorPosition] - The requested cursor  position to set after navigating to
 * @return {Page|null} The previous page after navigation is done, null if previous page doesn'nt exist.
 */
Paginator.prototype.gotoPrevious = function (cursorPosition) {
  var prevPage = this.getPrevious();
  cursorPosition = cursorPosition || this.CURSOR_POSITION.END;
  return (prevPage) ? this.gotoPage(prevPage, cursorPosition) : null;
};

/**
 * Navigate to the next page
 * @method
 * @param {string} [cursorPosition] - The requested cursor  position to set after navigating to
 * @return {Page|null} The next page after navigation is done, null if next page doesn'nt exist.
 */
Paginator.prototype.gotoNext = function (cursorPosition) {
  var nextPage = this.getNext();
  cursorPosition = cursorPosition || this.CURSOR_POSITION.END;
  return (nextPage) ? this.gotoPage(nextPage, cursorPosition) : null;
};

/**
 * Watch the current page, to check if content overflows the page's max-height.
 * @method
 * @return void
 * @throws {InvalidPageHeightError} if `currentHeight` fall down to zero meaning the link with DOM element is broken
 */
Paginator.prototype.watchPage = function () {
  var _nodes = [], _generalIndex = 0, _self_paginator = this, _configs = _self_paginator._editor.settings.paginate_configs();

  // 0) save bookmark and scroll positions
  var _bookmark = this._editor.selection.getBookmark();
  _self_paginator._previousBodyOffSetTop = $(_self_paginator._body).scrollTop();


  // 1) get defaultHeight from page
  var _innerHeight = _self_paginator.getPage(1).getInnerHeight();

  var _sumOfNodeHeights = 0, _iterationRank = 1, _newPageIndex = 0;
  $.each(_self_paginator.getPages(), function (i, page) {
    // 2) get all nodes inside all pages
    page.innerContent().each(function (ii, content) {
      var __margin_top = Number($(content).css('margin-top').split('px').join('')),
        __margin_bottom = Number($(content).css('margin-bottom').split('px').join('')),
        __height = $(content).outerHeight() + __margin_top;
      var __node = {
        prevPageIndex: ii,
        generalIndex: _generalIndex++,
        height: __height,
        html: $(content).detach()
      };
      _nodes.push(__node);
      // 3) evaluate when the sum of node heights extrapolate innerHeight
      // if node.height do not fit inside innerHeight, assing to next page
      if (_sumOfNodeHeights + __node.height + __margin_bottom > _innerHeight) {
        _iterationRank++;
        _newPageIndex = 0;
        _sumOfNodeHeights = 0;
      }

      // if node.height + sumOfNodeHeights fit inside innerHeight, do nothing
      __node.rank = _iterationRank;
      __node.newPageIndex = _newPageIndex++;
      _sumOfNodeHeights += __node.height;
    });
  });

  // 4) repage using nodes array
  // Iterates to the iterationRank. Creates or recycle pages.
  var _node, _currentRank = 1, _currentPage = _self_paginator.getPage(1);
  while ((_node = _nodes.shift()) !== undefined) {
    if (_currentRank !== _node.rank) {
      _currentRank = _node.rank;
      _currentPage = _self_paginator.getPage(_node.rank);
      if (!_currentPage)
        _currentPage = _createNextPage.call(_self_paginator, undefined, _node.rank > 1 ? _self_paginator.getPage(_node.rank - 1) : undefined);
    }
    // Add node back into page
    _currentPage.append(_node.html);
  }

  // 5) sanitize pages, headers and footers
  $.each(_self_paginator.getPages(), function (i, page) {
    if (!page.innerContent().length) return _self_paginator.removePage(page);
  });

  _self_paginator._editor.selection.moveToBookmark(_bookmark);
  _self_paginator.updateScrollPosition();
};

/**
 * Updates the scroll position using the current selected node.
 */
Paginator.prototype.updateScrollPosition = function () {
  var _self_paginator = this,
    _sel = _self_paginator._editor.selection.getSel().baseNode,
    _normalizedNode = _sel.nodeType === 1 ? _sel : _sel.parentNode,
    _nodeOffsetTop = _relativeOffsetTop(_normalizedNode, 'preventdelete'),
    _nodeHeight = $(_normalizedNode).outerHeight(true),
    _iframeHeight = Math.ceil($(_self_paginator._editor.iframeElement).height()),
    _bodyPrevOffsetTop = _self_paginator._previousBodyOffSetTop,
    _bodyOffsetTop = $(_self_paginator._body).scrollTop();

  // Check if node is inside the viewport
  if (_nodeOffsetTop >= _bodyPrevOffsetTop && _nodeOffsetTop + _nodeHeight < _bodyPrevOffsetTop + _iframeHeight) {
    _self_paginator._previousNodeOffsetTop = _nodeOffsetTop; // save previous position
    if (_bodyPrevOffsetTop !== _bodyOffsetTop) $(_self_paginator._body).scrollTop(_bodyPrevOffsetTop);
    return;
  }
  //var normalizer = _self_paginator._previousNodeOffsetTop >= _nodeOffsetTop ? 0 : (_iframeHeight - _nodeHeight);
  var normalizer = _nodeOffsetTop < _bodyPrevOffsetTop ? 0 : (_iframeHeight - _nodeHeight);

  // Update scroll position
  $(_self_paginator._body).scrollTop(_nodeOffsetTop - normalizer);
  _self_paginator._previousNodeOffsetTop = _nodeOffsetTop;
};

/**
 * Calculates offsetTop relative to given {stopClass}.
 * @param {HTMLElement} node element to walk on tree
 * @param {String} stopClass class in wich the element stop the recursion
 * @param {Number} height accumulated height
 * @return {Number} offsetTop relative to {stopClass}
 */
function _relativeOffsetTop(node, stopClass, height) {
  if (!node) return 0;
  if (!height) height = 0;
  height += node.offsetTop;
  if (node.className && node.className.contains(stopClass)) return height;
  return _relativeOffsetTop(node.parentNode, stopClass, height);
}

/**
 * Removes the page from paginator available pages (Custom Method).
 * @method
 * @private
 * @param {Page} page - The page to be removed.
 * @returns void
 */
Paginator.prototype.removePage = function (page) {
  var that = this;
  $.each(that.getPages(), function (i, el) {
    if (el.rank === page.rank) {
      $(page.content()).remove();
      that.getPages().splice(i, 1);
      return false;
    }
  });
};

/**
 * Get the currently focused page div
 * @method
 * @private
 * @return {Element} The parent div element having an attribute data-paginator
 * @throws InvalidFocusedRangeError
 */
var _getFocusedPageDiv = function () {
  var ret, selectedElement, parents;
  var currentRng = this._editor.selection.getRng();

  selectedElement = currentRng.startContainer;
  parents = $(selectedElement).closest('div[data-paginator="true"]');
  if (!parents.length) {
    throw new InvalidFocusedRangeError();
  } else {
    ret = parents[0];
  }

  return ret;
};

/**
 * Get the current computed padding
 * @method
 * @private
 * @return {object}
 */
var _getDocPadding = function () {
  var that = this;
  return {
    top: $(that._body).css('padding-top'),
    right: $(that._body).css('padding-right'),
    bottom: $(that._body).css('padding-bottom'),
    left: $(that._body).css('padding-left')
  };
};

/**
 * Create an empty HTML div element to wrap the futur content to fill a new page.
 * @method
 * @private
 * @param {number} pageRank The page rank to put in the attribute `data-paginator-page-rank`.
 * @returns {HTMLDivElement} The ready to fill div element.
 *
 * @todo Replace inline CSS style rules by adding an inner page CSS class. This CSS class has to be created and versionned carefully.
 */
var _createEmptyDivWrapper = function (pageRank) {
  var that = this;

  // Page structure
  var page = $('<div>').attr({
    'data-paginator': true,
    'data-paginator-page-rank': pageRank
  }).css({
    'margin': this._defaultPage.MARGIN_Y + 'px auto',
    'min-height': this._defaultPage.getInnerHeight(), // only innerHeight; paddings will be applied in setHeadersAndFooters
    'width': this._defaultPage.getInnerWidth()
  }).addClass("preventdelete");

  return page;
};

/**
 * Toggle the state of headers and footers according the settings
 * @method
 * @param {Boolean} first_invalidation define wheter is the first invalidation or not
 * @return void
 */
Paginator.prototype.toggleHeadersAndFooters = function () {
  var that = this;
  $.each(this.getPages(), function (i, page) { page.setHeadersAndFooters(); });
  that.watchPage();
};

/**
 * Create the next page with or without a content to put in, and append it to the paginator available pages.
 * @method
 * @private
 * @param {NodeList} contentNodeList The optional node list to put in the new next page.
 * @param {Page} fromPage The page reference from which desires to create the next page.
 * @returns {Page} The just created page
 */
var _createNextPage = function (contentNodeList, fromPage) {
  var currentPage = fromPage || this.getCurrentPage(),
    nextRank = currentPage ? (currentPage.rank + 1) : 1,
    divWrapper = _createEmptyDivWrapper.call(this, nextRank);
  if (contentNodeList) {
    $(contentNodeList).appendTo(divWrapper);
  }
  return _createNexPageFromRank.call(this, divWrapper[0], nextRank);
};

var _createNexPageFromRank = function (contentNodeList, nextRank) {
  var newPage = new Page(this._defaultPage.format().label, this._defaultPage.orientation, nextRank, contentNodeList, this._editor);
  this._pages.push(newPage);
  $(newPage.content()).appendTo(this._body);
  return newPage;
};

// Exports Paginator class
exports = module.exports = Paginator;

// Bind errors to the classes/paginator module.
exports.errors = errors;
},{"./Display":2,"./Page":3,"./paginator/errors":5,"./paginator/parser":6}],5:[function(require,module,exports){
/**
 * Paginator errors module
 * @module classes/paginator/errors
 * @namespace Pagiantor.errors
 */
'use strict';

/**
 * Must be thrown when trying to access a page with an invalid rank
 * @class
 * @memberof  Paginator.errors
 * @extends Error
 * @param {Number} rank The invalid page rank
 */
function InvalidPageRankError(rank){
  this.name = 'InvalidPageRankError';
  this.message = rank + ' is an invalid page rank';
  this.stack = (new Error()).stack;
}
InvalidPageRankError.prototype = Error.prototype;
InvalidPageRankError.prototype.name = 'InvalidPageRankError';

/**
 * Must be thrown when the DOM range of the text cursor is out of a paginated DOM tree.
 * @class
 * @memberof  Paginator.errors
 * @extends Error
 */
function InvalidFocusedRangeError(){
  this.name = 'InvalidFocusedRangeError';
  this.message = 'The text cursor if out of any page.';
  this.stack = (new Error()).stack;
}
InvalidFocusedRangeError.prototype = Error.prototype;
InvalidFocusedRangeError.prototype.name = 'InvalidFocusedRangeError';

/**
 * Must be thrown when the current page height doesn't match required values
 * @class
 * @memberof  Paginator.errors
 * @extends Error
 */
function InvalidPageHeightError(height){
  this.name = 'InvalidPageHeightError';
  this.message = height + 'px is an invalid page height.';
  this.stack = (new Error()).stack;
}
InvalidPageHeightError.prototype = Error.prototype;
InvalidPageHeightError.prototype.name = 'InvalidPageHeightError';

/**
 * Must be thrown when the requested cursor position doesn't match required values.
 * @class
 * @memberof  Paginator.errors
 * @extends Error
 */
function InvalidCursorPosition(requestedPosition){
  this.name = 'InvalidCursorPosition';
  this.message = requestedPosition + 'is an invalid cursor position.';
  this.stack = (new Error()).stack;
}
InvalidCursorPosition.prototype = Error.prototype;
InvalidCursorPosition.prototype.name = 'InvalidCursorPosition';

//
// export Paginator.errors namespace
//
module.exports = {
  InvalidPageRankError:InvalidPageRankError,
  InvalidFocusedRangeError:InvalidFocusedRangeError,
  InvalidPageHeightError:InvalidPageHeightError,
  InvalidCursorPosition:InvalidCursorPosition
};

},{}],6:[function(require,module,exports){
'use strict';

module.exports = {};

},{}],7:[function(require,module,exports){
'use strict';

/**
 * plugin.js
 *
 * Released under LGPL License.
 * Copyright (c) 2015 SIRAP SAS All rights reserved
 *
 * License: http://www.tinymce.com/license
 * Contributing: http://www.tinymce.com/contributing
 */

/**
 * plugin.js Tinymce plugin paginate
 * @file plugin.js
 * @module
 * @name tinycmce-plugin-paginate
 * @description Plugin for tinymce wysiwyg HTML editor that provide pagination in the editor.
 * @link https://github.com/sirap-group/tinymce-plugin-paginate
 * @author Rémi Becheras
 * @author Groupe SIRAP
 * @license GNU GPL-v2 http://www.tinymce.com/license
 * @listens tinymce.editor~event:init
 * @listens tinymce.editor~event:change
 * @listens tinymce.editor~event:SetContent
 * @listens tinymce.editor~event:NodeChange
 * @listens tinymce.editor.document~event:PageChange
 * @version 1.0.0
 */


/**
 * Tinymce library - injected by the plugin loader.
 * @external tinymce
 * @see {@link https://www.tinymce.com/docs/api/class/tinymce/|Tinymce API Reference}
 */
/*global tinymce:true */

/**
 * The jQuery plugin namespace - plugin dependency.
 * @external "jQuery.fn"
 * @see {@link http://learn.jquery.com/plugins/|jQuery Plugins}
 */
/*global jquery:true */

/**
 * Paginator class
 * @type {Paginator}
 * @global
 */
var Paginator = require('./classes/Paginator');

/**
 * Paginator ui module
 * @type {object}
 * @global
 */
var ui = require('./utils/ui');

/**
 * InvalidPageHeightError
 * @type {InvalidPageHeightError}
 * @global
 */
var InvalidPageHeightError = Paginator.errors.InvalidPageHeightError;

/**
 * Tinymce plugin paginate
 * @function
 * @global
 * @param {tinymce.Editor} editor - The injected tinymce editor.
 * @returns void
 */
function tinymcePluginPaginate(editor) {

  /**
   * Debug all useful editor events to see the order of their happen
   * @function
   * @private
   */
  function _debugEditorEvents() {
    var myevents = [];
    var mycount = {
      init: 0,
      change: 0,
      nodechange: 0,
      setcontent: 0
    };

    editor.on('init', function (evt) {
      console.log(editor);
      myevents.push({ 'init': evt });
      mycount.init++;
      console.log(myevents, mycount);
      // alert('pause after "init" event');
    });
    editor.on('change', function (evt) {
      myevents.push({ 'change': evt });
      mycount.change++;
      console.log(myevents, mycount);
      // alert('pause after "change" event');
    });
    editor.on('NodeChange', function (evt) {
      myevents.push({ 'NodeChange': evt });
      mycount.nodechange++;
      console.log(myevents, mycount);
      // alert('pause after "NodeChange" event');
    });
    editor.on('SetContent', function (evt) {
      myevents.push({ 'SetContent': evt });
      mycount.setcontent++;
      console.log(myevents, mycount);
      // alert('pause after "SetContent" event');
    });

    window.logEvents = myevents;
    window.logCount = mycount;
  }

  /**
   * On 'PageChange' event listener. Update page rank input on paginator's navigation buttons.
   * @function
   * @private
   * @param {event} evt javascript event
   */
  function onPageChange(evt) {
    ui.updatePageRankInput(evt.toPage.rank);
    editor.nodeChanged();
  }

  /**
   * on 'RemoveEditor' event listener.
   * @function
   * @private
   * @param {event} evt javascript event
   */
  function onRemoveEditor(evt) {
    ui.removeNavigationButtons();
    paginator.destroy();
    watchPageIterationsCount = 0;
    paginatorListens = false;
  }

  /**
   * Whatches any know keydown event that matters.
   * @function
   * @private
   * @param {event} evt - Javascript event
   * @returns void
   */
  function checkPreventDelete(evt) {
    /* Checks the container height */
    function _isEmpty(innerHTML) {
      return (innerHTML.replace(/\r?\n|\r/igm, '').length === 0);
    }

    function _getInnerText(el) {
      return el.innerText.replace(/\r?\n|\r/igm, '');
    }

    function _isPageEmpty(page) {
      return _getPageContent(page).length === 0;
    }

    function _getPageContent(page) {
      return $(page).children(':not(.pageFooter):not(.pageHeader)');
    }

    function _setCursor(elem, offset) {
      editor.selection.setCursorLocation(elem.childNodes[0], offset);
    }

    var _node = editor.selection.getNode(),
      _page = (_node.nodeName !== 'BODY') ? $(_node).closest('div[data-paginator="true"]')[0] : $(_node.firstChild),
      _sel = editor.selection.getSel(),
      _range = _sel.type === 'Range' ? editor.selection.getRng() : null;

    /**
     * Mannually sanitizes editor. Deals with ranged selections.
     * @param {boolean} pd prevent default action
     */
    function _sanitizeWithRange(pd) {
      // Remove only allowed Nodes in this range selection
      if (_sel.type !== 'Range' && !editor.plugins.paginate.isEmpty() && _node.nodeName !== 'BODY') return;
      if (!_range) return;

      // if selection is text, only returns
      if (_range.commonAncestorContainer.nodeType === 3) return;

      // prevent default action
      if (pd) {
        evt.preventDefault();
        evt.stopPropagation();
      }
      /* Proceed with delete and remove node if range is empty */
      // Select all nodes inside this selection
      var _nodeIterator = document.createTreeWalker(
        _range.commonAncestorContainer,
        NodeFilter.SHOW_ALL,
        {
          acceptNode: function (node) {
            if (node.className && node.className.contains('page'))
              return NodeFilter.FILTER_REJECT;
            if (node.className && node.className.contains('preventdelete'))
              return NodeFilter.FILTER_SKIP;
            if ($(node).closest('.preventdelete').length && node.nodeType === 1 && node.tagName !== 'BR')
              return NodeFilter.FILTER_ACCEPT;
            return NodeFilter.FILTER_SKIP;
          }
        }
      );
      // initialize variables for node removals
      var _marked = false, _nodeList = [],
        normalizedStart = _range.startContainer.nodeType === 3 ? _range.startContainer.parentNode : _range.startContainer,
        _normalizedEnd = _range.endContainer.nodeType === 3 ? _range.endContainer.parentNode : _range.endContainer;
      while (_nodeIterator.nextNode()) {
        if (!_marked) {
          if (_nodeIterator.currentNode !== normalizedStart) continue;
          _marked = true;
        }
        if (_nodeList.length > 1) _nodeList.pop().remove();
        _nodeList.push(_nodeIterator.currentNode);
        if (_nodeIterator.currentNode === _normalizedEnd) break;
      }
      // remove first and last nodeIt using offset
      var _firstNode = _nodeList.shift();
      _firstNode.innerText = _getInnerText(_firstNode).substr(0, _range.startOffset);
      var _firstOffset = _getInnerText(_firstNode).length;
      var _lastNode = _nodeList.pop();
      if (_range.endOffset < _getInnerText(_normalizedEnd).length) {
        _lastNode.innerText = (_getInnerText(_lastNode).length > 0 && _getInnerText(_lastNode).substr(_range.endOffset)) || '';
        // merge first and last
        _firstNode.innerText += _getInnerText(_lastNode);
      }
      _lastNode.remove();
      // append BR in case nothing left
      if (_firstNode.children.length === 0) _firstNode.appendChild(document.createElement('br'));

      // sets the cursor to the middle of mixed texts
      _setCursor(_firstNode, _firstOffset);

      /* Check paginator status */
      paginator.watchPage();
      if (pd) editor.save();
      return;
    }

    /**
     * Mannually sanitizes editor. Deals with caret selections.
     * @param {number} direction 1 for upwards (↑), 2 for downwards (↓)
     * @param {boolean} removing true for deleting (backspace/delete), false for arrowkeys
     * @param {boolean} walking true if cursor is walikng right (→) or left (←)
     */
    function _sanitizeWithoutRange(direction, removing, walking) {
      if (direction < 0) return;

      var _siblingPage, _pageContent, _isBoundary,
        _normalizedNode = _sel.baseNode.nodeType === 3 ? _sel.baseNode.parentNode : _sel.baseNode, _pd = false;

      // check if cursor is in a boundary element of the page
      function _isInBoundary(nodeSibling) {
        if (nodeSibling) return nodeSibling.className.contains('page') ? true : false;
        return true;
      }

      // Move cursor
      function _moveCursor() {
        // If I'm walking perpendicular
        // and going upwards (↑)
        if (direction === 1) {
          // sets the cursor to the ending of the last node of siblingPage
          var normalizedOffset = _getInnerText(_siblingPageContent[_siblingPageContent.length - 1]).length - 1;
          normalizedOffset = Math.max(_normalizedNode, 0);
          _setCursor(_siblingPageContent[_siblingPageContent.length - 1], normalizedOffset);
          return _preventDelete(true);
        }
        // and going downwards (↓)
        if (direction === 2) {
          // sets the cursor to the beginning of the first node of siblingPage
          _setCursor(_siblingPageContent[0], 0);
          return _preventDelete(true);
        }
      }

      // stop default actions
      function _preventDelete(pd) {
        if (!pd) return;
        evt.preventDefault();
        evt.stopPropagation();
      }

      // 0) check if we are in the page boundary
      // if the direction is upwards (↑)
      if (direction === 1) _isBoundary = _isInBoundary(_normalizedNode.previousElementSibling);
      // or the direction is donwards (↓)
      else if (direction === 2) _isBoundary = _isInBoundary(_normalizedNode.nextElementSibling);

      // if not on page boundary, 
      if (!_isBoundary) {
        // and I'm removing: let it be
        if (removing) return _preventDelete(false);
        // and I'm walking
        if (walking) {
          // and I'm going upwards and cursor is in position 0
          // move cursor to previous element
          if (direction === 1 && _sel.baseOffset === 0) {
            var normalizedOffset = _getInnerText(_normalizedNode.previousElementSibling).length - 1;
            normalizedOffset = Math.max(normalizedOffset, 0);
            _setCursor(_normalizedNode.previousElementSibling, normalizedOffset);
            _pd = true;
            // and I'm going downwards and cursor is in position length-1
            // move cursor to next element
          } else if (direction === 2 && _getInnerText(_normalizedNode).length === _sel.baseOffset) {
            _setCursor(_normalizedNode.nextElementSibling, 0);
            _pd = true;
          }
        }
        // nothing to do at all
        paginator.updateScrollPosition();
        return _preventDelete(_pd);
      }

      // 1) get the sibling upwards or donwards page
      // if the direction is upwards (↑)
      if (direction === 1) _siblingPage = _page.previousElementSibling;
      // or the direction is donwards (↓)
      else if (direction === 2) _siblingPage = _page.nextElementSibling;

      // if there'snt siblingPage
      if (!_siblingPage) {
        _pageContent = _getPageContent(_page);
        if (direction === 1) {
          // and I'm in the first element of the page
          // nothing to do, only prevent default action
          if (_pageContent[0] === _normalizedNode && _sel.focusOffset === 0)
            return _preventDelete(true);
        } else if (direction === 2) {
          // and I'm in the last element of the page
          // nothing to do, only prevent default action
          if (_pageContent[_pageContent.length - 1] === _normalizedNode && _getInnerText(_pageContent[_pageContent.length - 1]).length === _sel.baseOffset)
            return _preventDelete(true);
        }
        return _preventDelete(false);
      }
      var _siblingPageContent = _getPageContent(_siblingPage);

      // 2) select the pageContent content using parameters
      // if is removing
      if (removing) {
        _pageContent = _getPageContent(_page);
        // and the direction is upwards (↑),
        // I need the content of the current page
        if (direction === 1) {
          if (_sel.focusOffset === 0) {
            // and there's only a child within page content
            // remove P from escaping page
            if (_pageContent[0] === _normalizedNode) {
              _siblingPageContent[_siblingPageContent.length - 1].innerText += _getInnerText(_pageContent[0]);
              _pageContent[0].remove();
              paginator.watchPage();
              _setCursor(_siblingPageContent[_siblingPageContent.length - 1], _getInnerText(_siblingPageContent[_siblingPageContent.length - 1]).length);
              return _preventDelete(true);
            }
          }
        } else
          // and the direction is donwards (↓),
          // I need the content of the sibling page
          if (direction === 2) {
            if (_getInnerText(_normalizedNode).length === _sel.baseOffset) {
              // and there's only a child within page content
              // remove P from escaping page
              if (_pageContent[_pageContent.length - 1] === _normalizedNode) {
                _pageContent[_pageContent.length - 1].innerText += _getInnerText(_siblingPageContent[0]);
                _siblingPageContent[0].remove();
                paginator.watchPage();
                _setCursor(_pageContent[_pageContent.length - 1], _getInnerText(_pageContent[_pageContent.length - 1]).length);
                return _preventDelete(true);
              }
            }
          }

        return _preventDelete(false);
      }

      // 3) if isn't removing, I need to walk the cursor
      // but if I'm walking sideways
      // I'll walk only if hit the end or beginning
      if (walking) {
        _pageContent = _getPageContent(_page);
        _pd = false;
        // if I'm going left and I'm in the offset 0
        if (direction === 1 && _sel.baseOffset === 0) {
          // sets the cursor to the ending of the last node of siblingPage
          _setCursor(_siblingPageContent[_siblingPageContent.length - 1], _getInnerText(_siblingPageContent[_siblingPageContent.length - 1]).length);
          _pd = true;
        }
        // if I'm going right and I'm in the offset is equal to the element text length
        if (direction === 2 && _sel.baseOffset >= _getInnerText(_pageContent[0]).length - 1) {
          // sets the cursor to the beginning of the first node of siblingPage
          _setCursor(_siblingPageContent[0], 0);
          _pd = true;
        }
        // just walk
        paginator.updateScrollPosition();
        return _preventDelete(_pd);
      }
      // If I'm walking perpendicular
      // and going upwards (↑)
      _moveCursor();
    }

    /* If delete keys pressed */
    var direction = 0;
    switch (evt.keyCode) {
      case 37: // arrow ←
      case 38: // arrow ↑ 
        direction = 1; // (↑)
        /* falls through */
      case 39: // arrow →
      case 40: // arrow ↓
        if (!direction) direction = 2; // (↓)
        /* falls through */
      case 8: // backspace
        // set direction upwards
        if (!direction) direction = 1; // (↑)
        /* falls through */
      case 46: // delete
        if (!direction) direction = 2; // (↓)
        // if range exists and there isn't Ctrl pressed 
        // prevent delete and backspace actions
        if (!evt.ctrlKey) {
          if (_range) _sanitizeWithRange(true);
          else _sanitizeWithoutRange(direction,
            evt.keyCode === 8 || evt.keyCode === 46, // is removing
            evt.keyCode === 37 || evt.keyCode === 39); // walking sideways with cursor
          break;
        }
        /* falls through */
      case 86: // V
      case 88: // X
        if (evt.ctrlKey) _sanitizeWithRange(true);
        break;
      case 27: // esc
        if (editor.plugins.fullscreen.isFullscreen())
          editor.execCommand('mceFullScreen');
        break;
      case 13:
        setTimeout(function () {
          paginator.watchPage();
        }, 0);
        /* falls through */
      default:
        if (!evt.ctrlKey) {
          var valid =
            (evt.keyCode > 47 && evt.keyCode < 58) || // number keys
            evt.keyCode == 32 || evt.keyCode == 13 || // spacebar & return key(s) (if you want to allow carriage returns)
            (evt.keyCode > 64 && evt.keyCode < 91) || // letter keys
            (evt.keyCode > 95 && evt.keyCode < 112) || // numpad keys
            (evt.keyCode > 185 && evt.keyCode < 193) || // ;=,-./` (in order)
            (evt.keyCode > 218 && evt.keyCode < 223); // [\]' (in order)
          if (valid) _sanitizeWithRange(false);
        }
    }
  }

  /**
   * A 'Paginator' object to handle all paginating behaviors.
   * @var {Paginator} paginator
   * @global
   */
  var paginator;

  /**
   * A 'Display' object to handle graphics behaviors for the paginator needs.
   * @var {Display} display
   * @global
   */
  var display;

  /**
   * Is set to true when paginator is initialized.
   * @var {Boolean} paginatorListens
   * @global
   */
  var paginatorListens = false;

  /**
   * Count of the iterations of watchPage() calls triggered by thrown of `InvalidPageHeightError`. This is a temporary bugfix
   * @var {integer}
   * @global
   */
  var watchPageIterationsCount = 0;

  /**
   * The watch of active page is enabled if this var is true
   * @var
   * @global
   */
  var watchPageEnabled = false;

  // _debugEditorEvents();

  /**
   * Plugin method that disable the wath of page (to allow edition of extenal elements like headers and footers)
   * @method
   * @returns void
   */
  this.disableWatchPage = function () { // jshint ignore:line
    watchPageEnabled = false;
  };
  /**
   * Plugin method that enable the wath of page (after used this#disableWatchPage())
   * @method
   * @returns void
   */
  this.enableWatchPage = function () { // jshint ignore:line
    watchPageEnabled = true;
  };

  /**
   * Get the current page
   * @returns {Page} the paginator current page.
   */
  this.getCurrentPage = function () { // jshint ignore:line
    return paginator.getCurrentPage();
  };

  /**
   * Returns if the editor is empty
   * @returns {boolean} is empty
   */
  this.isEmpty = function () { // jshint ignore:line
    return paginator.isEmpty();
  };

  /**
   * Returns if the editor is dirty
   * @returns {boolean} is dirty
   */
  this.isDirty = function () { // jshint ignore:line
    return paginator.isDirty();
  };

  /**
   * Returns if the editors content is empty
   * @returns {boolean} is empty
   */
  this.contentIsEmpty = function () { // jshint ignore:line
    return paginator.contentIsEmpty();
  };

  editor.once('init', function () {
    paginator = new Paginator('A4', 'portrait', editor);
    editor.dom.bind(editor.getDoc(), 'PageChange', onPageChange);
    editor.shortcuts.remove('meta+a'); /* Enable native CTRL + A shortcut */
    paginator.init();
    paginatorListens = true;
    watchPageEnabled = true;
    paginator.gotoFocusedPage();
    if (editor.settings.paginate_navigation_buttons) ui.appendNavigationButtons(paginator);
  });

  editor.on('remove', onRemoveEditor);

  /**
   * On editor change
   * Checks if debounce time is bigger then last changed time.
   * This debounce saves a lot processing.
   */
  var _change_debouce = 500, _prev_debounce = Date.now();
  editor.on('change', function (evt) {
    evt.preventDefault();
    var newContent, beforeContent;
    if (!paginatorListens || !watchPageEnabled) return;
    if (_prev_debounce + _change_debouce > Date.now()) return;
    _prev_debounce = Date.now();
    paginator.watchPage();
  });

  editor.on('keydown', function (evt) {
    checkPreventDelete(evt);
  });

  editor.on('SetContent', function (args) {
    if (paginator) paginator.updatePages();
  });

  editor.on('toggleCabecalhoRodape', function (evt) {
    paginator.toggleHeadersAndFooters();
  });

  editor.on('toggleMargin', function (evt) {
    paginator.toggleHeadersAndFooters();
  });
}

// Add the plugin to the tinymce PluginManager
tinymce.PluginManager.add('paginate', tinymcePluginPaginate);
},{"./classes/Paginator":4,"./utils/ui":9}],8:[function(require,module,exports){
/**
 * page-formats module
 * @module utils/page-formats
 * @type array<Format>
 * @description When required, this module exports an array of formats supported by the application
 */

'use strict';

/**
 * Define a page format
 * @constructor
 * @param {string} label The format's label
 * @param {number} long The format's long dimension in milimeters
 * @param {number} short The format's short dimension in milimeters
 */
function Format(label,long,short){
  this.label = label;
  this.long = long;
  this.short = short;
}

/**
 * Register the only formats supported now by the application
 * @var supportedFormats
 * @global
 *
 * @todo this should be a plugin parameter defined in the setup function of the editor
 */
var supportedFormats = {
  'A4': {
    long: '297',
    short: '210'
  }
};

var exp = [];
$.each(supportedFormats,function(label,format){
  exp[label] = new Format(label, format.long, format.short);
});


module.exports = exp;

},{}],9:[function(require,module,exports){
/**
 * ui module provide ui functions
 * @module utils/ui
 */

'use strict';

/**
 * Append "previous page" and "next page" navigation buttons
 * @function appendNavigationButtons
 * @static
 * @param {Paginator} paginator The instancied paginator binded to the matched editor.
 * @returns void
 */
exports.appendNavigationButtons = function(paginator){

  /**
   * Validate input page rank and request a page change if input is valid
   * @callback
   * @param {Event} evt The change callback event
   * @returns void
   */
  function onInputRankChanges(evt){
    var toPage;
    var rank = evt.target.valueAsNumber;
    var actualRank = paginator.getCurrentPage().rank;
    if (rank !== actualRank) {
      try {
        toPage = paginator.getPage(rank);
        paginator.gotoPage(toPage);
      } catch (e) {
        if (e instanceof require('../classes/paginator/errors').InvalidPageRankError) {
          window.alert('Il n\'y a pas de page #'+rank);
          console.log($(this));
          $(this).val(actualRank);
        } else throw e;
      }
    }
  }

  var navbar;
  var navbarElements = {};

  var body = $('body');
  var btnSelector = '<a></a>';
  var btnCommonClasses = 'btn glyphicon';
  var btnCommonStyles = {
    'background': 'whitesmoke',
    'width':'100%',
    'top':'0'
  };

  // Create a div vertical wrapper to append nav elements into
  navbar = $('<div></div>')
  .attr('id','paginator-navbar')
  .css({
    'width': '60px',
    'position': 'absolute',
    'top': (window.screen.height/2 -35)+'px',
    'right': '40px',
    'z-index': '999'
  }).appendTo(body);

  // navigate to previous page
  navbarElements.btnPrevious = $(btnSelector)
    .attr('href','#')
    .attr('title','Previous page')
    .css($.extend(btnCommonStyles,{
      'border-top-left-radius': '25%',
      'border-top-right-radius': '25%',
      'border-bottom-left-radius': '0',
      'border-bottom-right-radius': '0'
    }))
    .addClass(btnCommonClasses + ' glyphicon-chevron-up')
    .click(function(){
      paginator.gotoPrevious();
      return false;
    })
    .appendTo(navbar)
  ;

  // input to show and control current page
  navbarElements.inputRank = $('<input></input>')
    .attr('type','number').attr('id','input-rank')
    .css({ 'width': '100%', 'line-height': '30px', 'text-align': 'center' })
    .change(onInputRankChanges).appendTo(navbar)
  ;

  setTimeout(function(){
    navbarElements.inputRank.val(paginator.getCurrentPage().rank);
  },500);

  // navigate to next page
  navbarElements.btnNext = $(btnSelector)
    .attr('href','#')
    .attr('title','Next page')
    .css($.extend(btnCommonStyles,{
      'width': '100%',
      'border-top-left-radius': '0',
      'border-top-right-radius': '0',
      'border-bottom-left-radius': '25%',
      'border-bottom-right-radius': '25%'
    }))
    .addClass(btnCommonClasses + ' glyphicon-chevron-down')
    .click(function(){
      paginator.gotoNext();
      return false;
    })
    .appendTo(navbar)
  ;
};

/**
 * Remove navigation buttons
 * @function
 * @static
 */
exports.removeNavigationButtons = function(){
  $('#paginator-navbar').remove();
};

exports.updatePageRankInput = function(rank){
  $('#input-rank').val(rank);
};

},{"../classes/paginator/errors":5}]},{},[1]);
