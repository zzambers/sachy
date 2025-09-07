"use strict";

// State

function State() {
    this.prevState = null;
    this.board = null;
    this.player = 0;
    this.nextState = null;
}
function StateProto() {
    this.isEqual = isEqual;
    this.getDerivedState = getDerivedState;
    this.getOponentState = getOponentState;
    this.getBoardValue = getBoardValue;
    this.isLastState = isLastState;
    this.getKind = getKind;
    this.getPlayer = getPlayer;
    this.getTag = getTag;
}


function createInitialState() {
    var board = [
        2,3,4,5,6,4,3,2,
        1,1,1,1,1,1,1,1,
        0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,
        1,1,1,1,1,1,1,1,
        2,3,4,5,6,4,3,2
    ];
    for (var i = 0; i < 64; ++i) {
        var val = board[i];
        if (val === 2 || val === 6) {
            board[i] |= 1 << 4; // tags for castling rights
        }
    }
    for (var i = 48; i < 64; ++i) {
        board[i] |= 1 << 3; // black color player
    }
    var state = new State();
    state.board = board;
    state.player = 0; // white
    return state;
}

function isEqual(state) {
    if (this.player != state.player) {
        return 0;
    }
    for (var i = 0; i < this.board.length; ++i) {
        if (this.board[i] != state.board[i]) {
            return 0;
        }
    }
    return 1;
}

function getDerivedState(c1, r1, c2, r2, extra) {
    var player = (this.player + 1) & 1;
    var board = this.board.slice();
    var idx1 = r1 * 8 + c1;
    var idx2 = r2 * 8 + c2;
    var valOrig = board[idx1];
    var val = valOrig & 15;  // clear tags (catling rights)
    if (extra) {
        var kind = this.getKind(val);
        if (kind === 1) { // pawn
            if (c1 != c2 && !board[idx2] && this.getTag(board[r1 * 8 + c2])) {
                board[r1 * 8 + c2] = 0;  // en-passant take
            }
            if (Math.abs(r2 - r1) > 1) {
                val |= 1 << 4; // tag long move
            }
            if (this.player ? r2 === 0 : r2 === 7) {
                val = extra | this.player << 3; // promotion
            }
        } else if (kind === 6 && this.getTag(valOrig)) { // king
            // castling...
            if (c2 === 2) { // long castle
                var rockval = board[r2 * 8];
                board[r2 * 8] = 0;
                board[r2 * 8 + 3] = rockval & 15;
            } else if (c2 === 6) { // short castle
                var rockval = board[r2 * 8 + 7];
                board[r2 * 8 + 7] = 0;
                board[r2 * 8 + 5] = rockval & 15;
            }
        }
    }
    board[idx1] = 0;
    board[idx2] = val;
    var taggedPawn = 1 | (player << 3) | (1 << 4);
    var base = (3 + player) << 3;
    for (var i = 0; i < 8; ++i) { // clear tags (long step pawns)
        if (board[base + i] === taggedPawn) {
            board[base + i] =  1 | (player << 3);
            break;
        }
    }
    var state = new State();
    state.prevState = this;
    state.player = player;
    state.board = board;
    return state;
}

function getOponentState() {  // same state, just oponent's turn
    return this.getDerivedState(0, 0, 0, 0, 0);
}

function getBoardValue(c, r) {
    if (c < 0 || c > 7 || r < 0 || r > 7) {
        throw "Invalid board coordinates!"; // should not happen.
    }
    return this.board[r * 8 + c];
}

function isLastState() {
    return !this.nextState;
}

function getKind(value) {
    return value & 7;
}

function getPlayer(value) {
    return (value >> 3) & 1;
}

function getTag(value) {
    // tag:  pawn - long move, king - cannot castle
    return (value >> 4) & 1;
}

State.prototype = new StateProto();


// MoveExporer

