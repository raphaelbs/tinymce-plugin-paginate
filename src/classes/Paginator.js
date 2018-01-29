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
  if (node.offsetParent && node.offsetParent === node.parentNode &&  node.offsetParent.className && node.offsetParent.className.contains(stopClass)) 
    return height + node.offsetParent[relativeTo];
  return _relativeOffset(node.parentNode, stopClass, height);
};


// Exports Paginator class
exports = module.exports = Paginator;

// Bind errors to the classes/paginator module.
exports.errors = errors;