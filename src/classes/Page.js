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
    return $(this._content).children(':not(.pageFooter):not(.pageHeader)');
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
  /* header style */
  header.style.position = 'absolute';
  header.style.top = 0;
  header.style.left = 0;
  header.style.borderBottom = '1px dashed #ddd';
  header.style.color = '#8d8e90';
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
    header.classList += ' large';
    header.style.height = spacingsWithHeaders.header.height + 'px';
    header.style.paddingTop = spacingsWithHeaders.header.pTop + 'px';
    header.style.paddingBottom = spacingsWithHeaders.header.pBottom + 'px';
    /* header style */
    header.style.borderBottom = '1px solid #ddd';

    // Footer, with headers and footers enabled
    footer.classList += ' large';
    footer.style.height = spacingsWithHeaders.footer.height + 'px';
    footer.style.paddingTop = spacingsWithHeaders.footer.pTop + 'px';
    footer.style.paddingBottom = spacingsWithHeaders.footer.pBottom + 'px';
    /* footer style */
    footer.style.borderTop = '1px solid #ddd';

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
   * @ignore
   * @param {HTMLElement} el should be header and footer elements
   * @return {undefined}
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

module.exports = Page;