function MoveExporer() {
    this.state = null;
    this.skipKingTest = 0;
    this.column = 0;
    this.row = 0
    this.move = null;
}
function MoveExporerProto() {
    this.getBoardValue = getBoardValue;
    this.moveOrTakeSeq = moveOrTakeSeq;
    this.straightMoves = straightMoves;
    this.diagonalMoves = diagonalMoves;
    this.pawnMove = pawnMove;
    this.pawnAttack = pawnAttack;
    this.checkedMove = checkedMove;
    this.processField = processField;
    this.processBoard = processBoard;
    this.processMove = processMove;
    this.processMoveEx = processMoveEx;
    this.testKingOK = testKingOK;
}

function testKingOK(oponentState) {
    var openentExporer = new MoveExporer();
    openentExporer.state = oponentState;
    openentExporer.skipKingTest = 1;
    var kingOK = 1;
    openentExporer.move = function(c, r) {
        var state = this.state;
        var val = state.getBoardValue(c, r);
        if (val && state.getKind(val) === 6) { // king
            kingOK = 0;
        }
    }
    openentExporer.processBoard();
    return kingOK;
}

function processMoveEx(c, r, e) {
    if (this.skipKingTest) {
        this.move(c, r, e);
        return;
    }
    var state = this.state.getDerivedState(this.column, this.row, c, r, e);
    if (this.testKingOK(state)) {
        this.move(c, r, e);
    }
}

function processMove(c, r) {
    this.processMoveEx(c, r, 0);
}

function moveOrTakeSeq(c, r) {
    var state = this.state;
    var value = state.getBoardValue(c, r);
    if (value) { // non-empty field
        if (state.getPlayer(value) !== state.player) {
            this.processMove(c, r);
        }
        return true;
    }
    this.processMove(c, r);
    return false;
}

function straightMoves(column, row) {
    for (var c = column - 1; c >= 0; --c) {
        if (this.moveOrTakeSeq(c, row)) {
            break;
        }
    }
    for (var c = column + 1; c <= 7; ++c) {
        if (this.moveOrTakeSeq(c, row)) {
            break;
        }
    }
    for (var r = row - 1; r >= 0; --r) {
        if (this.moveOrTakeSeq(column, r)) {
            break;
        }
    }
    for (var r = row + 1; r <= 7; ++r) {
        if (this.moveOrTakeSeq(column, r)) {
            break;
        }
    }
}

function diagonalMoves(column, row) {
    for (var c = column, r = row; --c >= 0 && --r >= 0;) {
        if (this.moveOrTakeSeq(c, r)) {
            break;
        }
    }
    for (var c = column, r = row; ++c <= 7 && ++r <= 7;) {
        if (this.moveOrTakeSeq(c, r)) {
            break;
        }
    }
    for (var c = column, r = row; ++c <= 7 && --r >= 0;) {
        if (this.moveOrTakeSeq(c, r)) {
            break;
        }
    }
    for (var c = column, r = row; --c >= 0 && ++r <= 7;) {
        if (this.moveOrTakeSeq(c, r)) {
            break;
        }
    }
}

function pawnMove(c, r) {
    if (r == 0 || r == 7) { // promotion
        this.processMoveEx(c, r, 2); // rock
        this.processMoveEx(c, r, 3); // knight
        this.processMoveEx(c, r, 4); // bishop
        this.processMoveEx(c, r, 5); // queen
        return;
    }
    this.processMove(c, r);
}


function pawnAttack(c, r) {
    var state = this.state;
    var value = state.getBoardValue(c, r);
    if (value) {
        if (state.getPlayer(value) !== state.player) {
            this.pawnMove(c, r);
        }
        return;
    }
    var value = state.getBoardValue(c, this.row);
    if (value
        && state.getKind(value) == 1 // pawn
        && state.getPlayer(value) !== state.player
        && state.getTag(value)) {
        this.processMoveEx(c, r, 1); // en-passant
    }
}

