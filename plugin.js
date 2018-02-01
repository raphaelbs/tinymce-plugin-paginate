(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

/* jshint node: true */

require('./src/main');

},{"./src/main":8}],2:[function(require,module,exports){
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
  /**
   * @property {Node}
   */
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

  var cm1 = Math.ceil(Number(this._display.mm2px(10)) - 1); // -1 is the dirty fix mentionned in the todo tag

  /**
   * Spacings with headers
   * @property {SpacingsWithHeaders}
   */
  this.spacingsWithHeaders = {
    page: {
      pTop: cm1 * 2.9, // will match the header outer height
      pRight: cm1,
      pBottom: cm1 * 2.2, // will match the footer outer height
      pLeft: cm1,
      sumHeight: function () { return this.pTop + this.pBottom; },
      sumWidth: function () { return this.pRight + this.pLeft; }
    }
  };
  // header
  this.spacingsWithHeaders.header = {
    pTop: Math.ceil(cm1 / 2.2),
    pBottom: Math.ceil(cm1 / 2.2),
    mBottom: Math.ceil(cm1 / 2),
    mRight: this.spacingsWithHeaders.page.pRight,
    mLeft: this.spacingsWithHeaders.page.pLeft,
    sumHeight: function () { return this.pTop + this.pBottom + this.mBottom + 1; } // 1px = border
  };
  this.spacingsWithHeaders.header.height = this.spacingsWithHeaders.page.pTop - this.spacingsWithHeaders.header.sumHeight();
  // addinfo
  this.spacingsWithHeaders.addInfo = {
    height: this.spacingsWithHeaders.header.height + cm1 * 1.7
  };
  // footer
  this.spacingsWithHeaders.footer = {
    pTop: Math.ceil(cm1 / 3),
    mRight: this.spacingsWithHeaders.page.pRight,
    pBottom: Math.ceil(cm1 / 2),
    mLeft: this.spacingsWithHeaders.page.pLeft,
    mTop: Math.ceil(cm1 / 2),
    sumHeight: function () { return this.pTop + this.pBottom + this.mTop + 1; } // 1px = border
  };
  this.spacingsWithHeaders.footer.height = this.spacingsWithHeaders.page.pBottom - this.spacingsWithHeaders.footer.sumHeight();

  /**
   * Spacings without headers
   * @property {SpacingsWithoutHeaders}
   */
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
 * @return {DOMElement|undefined} The page div Element to return in getter usage
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
 * @return {DOMElement|undefined} The page div Element to return in getter usage
 */
Page.prototype.innerContent = function () {
  if (this._content) {
    return $(this._content).children(':not(.pageFooter):not(.pageHeader):not(.pageAddData)');
  }
};

/**
 * Set headers and footers according to settings
 * @method
 * @param {Boolean} firstHeaderAndFooter mannual control over the first initilization
 * @return {undefined}
 */
Page.prototype.setHeadersAndFooters = function () {
  var that = this;
  var configs = that._editor.settings.paginate_configs();
  if (!configs) return;

  var spacingsWithHeaders = that.spacingsWithHeaders;
  var spacingsWithoutHeaders = that.spacingsWithoutHeaders;
  var cm1 = Math.ceil(Number(this._display.mm2px(10)) - 1); // -1 is the dirty fix mentionned in the todo tag

  // remove header and footer
  var removed = $(that._content).find('.pageHeader,.pageFooter,.pageAddData').remove();
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
    minHeight: Math.floor(that.getInnerHeight())
  };

  var headerAndFooterEnabled = configs.possuiCabecalhoRodape || (removed.length > 0 && configs.headerHtml && configs.possuiCabecalhoRodape !== false);
  var headerAdditionalData = configs.possuiDadosPaciente;

  // Header, with margins enabled
  var header = document.createElement('div');
  header.className = 'pageHeader';
  header.contentEditable = false;
  header.onmousedown = cancelDrag;
  header.style.width = $(that._content).width() + 'px';
  header.style.height = Math.ceil(spacing.top - cm1 / 2) + 'px';
  header.style.marginRight = spacingsWithHeaders.header.mRight + 'px';
  header.style.marginLeft = spacingsWithHeaders.header.mLeft + 'px';
  /* header style */
  header.style.position = 'absolute';
  header.style.top = 0;
  header.style.left = 0;
  header.style.borderBottom = '1px dashed #ddd';
  header.style.color = '#8d8e90';
  disableSelection(header);

  // AddData
  var addData = document.createElement('div');
  addData.className = 'pageAddData';
  addData.contentEditable = false;
  addData.onmousedown = cancelDrag;
  addData.style.width = $(that._content).width() + 'px';
  addData.style.height = spacingsWithHeaders.addInfo.height + 'px';
  addData.style.marginRight = spacingsWithHeaders.header.mRight + 'px';
  addData.style.marginLeft = spacingsWithHeaders.header.mLeft + 'px';
  /* AddData style */
  addData.style.position = 'absolute';
  addData.style.top = (spacing.top - cm1 / 2) + 'px';
  addData.style.left = 0;
  addData.style.borderBottom = '1px solid #ddd';
  addData.style.color = '#8d8e90';
  disableSelection(addData);

  // Footer, with margins enabled
  var footer = document.createElement('div');
  footer.className = 'pageFooter';
  footer.contentEditable = false;
  footer.onmousedown = cancelDrag;
  footer.style.width = $(that._content).width() + 'px';
  footer.style.height = Math.ceil(spacing.bottom - cm1 / 2) + 'px';
  footer.style.marginRight = spacingsWithHeaders.footer.mRight + 'px';
  footer.style.marginLeft = spacingsWithHeaders.footer.mLeft + 'px';
  /* footer style */
  footer.style.position = 'absolute';
  footer.style.bottom = 0;
  footer.style.left = 0;
  footer.style.borderTop = '1px dashed #ddd';
  footer.style.color = '#8d8e90';
  disableSelection(footer);

  // Headers and footers Enabled
  if (headerAndFooterEnabled) {
    // Header, with headers and footers enabled
    $(header).addClass('large'); // IE 9 throws error if not using jQuery

    // Set new header style
    header.style.height = spacingsWithHeaders.header.height + 'px';
    header.style.paddingTop = spacingsWithHeaders.header.pTop + 'px';
    header.style.paddingBottom = spacingsWithHeaders.header.pBottom + 'px';
    header.style.borderBottom = '1px solid #ddd';

    // Set new addData style
    addData.style.top = (spacingsWithHeaders.header.height + spacingsWithHeaders.header.pTop + spacingsWithHeaders.header.pBottom) + 'px';

    // Footer, with headers and footers enabled
    $(footer).addClass('large'); // IE 9 throws error if not using jQuery
    footer.style.height = spacingsWithHeaders.footer.height + 'px';
    footer.style.paddingTop = spacingsWithHeaders.footer.pTop + 'px';
    footer.style.paddingBottom = spacingsWithHeaders.footer.pBottom + 'px';
    footer.style.borderTop = '1px solid #ddd';

    // spacing, with headers and footers enabled
    spacing.top = spacingsWithHeaders.page.pTop;
    spacing.right = spacingsWithHeaders.page.pRight;
    spacing.bottom = spacingsWithHeaders.page.pBottom;
    spacing.left = spacingsWithHeaders.page.pLeft;
  }

  // Addional data Enabled
  if (headerAdditionalData) {
    spacing.top += spacingsWithHeaders.addInfo.height;
  }
  
  insertHeaderData(header, headerAndFooterEnabled);
  insertFooterData(footer, headerAndFooterEnabled);
  insertAddData(addData, headerAdditionalData);

  $(that._content)
    .css({
      'padding-top': spacing.top + 'px ',
      'padding-right': spacing.right + 'px ',
      'padding-bottom': spacing.bottom + 'px ',
      'padding-left': spacing.left + 'px',
      'height': spacing.minHeight + 'px',
      'min-height': spacing.minHeight + 'px',
      'max-height': spacing.minHeight + 'px'
    })
    .prepend(header)
    .append(footer);

  if(headerAdditionalData) $(header).before(addData);

  /**
   * Disable mouse selection for header and footer.
   * @ignore
   * @param {HTMLElement} el should be header and footer elements
   * @return {undefined}
   */
  function disableSelection(el) {
    el.onselectstart=function(){return false;};
    $(el).css({
      '-webkit-touch-callout': 'none', /* iOS Safari */
      '-webkit-user-select': 'none', /* Safari */
      '-khtml-user-select': 'none', /* Konqueror HTML */
      '-moz-user-select': 'none', /* Firefox */
      '-ms-user-select': 'none', /* Internet Explorer/Edge */
      'user-select': 'none', /* Non-prefixed version, currently supported by Chrome and Opera */
    });
  }

  /**
   * Insert HTML content into header DOM element.
   * @ignore
   * @param {HTMLElement} header virtual header DOM element
   * @return {undefined}
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
   * @ignore
   * @param {HTMLElement} footer virtual header DOM element
   * @return {undefined}
   */
  function insertFooterData(footer, headerAndFooterEnabled) {
    var _configs = that._editor.settings.paginate_configs();
    if (_configs && _configs.footerHtml) {
      if (typeof _configs.footerHtml !== 'function') throw Error('[tinymce~paginate] configuration "paginate_configs.footerHtml" should be [function] but is [' + typeof _configs.footerHtml + ']');
      _configs.footerHtml(footer, headerAndFooterEnabled, that.rank);
    }
  }
  /**
   * Insert HTML content into header DOM element.
   * @ignore
   * @param {HTMLElement} addData virtual header DOM element
   * @return {undefined}
   */
  function insertAddData(addData, headerAdditionalData) {
    var _configs = that._editor.settings.paginate_configs();
    if (_configs && _configs.addInfoHtml) {
      if (typeof _configs.addInfoHtml !== 'function') throw Error('[tinymce~paginate] configuration "paginate_configs.addInfoHtml" should be [function] but is [' + typeof _configs.addInfoHtml + ']');
      _configs.addInfoHtml(addData, headerAdditionalData, that.rank);
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
  return content === 0;
};

/**
 * Clean all content from this page
 * @method
 * @return {undefined}
 */
Page.prototype.clean = function () {
  if (this._content) {
    var headersAndFooters = $(this._content).find('.pageFooter,.pageHeader,.pageAddData').detach();
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
  return Math.ceil(defaultHeightInPx - 5); // -1 is the dirty fix mentionned in the todo tag
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
  if (configs.possuiDadosPaciente) paddings += this.spacingsWithHeaders.addInfo.height;
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

module.exports = Page;
},{"../utils/page-formats":9,"./Display":2}],4:[function(require,module,exports){
/**
 * Paginator class module
 * @module classes/Paginator
 */

'use strict';

// var _ = require('lodash');
var Display = require('./Display');
var Page = require('./Page');
var parser = require('./paginator/parser');
var WatchPage = require('./WatchPage');

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
  /**
   * Previous body's scroll offset. 
   * @property {Number}
   * @private
   */
  this._previousBodyOffSetTop = 0;
  /**
   * 
   * @property {Bookmark}
   * @private
   */
  this._previousBookmark = null;
  /*
   * Saves previous node before undo and redo.
   * This node is used to scroll correctly after this operations.
   */
  var that = this;
  this._editor.on('BeforeExecCommand', function (e) {
    var cmd = e.command;

    if (cmd === 'undo' || cmd === 'redo') {
      that._previousBookmark =  that._editor.selection.getBookmark(2, true);
    }
  });

  /**
   * Instanciate WatchPage class
   */
  this._watchPage = new WatchPage(this);
}

Paginator.prototype.destroy = function () {
  this._pages = null;
  this._editor = null;
  this._document = null;
  this._display = null;
  this._defaultPage = null;
  this._body = null;
  this._watchPage = null;
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
 * @return {undefined}
 */
Paginator.prototype.init = function () {
  var that = this;
  that._previousNodeOffsetTop = 0;

  // load or update pages
  that.initPages();

  // set document height and width based on page size
  $(that._document.body).css('min-width', that._defaultPage.getDefaultWidth());
  if (that._editor.settings.paginate_set_default_height){
    $(that._editor.iframeElement).css('height', that._defaultPage.getDefaultHeight() + this._defaultPage.MARGIN_Y * 4);
  }

  // save initial content
  that.setInitialSnapshot();

  // remove all previous undos
  that._editor.undoManager.clear();

  // Is watching page
  that._isWatchingPage = false;
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
 * Create the next page with or without a content to put in, and append it to the paginator available pages.
 * @method
 * @private
 * @param {NodeList} contentNodeList The optional node list to put in the new next page.
 * @param {Page} fromPage The page reference from which desires to create the next page.
 * @returns {Page} The just created page
 */
Paginator.prototype.createNextPage = function (contentNodeList, fromPage) {
  var currentPage = fromPage || this.getCurrentPage(),
    nextRank = currentPage ? (currentPage.rank + 1) : 1,
    divWrapper = _createEmptyDivWrapper.call(this, nextRank);
  if (contentNodeList) {
    $(contentNodeList).appendTo(divWrapper);
  }
  return _createNexPageFromRank.call(this, divWrapper[0], nextRank);
};

/**
 * Returns the current content.
 * @method
 * @return {string} pages content
 */
Paginator.prototype.currentContent = function () {
  var content = '';
  $.each(this.getPages(), function (i, el) {
    var d = $('<div>').html(el.innerContent().clone());
    el = d.html();
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
 * Go to the page having the focus
 * @method
 * @return {undefined}
 */
Paginator.prototype.gotoBeginning = function () {
  var focusedPage, focusedDiv;

  try {
    var pageRank;
    focusedDiv = _getFocusedPageDiv.call(this);
    pageRank = $(focusedDiv).attr('data-paginator-page-rank');
    focusedPage = this.getPage(pageRank);
  } catch (e) {
    // if there is no focused page div, focus to the first page
    focusedPage = this.getPage(1);
  } finally {
    this.gotoPage(focusedPage, this.CURSOR_POSITION.END);
  }
};

/**
 * Go to the page having the focus
 * @method
 * @return {undefined}
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
 * Navigate to the given page
 * @method
 * @param {Page} toPage - The page to navigate to
 * @param {string} [cursorPosition] - The requested cursor  position to set after navigating to
 * @return {undefined}
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
    that.createNextPage(inner);
  } else {
    $.each(wrappedPages, function (i, el) {
      var page = new Page(that._defaultPage.format().label, that._defaultPage.orientation, i + 1, el, that._editor);
      that._pages.push(page);
    });
  }
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
 * Check whether the page is beeing watched or not.
 * @method
 * @return {undefined}
 */
Paginator.prototype.isWatchingPage = function (){
  return this._isWatchingPage;
};

/**
 * Removes the page from paginator available pages (Custom Method).
 * @method
 * @param {Page} page - The page to be removed.
 * @returns {undefined}
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
 * Saves scroll position relative to the body of tinymce's iframe.
 * @method
 * @return {undefined}
 */
Paginator.prototype.saveScrollPosition = function (){
  this._previousBodyOffSetTop = this._document.documentElement.scrollTop;
  this._previousBodyOffSetLeft = this._document.documentElement.scrollLeft;
};

/**
 * Set an initial snapshot of the content. Should be called in #init()
 * @method
 * @return {undefined}
 */
Paginator.prototype.setInitialSnapshot = function () {
  this._initial_snapshot = this.currentContent();
};

/**
 * Toggle the state of headers and footers according the settings
 * @method
 * @return {undefined}
 */
Paginator.prototype.toggleHeadersAndFooters = function () {
  var that = this;
  $.each(this.getPages(), function (i, page) { page.setHeadersAndFooters(); });
  that.watchPage();
};

/**
 * Toggle additional data in the header of all pages.
 * @method
 * @return {undefined}
 */
Paginator.prototype.toggleHeaderAdditionalData = function () {
  var that = this;
  $.each(this.getPages(), function (i, page) { page.setHeadersAndFooters(); });
  that.watchPage();
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

  // invalidate headers and footers wich calls watch page
  _self_paginator.toggleHeadersAndFooters();
};

/**
 * Updates the scroll position using the current selected node.
 * It's called for each cycle of [Paginator.watchPage()]{@link #watchPage}.
 * @method
 * @param {Boolean} usePresentValues use present values in scroll calculations
 * @return {undefined}
 */
Paginator.prototype.updateScrollPosition = function (usePresentValues) {
  var _self_paginator = this, 
    _sel = _self_paginator._editor.selection.getSel().anchorNode;
  _sel = _sel.className && _sel.className.contains('pageFooter') ? _sel.previousElementSibling : _sel;
  _sel = _sel.className && _sel.className.contains('pageHeader') ? _sel.nextElementSibling : _sel;

  var _normalizedNode = _sel.nodeType === 1 ? _sel : _sel.parentNode,
    _nodeOffsetTop = _relativeOffset(_normalizedNode, 'preventdelete', 0, 'offsetTop'),
    _nodeOffsetLeft = _relativeOffset(_normalizedNode, 'preventdelete', 0, 'offsetLeft'),
    _nodeHeight = $(_normalizedNode).outerHeight(true),
    _iframeHeight = Math.ceil($(_self_paginator._editor.iframeElement).height()),
    _iframeWidth = Math.ceil($(_self_paginator._editor.iframeElement).width()),
    _bodyPrevOffsetTop = _self_paginator._previousBodyOffSetTop,
    _bodyPrevOffsetLeft = _self_paginator._previousBodyOffSetLeft,
    _bodyOffsetTop = this._document.documentElement.scrollTop,
    _bodyOffsetLeft = this._document.documentElement.scrollLeft;

  // Check if node is inside the height viewport
  (function CheckHeightViewportPastValues(){
    if (usePresentValues) return;
    if (_nodeOffsetTop >= _bodyPrevOffsetTop && _nodeOffsetTop + _nodeHeight < _bodyPrevOffsetTop + _iframeHeight) {
      _self_paginator._previousNodeOffsetTop = _nodeOffsetTop; // save previous position
      if (_bodyPrevOffsetTop !== _bodyOffsetTop) _self_paginator._document.documentElement.scrollTop = _bodyPrevOffsetTop;
      return;
    }
    var normalizer = _nodeOffsetTop < _bodyPrevOffsetTop ? 0 : (_iframeHeight - _nodeHeight);
  
    // Update scroll position
    _self_paginator._document.documentElement.scrollTop = _nodeOffsetTop - normalizer;
    _self_paginator._previousNodeOffsetTop = _nodeOffsetTop;
  })();
  (function CheckHeightViewportPresentValues(){
    if (!usePresentValues) return;
    if (_nodeOffsetTop >= _bodyOffsetTop && _nodeOffsetTop + _nodeHeight < _bodyOffsetTop + _iframeHeight) {
      _self_paginator._previousNodeOffsetTop = _nodeOffsetTop; // save previous position
      return;
    }
    var normalizer = _nodeOffsetTop < _bodyOffsetTop ? 0 : (_iframeHeight - _nodeHeight);
  
    // Update scroll position
    _self_paginator._document.documentElement.scrollTop = _nodeOffsetTop - normalizer;
    _self_paginator._previousNodeOffsetTop = _nodeOffsetTop;
  })();

  //TODO: Check if node is inside the width viewport
  /*(function CheckWidthViewport(){
    if (_nodeOffsetLeft >= _bodyPrevOffsetLeft && _nodeOffsetLeft < _bodyPrevOffsetLeft + _iframeWidth) {
      _self_paginator._previousBodyOffSetLeft = _nodeOffsetLeft; // save previous position
      if (_bodyPrevOffsetLeft !== _bodyOffsetLeft) _self_paginator._document.documentElement.scrollLeft = _bodyPrevOffsetLeft;
      return;
    }
    var normalizer = _nodeOffsetLeft < _bodyPrevOffsetLeft ? 0 : (_iframeHeight - _nodeHeight);
  
    // Update scroll position
    _self_paginator._document.documentElement.scrollLeft = _nodeOffsetLeft - 0;
    _self_paginator._previousBodyOffSetLeft = _nodeOffsetLeft;
  })();*/
};

/**
 * Watch the current page, to check if content overflows the page's max-height.
 * @method
 * @return {undefined}
 */
Paginator.prototype.watchPage = function () {
  if (this.isWatchingPage()) return;
  this._watchPage.watch();
};

/**
 * Calculates offset(any) relative to given {stopClass}.
 * @param {HTMLElement} node element to walk on tree
 * @param {String} stopClass class in wich the element stop the recursion
 * @param {Number} height accumulated height
 * @param {String} relativeTo represent the orientation in witch this node is relative eg. offsetTop | offsetLeft
 * @return {Number} offset(any) relative to {stopClass}
 */
Paginator.prototype.relativeOffset = function (node, stopClass, height, relativeTo) {
  return _relativeOffset(node, stopClass, height, relativeTo);
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
  var minH = Math.floor(this._defaultPage.getInnerHeight());

  // Page structure
  var page = $('<div>').attr({
    'data-paginator': true,
    'data-paginator-page-rank': pageRank
  })
  .css({
    'margin': this._defaultPage.MARGIN_Y + 'px auto',
    'min-height': minH, // only innerHeight; paddings will be applied in setHeadersAndFooters
    'max-height': minH, // only innerHeight; paddings will be applied in setHeadersAndFooters
    'height': minH, // only innerHeight; paddings will be applied in setHeadersAndFooters
    'max-width': this._defaultPage.getInnerWidth(),
    'min-width': this._defaultPage.getInnerWidth(),
    'width': this._defaultPage.getInnerWidth()
  })
  .addClass("preventdelete");

  return page;
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
 * Create the next page with or without a content to put in, and append it to the paginator available pages.
 * @method
 * @private
 * @param {NodeList} contentNodeList The optional node list to put in the new next page.
 * @param {Number} nextRank The new page rank.
 * @returns {Page} The just created page
 */
var _createNexPageFromRank = function (contentNodeList, nextRank) {
  var newPage = new Page(this._defaultPage.format().label, this._defaultPage.orientation, nextRank, contentNodeList, this._editor);
  this._pages.push(newPage);
  $(newPage.content()).appendTo(this._body);
  return newPage;
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
 * Calculates offset(any) relative to given {stopClass}.
 * @param {HTMLElement} node element to walk on tree
 * @param {String} stopClass class in wich the element stop the recursion
 * @param {Number} height accumulated height
 * @param {String} relativeTo represent the orientation in witch this node is relative eg. offsetTop | offsetLeft
 * @return {Number} offset(any) relative to {stopClass}
 */
var _relativeOffset = function (node, stopClass, height, relativeTo) {
  if (!node) return 0;
  if (!relativeTo) relativeTo = 'offsetTop';
  if (!height) height = 0;
  height += node[relativeTo];
  if (node.offsetParent && height > 0 && node.offsetParent.className && node.offsetParent.className.contains(stopClass)) 
    return height + node.offsetParent[relativeTo];
  return _relativeOffset(node.parentNode, stopClass, height);
};


// Exports Paginator class
exports = module.exports = Paginator;

// Bind errors to the classes/paginator module.
exports.errors = errors;
},{"./Display":2,"./Page":3,"./WatchPage":5,"./paginator/errors":6,"./paginator/parser":7}],5:[function(require,module,exports){
/**
 * Watch the current page, to check if content overflows the page's max-height.
 */
'use strict';

function WatchPage(paginator) {
  this.paginator = paginator;
}

/**
 * Remove classes
 * @method
 * @private
 * @return {undefined}
 */
function _removeClasses() {
  var that = this; // jshint ignore:line
  $(that.paginator._body).find('.c-split.c-left').each(function(i, leftEdge){ 
    $(leftEdge).removeClass('c-split');
    $(leftEdge).removeClass('c-left');
    var rightEdge = $(that.paginator._body).find('.c-split.c-right.' + leftEdge.className), rightText = $(rightEdge).text();
    $(leftEdge).removeClass(leftEdge.className);
    $(leftEdge).append(' ' + rightText);
    $(rightEdge).remove();
  });
}

/**
 * Get all nodes inside all pages.
 * @method
 * @private
 * @return {undefined}
 * @param {Array<Object>} _nodes Array of nodes
 * @param {Number} _innerHeight Page inner height
 */
function _walkInNodes(_nodes, _innerHeight) {
  var _sumOfNodeHeights = 0, _iterationRank = 1, nextContentMeasurer, that = this; // jshint ignore:line
  $.each(that.paginator.getPages(), function (i, page) {
    page.innerContent().each(function (ii, content) {
      var __margin_top = Number($(content).css('margin-top').split('px').join('')),
        __margin_bottom = Number($(content).css('margin-bottom').split('px').join('')),
        __height = $(content).outerHeight() + __margin_top,
        //__nextContentMeasurer = $('<p></p>').insertAfter($(content)), TODO: BKP_23122
        __node = {
          height: __height,
          html: $(content).detach(),
          rank: _iterationRank
        };
      _nodes.push(__node);

      // When the sum of node.heights do not fit inside innerHeight, assing to next page
      if (_sumOfNodeHeights + __node.height > _innerHeight) {
        _sumOfNodeHeights = 0;
        _iterationRank++;
        __node.rank = _iterationRank;
        /**
         * TODO: BKP_23122
         * Editor está perdendo as informações de página ao colar texto
            _recalculatePageBreaker(__node, __nextContentMeasurer, __margin_top, __margin_bottom, content);
          } else {
            $(__nextContentMeasurer).remove();*/
      }
      
      // If node.height + sumOfNodeHeights fit inside innerHeight, do nothing
      _sumOfNodeHeights += __node.height;
    });
  });

  /**
   * When the sum of node.heights do not fit inside innerHeight, 
   *    break the node and assing to next page.
   * Example:
   *    _____________
   *    |           |
   *    |           |
   *    |           |
   *    |           |
   *    |           |
   *    | left edge |
   *    |___________| 
   *    _____________
   *    |right edge |
   *    |           |
   *    |           |
   *    |           |
   *    |           |
   *    |           |
   *    |___________| 
   * @method
   * @private
   * @return {undefined}
   * @param {object} c contains every object that is utilized: __node, __nextContentMeasurer, _sumOfNodeHeights, __margin_bottom, _innerHeight, _nodes, __node, content
   */
  function _recalculatePageBreaker(__node, __nextContentMeasurer, __margin_top, __margin_bottom, content) {
    var htmlText = $(__node.html).text();
    htmlText = htmlText.replace(/[\t|\n|\r]/igm, '');
    var spacesArray = htmlText.split(' '), index = spacesArray.length;
    while(true){
      // Calculate array to decrease size
      var halfArray = spacesArray.slice(0, index),
      halfPlusOneArray = spacesArray.slice(0, 1 + index), leftEdge, rightEdge;
  
      __nextContentMeasurer.html(halfArray.join(' '));
      leftEdge = $(__nextContentMeasurer).outerHeight() + __margin_top;
      __nextContentMeasurer.html(halfPlusOneArray.join(' '));
      rightEdge = $(__nextContentMeasurer).outerHeight() + __margin_top;
  
      // Needs to decrease.
      // If the sum of nodes + what should be inside the page were bigger then
      // page itself, then we need to remove more content from inside the page.
      if (_sumOfNodeHeights + leftEdge + __margin_bottom > _innerHeight) {
        index--;
        // If index equals to zero, is impossible to decrease; send it to pqp.
        if (index === 0) {
          _iterationRank++;
          __node.rank = _iterationRank;
          break;
        }
        continue;
      }
      
      // If right edge and left edge were equals, then it's done.
      if (rightEdge == leftEdge && _sumOfNodeHeights + rightEdge + __margin_bottom <= _innerHeight) {
        $(__nextContentMeasurer).remove();
        break;
      }
      
      _iterationRank++;
  
      // If the right edge is outside the page height,
      // then we found the edge.
      if (_sumOfNodeHeights + rightEdge + __margin_bottom > _innerHeight) {
        // Calculate Html
        __nextContentMeasurer.html(spacesArray.slice(index, spacesArray.length).join(' '));
  
        var id = Date.now(), cHeight = $(__nextContentMeasurer).outerHeight() + __margin_top;
        // Append new node
        var __newNode = {
          height: cHeight,
          html: $(__nextContentMeasurer).detach(),
          rank: _iterationRank
        };
        _nodes.push(__newNode);
  
        // Update node properties
        __node.html = $(content).html(halfArray.join(' '));
        __node.height = leftEdge;
  
        // Mark nodes with class to bind then
        $(__nextContentMeasurer).addClass('c-split c-right c-'+id);
        $(content).addClass('c-split c-left c-'+id);
  
        __node = __newNode; 
        _sumOfNodeHeights = 0;
        break;
      }
    }
  }

}

/**
 * Watch page.
 * This cicle should be executed everytime someting in the Editor changes.
 */
WatchPage.prototype.watch = function() {
  var _nodes = [], _paginator = this.paginator, _configs = _paginator._editor.settings.paginate_configs(); // jshint ignore:line
  
  // Lock
  _paginator._isWatchingPage = true;

  // 0) save bookmark and scroll positions
  var _bookmark = _paginator._previousBookmark || _paginator._editor.selection.getBookmark();
  _paginator._previousBookmark = null;
  _paginator.saveScrollPosition();


  // 1) get defaultHeight from page
  var _innerHeight = _paginator._pages[0].getInnerHeight();

  // 1.5) remove classes and re-join splitted elements
  _removeClasses.call(this);

  // 2) Get all nodes inside all pages.
  _walkInNodes.call(this, _nodes, _innerHeight);

  // 4) repage using nodes array
  // Iterates to the iterationRank. Creates or recycle pages.
  var _node, _currentRank = 1, _currentPage = _paginator.getPage(1);
  while ((_node = _nodes.shift()) !== undefined) {  
    if (_currentRank !== _node.rank) {
      _currentRank = _node.rank;
      _currentPage = _paginator.getPage(_node.rank);
      if (!_currentPage)
        _currentPage = _paginator.createNextPage(undefined, _node.rank > 1 ? _paginator.getPage(_node.rank - 1) : undefined);
    }
    // Add node back into page
    _currentPage.append(_node.html);
  }

  // 5) sanitize pages, headers and footers
  $.each(_paginator.getPages(), function (i, page) {
    if (page && !page.innerContent().length) return _paginator.removePage(page);
  });

  // restore bookmark position
  _paginator._editor.selection.moveToBookmark(_bookmark);
  // normalize bookmark
  var _sel = _paginator._editor.selection.getSel().anchorNode;
  if(_sel.className && _sel.className.contains('pageFooter'))
    _bookmark.start[1]--;
  else if(_sel.className && _sel.className.contains('pageHeader'))
    _bookmark.start[1]++;
  _paginator._editor.selection.moveToBookmark(_bookmark);

  _paginator.updateScrollPosition();
  _paginator._editor.undoManager.add();

  // Unlock
  _paginator._isWatchingPage = false;
};

module.exports = WatchPage;
},{}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
'use strict';

module.exports = {};

},{}],8:[function(require,module,exports){
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

  /* Checks the container height */
  function containerIsEmpty(innerHTML) {
    return (innerHTML.replace(/\r?\n|\r/igm, '').length === 0);
  }

  function getInnerText(el) {
    return el.textContent.replace(/\r?\n|\r/igm, '');
  }

  function getTextLength(el) {
    return getInnerText(el).length;
  }

  function isPageEmpty(page) {
    return getPageContent(page).length === 0;
  }

  function getPageContent(page) {
    return $(page).children(':not(.pageFooter):not(.pageHeader):not(.pageAddData)');
  }

  /* Sets the cursor at the beginning or the end of element */
  function setCursor(elem, atTheEnd) {
    var whichNode = 0;
    if (atTheEnd === true) {
      whichNode = elem.childNodes.length - 1;
    }
    if (elem.childNodes && elem.childNodes.length > 0) {
      if (elem.childNodes[whichNode].nodeType !== 3) 
        return setCursor(elem.childNodes[whichNode], atTheEnd);
      elem = elem.childNodes[whichNode];
    }
    if (atTheEnd) {
      if (elem.nodeType === 3){
        atTheEnd = elem.length;
      } else {
        atTheEnd = elem.innerText.length;
      }
    } else {
      atTheEnd = 0;
    }
    return editor.selection.setCursorLocation(elem, atTheEnd);
  }

  /* Insert a span into cursor position */
  function insertElementIntoPosition(element, selection, normalizedNode, offset) {
    if (selection.anchorNode.splitText) {
      selection.anchorNode.parentElement.insertBefore(element, selection.anchorNode.splitText(offset));
      return;
    } else {
      if (selection.anchorNode === normalizedNode){
        normalizedNode.prepend(element);
        return;
      } else {
        return insertElementIntoPosition(selection.anchorNode.parentElement, selection, normalizedNode, offset);
      }
    }
  }

  /* Check whether the cursor is in the page's most outside line */
  function isBoundaryLine(direction, selection, normalizedNode) {
    normalizedNode.normalize();
    paginatorListens = false;

    // Creates a empty span
    var _isBoundaryLine = false, goingUp = direction === 1, _spanCursor = document.createElement("span");
    _spanCursor.innerHTML = '&nbsp;';

    // Replaces the <p> element by a <span> with the same html content
    var _virtualNode = document.createElement('span');
    _virtualNode.innerHTML = normalizedNode.innerHTML;

    // Insert a span into cursor position
    if (selection.anchorNode.splitText) {
      selection.anchorNode.parentElement.insertBefore(_spanCursor, selection.anchorNode.splitText(selection.anchorOffset));
    } else {
      normalizedNode.prepend(_spanCursor);
    }

    // Save cursor top
    var _cursorBottom = _spanCursor.getClientRects()[0][goingUp ? 'top' : 'bottom'] - (goingUp ? 14 : 0);
    // Hides normalizedNode
    normalizedNode.insertAdjacentElement('afterend', _virtualNode);
    normalizedNode.style.display = 'none';
    // Save boundary top
    var _boundaryBottom = _virtualNode.getClientRects()[goingUp ? 0 : _virtualNode.getClientRects().length-1][goingUp ? 'top' : 'bottom'];
    
    // Check whether the span element is in the same Y position than the first/last
    if (goingUp && _boundaryBottom >= _cursorBottom) _isBoundaryLine = true;
    if (!goingUp && _boundaryBottom <= _cursorBottom) _isBoundaryLine = true;
    
    // Reset element states
    normalizedNode.style.display = '';
    _virtualNode.remove();
    _spanCursor.remove();
    
    paginatorListens = true;
    normalizedNode.normalize();
    // If both offsets are equal, then the user is in the boundary line
    return _isBoundaryLine;
  }

  /* Check if cursor is in a boundary element of the page */
  function isPageBoundary(nodeSibling) {
    if (nodeSibling) return nodeSibling.className.contains('page') ? true : false;
    return true;
  }

  function isBlockBoundary(normalizedNode, selection, isFirstCharacter) {
    // If we are looking to match the first character of the normalizedNode
    if (selection.anchorOffset !== (isFirstCharacter ? 0 : getTextLength(selection.anchorNode))) return false;
    if (selection.anchorNode === normalizedNode) return true;
    if (!normalizedNode.childNodes || normalizedNode.childNodes.length === 0) return false;
    return isBlockBoundary(normalizedNode.childNodes[isFirstCharacter ? 0 : normalizedNode.childNodes.length - 1], selection, isFirstCharacter);
  }

  // stop default actions
  function _preventDelete(pd) {
    if (!pd || !evt) return;
    evt.preventDefault();
    evt.stopPropagation();
  }

  var node, page, sel, range, evt;

  /**
   * Mannually sanitizes editor. Deals with ranged selections.
   * @param {boolean} pd prevent default action
   * @param {boolean} removing true for deleting (backspace/delete), false for arrowkeys
   * @param {boolean} walking true if cursor is walikng right (→) or left (←)
   * @param {number} direction 1 for upwards (↑), 2 for downwards (↓)
   * @method
   * @ignore
   * @return {undefined}
   */
  function sanitizeWithRange(pd, removing, walking, direction) {

    // If not removing, there's no need to sanitize the range
    if (!removing) {
      var normalize_anchor = Math[direction === 1 ? 'min' : 'max'](sel.anchorOffset, sel.focusOffset),
      n_sel = {
        anchorNode: sel.anchorNode,
        focusOffset: normalize_anchor,
        anchorOffset: normalize_anchor,
        type: 'Caret'
      };
      return sanitizeWithoutRange(direction, removing, walking, n_sel);
    }
    
    // Remove only allowed Nodes in this range selection
    if (sel.type !== 'Range' && !editor.plugins.paginate.isEmpty() && node.nodeName !== 'BODY') return;
    if (!range) return;
    
    // if selection is text, only returns
    if (range.commonAncestorContainer.nodeType === 3) return;
    
    // prevent default action
    if (pd) {
      evt.preventDefault();
      evt.stopPropagation();
    }

    if (range.startContainer === range.endContainer && range.startOffset === range.endOffset) return;
    
    /* Proceed with delete and remove node if range is empty */
    // Select all nodes inside this selection
    var _nodeIterator = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_ALL,
      {
        acceptNode: function (node) {
          // ignore if is header or footer
          if (node.className && node.className.contains('page')) return NodeFilter.FILTER_REJECT;
          // jump into page content
          if (node.className && node.className.contains('preventdelete')) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    // initialize variables for node removals
    var _nodeList = [];
    while (_nodeIterator.nextNode()) {
      if (_nodeList.length === 0 && _nodeIterator.currentNode !== range.startContainer) continue;
      _nodeList.push(_nodeIterator.currentNode);
      if (_nodeIterator.currentNode === range.endContainer) break;
    }

    // remove first and last nodeIt using offset
    var _firstNode = _nodeList.shift();
    _firstNode.textContent = getInnerText(_firstNode).substr(0, range.startOffset);
    var _lastNode = _nodeList.pop();
    if (range.endOffset < getTextLength(range.endContainer)) {
      _lastNode.textContent = (getTextLength(_lastNode) > 0 && getInnerText(_lastNode).substr(range.endOffset)) || '';
      // merge first and last
      _firstNode.textContent += getInnerText(_lastNode);
    }
    _lastNode.remove();

    // clean list
    _nodeList.forEach(function(node){
      try { node.remove(); } catch (e) {}
    });

    // append BR in case nothing left
    if (_firstNode.nodeType === 3) _firstNode = _firstNode.parentNode;
    if (_firstNode.children.length === 0) _firstNode.appendChild(document.createElement('br'));

    // sets the cursor to the middle of mixed texts
    setCursor(_firstNode, true);

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
   * @param {object} n_sel object replacing Selection
   * @method
   * @ignore
   * @return {undefined}
   */
  function sanitizeWithoutRange(direction, removing, walking, n_sel) {
    if (direction < 0) return;

    var _siblingPage, _pageContent, _isPageBoundary, __sel = n_sel || sel,
      _pd = false, _normalizedNode = (function _NN(_node){ 
        if (_node.parentNode.className && _node.parentNode.className.contains('preventdelete')) return _node;
        return _NN(_node.parentNode);
      })(__sel.anchorNode), _isBlockBoundary = isBlockBoundary(_normalizedNode, __sel, direction === 1);

    // 0) check if we are in the page boundary
    // if the direction is upwards (↑)
    if (direction === 1) _isPageBoundary = isPageBoundary(_normalizedNode.previousElementSibling);
    // or the direction is donwards (↓)
    else if (direction === 2) _isPageBoundary = isPageBoundary(_normalizedNode.nextElementSibling);

    // if not on page boundary, 
    if (!_isPageBoundary) {
      // and I'm removing: let it be
      if (removing) return _preventDelete(false);
      // and I'm walking
      if (walking) {
        // and I'm going upwards and cursor is in position 0
        // move cursor to previous element
        if (direction === 1 && _isBlockBoundary) {
          setCursor(_normalizedNode.previousElementSibling, true);
          _pd = true;
          // and I'm going downwards and cursor is in position length-1
          // move cursor to next element
        } else if (direction === 2 && _isBlockBoundary) {
          setCursor(_normalizedNode.nextElementSibling, false);
          _pd = true;
        }
      }
      // nothing to do at all
      paginator.updateScrollPosition(true);
      return _preventDelete(_pd);
    }

    // 1) get the sibling upwards or donwards page
    // if the direction is upwards (↑)
    if (direction === 1) _siblingPage = page.previousElementSibling;
    // or the direction is donwards (↓)
    else if (direction === 2) _siblingPage = page.nextElementSibling;

    // if there'snt siblingPage
    if (!_siblingPage) {
      _pageContent = getPageContent(page);
      if (direction === 1) {
        // and I'm in the first element of the page
        // nothing to do, only prevent default action
        if (_pageContent[0] === _normalizedNode) {
          if (_isBlockBoundary) {
            setCursor(_normalizedNode, false);
            return _preventDelete(true);
          }
        }
      } else if (direction === 2) {
        // and I'm in the last element of the page
        if (_pageContent[_pageContent.length - 1] === _normalizedNode) {
          // and I'm not in the last lines offset
          if (_isBlockBoundary) {
            setCursor(_normalizedNode, true);
            return _preventDelete(true);
          }
        }
      }
      return _preventDelete(false);
    }
    var _siblingPageContent = getPageContent(_siblingPage);

    // 2) select the pageContent content using parameters
    // if is removing
    if (removing) {
      _pageContent = getPageContent(page);
      // and the direction is upwards (↑),
      // I need the content of the current page
      if (direction === 1) {
        if (_isBlockBoundary) {
          // and there's only a child within page content
          // remove P from escaping page
          if (_pageContent[0] === _normalizedNode) {
            _siblingPageContent[_siblingPageContent.length - 1].innerHTML += _pageContent[0].innerHTML;
            _pageContent[0].remove();
            setCursor(_siblingPageContent[_siblingPageContent.length - 1], true);
            paginator.watchPage();
            return _preventDelete(true);
          }
        }
      } else
        // and the direction is donwards (↓),
        // I need the content of the sibling page
        if (direction === 2) {
          if (_isBlockBoundary) {
            // and there's only a child within page content
            // remove P from escaping page
            if (_pageContent[_pageContent.length - 1] === _normalizedNode) {
              _pageContent[_pageContent.length - 1].innerHTML += _siblingPageContent[0].innerHTML;
              _siblingPageContent[0].remove();
              setCursor(_pageContent[_pageContent.length - 1], true);
              paginator.watchPage();
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
      _pageContent = getPageContent(page);
      // if I'm going left and I'm in the offset 0
      if (direction === 1 && _isBlockBoundary) {
        // sets the cursor to the ending of the last node of siblingPage
        setCursor(_siblingPageContent[_siblingPageContent.length - 1], true);
        _pd = true;
      }
      // if I'm going right and I'm in the offset is equal to the element text length
      if (direction === 2 && _isBlockBoundary) {
        // sets the cursor to the beginning of the first node of siblingPage
        setCursor(_siblingPageContent[0], false);
        _pd = true;
      }
      // just walk
      paginator.updateScrollPosition(true);
      return _preventDelete(_pd);
    }
    // If I'm walking perpendicular
    // and going upwards (↑) or downwards (↓)
    // Evaluate the offsetTop from the cursor
    if (!isBoundaryLine(direction, sel, _normalizedNode)) {
      return _preventDelete(false);
    }

    if (direction === 1) {
      // sets the cursor to the ending of the last node of siblingPage
      setCursor(_siblingPageContent[_siblingPageContent.length - 1], true);
    }
    // and going downwards (↓)
    if (direction === 2) {
      // sets the cursor to the beginning of the first node of siblingPage
      setCursor(_siblingPageContent[0], false);
    }
    // just walk
    paginator.updateScrollPosition(true);
    return _preventDelete(true);
  }

  /**
   * Check Prevent Delete
   * ADAPTED FROM: https://stackoverflow.com/questions/29491324/how-to-prevent-delete-of-a-div-in-tinymce-editor
   * @function
   * @private
   * @param {event} e - Javascript event
   * @returns void
   */
  function checkPreventDelete(e) {

    node = editor.selection.getNode();
    evt = e;
    page = (node.nodeName !== 'BODY') ? $(node).closest('div[data-paginator="true"]')[0] : $(node.firstChild);
    sel = editor.selection.getSel();
    range = sel.type === 'Range' ? editor.selection.getRng() : null;

    /* If delete keys pressed */
    var direction = 0;
    switch (e.keyCode) {
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
        if (!e.ctrlKey || !e.shiftKey) {
          if (range) sanitizeWithRange(true,
            e.keyCode === 8 || e.keyCode === 46, // is removing
            e.keyCode === 37 || e.keyCode === 39, // walking sideways with cursor
            direction); 
          else sanitizeWithoutRange(direction,
            e.keyCode === 8 || e.keyCode === 46, // is removing
            e.keyCode === 37 || e.keyCode === 39); // walking sideways with cursor
          break;
        }
        /* falls through */
      case 86: // V
        //if (evt.ctrlKey) sanitizeWithRange(false);
        break;
      case 88: // X
        if (e.ctrlKey) sanitizeWithRange(true);
        break;
      case 27: // esc
        if (editor.plugins.fullscreen.isFullscreen())
          editor.execCommand('mceFullScreen');
        break;
      case 13: // enter
        setTimeout(function () {
          paginator.watchPage();
        }, 0);
        /* falls through */
      default:
        if (!e.ctrlKey || !e.shiftKey) {
          var valid =
            (e.keyCode > 47 && e.keyCode < 58) || // number keys
            e.keyCode == 32 || e.keyCode == 13 || // spacebar & return key(s) (if you want to allow carriage returns)
            (e.keyCode > 64 && e.keyCode < 91) || // letter keys
            (e.keyCode > 95 && e.keyCode < 112) || // numpad keys
            (e.keyCode > 185 && e.keyCode < 193) || // ;=,-./` (in order)
            (e.keyCode > 218 && e.keyCode < 223); // [\]' (in order)
          if (valid) sanitizeWithRange(false);
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


  /**
   * Saves scroll position before Undo.
   * @var
   * @global
   */
  var scrollPositionAfterUndo = 0;

  // _debugEditorEvents();

  /**
   * Plugin method that disable the wath of page (to allow edition of extenal elements like headers and footers)
   * @method
   * @returns {undefined}
   */
  this.disableWatchPage = function () { // jshint ignore:line
    watchPageEnabled = false;
  };
  /**
   * Plugin method that enable the wath of page (after used this#disableWatchPage())
   * @method
   * @returns {undefined}
   */
  this.enableWatchPage = function () { // jshint ignore:line
    watchPageEnabled = true;
  };

  /**
   * Get the current page
   * @method
   * @returns {Page} the paginator current page.
   */
  this.getCurrentPage = function () { // jshint ignore:line
    return paginator.getCurrentPage();
  };

  /**
   * Returns if the editor is empty
   * @method
   * @returns {boolean} is empty
   */
  this.isEmpty = function () { // jshint ignore:line
    return paginator.isEmpty();
  };

  /**
   * Returns if the editor is dirty
   * @method
   * @returns {boolean} is dirty
   */
  this.isDirty = function () { // jshint ignore:line
    return paginator.isDirty();
  };

  /**
   * Returns if the editors content is empty
   * @method
   * @returns {boolean} is empty
   */
  this.contentIsEmpty = function () { // jshint ignore:line
    return paginator.contentIsEmpty();
  };

  /**
   * Returns the current content.
   * @method
   * @returns {boolean} is empty
   */
  this.getCurrentContent = function () { // jshint ignore:line
    return paginator.currentContent();
  };

  editor.once('init', function () {
    paginator = new Paginator('A4', 'portrait', editor);
    editor.dom.bind(editor.getDoc(), 'PageChange', onPageChange);
    editor.shortcuts.remove('meta+a'); /* Enable native CTRL + A shortcut */

    if (navigator && navigator.userAgent && navigator.userAgent.match(/iPhone/)) {
      // editorContainer, contentAreaContainer, iframeElement
      editor.contentAreaContainer.style.webkitOverflowScrolling = 'touch';
      editor.contentAreaContainer.style.overflow='scroll';
    }
    paginator.init();
    paginatorListens = true;
    watchPageEnabled = true;
    //paginator.gotoFocusedPage();
    paginator.gotoBeginning();
    if (editor.settings.paginate_navigation_buttons) ui.appendNavigationButtons(paginator);
  });

  editor.on('remove', function(evt) {
    ui.removeNavigationButtons();
    // if (paginator) paginator.destroy();
    clearTimeout(_timeout);
    watchPageIterationsCount = 0;
    paginatorListens = false;
  });

  /*
   * On editor change
   * Checks if debounce time is bigger then last changed time.
   * This debounce saves a lot processing.
   */
  var _change_debouce = 100, _timeout;
  editor.on('change', function (evt) {
    evt.preventDefault();
    if (!paginatorListens || !watchPageEnabled || paginator.isWatchingPage()) return;

    clearTimeout(_timeout);
    _timeout = setTimeout(function(){
      paginator.watchPage();
    }, _change_debouce);
  });

  editor.on('keydown', function (evt) {
    checkPreventDelete(evt);
  });

  /*
   * Watches for page content changes.
   */
  editor.on('SetContent', function (args) {
    if (!paginator || paginator.isWatchingPage()) return;
    paginator.updatePages();
  });

  editor.on('ToggleHeadersAndFooters', function (evt) {
    paginator.toggleHeadersAndFooters();
  });

  editor.on('ToggleMargins', function (evt) {
    paginator.toggleHeadersAndFooters();
  });

  editor.on('ToggleHeaderAdditionalData', function (evt) {
    paginator.toggleHeaderAdditionalData();
  });
}

// Add the plugin to the tinymce PluginManager
tinymce.PluginManager.add('paginate', tinymcePluginPaginate);
},{"./classes/Paginator":4,"./utils/ui":10}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
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

},{"../classes/paginator/errors":6}]},{},[1]);
