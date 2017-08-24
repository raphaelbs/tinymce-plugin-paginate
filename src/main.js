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

  function onRemoveEditor(evt) {
    ui.removeNavigationButtons();
    paginator.destroy();
    watchPageIterationsCount = 0;
    paginatorListens = false;
  }

  /**
   * Check Prevent Delete
   * ADAPTED FROM: https://stackoverflow.com/questions/29491324/how-to-prevent-delete-of-a-div-in-tinymce-editor
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
    if (!paginator) return;
    paginator.updatePages();
  });

  editor.on('ToggleHeadersAndFooters', function (evt) {
    paginator.toggleHeadersAndFooters();
  });

  editor.on('ToggleMargins', function (evt) {
    paginator.toggleHeadersAndFooters();
  });
}

// Add the plugin to the tinymce PluginManager
tinymce.PluginManager.add('paginate', tinymcePluginPaginate);