function checkedMove(c, r) {
    if (c < 0 || c > 7 || r < 0 || r > 7) {
        return;
    }
    var state = this.state;
    var value = state.getBoardValue(c, r);
    if (!value || state.getPlayer(value) !== state.player) {
        this.processMove(c, r);
    }
}

function processField(column, row) {
    var state = this.state;
    var value = state.getBoardValue(column, row);
    if (!value) { // empty field
        return;
    }
    var player = state.getPlayer(value);
    if (player !== state.player) { // not current player
        return;
    }
    this.column = column;
    this.row = row;
    var kind = state.getKind(value);
    switch(kind) {
        case 1: // pawn
            var r = player ? row - 1 : row + 1;
            if (r < 0 || r > 7) {
                break; // pawn on last row!?
            }
            if (!state.getBoardValue(column, r)) { // empty
                this.pawnMove(column, r);
                if (player) {
                    if (row == 6 && !state.getBoardValue(column, 4)) {
                        this.processMoveEx(column, 4, 1); // long pawn move black
                    }
                } else {
                    if (row == 1 && !state.getBoardValue(column, 3)) {
                        this.processMoveEx(column, 3, 1); // long pawn move white
                    }
                }
            }
            if (column > 0) {
                this.pawnAttack(column - 1, r);
            }
            if (column < 7) {
                this.pawnAttack(column + 1, r);
            }
            break;
        case 2: // rock
            this.straightMoves(column, row);
            break;
        case 3: // knight
            this.checkedMove(column + 2, row + 1);
            this.checkedMove(column + 1, row + 2);
            this.checkedMove(column - 1, row + 2);
            this.checkedMove(column - 2, row + 1);
            this.checkedMove(column + 2, row - 1);
            this.checkedMove(column + 1, row - 2);
            this.checkedMove(column - 1, row - 2);
            this.checkedMove(column - 2, row - 1);
            break;
        case 4: // bishop
            this.diagonalMoves(column, row);
            break;
        case 5: // qeeen
            this.straightMoves(column, row);
            this.diagonalMoves(column, row);
            break;
        case 6: // king
            this.checkedMove(column + 1, row);
            this.checkedMove(column + 1, row + 1);
            this.checkedMove(column, row + 1);
            this.checkedMove(column - 1, row + 1);
            this.checkedMove(column - 1, row);
            this.checkedMove(column - 1, row - 1);
            this.checkedMove(column, row - 1);
            this.checkedMove(column + 1, row - 1);
            // castling
            if (state.getTag(value)) { // king has castling rights
                var rockVal = state.getBoardValue(0, row);
                if (state.getKind(rockVal) === 2 // rock is on expected square
                    && state.getTag(rockVal) // rock has castling rights
                    && !state.getBoardValue(1, row) // squares between are empty
                    && !state.getBoardValue(2, row)
                    && !state.getBoardValue(3, row)
                    && this.testKingOK(state.getDerivedState(column, row, column, row, 0)) // king not in check
                    && this.testKingOK(state.getDerivedState(column, row, column - 1, row, 0)) // in-between square is not under attack
                    ) {
                        this.processMoveEx(2, row, 6);
                }
                var rockVal = state.getBoardValue(7, row);
                if (state.getKind(rockVal) === 2 // rock is on expected square
                    && state.getTag(rockVal) // rock has castling rights
                    && !state.getBoardValue(5, row) // squares between are empty
                    && !state.getBoardValue(6, row)
                    && this.testKingOK(state.getDerivedState(column, row, column, row, 0)) // king not in check
                    && this.testKingOK(state.getDerivedState(column, row, column + 1, row, 0))  // in-between square is not under attack
                    ) {
                        this.processMoveEx(6, row, 6);
                }
            }
            break;
    }
}

function processBoard() {
    for (var r = 0; r < 8; ++r) {
        for (var c = 0; c < 8; ++c) {
            this.processField(c, r);
        }
    }
}

MoveExporer.prototype = new MoveExporerProto();


// Game

