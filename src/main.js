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