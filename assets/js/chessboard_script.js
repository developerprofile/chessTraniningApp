import Chess from './chess.js';
import globalObject from './globals.js';

import Vue from 'vue';
import axios from 'axios';
import progressInformationComponent from './components/progressInformationComponent.js';
import puzzleRankingComponent from './components/puzzleRankingComponent.js';
import playerRankingDifference from './components/playerRankingDifferenceComponent.js';
import puzzleRankingDifferenceComponent from './components/puzzleRankingDifferenceComponent.js';
import showSolutionComponent from './components/showSolutionComponent.js';
import playerRankingComponent from './components/playerRankingComponent.js';
import statusComponent from './components/statusComponent.js';
import LineChartContainerMini from './components/ChartContainerMini.vue'
import NextPosition from './components/NextPosition.vue'

var appMainComponent = new Vue({
    delimiters: ['${', '}'],
    el: '#app',
    data: {
        statusValue: 0
            },
    components: {
        'progress-information-component': progressInformationComponent,
        'puzzle-ranking-component': puzzleRankingComponent,
        'player-ranking-difference-component': playerRankingDifference,
        'puzzle-ranking-difference-component': puzzleRankingDifferenceComponent,
        'show-solution-component': showSolutionComponent,
        'player-ranking-component': playerRankingComponent,
        'status-component': statusComponent,
        'line-chart-container': LineChartContainerMini,
        'next-position': NextPosition
    },
    methods: {
      getposition: function () {
          globalObject.progressInformationValue='';
          hideProgressInfo();

          getRandomPosition();          
      }
  }
});

// do not pick up pieces if the game is over
// only pick up pieces for the side to move