function Game() {
    this.curState = this.initialState;
    this.playerKinds = [0, 0];
    this.gameOver = 0;
    this.scores = [0, 0];
    // UI
    this.boardOrientation = 0;
    this.shownState = this.curState;
    this.selected = false;
    this.selRow = 0;
    this.selCol = 0;
    this.squareElems = null;
    this.rowLableElems = null;
    this.colLabeElems = null;
    this.infoE = null;
    this.evalCnt = 0;
    this.mateCnt = 0;
}
function GameProto() {
    this.processValidMoves = processValidMoves;
    this.testKingOK = testKingOK;
    this.isValidMove = isValidMove;
    this.getPlayer = getPlayer;
    this.createInitialState = createInitialState;
    this.prepareBoard = prepareBoard;
    this.prepareColLables = prepareColLables;
    this.prepareRowLable = prepareRowLable;
    this.prepareHistoryButtons = prepareHistoryButtons;
    this.getSquareElem = getSquareElem;
    this.removeElemChild = removeElemChild;
    this.updateBoard = updateBoard;
    this.setOnclickCallback = setOnclickCallback;
    this.clickedBoardSquare = clickedBoardSquare;
    this.makeMove = makeMove;
    this.replayMoves = replayMoves;
    this.getMovesStr = getMovesStr;
    this.runAiCallback = runAiCallback;
    this.evalState = evalState;
    this.evalStateForPlayer = evalStateForPlayer;
    this.aiMakeMove = aiMakeMove;
    this.checkGameOver = checkGameOver;
    this.scheduleEngine = scheduleEngine;
    this.start = start;
    this.initialState = createInitialState();
    this.setOption = setOption;
    this.piecesB = ["","♟","♜","♞","♝","♛","♚"];
    this.piecesW = ["","♙","♖","♘","♗","♕","♔"];
    this.colLabels = ["A","B","C","D","E","F","G","H"];
    this.rowLabels = ["1","2","3","4","5","6","7","8"];
    this.pieceValues = [0, 1, 5, 3, 3, 9, 1];
}

function processValidMoves(state, callback) {
    var explorer = new MoveExporer();
    explorer.state = state;
    explorer.move = callback;
    explorer.processBoard();
}

function isValidMove(state, c1, r1, c2, r2, ex) {
    var result = false;
    function callback(c, r, e) {
        if (this.column == c1 && this.row == r1 && c == c2 && r == r2) {
            if (!e || e <= 1 || e >= 6 || e == ex) {
                result = true;
            }
        }
    }
    processValidMoves(state, callback);
    return result;
}

function makeMove(c1, r1, c2, r2, e) {
    var origState = this.curState;
    this.curState = origState.getDerivedState(c1, r1, c2, r2, e);
    if (this.shownState === origState) {
        this.shownState = this.curState; // update shown state
    }
    origState.nextState = this.curState;
    this.checkGameOver();
}

function checkGameOver() {
    var moveCnt = 0;
    function callback1(c, r, e) {
        moveCnt++;
    }
    this.processValidMoves(this.curState, callback1);
    if (moveCnt == 0) {
        var state2 = this.curState.getOponentState();
        var stalemate = this.testKingOK(state2);
        if (stalemate) {
            this.scores[0] = 0.5;
            this.scores[1] = 0.5;
        } else {
            this.scores[state2.player] = 1.0;
        }
        this.gameOver = 1;
    }
}

function replayMoves(movesStr) {
    var moves = movesStr.split(".");
    for (var i = 0; i < moves.length; ++i) {
        var move = moves[i];
        var c1 = move.charCodeAt(0) - 97;
        var r1 = move.charCodeAt(1) - 49;
        var c2 = move.charCodeAt(2) - 97;
        var r2 = move.charCodeAt(3) - 49;
        var e = 5;
        if (move.length == 5) {
            var eStr = move.charAt(4);
            e = eStr == 'r' ? 2 :
                eStr == 'n' ? 3 :
                eStr == 'b' ? 4 : 5;
        }
        if (!this.isValidMove(this.curState, c1, r1, c2, r2, e)) {
            console.log("Invalid move: " + move);
            return;
        }
        this.makeMove(c1, r1, c2, r2, e);
    }
}

