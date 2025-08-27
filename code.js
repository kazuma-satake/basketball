// スプレッドシートのIDをスクリプトのプロパティに保存
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

/**
 * Webアプリのメインページを表示します。
 */
function doGet() {
  setupSpreadsheetsIfNeeded();
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('バスケ スコアブック')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * IDを使ってスプレッドシートオブジェクトを取得する共通関数
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * ★★★ フロントエンドから呼び出される唯一の関数 ★★★
 * この関数が、要求された関数名を元に、適切な処理を呼び出します。
 */
function callServerFunction(functionName, ...args) {
  const functions = {
    getPlayers,
    getGames,
    getInitialGameData,
    recordPlay,
    deletePlay,
    createNewGame
  };

  if (functions[functionName]) {
    try {
      return functions[functionName](...args);
    } catch (e) {
      // フロントエンドにエラー内容を伝える
      throw new Error(`サーバーエラー (${functionName}): ${e.message}`);
    }
  } else {
    throw new Error(`'${functionName}' という名前のサーバー関数は見つかりませんでした。`);
  }
}


// --- ここから下は callServerFunction から呼び出される内部的な関数 ---

/**
 * 必要なシートが存在するか確認し、なければ作成します。
 */
function setupSpreadsheetsIfNeeded() {
  const ss = getSpreadsheet();
  const sheetsInfo = {
    '選手名簿': ['背番号', '選手名'], // ★修正点: 背番号の列を追加
    '試合一覧': ['試合ID', '試合名', '作成日時'],
  };

  for (const sheetName in sheetsInfo) {
    if (!ss.getSheetByName(sheetName)) {
      const sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, sheetsInfo[sheetName].length).setValues([sheetsInfo[sheetName]]);
    }
  }

  const rosterSheet = ss.getSheetByName('選手名簿');
  if (rosterSheet.getLastRow() < 2) {
      // 初期データに背番号を追加
      rosterSheet.getRange('A2:B4').setValues([
        [4, '選手A'], 
        [5, '選手B'], 
        [6, '選手C']
      ]);
  }
}

/**
 * ★★★ 改良点 ★★★
 * 背番号と選手名の両方を取得し、加工して返します。
 */
function getPlayers() {
  const ss = getSpreadsheet();
  const rosterSheet = ss.getSheetByName('選手名簿');
  if (!rosterSheet || rosterSheet.getLastRow() < 2) return [];
  // A列(背番号)とB列(選手名)を取得
  const playerInfo = rosterSheet.getRange(2, 1, rosterSheet.getLastRow() - 1, 2).getValues();
  return playerInfo.map(row => ({
    number: row[0],
    name: row[1],
    display: `${row[0]} ${row[1]}` // ドロップダウン表示用の文字列
  }));
}

function getGames() {
  const ss = getSpreadsheet();
  const gameSheet = ss.getSheetByName('試合一覧');
  if (gameSheet.getLastRow() < 2) return [];
  const gameData = gameSheet.getRange(2, 1, gameSheet.getLastRow() - 1, 2).getValues();
  return gameData.map(row => ({ id: row[0], name: row[1] })).reverse();
}

function createNewGame(gameName) {
  if (!gameName) { throw new Error('試合名を入力してください。'); }
  const ss = getSpreadsheet();
  const gameSheet = ss.getSheetByName('試合一覧');
  const newGameId = 'G' + new Date().getTime();
  
  gameSheet.appendRow([newGameId, gameName, new Date()]);

  const newSheet = ss.insertSheet(`Game_${newGameId}`);
  // ヘッダー行に背番号を追加
  newSheet.getRange('A1:E1').setValues([['タイムスタンプ', '背番号', '選手名', 'プレー', 'プレーID']]); // ★修正点: 背番号の列を追加
  
  return { id: newGameId, name: gameName };
}

/**
 * ★★★ 改良点 ★★★
 * 試合ログシートの列の順番を背番号に合わせて調整
 */
function getInitialGameData(gameId) {
  const ss = getSpreadsheet();
  const gameLogSheet = ss.getSheetByName(`Game_${gameId}`);

  if (!gameLogSheet || gameLogSheet.getLastRow() < 2) {
    return { plays: [] };
  }
  
  // タイムスタンプ, 背番号, 選手名, プレー, プレーID の5列を読み込む
  const gameLogs = gameLogSheet.getRange(2, 1, gameLogSheet.getLastRow() - 1, 5).getValues(); // ★修正点: 5列を読み込む
  
  const plays = gameLogs.map(row => ({
    // 順番: A列がタイムスタンプ, B列が背番号, C列が選手名, D列がプレー, E列がプレーID
    playerNumber: row[1], // ★修正点: 背番号
    playerName: row[2],   // ★修正点: 選手名
    play: row[3],
    id: row[4] 
  }));

  return { plays: plays };
}

/**
 * ★★★ 改良点 ★★★
 * プレー記録時に背番号も保存するように変更
 */
function recordPlay(playerDisplay, play, gameId) {
  const ss = getSpreadsheet();
  const gameLogSheet = ss.getSheetByName(`Game_${gameId}`);
  if (!gameLogSheet) {
    throw new Error(`試合ID '${gameId}' の記録シートが見つかりません。`);
  }

  const [playerNumber, playerName] = playerDisplay.split(' ', 2); // "背番号 名前" から分離
  const playId = 'P' + new Date().getTime();
  // 記録する列: タイムスタンプ, 背番号, 選手名, プレー, プレーID
  gameLogSheet.appendRow([new Date(), playerNumber, playerName, play, playId]); // ★修正点: 背番号と選手名を分ける
  
  return { playerNumber, playerName, play, id: playId }; // 記録したプレー情報を返す
}

/**
 * ★★★ 改良点 ★★★
 * 試合専用シートから指定されたプレーIDの行を削除します。
 * プレーIDはE列にある
 */
function deletePlay(playId, gameId) {
  if (!playId) { throw new Error('プレーIDが指定されていません。');}
  const ss = getSpreadsheet();
  const gameLogSheet = ss.getSheetByName(`Game_${gameId}`);
  if (!gameLogSheet || gameLogSheet.getLastRow() < 2) return;

  // プレーIDはE列にある (インデックス4)
  const playIdColumnValues = gameLogSheet.getRange(2, 5, gameLogSheet.getLastRow() - 1, 1).getValues(); // ★修正点: E列を読み込む
  
  for (let i = playIdColumnValues.length - 1; i >= 0; i--) {
    if (String(playIdColumnValues[i][0]).trim() === String(playId).trim()) {
      gameLogSheet.deleteRow(i + 2);
      return;
    }
  }
}
