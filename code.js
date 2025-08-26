// スプレッドシートのIDをスクリプトのプロパティに保存
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

/**
 * Webアプリのメインページを表示します。
 */
function doGet() {
  setupSpreadsheetsIfNeeded(); // 最初にシート構造を確認・作成
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
 * 必要なシートが存在するか確認し、なければ作成します。
 */
function setupSpreadsheetsIfNeeded() {
  const ss = getSpreadsheet();
  const sheetsInfo = {
    '選手名簿': ['選手名'],
    '試合一覧': ['試合ID', '試合名', '作成日時'],
    'スコア記録': ['タイムスタンプ', '試合ID', '選手名', 'プレー']
  };

  for (const sheetName in sheetsInfo) {
    if (!ss.getSheetByName(sheetName)) {
      const sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, sheetsInfo[sheetName].length).setValues([sheetsInfo[sheetName]]);
    }
  }

  // 選手名簿にサンプルデータを入力
  const rosterSheet = ss.getSheetByName('選手名簿');
  if (rosterSheet.getLastRow() < 2) {
      rosterSheet.getRange('A2:A4').setValues([['選手A'], ['選手B'], ['選手C']]);
  }
}

// --- Webアプリから呼び出されるバックエンド関数 ---

/**
 * 新しい試合を作成します。
 */
function createNewGame(gameName) {
  if (!gameName) {
    return { status: 'error', message: '試合名を入力してください。' };
  }
  const ss = getSpreadsheet();
  const gameSheet = ss.getSheetByName('試合一覧');
  const newGameId = 'G' + new Date().getTime(); // ユニークな試合IDを生成
  gameSheet.appendRow([newGameId, gameName, new Date()]);
  return { status: 'success', newGame: { id: newGameId, name: gameName }};
}

/**
 * 登録されている全ての試合リストを取得します。
 */
function getGames() {
  const ss = getSpreadsheet();
  const gameSheet = ss.getSheetByName('試合一覧');
  if (gameSheet.getLastRow() < 2) {
    return [];
  }
  const gameData = gameSheet.getRange(2, 1, gameSheet.getLastRow() - 1, 2).getValues();
  // [[id1, name1], [id2, name2]] の形式で返す
  return gameData.map(row => ({ id: row[0], name: row[1] }));
}

/**
 * 選手名簿を取得します。
 */
function getPlayers() {
  const ss = getSpreadsheet();
  const rosterSheet = ss.getSheetByName('選手名簿');
  if (!rosterSheet || rosterSheet.getLastRow() < 2) return [];
  return rosterSheet.getRange(2, 1, rosterSheet.getLastRow() - 1, 1).getValues().flat();
}

/**
 * プレーを記録します。試合IDも一緒に保存します。
 */
function recordPlay(player, play, gameId) {
  if (!gameId) {
    return { status: 'error', message: '記録する試合を選択してください。' };
  }
  const ss = getSpreadsheet();
  const logSheet = ss.getSheetByName('スコア記録');
  logSheet.appendRow([new Date(), gameId, player, play]);
  return { status: 'success', message: `${player}の${play}を記録しました。` };
}

/**
 * 指定された試合IDに基づいて、個人スタッツと合計点を計算して返します。
 */
function getStatsAndScore(gameId) {
  if (!gameId) {
    return { headers: [], stats: [], totalScore: 0 };
  }

  const ss = getSpreadsheet();
  const logSheet = ss.getSheetByName('スコア記録');
  
  // 記録がない場合はここで処理を終了
  if (logSheet.getLastRow() < 2) {
    return { headers: ['選手名', 'PTS', 'FGM', 'FGA', '3PM', '3PA', 'FTM', 'FTA'], stats: [], totalScore: 0 };
  }

  const logs = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 4).getValues();
  const gameLogs = logs.filter(row => row[1] === gameId); // 対象の試合のログだけを抽出

  const playerStats = {};

  // 抽出したログを元にスタッツを計算
  gameLogs.forEach(row => {
    const player = row[2];
    const play = row[3];

    // statsオブジェクトに選手が存在しなければ初期化
    if (!playerStats[player]) {
      playerStats[player] = { PTS: 0, FGM: 0, FGA: 0, '3PM': 0, '3PA': 0, FTM: 0, FTA: 0 };
    }
    const stats = playerStats[player];

    switch (play) {
      case '2P成功':
        stats.PTS += 2;
        stats.FGM++;
        stats.FGA++;
        break;
      case '2P失敗':
        stats.FGA++;
        break;
      case '3P成功':
        stats.PTS += 3;
        stats.FGM++;
        stats.FGA++;
        stats['3PM']++;
        stats['3PA']++;
        break;
      case '3P失敗':
        stats.FGA++;
        stats['3PA']++;
        break;
      case 'FT成功':
        stats.PTS += 1;
        stats.FTM++;
        stats.FTA++;
        break;
      case 'FT失敗':
        stats.FTA++;
        break;
    }
  });

  const headers = ['選手名', 'PTS', 'FGM', 'FGA', '3PM', '3PA', 'FTM', 'FTA'];
  let totalScore = 0;

  // 計算結果をテーブル表示用の配列形式に変換
  const statsArray = Object.keys(playerStats).map(player => {
    const p = playerStats[player];
    totalScore += p.PTS;
    return [player, p.PTS, p.FGM, p.FGA, p['3PM'], p['3PA'], p.FTM, p.FTA];
  });
  
  return { headers: headers, stats: statsArray, totalScore: totalScore };
}