function getMovesStr() {
    var state = this.curState;
    var moves = "";
    while (state.prevState) {
        var prevState = state.prevState;
        var move;
        function callback(c, r, e) {
            var state2 = this.state.getDerivedState(this.column, this.row, c, r, e);
            if (state.isEqual(state2)) {
                //console.log("c1 " + this.column + " r1 " + this.row + " c2 " + c + " r2 " + r);
                move = String.fromCharCode(this.column + 97, this.row + 49, c + 97, r + 49);
                if (e && e > 1 && e < 6) {
                    move += e == 2 ? "r" :
                            e == 3 ? "n" :
                            e == 4 ? "b" : "q";
                }
            }
        }
        this.processValidMoves(prevState, callback);
        moves = moves == "" ? move : move + "." + moves;
        state = prevState;
    }
    return moves;
}

// AI

function evalStateForPlayer(state, player) {
    var board = state.board;
    var score = 0;
    for (var i = 0; i < 64; ++i) {
        var val = board[i];
        if (val && state.getPlayer(val) == player) {
            score += this.pieceValues[state.getKind(val)];
        }
    }
    return score;
}

function evalState(state) {
    this.evalCnt++;
    if (this.playerKinds[this.curState.player] == 2) {
        return 0; // just random moves
    }
    var moveCnt = 0;
    function callback(c, r, e) {
        moveCnt++;
    }
    this.processValidMoves(state, callback);
    if (moveCnt == 0) {
        this.mateCnt++;
        return this.testKingOK(state.getOponentState()) ? 0 /* stalemate */ :
            state.player ? 1 : -1;
    }
    var white = this.evalStateForPlayer(state, 0);
    var black = this.evalStateForPlayer(state, 1);
    return -1 + 2 * white / (white + black); // normalize to range -1 .. 1
}

function runAiCallback(state, depthLim, movesDst) {
    if (depthLim <= 0) {
        return this.evalState(state); // eval state
    }
    var game = this;
    var max = state.player == 0;
    var score = max ? -1 : 1;
    var moveCnt = 0;
    function callback(c, r, e) {
        var newState = state.getDerivedState(this.column, this.row, c, r, e);
        var newScore = game.runAiCallback(newState, depthLim - 1, null);
        if (max ? newScore > score : newScore < score) {
            score = newScore;
            if (movesDst) {
                movesDst.splice(0);
            }
        }
        if (movesDst && newScore === score) {
            movesDst.push(this.column);
            movesDst.push(this.row);
            movesDst.push(c);
            movesDst.push(r);
            movesDst.push(e);
        }
        moveCnt++;
    }
    this.processValidMoves(state, callback);
    if (!moveCnt) { // game over
        return this.evalState(state); // eval state
    }
    return score;
}

function aiMakeMove() {
    this.evalCnt = 0;
    this.mateCnt = 0;
    var moves = [];
    var depth = this.playerKinds[this.curState.player] == 2 ? 1 : 2;
    var score = this.runAiCallback(this.curState, depth, moves);
    console.log("score: " + score);
    var moveCount = moves.length / 5;
    var randomIndex = Math.floor(Math.random() * moveCount);
    console.log("moves: " + moveCount + ", chosen: " + randomIndex);
    var movesBase = randomIndex * 5;
    this.makeMove(moves[movesBase], moves[movesBase + 1], moves[movesBase + 2], moves[movesBase + 3], moves[movesBase + 4]);
    this.scheduleEngine();
    this.updateBoard();
    console.log("evalCnt: " + this.evalCnt + " mateCnt: " + this.mateCnt);
}

