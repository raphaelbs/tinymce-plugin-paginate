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