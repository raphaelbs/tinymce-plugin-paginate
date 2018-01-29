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
      return el.textContent.replace(/\r?\n|\r/igm, '');
    }

    function _isPageEmpty(page) {
      return _getPageContent(page).length === 0;
    }

    function _getPageContent(page) {
      return $(page).children(':not(.pageFooter):not(.pageHeader):not(.pageAddData)');
    }

    function _setCursor(elem, offset) {
      if (elem.childNodes && elem.childNodes.length > 0) {
        if (elem.childNodes[0].nodeType === 3) 
          return editor.selection.setCursorLocation(elem.childNodes[0], offset);
        return _setCursor(elem.childNodes[0], offset);
      }
      return editor.selection.setCursorLocation(elem, offset);
    }

    var _node = editor.selection.getNode(),
      _page = (_node.nodeName !== 'BODY') ? $(_node).closest('div[data-paginator="true"]')[0] : $(_node.firstChild),
      _sel = editor.selection.getSel(),
      _range = _sel.type === 'Range' ? editor.selection.getRng() : null;

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
    function _sanitizeWithRange(pd, removing, walking, direction) {

      // If not removing, there's no need to sanitize the range
      if (!removing) {
        return _sanitizeWithoutRange(direction, removing, walking);
      }
      
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

      if (_range.startContainer === _range.endContainer && _range.startOffset === _range.endOffset) return;
      
      /* Proceed with delete and remove node if range is empty */
      // Select all nodes inside this selection
      var _nodeIterator = document.createTreeWalker(
        _range.commonAncestorContainer,
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
        if (_nodeList.length === 0 && _nodeIterator.currentNode !== _range.startContainer) continue;
        _nodeList.push(_nodeIterator.currentNode);
        if (_nodeIterator.currentNode === _range.endContainer) break;
      }

      // remove first and last nodeIt using offset
      var _firstNode = _nodeList.shift();
      _firstNode.textContent = _getInnerText(_firstNode).substr(0, _range.startOffset);
      var _firstOffset = _getInnerText(_firstNode).length;
      var _lastNode = _nodeList.pop();
      if (_range.endOffset < _getInnerText(_range.endContainer).length) {
        _lastNode.textContent = (_getInnerText(_lastNode).length > 0 && _getInnerText(_lastNode).substr(_range.endOffset)) || '';
        // merge first and last
        _firstNode.textContent += _getInnerText(_lastNode);
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
     * @method
     * @ignore
     * @return {undefined}
     */
    function _sanitizeWithoutRange(direction, removing, walking) {
      if (direction < 0) return;

      // check if cursor is in a boundary element of the page
      function _isInBoundary(nodeSibling) {
        if (nodeSibling) return nodeSibling.className.contains('page') ? true : false;
        return true;
      }

      // stop default actions
      function _preventDelete(pd) {
        if (!pd) return;
        evt.preventDefault();
        evt.stopPropagation();
      }

      var _siblingPage, _pageContent, _isBoundary,
        _pd = false, _normalizedNode = (function _NN(_node){ 
          if (_node.parentNode.className && _node.parentNode.className.contains('preventdelete')) return _node;
          return _NN(_node.parentNode);
        })(_sel.anchorNode);

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
          if (direction === 1 && _sel.anchorOffset === 0) {
            var normalizedOffset = _getInnerText(_normalizedNode.previousElementSibling).length;
            normalizedOffset = Math.max(normalizedOffset, 0);
            _setCursor(_normalizedNode.previousElementSibling, normalizedOffset);
            _pd = true;
            // and I'm going downwards and cursor is in position length-1
            // move cursor to next element
          } else if (direction === 2 && _getInnerText(_normalizedNode).length === _sel.anchorOffset) {
            _setCursor(_normalizedNode.nextElementSibling, 0);
            _pd = true;
          }
        }
        // nothing to do at all
        paginator.updateScrollPosition(true);
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
          if (_pageContent[0] === _normalizedNode) {
            if (_sel.focusOffset !== 0) {
              _setCursor(_normalizedNode, 0);
            }
            return _preventDelete(true);
          }
        } else if (direction === 2) {
          // and I'm in the last element of the page
          if (_pageContent[_pageContent.length - 1] === _normalizedNode) {
            // and I'm not in the last lines offset
            if (_getInnerText(_pageContent[_pageContent.length - 1]).length === _sel.anchorOffset) {
              var _normalizedOffset = _getInnerText(_normalizedNode).length;
              _normalizedOffset = Math.max(_normalizedOffset, 0);
              _setCursor(_normalizedNode, _normalizedOffset);
              return _preventDelete(true);
            }
          }
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
              _siblingPageContent[_siblingPageContent.length - 1].textContent += _getInnerText(_pageContent[0]);
              _pageContent[0].remove();
              _setCursor(_siblingPageContent[_siblingPageContent.length - 1], _getInnerText(_siblingPageContent[_siblingPageContent.length - 1]).length);
              paginator.watchPage();
              return _preventDelete(true);
            }
          }
        } else
          // and the direction is donwards (↓),
          // I need the content of the sibling page
          if (direction === 2) {
            if (_getInnerText(_normalizedNode).length === _sel.anchorOffset) {
              // and there's only a child within page content
              // remove P from escaping page
              if (_pageContent[_pageContent.length - 1] === _normalizedNode) {
                _pageContent[_pageContent.length - 1].textContent += _getInnerText(_siblingPageContent[0]);
                _siblingPageContent[0].remove();
                _setCursor(_pageContent[_pageContent.length - 1], _getInnerText(_pageContent[_pageContent.length - 1]).length);
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
        _pageContent = _getPageContent(_page);
        // if I'm going left and I'm in the offset 0
        if (direction === 1 && _sel.anchorOffset === 0) {
          // sets the cursor to the ending of the last node of siblingPage
          _setCursor(_siblingPageContent[_siblingPageContent.length - 1], _getInnerText(_siblingPageContent[_siblingPageContent.length - 1]).length);
          _pd = true;
        }
        // if I'm going right and I'm in the offset is equal to the element text length
        if (direction === 2 && _getInnerText(_normalizedNode).length === _sel.anchorOffset) {
          // sets the cursor to the beginning of the first node of siblingPage
          _setCursor(_siblingPageContent[0], 0);
          _pd = true;
        }
        // just walk
        paginator.updateScrollPosition(true);
        return _preventDelete(_pd);
      }
      // If I'm walking perpendicular
      // and going upwards (↑) or downwards (↓)
      if (direction === 1) {
        // sets the cursor to the ending of the last node of siblingPage
        var __normalizedOffset = _getInnerText(_siblingPageContent[_siblingPageContent.length - 1]).length;
        __normalizedOffset = Math.max(__normalizedOffset, 0);
        _setCursor(_siblingPageContent[_siblingPageContent.length - 1], __normalizedOffset);
      }
      // and going downwards (↓)
      if (direction === 2) {
        // sets the cursor to the beginning of the first node of siblingPage
        _setCursor(_siblingPageContent[0], 0);
      }
      // just walk
      paginator.updateScrollPosition(true);
      return _preventDelete(true);
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
        if (!evt.ctrlKey || !evt.shiftKey) {
          if (_range) _sanitizeWithRange(true,
            evt.keyCode === 8 || evt.keyCode === 46, // is removing
            evt.keyCode === 37 || evt.keyCode === 39, // walking sideways with cursor
            direction); 
          else _sanitizeWithoutRange(direction,
            evt.keyCode === 8 || evt.keyCode === 46, // is removing
            evt.keyCode === 37 || evt.keyCode === 39); // walking sideways with cursor
          break;
        }
        /* falls through */
      case 86: // V
        //if (evt.ctrlKey) _sanitizeWithRange(false);
        break;
      case 88: // X
        if (evt.ctrlKey) _sanitizeWithRange(true);
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
        if (!evt.ctrlKey || !evt.shiftKey) {
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