function scheduleEngine() {
    if (this.playerKinds[this.curState.player] != 0 && !this.gameOver) {
        var game = this;
        function callback() {
            game.aiMakeMove();
        }
        setTimeout(callback, 500);
    }
}

// UI

function setOnclickCallback(element, col, row) {
    var game = this;
    element.onclick = function () {
        game.clickedBoardSquare(col, row);
    }
}

function prepareColLables(tableE, array) {
    var rowE = document.createElement("tr");
    tableE.appendChild(rowE);
    for(var col = 0; col < 10; ++col) {
        var labE = document.createElement("th"); // column label
        rowE.appendChild(labE);
        if (col > 0 && col < 9) {
            array.push(labE);
        }
    }
}

function prepareRowLable(rowE, array) {
    var labE = document.createElement("th"); // row label
    rowE.appendChild(labE);
    array.push(labE);
}

function prepareBoard() {
    var squareElems = [];
    var columnLabels = [];
    var rowLables = [];
    var divE = document.getElementById("board");
    var tableE = document.createElement("table");
    tableE.setAttribute("class", "chess-table");
    divE.appendChild(tableE);
    this.prepareColLables(tableE, columnLabels);
    for (var row = 0; row < 8; ++row) {
        var rowE = document.createElement("tr");
        tableE.appendChild(rowE);
        this.prepareRowLable(rowE, rowLables);
        for (var col = 0; col < 8; ++col) {
            var colE = document.createElement("td");
            this.setOnclickCallback(colE, col, row);
            rowE.appendChild(colE);
            squareElems.push(colE);
        }
        this.prepareRowLable(rowE, rowLables);
    }
    this.prepareColLables(tableE, columnLabels);
    this.squareElems = squareElems;
    this.infoE = document.getElementById("game-info-text");
    this.rowLableElems = rowLables;
    this.colLabeElems = columnLabels;

}

function prepareHistoryButtons() {
    var game = this;
    var divE = document.getElementById("history");
    function createHistoryButton(name) {
        var button = document.createElement("button");
        var content = document.createTextNode(name);
        button.appendChild(content);
        divE.appendChild(button);
        return button;
    }
    var fisrtB = createHistoryButton("|<");
    fisrtB.onclick = function () {
        while (game.shownState.prevState) {
            game.shownState = game.shownState.prevState;
        }
        game.updateBoard();
    }
    var prevB = createHistoryButton("<");
    prevB.onclick = function () {
        if (game.shownState.prevState) {
            game.shownState = game.shownState.prevState;
            game.updateBoard();
        }
    }
    var nextB = createHistoryButton(">");
    nextB.onclick = function () {
        if (game.shownState.nextState) {
            game.shownState = game.shownState.nextState;
            game.updateBoard();
        }
    }
    var lastB = createHistoryButton(">|");
    lastB.onclick = function () {
        while (game.shownState.nextState) {
            game.shownState = game.shownState.nextState;
        }
        game.updateBoard();
    }
    var br = document.createElement("br");
    divE.appendChild(br);
    var saveB = createHistoryButton("save");
    saveB.onclick = function () {
        window.location.search = "white=" + game.playerKinds[0] + "&black=" + game.playerKinds[1] + "&moves=" + game.getMovesStr();
    }
}

function getSquareElem(col, row) {
    var index = this.boardOrientation ? row * 8 + (7 - col) : (7 - row)*8+col;
    return this.squareElems[index];
}

function removeElemChild(elem) {
    if (elem.firstChild) {
        elem.removeChild(elem.firstChild);
    }
}

