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

  const rosterSheet = ss.getSheetByName('選手名簿');
  if (rosterSheet.getLastRow() < 2) {
      rosterSheet.getRange('A2:A4').setValues([['選手A'], ['選手B'], ['選手C']]);
  }
}

// --- Webアプリから呼び出されるバックエンド関数 ---

/**
 * ★★★ 高速化のための新しい関数 ★★★
 * プレーをバックグラウンドで記録するだけの軽量な関数。データを返さないため高速。
 */
function recordPlayInBackground(player, play, gameId) {
  if (!gameId) { return; }
  try {
    const ss = getSpreadsheet();
    const logSheet = ss.getSheetByName('スコア記録');
    logSheet.appendRow([new Date(), gameId, player, play]);
  } catch (e) {
    // エラーが発生してもUIは既に更新されているため、ここではログに残すだけ
    console.error('記録エラー: ' + e.message);
  }
}

/**
 * 新しい試合を作成します。
 */
function createNewGame(gameName) {
  if (!gameName) { return { status: 'error', message: '試合名を入力してください。' }; }
  const ss = getSpreadsheet();
  const gameSheet = ss.getSheetByName('試合一覧');
  const newGameId = 'G' + new Date().getTime();
  gameSheet.appendRow([newGameId, gameName, new Date()]);
  return { status: 'success', newGame: { id: newGameId, name: gameName }};
}

/**
 * 登録されている全ての試合リストを取得します。
 */
function getGames() {
  const ss = getSpreadsheet();
  const gameSheet = ss.getSheetByName('試合一覧');
  if (gameSheet.getLastRow() < 2) return [];
  const gameData = gameSheet.getRange(2, 1, gameSheet.getLastRow() - 1, 2).getValues();
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
 * 指定された試合IDに基づいて、個人スタッツと合計点を計算して返します。
 * (この関数は試合を読み込む最初の1回だけ使われます)
 */
function getStatsAndScore(gameId) {
  if (!gameId) {
    return { headers: [], stats: [], totalScore: 0 };
  }

  const ss = getSpreadsheet();
  const logSheet = ss.getSheetByName('スコア記録');
  
  const headers = ['選手名', 'PTS', 'FGM', 'FGA', '3PM', '3PA', 'FTM', 'FTA'];
  if (logSheet.getLastRow() < 2) {
    return { headers: headers, stats: [], totalScore: 0 };
  }

  const logs = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 4).getValues();
  const gameLogs = logs.filter(row => row[1] === gameId);

  const playerStats = {};

  gameLogs.forEach(row => {
    const player = row[2];
    const play = row[3];

    if (!playerStats[player]) {
      playerStats[player] = { PTS: 0, FGM: 0, FGA: 0, '3PM': 0, '3PA': 0, FTM: 0, FTA: 0 };
    }
    const stats = playerStats[player];

    switch (play) {
      case '2P成功': stats.PTS += 2; stats.FGM++; stats.FGA++; break;
      case '2P失敗': stats.FGA++; break;
      case '3P成功': stats.PTS += 3; stats.FGM++; stats.FGA++; stats['3PM']++; stats['3PA']++; break;
      case '3P失敗': stats.FGA++; stats['3PA']++; break;
      case 'FT成功': stats.PTS += 1; stats.FTM++; stats.FTA++; break;
      case 'FT失敗': stats.FTA++; break;
    }
  });

  let totalScore = 0;
  const statsArray = Object.keys(playerStats).map(player => {
    const p = playerStats[player];
    totalScore += p.PTS;
    return [player, p.PTS, p.FGM, p.FGA, p['3PM'], p['3PA'], p.FTM, p.FTA];
  });
  
  return { headers: headers, stats: statsArray, totalScore: totalScore };
}