var onDragStart = function(source, piece, position, orientation) {
  if (globalObject.game.game_over() === true ||
      (globalObject.game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (globalObject.game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false;
  }
};

var onDrop = function(source, target) {
  var playerMove = makeMove(source, target);

  if (playerMove)
  {
     var solutionMove = getNextMoveFromSolution(globalObject.solution);
     checkPlayerSolution(playerMove, solutionMove);
  }

  // illegal move
  if (playerMove === null) return 'snapback';

  updateStatus();
};

// update the board position after the piece snap
// for castling, en passant, pawn promotion
var onSnapEnd = function() {
  board.position(globalObject.game.fen());
};

var updateStatus = function() {
  if (!globalObject.puzzleActive)
  {
      return;
  }

  var status = '';
  var moveIcon = '<i class="fas fa-chess-king" style="color:#ced4da; padding-right:5px;"></i>';
  var moveColor = 'White';
  cfg.orientation='white';

  if (globalObject.game.turn() === 'b') {
    moveColor = 'Black';
    moveIcon = '<i class="fas fa-chess-king" style="padding-right:5px;"></i>';
    cfg.orientation='black';
  }

  //update orientation
  board = ChessBoard('board', cfg);

  // checkmate?
  if (globalObject.game.in_checkmate() === true) {
    status = 'Game over, ' + moveColor + ' is in checkmate.';
  }

  // draw?
  else if (globalObject.game.in_draw() === true) {
    status = 'Game over, drawn position';
  }

  // game still on
  else {
    status = moveColor + ' to move';

    // check?
    if (globalObject.game.in_check() === true) {
      status += ', ' + moveColor + ' is in check';
    }
  }

  globalObject.statusValue = status;
};

var initNewPosition = function(fen) {
    globalObject.game.load(fen);

    cfg.position = fen;
    cfg.draggable = true;

    board = ChessBoard('board', cfg);
}

var setSolutionArray = function(solution) {
    var solutionTmp = JSON.parse(solution);
    solutionTmp.array.reverse();

    return solutionTmp.array;
}

var getNextMoveFromSolution = function(solution) {
    var nextMove = solution.pop();
    return nextMove;
}

var makeMove = function(from, to) {
    var move = globalObject.game.move({
      from: from,
      to: to,
      promotion: 'q' // NOTE: always promote to a queen for example simplicity
    });

    return move;
}

var checkPlayerSolution = function(playerMove, solutionMove) {
     var movesSolution = solutionMove.split("-");

     if (movesSolution[0] == playerMove.from && movesSolution[1] == playerMove.to)
     {
        var nextMove = getNextMoveFromSolution(globalObject.solution);

        setProgressInfo(true);

        if (nextMove)
        {
          var movesNextMove = nextMove.split("-");
          var move = makeMove(movesNextMove[0], movesNextMove[1]);
        }
        //no more moves - ending
        else
        {
            var ratings = calculateNewRankings(true);

            globalObject.puzzleResult = true;
            globalObject.puzzleActive = false;
            setPuzzleCompleted();
            changePlayerRatingInTemplate(ratings.newPlayerRanking);
            changePuzzleRankingInTemplate(ratings.newPuzzleRanking);
        }
     }
     //user error
     else
     {
        var ratings = calculateNewRankings(false);

        globalObject.puzzleResult = false;
        globalObject.puzzleActive = false;
        globalObject.showSolutionFlag = true;
        setProgressInfo(false);
        changePlayerRatingInTemplate(ratings.newPlayerRanking);
        changePuzzleRankingInTemplate(ratings.newPuzzleRanking);
     }

     if (!globalObject.puzzleActive)
     {
         console.log(ratings.newPlayerRanking);

         savePuzzleRatingAxios(globalObject.puzzleId, ratings.newPuzzleRanking)
         .then(saveUserRankingAxios(globalObject.userId, ratings.newPlayerRanking))
         .then(saveStatisticsAxios(globalObject.userId, ratings.newPlayerRanking, globalObject.puzzleId, ratings.newPuzzleRanking, globalObject.puzzleResult));
     }
}

var setProgressInfo = function(type) {
    var html;

    if (type)
    {
        html = '<i class="fas fa-check" style="color:green"></i> Good move, keep on :)';
    }
    else
    {
        html = '<i class="fas fa-times" style="color:red"></i> Bad move :(';
    }

    globalObject.progressInformationValue=html;
}

var setPuzzleCompleted = function() {
    var html = '<i class="fas fa-check" style="color:green"></i> Puzzle completed :)';
    globalObject.progressInformationValue=html;

    globalObject.puzzleActive = false;
}

var calculateNewRankings = function(result) {
 var k = 32;
 var s1,s2;
 var resultArray = {};
 var floatUserRanking = parseFloat(globalObject.playerRankingValue);
 var floatPuzzleRanking = parseFloat(globalObject.puzzleRankingValue);

 if (floatUserRanking && floatPuzzleRanking)
 {
   if (result)
   {
     s1 = 1;
     s2 = 0;
   }
   else
   {
     s1 = 0;
     s2 = 1;
   }

   var r1 = parseFloat(Math.pow(10, floatUserRanking/400));
   var r2 = parseFloat(Math.pow(10, floatPuzzleRanking/400));

   var e1 = parseFloat(r1/(r1+r2));
   var e2 = parseFloat(r2/(r1+r2));

   var param1Part2 = s1-e1;
   var newPlayerRanking = floatUserRanking+(k*param1Part2);

   newPlayerRanking = newPlayerRanking.toFixed(2);

   var param2Part2 = s2-e2;
   var newPuzzleRanking = floatPuzzleRanking+(k*param2Part2);
   newPuzzleRanking = newPuzzleRanking.toFixed(2);

   resultArray = {newPlayerRanking: newPlayerRanking, newPuzzleRanking: newPuzzleRanking};
 }

 return resultArray;

}

var calculateRankingDifference = function (ranking1, ranking2) {
    return Math.abs(parseFloat(ranking1) - parseFloat(ranking2)).toFixed(2);
}

var changePlayerRatingInTemplate = function(newRating) {
  var playerRating = globalObject.playerRankingValue;
  var difference = calculateRankingDifference(playerRating, newRating);

  if (newRating > playerRating)
  {
      var icon = '<i class="fas fa-plus" style="color:green;"></i>';
  }
  else
  {
      var icon = '<i class="fas fa-minus" style="color:red;"></i>';
  }

    globalObject.playerRankingDifferenceValue = '('+ icon + difference + ')';
    globalObject.playerRankingValue = newRating;
    setNewPlayerRating(newRating);
}

var setNewPlayerRating = function(newRating) {
    globalObject.playerRankingValue = newRating;
}

var changePuzzleRankingInTemplate = function(newPuzzleRanking) {
  var difference = calculateRankingDifference(globalObject.puzzleRankingValue, newPuzzleRanking);
  var icon;

  if (newPuzzleRanking > globalObject.puzzleRankingValue)
  {
      icon = '<i class="fas fa-plus" style="color:green;"></i>';
  }
  else
  {
      icon = '<i class="fas fa-minus" style="color:red;"></i>';
  }

  globalObject.puzzleRankingValue = newPuzzleRanking;
  globalObject.puzzleRankingDifferenceValue = '('+icon+difference+')';
}

var resetValuesInTemplateAfterChangingPosition = function () {
    globalObject.playerRankingDifferenceValue = null;
    globalObject.puzzleRankingDifferenceValue= null;
    //globalObject.puzzleRankingValue = '?';
}

var hideProgressInfo = function () {
    //globalObject.progressInformation.html('');
}

var disableShowSolutionButton = function () {
    globalObject.showSolutionFlag = false;
}

updateStatus();

var cfg = {
    draggable: true,
    orientation: 'white',
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd
};

var board = ChessBoard('board', cfg);

var savePuzzleRatingAxios = function(puzzleId, newPuzzleRating) {
  $.LoadingOverlay("show");  

  return axios.post(Routing.generate('api_set_position'), {
    puzzleId:puzzleId, 
    newPuzzleRating:newPuzzleRating
  })
  .then(response => {
          console.log(response);
      })
    .catch(error => console.log(error))
    .finally();
}

var saveUserRankingAxios = function(userId, newPlayerRating) {
  return axios.put(Routing.generate('api_put_user'), {
    userId:userId, 
    newPlayerRating:newPlayerRating
  })
  .then(response => {
          console.log(response);
      })
    .catch(error => console.log(error))
    .finally();
}

var saveStatisticsAxios = function(userId, newPlayerRating, puzzleId, newPuzzleRating, puzzleResult) {
  return axios.post(Routing.generate('api_send_statistic_to_queue'), {
    userId: userId, 
    newPlayerRating: newPlayerRating, 
    puzzleId: puzzleId, 
    newPuzzleRating: newPuzzleRating, 
    puzzleResult: puzzleResult
  })
  .then(response => {
          console.log(response);
      })
    .catch(error => console.log(error))
    .finally(
          $.LoadingOverlay("hide")
    );
}

//TODO convert to axios
$(document).on( "click", "#show_solution_button", function(event) {
    event.preventDefault();
    globalObject.game.load(globalObject.currentPosition);

    var nextMove = getNextMoveFromSolution(globalObject.solutionCopy);

    if (nextMove)
    {
        var movesNextMove = nextMove.split("-");
        var playerMove = makeMove(movesNextMove[0], movesNextMove[1]);

        var newFen = globalObject.game.fen();

        cfg.position = newFen;
        cfg.draggable = false;
        board = ChessBoard('board', cfg);
        globalObject.showSolutionFlag = false;
    }
});

var getRandomPosition = function() {
  $.LoadingOverlay("show");  

  axios
    .get(Routing.generate('api_get_random_position'))
    .then(response => {
          globalObject.currentPosition = response.data.fen;

          initNewPosition(response.data.fen);
          globalObject.solution = setSolutionArray(response.data.solution);
          globalObject.solutionCopy = setSolutionArray(response.data.solution);
          globalObject.puzzleRankingValue = parseFloat(response.data.puzzleRanking).toFixed(2);
          globalObject.puzzleActive = true;
          globalObject.puzzleId = response.data.puzzleId;

          resetValuesInTemplateAfterChangingPosition();
          updateStatus();
      })
    .catch(error => console.log(error))
    .finally($.LoadingOverlay("hide") );
}