function updateBoard() {
    for (var col = 0; col < 16; ++col) {
        var labE = this.colLabeElems[col];
        this.removeElemChild(labE);
        var index = this.boardOrientation ? (15 - col) % 8 : col % 8;
        labE.appendChild(document.createTextNode(this.colLabels[index]));
    }
    for (var row = 0; row < 16; ++row) {
        var labE = this.rowLableElems[row];
        this.removeElemChild(labE);
        var index = this.boardOrientation ? row >> 1 : 7 - (row >> 1);
        labE.appendChild(document.createTextNode(this.rowLabels[index]));
    }
    var kingAttacked = 0;
    var shownState = this.shownState;
    for (var row = 0; row < 8; ++row) {
        for (var col = 0; col < 8; ++col) {
            var squareE = this.getSquareElem(col, row);
            this.removeElemChild(squareE);
            squareE.removeAttribute("class");
            var piece = shownState.getBoardValue(col, row)
            if (piece) {
                var player = shownState.getPlayer(piece);
                var kind = shownState.getKind(piece);
                var pieceChar = player ? this.piecesB[kind] : this.piecesW[kind];
                if (shownState.isLastState() && player === shownState.player && this.playerKinds[player] == 0 && !this.gameOver) {
                    squareE.setAttribute("class", "selectable-square");
                }
                var spanE = document.createElement("span");
                squareE.appendChild(spanE);
                if (kind === 6 && player === shownState.player  // king of current player
                    && !this.testKingOK(shownState.getOponentState())) {
                    spanE.setAttribute("class", "checked-king");
                }
                var txtE = document.createTextNode(pieceChar);
                spanE.appendChild(txtE);
            }
        }
    }
    if (shownState.isLastState() && this.selected) {
        this.getSquareElem(this.selCol, this.selRow).setAttribute("class", "selected-square");
        var game = this;
        var col = this.selCol;
        var row = this.selRow;
        function callback2(c, r, e) {
            if (this.row == row && this.column == col) {
                game.getSquareElem(c, r).setAttribute("class", "move-square");
            }
        }
        this.processValidMoves(this.curState, callback2);
    }
    this.removeElemChild(this.infoE);
    var infoText;
    if (this.gameOver) {
        infoText = "GAME OVER! Result (white-black): " + this.scores[0] + "-" + this.scores[1];
    } else {
        infoText = kingAttacked ? "CHECK! " : "";
        infoText += (this.curState.player ? "Black's" : "White's") + " move.";
    }
    this.infoE.appendChild(document.createTextNode(infoText));
}

function clickedBoardSquare(col, row) {
    var state = this.curState;
    var player = state.player;
    if (this.playerKinds[player] == 0  // human player
        && this.shownState.isLastState() && !this.gameOver) {
        col = this.boardOrientation ? 7 - col : col;
        row = this.boardOrientation ? row : 7 - row;
        var val = state.getBoardValue(col, row);
        if (val && this.getPlayer(val) == player) {
            this.selRow = row;
            this.selCol = col;
            this.selected = true
        } else {
            if (this.selected && this.isValidMove(this.curState, this.selCol, this.selRow, col, row, 5)) {
                this.makeMove(this.selCol, this.selRow, col, row, 5); // currently always promote to qeen
                this.scheduleEngine();
            }
            this.selected = false
        }
        this.updateBoard();
    }
}

function setOption(name,value) {
    switch (name) {
        case "white":
        case "black":
            this.playerKinds[name == "white" ? 0 : 1] = value | 0;
            document.getElementById(name).value = value;
            break;
        case "moves":
            this.replayMoves(value);
            break;
        default: console.log("Unknown name: " + name);
    }
}


function start() {
    this.boardOrientation = this.playerKinds[0] && !this.playerKinds[1];
    this.prepareBoard();
    this.prepareHistoryButtons();
    this.updateBoard();
    this.scheduleEngine();
}

Game.prototype = new GameProto();


function startGame() {
    var queryString = window.location.search;
    if (queryString) {
        var game = new Game();
        document.getElementById("new-game-toggle").checked = true;
        var params = queryString.slice(1).split("&");
        for (var i = 0; i < params.length; ++i) {
            var name = params[i].split("=", 1)[0];
            var val = params[i].slice(name.length + 1);
            game.setOption(name,val);
        }
        game.start();
    }
}
